import React, { useEffect, useMemo, useState } from 'react';
import { db, isFirebaseConfigured } from '../firebaseClient';

/** Firestore 文件型別（後台維護） */
interface AdData {
  image_url?: string;       // 主圖（建議 1200–1600px、<300KB、WebP/AVIF）
  thumb_url?: string;       // 低清縮圖（400–600px、<50KB），可選
  click_url?: string;       // 點擊前往
  headline?: string;        // 文案（卡片下方顯示）
  cta_text?: string;        // CTA（右下膠囊），預設「了解更多」
  active?: boolean;
  start_at?: number;        // UNIX 秒
  end_at?: number;          // UNIX 秒
  allowed_hosts?: string[]; // 允許網域（純網域，不含 http/https）
}

/** 元件 props */
export interface AdSlotProps {
  docPath?: string;               // Firestore 路徑（預設 'ads/current'）
  className?: string;             // 外層樣式
  allowedHostnames?: string[];    // 備用白名單（後台沒給 allowed_hosts 時使用）
  trackingHrefOverride?: (url: string) => string | undefined; // 可覆寫 click_url（短鏈/UTM）
  onLoadStateChange?: (s: LoadState) => void;                 // 載入狀態回呼
  requireHttps?: boolean;         // 預設 true：只允許 https
  compact?: boolean;              // 緊湊樣式
  cacheTTL?: number;              // 本地快取秒數，預設 6 小時
}

type LoadState = 'idle' | 'loading' | 'ready' | 'placeholder' | 'error';

/** 工具：時間窗 */
const withinWindow = (ad: AdData, nowSec = Math.floor(Date.now() / 1000)) => {
  const start = ad.start_at ?? -Infinity;
  const end = ad.end_at ?? Infinity;
  return nowSec >= start && nowSec <= end;
};

/** 工具：白名單 */
const isHostnameAllowed = (url: string, allowed: string[]) => {
  if (!url) return false;
  if (!allowed || allowed.length === 0) return true; // 無白名單 → 不限制
  try {
    const host = new URL(url).hostname.toLowerCase();
    return allowed.some(a => {
      const norm = a.trim().toLowerCase();
      return host === norm || host.endsWith(`.${norm}`);
    });
  } catch {
    return false;
  }
};

/** 工具：本地快取 */
const KC_PREFIX = 'adslot_cache:';
const readCache = (key: string, ttlMs: number): AdData | null => {
  try {
    const raw = localStorage.getItem(KC_PREFIX + key);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > ttlMs) return null;
    return data as AdData;
  } catch { return null; }
};
const writeCache = (key: string, data: AdData) => {
  try { localStorage.setItem(KC_PREFIX + key, JSON.stringify({ ts: Date.now(), data })); } catch {}
};

/** 卡片容器（帶互動態） */
const Card: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ className = '', children }) => (
  <div
    className={[
      'rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800',
      'shadow-sm overflow-hidden transition-transform duration-300',
      'hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0',
      className,
    ].join(' ')}
  >
    {children}
  </div>
);

const AdSlot: React.FC<AdSlotProps> = ({
  docPath = 'ads/current',
  className = '',
  allowedHostnames = [],
  trackingHrefOverride,
  onLoadStateChange,
  requireHttps = true,
  compact = false,
  cacheTTL = 60 * 60 * 6, // 6 小時
}) => {
  const [ad, setAd] = useState<AdData | null>(null);
  const [state, setState] = useState<LoadState>('idle');
  const [imgLoaded, setImgLoaded] = useState(false);

  useEffect(() => { onLoadStateChange?.(state); }, [state, onLoadStateChange]);

  // 先用本地快取即時顯示（SWR）
  useEffect(() => {
    const cached = readCache(docPath, cacheTTL * 1000);
    if (cached) {
      setAd(cached);
      setState('loading'); // 先顯示，待主圖 onLoad → ready
    }
  }, [docPath, cacheTTL]);

  // 讀取 Firestore（背景刷新）
  useEffect(() => {
    let cancelled = false;
    const done = (s: LoadState) => !cancelled && setState(s);

    if (!isFirebaseConfigured || !db) {
      done('placeholder');
      return () => { cancelled = true; };
    }

    (async () => {
      // 若沒有快取才顯示 loading 狀態骨架；有快取就靜默刷新
      if (!ad) done('loading');

      try {
        const snap = await db.doc(docPath).get();
        if (!snap.exists) return done(ad ? 'loading' : 'placeholder');

        const data = (snap.data() as AdData) ?? {};
        writeCache(docPath, data);
        if (cancelled) return;

        setAd(data);

        const active = data.active === true;
        const inWindow = withinWindow(data);
        const hasImg = !!data.image_url;
        if (active && inWindow && hasImg) {
          done('loading'); // 等 <img> onLoad → ready
        } else {
          done(ad ? 'loading' : 'placeholder');
        }
      } catch (e) {
        console.error('[AdSlot] Firestore error:', e);
        done(ad ? 'loading' : 'error');
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docPath]); // 刻意不把 ad 當依賴，避免循環

  // 後台優先的白名單
  const effectiveHosts = useMemo(() => {
    const src = (ad as any)?.allowed_hosts;
    let fromBackend: string[] = [];
    if (Array.isArray(src)) fromBackend = src.filter(Boolean).map((s: string) => s.trim());
    else if (typeof src === 'string' && src.trim()) fromBackend = [src.trim()];
    return fromBackend.length > 0 ? fromBackend : (allowedHostnames || []);
  }, [ad?.allowed_hosts, allowedHostnames]);

  // 最終 click 連結（驗證 + 可覆寫）
  const finalHref = useMemo(() => {
    const raw = ad?.click_url?.trim();
    if (!raw) return undefined;
    let url: URL;
    try { url = new URL(raw); } catch { return undefined; }
    if (requireHttps && url.protocol !== 'https:') return undefined;
    return trackingHrefOverride?.(url.href) ?? url.href;
  }, [ad?.click_url, trackingHrefOverride, requireHttps]);

  const clickable = useMemo(() => {
    if (!finalHref) return false;
    return isHostnameAllowed(finalHref, effectiveHosts);
  }, [finalHref, effectiveHosts]);

  const Wrapper: any = clickable ? 'a' : 'div';
  const wrapperProps = clickable ? { href: finalHref, target: '_blank', rel: 'noopener noreferrer' } : {};

  const aspect = 'aspect-[2/1]';
  const cardPad = compact ? 'p-2' : 'p-3';
  const ctaText = ad?.cta_text?.trim() || '了解更多';

  // 主圖/縮圖 URL（避免同 URL 造成浪費）
  const mainSrc = ad?.image_url?.trim() || '';
  const thumbSrc =
    ad?.thumb_url && ad.thumb_url.trim() && ad.thumb_url.trim() !== mainSrc
      ? ad.thumb_url.trim()
      : undefined;

  // ✨ 自動 preconnect Firestore 與圖床，降低握手延遲
  useEffect(() => {
    const links: HTMLLinkElement[] = [];
    const add = (href: string) => {
      try {
        const l = document.createElement('link');
        l.rel = 'preconnect';
        l.href = href;
        l.crossOrigin = 'anonymous';
        document.head.appendChild(l);
        links.push(l);
      } catch {}
    };
    add('https://firestore.googleapis.com');
    try { if (mainSrc) { const u = new URL(mainSrc); add(`${u.protocol}//${u.hostname}`); } } catch {}
    try { if (thumbSrc) { const u = new URL(thumbSrc); add(`${u.protocol}//${u.hostname}`); } } catch {}
    return () => { links.forEach(l => l.remove()); };
  }, [mainSrc, thumbSrc]);

  // ====== 無資料/錯誤 → placeholder ======
  if (state === 'idle' || state === 'error' || !ad || state === 'placeholder') {
    return (
      <div className={`w-full max-w-[560px] ${className}`}>
        <Card><div className={`${aspect} w-full bg-gray-100 dark:bg-gray-700`} /></Card>
        {ad?.headline && (
          <p className="mt-2 text-sm font-medium text-gray-700 dark:text-gray-200 text-center">{ad.headline}</p>
        )}
      </div>
    );
  }

  // ====== 主體 ======
  return (
    <div className={`w-full max-w-[560px] ${className}`}>
      <Wrapper {...wrapperProps} aria-label={ad?.headline ?? 'Sponsored'} className="block group">
        <Card>
          <div className={`relative ${cardPad}`}>
            {/* 贊助角標 */}
            <div className="absolute left-3 top-3 z-10">
              <span className="rounded-full bg-black/50 text-white text-[10px] px-2 py-0.5 tracking-wide">贊助</span>
            </div>

            {/* CTA 浮動膠囊（右下） */}
            <div className="absolute right-3 bottom-3 z-10 opacity-90 group-hover:opacity-100 transition">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/90 dark:bg-gray-900/80 text-xs font-semibold px-2.5 py-1 shadow ring-1 ring-black/5">
                {ctaText} <span aria-hidden>↗</span>
              </span>
            </div>

            {/* 圖片容器 */}
            <div className={`${aspect} w-full relative overflow-hidden rounded-xl`}>
              {/* 有縮圖且主圖未載入 → 顯示縮圖骨架 */}
              {!imgLoaded && thumbSrc && (
                <img
                  src={thumbSrc}
                  alt=""
                  aria-hidden
                  className="absolute inset-0 w-full h-full object-cover blur-md scale-105"
                  referrerPolicy="no-referrer"
                />
              )}

              {/* 沒縮圖 → 純色 skeleton（避免用大圖當骨架） */}
              {!imgLoaded && !thumbSrc && (
                <div className="absolute inset-0 w-full h-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
              )}

              {/* 主圖（只載一次） */}
              <img
                src={mainSrc}
                alt={ad?.headline ?? 'Sponsored'}
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
                loading="eager"
                decoding="async"
                fetchPriority="high"
                referrerPolicy="no-referrer"
                draggable={false}
                // 讓瀏覽器自選尺寸（有縮圖才提供 srcSet）
                {...(thumbSrc
                  ? { srcSet: `${thumbSrc} 480w, ${mainSrc} 1200w`, sizes: '(max-width: 640px) 100vw, 560px' }
                  : {})}
                onLoad={() => { setImgLoaded(true); setState('ready'); }}
                onError={(e) => { console.warn('[AdSlot] <img> error:', mainSrc, e); setState('placeholder'); }}
              />
            </div>
          </div>
        </Card>
      </Wrapper>

      {/* 文案（卡片外、下方） */}
      {ad?.headline && (
        <p className={`mt-2 ${compact ? 'text-[13px]' : 'text-sm'} font-semibold text-gray-800 dark:text-gray-100 text-center`}>
          {ad.headline}
        </p>
      )}
    </div>
  );
};

export { AdSlot };
export default AdSlot;
