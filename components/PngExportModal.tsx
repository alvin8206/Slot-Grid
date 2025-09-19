// components/PngExportModal.tsx
import React, { useState, useCallback, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import type { ScheduleData, CalendarDay, PngStyle, PngExportViewMode, TitleAlign, DayStatus, PngSettingsState } from '../types';
import { DownloadIcon, CheckIcon, SpinnerIcon, RainbowIcon } from './icons';
import Modal from './Modal';
import PngExportContent from './PngExportContent';
import { AdSlot } from './AdSlot';
import { embedFontForExport } from '../fontUtils';

// This declaration is necessary because html-to-image is loaded from a CDN.
declare const htmlToImage: {
  toPng: <T extends HTMLElement>(node: T, options?: object) => Promise<string>;
};

// NEW: Color utility functions
const parseColor = (colorStr: string): { hex: string; alpha: number } => {
    if (!colorStr || typeof colorStr !== 'string') return { hex: '#000000', alpha: 1 };
    if (colorStr === 'transparent') return { hex: '#000000', alpha: 0 };
    if (colorStr.startsWith('#')) {
        return { hex: colorStr.toLowerCase(), alpha: 1 };
    }
    if (colorStr.startsWith('rgb')) {
        const parts = colorStr.match(/[\d.]+/g);
        if (!parts || parts.length < 3) return { hex: '#000000', alpha: 1 };
        const [r, g, b] = parts.map(Number);
        const toHex = (c: number) => ('0' + c.toString(16)).slice(-2);
        const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
        const alpha = parts.length > 3 ? parseFloat(parts[3]) : 1;
        return { hex, alpha };
    }
    return { hex: '#000000', alpha: 1 }; // Fallback for unknown formats
};

const hexToRgb = (hex: string): { r: number, g: number, b: number } | null => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
};


const FONT_CATEGORIES = [
    {
        name: '常用中文字體',
        fonts: [
            { id: "'Noto Sans TC', sans-serif", name: '思源黑體', urlValue: 'Noto+Sans+TC:wght@300;400;700' },
            { id: "'Noto Serif TC', serif", name: '思源宋體', urlValue: 'Noto+Serif+TC:wght@300;400;700' },
            { id: "'LXGW WenKai TC', cursive", name: '霞鶩文楷', urlValue: 'LXGW+WenKai+TC:wght@300;400;700' },
        ]
    },
    {
        name: '中文藝術字體',
        fonts: [
            { id: "'Yuji Syuku', serif", name: '佑字肅', urlValue: 'Yuji+Syuku' },
            { id: "'Hina Mincho', serif", name: '雛明朝', urlValue: 'Hina+Mincho' },
            { id: "'Zen Dots', cursive", name: '禪點體', urlValue: 'Zen+Dots' },
            { id: "'DotGothic16', sans-serif", name: '點陣哥特體', urlValue: 'DotGothic16' },
            { id: "'Reggae One', cursive", name: '雷鬼體', urlValue: 'Reggae+One' },
            { id: "'Rampart One', cursive", name: '城牆體', urlValue: 'Rampart+One' },
            { id: "'Kaisei Opti', serif", name: '解星光學體', urlValue: 'Kaisei+Opti:wght@400;700' },
            { id: "'M PLUS Rounded 1c', sans-serif", name: 'M+ 圓體', urlValue: 'M+PLUS+Rounded+1c:wght@300;400;700' },
            { id: "'Zen Maru Gothic', sans-serif", name: '禪丸哥特體', urlValue: 'Zen+Maru+Gothic:wght@400;700' },
        ]
    },
    {
        name: '英文字體 (僅適用英文)',
        fonts: [
            { id: "'Cormorant Garamond', serif", name: 'Cormorant Garamond', urlValue: 'Cormorant+Garamond:wght@400;700' },
            { id: "'Playfair Display', serif", name: 'Playfair Display', urlValue: 'Playfair+Display:wght@400;700' },
            { id: "'Lobster', cursive", name: 'Lobster', urlValue: 'Lobster' },
            { id: "'Pacifico', cursive", name: 'Pacifico', urlValue: 'Pacifico' },
            { id: "'Bebas Neue', sans-serif", name: 'Bebas Neue', urlValue: 'Bebas+Neue' },
            { id: "'Space Mono', monospace", name: 'Space Mono', urlValue: 'Space+Mono:wght@400;700' },
            { id: "'Roboto', sans-serif", name: 'Roboto', urlValue: 'Roboto:wght@300;400;700' },
            { id: "'Lato', sans-serif", name: 'Lato', urlValue: 'Lato:wght@300;400;700' },
            { id: "'Montserrat', sans-serif", name: 'Montserrat', urlValue: 'Montserrat:wght@300;400;700' },
            { id: "'Open Sans', sans-serif", name: 'Open Sans', urlValue: 'Open+Sans:wght@300;400;700' },
            { id: "'Poppins', sans-serif", name: 'Poppins', urlValue: 'Poppins:wght@300;400;700' },
            { id: "'Raleway', sans-serif", name: 'Raleway', urlValue: 'Raleway:wght@300;400;700' },
        ]
    }
];

export const FONT_OPTIONS = FONT_CATEGORIES.flatMap(c => c.fonts);

const PRESET_COLORS = {
    bg: ['transparent', '#FFFFFF', '#F9FAFB', '#F3F4F6', '#111827', '#FECACA', '#BFDBFE'],
    text: ['#111827', '#6B7280', '#FFFFFF', '#9CA3AF', '#BE123C', '#1D4ED8'],
    border: ['transparent', '#E5E7EB', '#D1D5DB', '#9CA3AF', '#374151', '#FCA5A5', '#93C5FD'],
    block: ['transparent', '#F9FAFB', '#FFFFFF', '#E5E7EB', '#1F2937', '#FEE2E2', '#DBEAFE'],
    strikethrough: ['#EF4444', '#FFFFFF', '#9CA3AF', '#6B7280', '#111827'],
    status: [
        '#EF4444', // Red
        '#FBBF24', // Yellow
        '#22C55E', // Green
        '#111827', // Black
        '#FFFFFF', // White
        '#6B7280', // Gray
    ],
};

interface PngExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    scheduleData: ScheduleData;
    title: string;
    calendarDays: CalendarDay[];
    currentDate: Date;
    loginPromptContent?: React.ReactNode;
    pngSettings: PngSettingsState;
    setPngSettings: React.Dispatch<React.SetStateAction<PngSettingsState>>;
}

const SettingsSection: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({ title, children, className }) => (
    <div className={className}>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{title}</h3>
        <div className="space-y-3">{children}</div>
    </div>
);

const SettingsCard: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ children, className }) => (
    <div className={`bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 ${className}`}>
        {children}
    </div>
);

interface ColorPickerInputProps {
  value: string;
  onChange: (color: string) => void;
  isCustom: boolean;
}

const ColorPickerInput: React.FC<ColorPickerInputProps> = ({ value, onChange, isCustom }) => {
    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const [popoverPosition, setPopoverPosition] = useState<'top' | 'bottom'>('top');
    const { hex, alpha } = useMemo(() => parseColor(value), [value]);

    useLayoutEffect(() => {
        if (isPickerOpen && popoverRef.current) {
            const rect = popoverRef.current.getBoundingClientRect();
            // Check if it's going off the top of the viewport
            if (rect.top < 10) { // 10px buffer
                setPopoverPosition('bottom');
            } else {
                setPopoverPosition('top');
            }
        } else if (!isPickerOpen) {
            // Reset when closed so it tries 'top' first next time
            setPopoverPosition('top');
        }
    }, [isPickerOpen]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsPickerOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleColorChange = (newHex: string) => {
        const rgb = hexToRgb(newHex);
        if (!rgb) return;
        
        // When user picks a new color, if original was transparent, make it fully opaque.
        const newAlpha = (alpha === 0 && value === 'transparent') ? 1 : alpha;
        onChange(`rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${newAlpha})`);
    };

    const handleAlphaChange = (newAlpha: number) => {
        const rgb = hexToRgb(hex);
        if (!rgb) return;
        
        if (newAlpha === 0) {
            onChange('transparent');
        } else {
            onChange(`rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${newAlpha})`);
        }
    };

    const rgb = hexToRgb(hex);
    const previewColor = rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})` : 'transparent';
    const isTransparent = alpha === 0;

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                onClick={() => setIsPickerOpen(prev => !prev)}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform transform hover:scale-110 shadow-sm ${isCustom ? 'ring-2 ring-offset-2 ring-blue-500' : 'ring-1 ring-inset ring-gray-300 dark:ring-gray-600'}`}
                style={{
                  backgroundColor: isTransparent ? 'transparent' : previewColor,
                  backgroundImage: isTransparent ? `url('data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path fill="%23d1d5db" d="M0 0h8v8H0zM8 8h8v8H8z" fill-opacity="0.2"/></svg>')` : 'none',
                }}
            >
                <div className="flex items-center justify-center" aria-hidden="true">
                    <RainbowIcon />
                </div>
            </button>

            {isPickerOpen && (
                <div
                    ref={popoverRef}
                    className={`absolute left-1/2 -translate-x-1/2 z-10 w-60 bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-4 border border-gray-200 dark:border-gray-700 space-y-4
                        ${popoverPosition === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'}`
                    }
                >
                    <div className="flex items-center gap-3">
                        <div className="relative w-10 h-10 rounded-md overflow-hidden border border-gray-300 dark:border-gray-500 shrink-0">
                            <div className="absolute inset-0 bg-white" style={{ backgroundImage: `url('data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path fill="%23d1d5db" d="M0 0h8v8H0zM8 8h8v8H8z" fill-opacity="0.2"/></svg>')`}}></div>
                            <div className="absolute inset-0" style={{ backgroundColor: previewColor }}></div>
                            <input
                                type="color"
                                value={hex}
                                onChange={(e) => handleColorChange(e.target.value)}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                        </div>
                        <div className="flex-grow">
                             <label htmlFor="color-hex-value" className="text-xs font-medium text-gray-500 dark:text-gray-400">顏色</label>
                             <div id="color-hex-value" className="text-sm font-semibold text-gray-800 dark:text-gray-100 uppercase tracking-wider">{hex}</div>
                        </div>
                    </div>
                    <div>
                        <div className="flex justify-between items-baseline mb-1">
                          <label htmlFor="alpha-slider" className="text-xs font-medium text-gray-500 dark:text-gray-400">透明度</label>
                          <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{Math.round(alpha * 100)}%</span>
                        </div>
                        <input
                            id="alpha-slider"
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={alpha}
                            onChange={(e) => handleAlphaChange(parseFloat(e.target.value))}
                            className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer"
                        />
                    </div>
                </div>
            )}
        </div>
    );
};


const ColorSelectorRow: React.FC<{ value: string; onChange: (color: string) => void; presets: string[]; }> = ({ value, onChange, presets }) => {
    const isCustom = !presets.includes(value);
    return (
        <div className="flex items-center justify-end gap-2">
            {presets.map(color => {
                if (color === 'transparent') {
                   return (
                        <button
                            key={color}
                            type="button"
                            onClick={() => onChange(color)}
                            className={`w-6 h-6 rounded-full transition-transform transform hover:scale-110 shadow-sm border bg-[conic-gradient(from_90deg_at_50%_50%,#ccc_25%,#fff_0,#fff_50%,#ccc_0,#ccc_75%,#fff_0)] bg-[length:10px_10px] ${value === color ? 'ring-2 ring-offset-1 ring-blue-500' : 'border-gray-300 dark:border-gray-600'}`}
                        />
                   );
                }
                return (
                    <button key={color} type="button" onClick={() => onChange(color)} className={`w-6 h-6 rounded-full transition-transform transform hover:scale-110 shadow-sm border dark:border-gray-700 ${value.toUpperCase() === color.toUpperCase() ? 'ring-2 ring-offset-1 ring-blue-500' : ''}`} style={{ backgroundColor: color }} />
                )
            })}
            <ColorPickerInput value={value} onChange={onChange} isCustom={isCustom} />
        </div>
    );
};

type FontStatus = 'idle' | 'loading' | 'loaded';
type PngSettingsTab = 'content' | 'style' | 'layout';
type ExportStage = 'configuring' | 'generating_image' | 'completed';

const FontCard: React.FC<{
  fontOption: typeof FONT_OPTIONS[0];
  isSelected: boolean;
  status: FontStatus;
  onSelect: () => void;
  preloadFont: () => void;
}> = ({ fontOption, isSelected, status, onSelect, preloadFont }) => {
  const cardRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (status !== 'idle' || !cardRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          preloadFont(); // Pre-load when visible
          observer.unobserve(entry.target);
        }
      },
      {
        root: null,
        rootMargin: '0px 200px 0px 0px', // Preload 200px ahead of the scroll direction
        threshold: 0.01,
      }
    );

    observer.observe(cardRef.current);

    return () => observer.disconnect();
  }, [status, preloadFont]);

  return (
    <button
      ref={cardRef}
      type="button"
      onClick={onSelect}
      disabled={status === 'loading'}
      className={`relative flex-shrink-0 w-28 h-16 flex items-center justify-center p-2 border-2 rounded-lg transition-all duration-200 text-center ${isSelected ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/50' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 hover:border-blue-400'}`}
      style={{ fontFamily: status === 'loaded' ? fontOption.id : 'sans-serif' }}
    >
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70 dark:bg-gray-700/70 rounded-md">
          <SpinnerIcon className="w-6 h-6 text-blue-500" />
        </div>
      )}
      <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{fontOption.name}</span>
    </button>
  );
};


const PngExportModal: React.FC<PngExportModalProps> = ({
    isOpen,
    onClose,
    scheduleData,
    title,
    calendarDays,
    currentDate,
    loginPromptContent,
    pngSettings,
    setPngSettings
}) => {
    const exportRef = useRef<HTMLDivElement>(null);
    const previewContainerRef = useRef<HTMLDivElement>(null);
    const scaleWrapperRef = useRef<HTMLDivElement>(null);
    
    const [activeTab, setActiveTab] = useState<PngSettingsTab>('content');
    const [isExporting, setIsExporting] = useState(false);

    const {
        exportViewMode, pngStyle, bgColor, textColor, borderColor, blockColor, showShadow,
        showTitle, showBookedSlots, bookedStyle, strikethroughColor, strikethroughThickness,
        fontScale, font, language, horizontalGap, verticalGap, titleAlign,
        dayOffColor, closedColor, fullyBookedColor, slotLayout,
    } = pngSettings;

    const updateSetting = <K extends keyof PngSettingsState>(key: K, value: PngSettingsState[K]) => {
        setPngSettings(prev => ({ ...prev, [key]: value }));
    };

    const [localTitle, setLocalTitle] = useState(title);
    const [exportStage, setExportStage] = useState<ExportStage>('configuring');
    const [generatedPngDataUrl, setGeneratedPngDataUrl] = useState<string | null>(null);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [fontStatuses, setFontStatuses] = useState<Record<string, FontStatus>>({});

    useEffect(() => {
        if (isOpen) {
            setExportStage('configuring');
            setGeneratedPngDataUrl(null);
            setLocalTitle(title);
            setIsExporting(false);
            setActiveTab('content');
        }
    }, [isOpen, title]);
    
    const propsForContent = useMemo(() => ({
        scheduleData, title: localTitle, calendarDays, currentDate,
        ...pngSettings,
    }), [scheduleData, localTitle, calendarDays, currentDate, pngSettings]);

    const selectedFontStatus = fontStatuses[font] || 'idle';

    useLayoutEffect(() => {
        const containerNode = previewContainerRef.current;
        const wrapperNode = scaleWrapperRef.current;
        const exportNode = exportRef.current;

        if (!isOpen || !containerNode || !wrapperNode || !exportNode) {
            return;
        }

        if (selectedFontStatus !== 'loaded') {
            return;
        }

        let rafId1: number | null = null;
        let rafId2: number | null = null;

        const updatePreviewLayout = () => {
            if (!containerNode || !wrapperNode || !exportNode) return;
            
            const exportWidth = 800;
            const containerWidth = containerNode.offsetWidth;

            if (exportWidth > 0 && containerWidth > 0) {
                const scale = containerWidth / exportWidth;
                wrapperNode.style.transform = `scale(${scale})`;
                
                const exportHeight = exportNode.offsetHeight;
                const scaledHeight = exportHeight * scale;
                wrapperNode.style.height = `${scaledHeight}px`;
            }
        };

        // FIX: Use a double requestAnimationFrame to ensure the browser has painted
        // with the new font before we measure the element's height. This prevents
        // measuring based on a fallback font.
        rafId1 = requestAnimationFrame(() => {
            rafId2 = requestAnimationFrame(updatePreviewLayout);
        });

        const resizeObserver = new ResizeObserver(updatePreviewLayout);
        resizeObserver.observe(containerNode);
        resizeObserver.observe(exportNode);

        return () => {
            if (rafId1) cancelAnimationFrame(rafId1);
            if (rafId2) cancelAnimationFrame(rafId2);
            resizeObserver.disconnect();
            if (wrapperNode) {
                 wrapperNode.style.height = '';
                 wrapperNode.style.transform = '';
            }
        };
    }, [isOpen, selectedFontStatus, propsForContent]); // Re-run when font is loaded or content changes
    
    const loadFont = useCallback((fontOption: typeof FONT_OPTIONS[0]) => {
      return new Promise<void>((resolve, reject) => {
        const { id, urlValue, name } = fontOption;

        if (fontStatuses[id] === 'loading' || fontStatuses[id] === 'loaded') {
          resolve();
          return;
        }
        
        setFontStatuses(prev => ({ ...prev, [id]: 'loading' }));
        
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = `https://fonts.googleapis.com/css2?family=${urlValue.replace(/ /g, '+')}&display=swap`;

        link.onload = () => {
            setFontStatuses(prev => ({ ...prev, [id]: 'loaded' }));
            resolve();
        };
        link.onerror = () => {
            console.error(`Failed to load font stylesheet: ${name}`);
            setFontStatuses(prev => ({ ...prev, [id]: 'idle' }));
            reject(new Error(`Failed to load font: ${name}`));
        };
        document.head.appendChild(link);
      });
    }, [fontStatuses]);

    useEffect(() => {
        if (isOpen) {
            const selectedFontOption = FONT_OPTIONS.find(f => f.id === font);
            if (selectedFontOption && (!fontStatuses[font] || fontStatuses[font] === 'idle')) {
                loadFont(selectedFontOption).catch(e => console.error("Failed to preload selected font:", e));
            }
        }
    }, [isOpen, font, fontStatuses, loadFont]);

    const handleFontSelect = useCallback(async (fontOption: typeof FONT_OPTIONS[0]) => {
        const { id } = fontOption;
        const currentStatus = fontStatuses[id] || 'idle';
        
        updateSetting('font', id);

        if (currentStatus === 'loading') return;
        
        try {
            if (currentStatus !== 'loaded') await loadFont(fontOption);
        } catch (error) {
            alert(`無法載入字體：${fontOption.name}。請稍後再試。`);
        }
    }, [fontStatuses, loadFont, updateSetting]);

    const handleStartExport = useCallback(async () => {
        const exportNode = exportRef.current;
        if (!exportNode) {
            alert('無法匯出：預覽元件尚未準備好。');
            return;
        }

        setIsExporting(true);
        setExportStage('generating_image');
        setLoadingMessage('正在準備字體...');

        const MIN_EXPORT_DURATION = 3500;
        const delayPromise = new Promise(resolve => setTimeout(resolve, MIN_EXPORT_DURATION));

        const generationTask = async () => {
            const selectedFont = FONT_OPTIONS.find(f => f.id === font);
            if (!selectedFont) {
                throw new Error("錯誤：找不到選擇的字體。");
            }
            
            let styleEl: HTMLStyleElement | null = null;
            try {
                // --- Start of The Ultimate "Forced Repaint" Strategy for iOS Safari ---
                // This sequence combines multiple techniques to ensure custom fonts are rendered before screenshotting.

                // 1. Prepare Font CSS: Embeds font files as Base64 for self-containment.
                const fontEmbedCSS = await embedFontForExport(selectedFont);
                
                // 2. Inject Style: Makes the browser aware of the @font-face rules.
                styleEl = document.createElement('style');
                styleEl.textContent = fontEmbedCSS;
                document.head.appendChild(styleEl);

                // 3. Wait for All Fonts to be Ready: `document.fonts.ready` is a robust way to wait for
                // font loading and layout operations to complete for the entire document, as suggested.
                await document.fonts.ready;
                
                // 4. Force Reflow: Reading a layout property forces the browser to compute layout with the new font.
                exportNode.offsetHeight;

                // 5. Double RAF Buffer: Waits for two repaint cycles, which is particularly effective on Safari.
                await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

                // 6. Insurance Delay: A final small delay helps on slower devices.
                await new Promise(resolve => setTimeout(resolve, 300));
                // --- End of Strategy ---

                setLoadingMessage('正在繪製圖片...');
                
                // 7. Capture Image: Pass fontEmbedCSS again for maximum reliability.
                const dataUrl = await htmlToImage.toPng(exportNode, {
                    quality: 1,
                    pixelRatio: 2,
                    backgroundColor: bgColor,
                    fontEmbedCSS: fontEmbedCSS, 
                });
                
                setGeneratedPngDataUrl(dataUrl);

            } catch (err) {
                console.error("Error during image generation process:", err);
                throw err;
            } finally {
                // Cleanup injected style
                if (styleEl) {
                    document.head.removeChild(styleEl);
                }
            }
        };

        try {
            await Promise.all([generationTask(), delayPromise]);
            setExportStage('completed');
        } catch (error) {
            console.error('Oops, something went wrong during PNG export!', error);
            alert(`匯出圖片時發生錯誤！ ${error instanceof Error ? error.message : ''}`);
            setExportStage('configuring');
        } finally {
            setIsExporting(false);
        }
    }, [font, bgColor]);

    const handleOpenInNewTab = useCallback(async () => {
        if (!generatedPngDataUrl) return;
        try {
            const response = await fetch(generatedPngDataUrl);
            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);
            window.open(objectUrl, '_blank', 'noopener,noreferrer');
            setTimeout(() => URL.revokeObjectURL(objectUrl), 100);
        } catch (error) {
            console.error('Error opening image in new tab:', error);
            window.open(generatedPngDataUrl, '_blank', 'noopener,noreferrer');
        }
    }, [generatedPngDataUrl]);

     const handleStyleChange = (style: PngStyle) => {
        const newSettings: Partial<PngSettingsState> = { pngStyle: style };
        if (style === 'minimal') {
            newSettings.bgColor = 'transparent';
            newSettings.textColor = '#111827';
            newSettings.borderColor = 'transparent';
            newSettings.blockColor = 'transparent';
            newSettings.strikethroughColor = '#EF4444';
        } else if (style === 'borderless') {
            newSettings.bgColor = '#FFFFFF';
            newSettings.textColor = '#111827';
            newSettings.blockColor = '#F9FAFB';
            newSettings.borderColor = 'transparent';
            newSettings.strikethroughColor = '#EF4444';
        } else if (style === 'wireframe') {
            newSettings.bgColor = '#FFFFFF';
            newSettings.textColor = '#111827';
            newSettings.borderColor = '#374151';
            newSettings.blockColor = 'transparent';
            newSettings.strikethroughColor = '#EF4444';
        }
        setPngSettings(prev => ({ ...prev, ...newSettings }));
    };
    
    if (!isOpen) return null;

    const header = <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100" translate="no">{exportStage === 'completed' ? '匯出成功！' : '匯出 PNG 圖片'}</h2>;
    
    const footer = exportStage === 'completed' ? null : (
        <>
            {loginPromptContent}
            <div className="grid grid-cols-2 gap-3 w-full">
                <button onClick={onClose} className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold py-3 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors" disabled={isExporting}>關閉</button>
                <button onClick={handleStartExport} disabled={isExporting} className="bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-wait">
                    {isExporting ? <><SpinnerIcon className="w-5 h-5 mr-2" />{loadingMessage}</> : <><DownloadIcon /> 下載 PNG</>}
                </button>
            </div>
        </>
    );
    
    const TabButton: React.FC<{ tab: PngSettingsTab, label: string; disabled?: boolean }> = ({ tab, label, disabled }) => (
      <button 
        onClick={() => !disabled && setActiveTab(tab)} 
        disabled={disabled}
        className={`py-2 px-4 rounded-lg transition-all text-sm font-medium ${activeTab === tab ? 'bg-white dark:bg-gray-600 shadow text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
        {label}
      </button>
    );
    
    const ViewModeButton: React.FC<{ mode: PngExportViewMode, label: string }> = ({ mode, label }) => (
      <button 
        onClick={() => {
            updateSetting('exportViewMode', mode);
        }}
        className={`py-2 rounded-lg transition-all text-sm font-medium ${exportViewMode === mode ? 'bg-white dark:bg-gray-600 shadow text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'}`}>
        {label}
      </button>
    );
    
    const AlignButton: React.FC<{ align: TitleAlign, label: string }> = ({ align, label }) => (
        <button 
          onClick={() => updateSetting('titleAlign', align)} 
          className={`py-2 rounded-lg transition-all text-sm font-medium ${titleAlign === align ? 'bg-white dark:bg-gray-600 shadow text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'}`}>
          {label}
        </button>
      );

    return (
        <Modal isOpen={isOpen} onClose={isExporting ? () => {} : onClose} headerContent={header} footerContent={footer} modalClassName="xl:max-w-4xl">
            <div
                style={{
                  position: 'fixed',
                  top: 0,
                  left: -99999,
                  pointerEvents: 'none',
                  opacity: 0,
                }}
              >
                <PngExportContent ref={exportRef} {...propsForContent} />
            </div>

            {exportStage === 'configuring' ? (
                <div className="flex flex-col lg:flex-row gap-6 items-start">
                    <div className="w-full lg:w-1/2 lg:sticky lg:top-0">
                        <div className="space-y-2">
                            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">預覽</h3>
                            <div ref={previewContainerRef} className="w-full bg-gray-200/50 dark:bg-gray-700/50 rounded-md overflow-x-hidden max-h-[25vh] lg:max-h-[50vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
                                <div ref={scaleWrapperRef} style={{ transformOrigin: 'top left', transition: 'transform 0.2s ease-out, height 0.2s ease-out', visibility: selectedFontStatus === 'loaded' ? 'visible' : 'hidden' }}>
                                    <PngExportContent {...propsForContent} />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="w-full lg:w-1/2 space-y-4">
                        <SettingsCard>
                          <SettingsSection title="顯示範圍">
                            <div className="grid grid-cols-3 gap-1 rounded-xl bg-gray-200 dark:bg-gray-700 p-1">
                                <ViewModeButton mode="month" label="完整月曆"/>
                                <ViewModeButton mode="remaining" label="剩餘月份"/>
                                <ViewModeButton mode="list" label="清單模式"/>
                            </div>
                          </SettingsSection>
                        </SettingsCard>

                      <div className="grid grid-cols-3 gap-1 rounded-xl bg-gray-200 dark:bg-gray-700 p-1">
                          <TabButton tab="content" label="內容" />
                          <TabButton tab="style" label="樣式" />
                          <TabButton tab="layout" label="排版" />
                      </div>

                      <div className="space-y-4">
                        {activeTab === 'content' && (
                          <>
                            <SettingsCard>
                              <SettingsSection title="標題">
                                <input type="text" value={localTitle} onChange={e => setLocalTitle(e.target.value)} className="w-full p-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 transition text-gray-800 dark:text-gray-100"/>
                              </SettingsSection>
                            </SettingsCard>
                            <SettingsCard>
                              <SettingsSection title="顯示項目">
                                <label htmlFor="png-show-title" className="flex items-center justify-between cursor-pointer">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">顯示主標題</span>
                                    <div className="relative">
                                        <input type="checkbox" id="png-show-title" className="sr-only peer" checked={showTitle} onChange={e => updateSetting('showTitle', e.target.checked)} />
                                        <div className="block bg-gray-200 dark:bg-gray-600 w-10 h-6 rounded-full peer-checked:bg-blue-600 transition"></div>
                                        <div className="dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition transform peer-checked:translate-x-full"></div>
                                    </div>
                                </label>
                                <label htmlFor="png-show-booked" className="flex items-center justify-between cursor-pointer">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">顯示已預約時段</span>
                                    <div className="relative">
                                        <input type="checkbox" id="png-show-booked" className="sr-only peer" checked={showBookedSlots} onChange={e => updateSetting('showBookedSlots', e.target.checked)} />
                                        <div className="block bg-gray-200 dark:bg-gray-600 w-10 h-6 rounded-full peer-checked:bg-blue-600 transition"></div>
                                        <div className="dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition transform peer-checked:translate-x-full"></div>
                                    </div>
                                </label>
                                {showBookedSlots && (
                                    <div className="space-y-2 pt-3 border-t border-gray-200/60 dark:border-gray-700/60">
                                        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">已預約樣式</label>
                                        <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-200 dark:bg-gray-700 p-1">
                                            <button onClick={() => updateSetting('bookedStyle', 'strikethrough')} className={`py-2 rounded-lg transition-all text-sm font-medium ${bookedStyle === 'strikethrough' ? 'bg-white dark:bg-gray-600 shadow text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'}`}>畫橫線</button>
                                            <button onClick={() => updateSetting('bookedStyle', 'fade')} className={`py-2 rounded-lg transition-all text-sm font-medium ${bookedStyle === 'fade' ? 'bg-white dark:bg-gray-600 shadow text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'}`}>降低透明度</button>
                                        </div>
                                    </div>
                                )}
                              </SettingsSection>
                            </SettingsCard>
                            <SettingsCard>
                                <SettingsSection title="語言">
                                    <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-200 dark:bg-gray-700 p-1">
                                        <button onClick={() => updateSetting('language', 'zh')} className={`py-2 rounded-lg transition-all text-sm font-medium ${language === 'zh' ? 'bg-white dark:bg-gray-600 shadow text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'}`}>中文</button>
                                        <button onClick={() => updateSetting('language', 'en')} className={`py-2 rounded-lg transition-all text-sm font-medium ${language === 'en' ? 'bg-white dark:bg-gray-600 shadow text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'}`}>English</button>
                                    </div>
                                </SettingsSection>
                            </SettingsCard>
                          </>
                        )}
                        {activeTab === 'style' && (
                          <>
                            {exportViewMode !== 'list' && <SettingsCard>
                              <SettingsSection title="整體風格">
                                  <div className="grid grid-cols-4 gap-2 rounded-xl bg-gray-200 dark:bg-gray-700 p-1">
                                      <button onClick={() => handleStyleChange('minimal')} className={`py-2 rounded-lg transition-all text-sm font-medium ${pngStyle === 'minimal' ? 'bg-white dark:bg-gray-600 shadow text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'}`}>簡約</button>
                                      <button onClick={() => handleStyleChange('borderless')} className={`py-2 rounded-lg transition-all text-sm font-medium ${pngStyle === 'borderless' ? 'bg-white dark:bg-gray-600 shadow text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'}`}>區塊</button>
                                      <button onClick={() => handleStyleChange('wireframe')} className={`py-2 rounded-lg transition-all text-sm font-medium ${pngStyle === 'wireframe' ? 'bg-white dark:bg-gray-600 shadow text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'}`}>線框</button>
                                      <button onClick={() => handleStyleChange('custom')} className={`py-2 rounded-lg transition-all text-sm font-medium ${pngStyle === 'custom' ? 'bg-white dark:bg-gray-600 shadow text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'}`}>自訂</button>
                                  </div>
                              </SettingsSection>
                            </SettingsCard>}
                            <SettingsCard>
                              <SettingsSection title="顏色">
                                <div className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-3">
                                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">背景</span>
                                    <ColorSelectorRow presets={PRESET_COLORS.bg} value={bgColor} onChange={(c) => updateSetting('bgColor', c)} />

                                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">主要文字</span>
                                    <ColorSelectorRow presets={PRESET_COLORS.text} value={textColor} onChange={(c) => updateSetting('textColor', c)} />
                                    
                                    {(pngStyle === 'wireframe' || pngStyle === 'custom' || exportViewMode === 'list') && (
                                        <>
                                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">邊框</span>
                                            <ColorSelectorRow presets={PRESET_COLORS.border} value={borderColor} onChange={(c) => updateSetting('borderColor', c)} />
                                        </>
                                    )}

                                    {(pngStyle === 'borderless' || pngStyle === 'custom') && (
                                        <>
                                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">區塊</span>
                                            <ColorSelectorRow presets={PRESET_COLORS.block} value={blockColor} onChange={(c) => updateSetting('blockColor', c)} />
                                        </>
                                    )}
                                </div>
                                
                                <div className="pt-4 mt-4 border-t border-gray-200/60 dark:border-gray-700/60">
                                    <div className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-3">
                                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">休假文字</span>
                                        <ColorSelectorRow presets={PRESET_COLORS.status} value={dayOffColor} onChange={(c) => updateSetting('dayOffColor', c)} />
                                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">公休文字</span>
                                        <ColorSelectorRow presets={PRESET_COLORS.status} value={closedColor} onChange={(c) => updateSetting('closedColor', c)} />
                                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">約滿文字</span>
                                        <ColorSelectorRow presets={PRESET_COLORS.status} value={fullyBookedColor} onChange={(c) => updateSetting('fullyBookedColor', c)} />
                                    </div>
                                </div>
                                
                                {showBookedSlots && bookedStyle === 'strikethrough' && (
                                    <div className="pt-3 mt-3 border-t border-gray-200/60 dark:border-gray-700/60">
                                        <div className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-3">
                                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">橫線顏色</span>
                                            <ColorSelectorRow presets={PRESET_COLORS.strikethrough} value={strikethroughColor} onChange={(c) => updateSetting('strikethroughColor', c)} />
                                            
                                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">橫線粗細</span>
                                            <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-200 dark:bg-gray-700 p-1">
                                                <button onClick={() => updateSetting('strikethroughThickness', 'thin')} className={`py-2 rounded-lg transition-all text-sm font-medium ${strikethroughThickness === 'thin' ? 'bg-white dark:bg-gray-600 shadow text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'}`}>細</button>
                                                <button onClick={() => updateSetting('strikethroughThickness', 'thick')} className={`py-2 rounded-lg transition-all text-sm font-medium ${strikethroughThickness === 'thick' ? 'bg-white dark:bg-gray-600 shadow text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'}`}>粗</button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                              </SettingsSection>
                            </SettingsCard>
                            {pngStyle === 'custom' && exportViewMode !== 'list' && (
                                <SettingsCard>
                                    <SettingsSection title="效果">
                                        <label htmlFor="png-show-shadow" className="flex items-center justify-between cursor-pointer">
                                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">顯示陰影</span>
                                            <div className="relative">
                                                <input type="checkbox" id="png-show-shadow" className="sr-only peer" checked={showShadow} onChange={e => updateSetting('showShadow', e.target.checked)} />
                                                <div className="block bg-gray-200 dark:bg-gray-600 w-10 h-6 rounded-full peer-checked:bg-blue-600 transition"></div>
                                                <div className="dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition transform peer-checked:translate-x-full"></div>
                                            </div>
                                        </label>
                                    </SettingsSection>
                                </SettingsCard>
                            )}
                            <SettingsCard>
                                <SettingsSection title="字體">
                                    <div className="space-y-4">
                                        {FONT_CATEGORIES.map(category => (
                                            <div key={category.name}>
                                                <h4 className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2">{category.name}</h4>
                                                <div className="relative">
                                                    <div className="flex space-x-3 overflow-x-auto pb-4 -mb-4 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
                                                        {category.fonts.map(f => (
                                                            <FontCard
                                                                key={f.id}
                                                                fontOption={f}
                                                                isSelected={font === f.id}
                                                                status={fontStatuses[f.id] || 'idle'}
                                                                onSelect={() => handleFontSelect(f)}
                                                                preloadFont={() => loadFont(f)}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </SettingsSection>
                            </SettingsCard>
                          </>
                        )}
                        {activeTab === 'layout' && (
                          <>
                            <SettingsCard>
                               <SettingsSection title="主標題對齊">
                                    <div className="grid grid-cols-3 gap-1 rounded-xl bg-gray-200 dark:bg-gray-700 p-1">
                                        <AlignButton align="left" label="靠左"/>
                                        <AlignButton align="center" label="置中"/>
                                        <AlignButton align="right" label="靠右"/>
                                    </div>
                               </SettingsSection>
                            </SettingsCard>
                            {exportViewMode !== 'list' && (
                                <SettingsCard>
                                    <SettingsSection title="時段排版">
                                        <div className="grid grid-cols-2 gap-1 rounded-xl bg-gray-200 dark:bg-gray-700 p-1">
                                            <button onClick={() => updateSetting('slotLayout', 'vertical')} className={`py-2 rounded-lg transition-all text-sm font-medium ${slotLayout === 'vertical' ? 'bg-white dark:bg-gray-600 shadow text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'}`}>垂直排列</button>
                                            <button onClick={() => updateSetting('slotLayout', 'horizontal-wrap')} className={`py-2 rounded-lg transition-all text-sm font-medium ${slotLayout === 'horizontal-wrap' ? 'bg-white dark:bg-gray-600 shadow text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'}`}>雙排</button>
                                        </div>
                                    </SettingsSection>
                                </SettingsCard>
                            )}
                            <SettingsCard>
                               <SettingsSection title="字體縮放">
                                    <label className="text-sm text-gray-600 dark:text-gray-400 flex justify-between items-center mb-2">
                                        <span>縮放比例</span>
                                        <span className="text-base font-semibold text-gray-800 dark:text-gray-200">{Math.round(fontScale * 100)}%</span>
                                    </label>
                                    <input type="range" min="0.5" max="5" step="0.1" value={fontScale} onChange={e => updateSetting('fontScale', Number(e.target.value))} className="w-full h-3 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer focus:outline-none"/>
                               </SettingsSection>
                            </SettingsCard>
                            {exportViewMode !== 'list' && <SettingsCard>
                               <SettingsSection title="間距">
                                    <div>
                                       <label className="text-sm text-gray-600 dark:text-gray-400 flex justify-between items-center mb-2">
                                           <span>水平間距</span>
                                           <span className="text-base font-semibold text-gray-800 dark:text-gray-200">{horizontalGap}px</span>
                                       </label>
                                       <input type="range" min="0" max="48" value={horizontalGap} onChange={e => updateSetting('horizontalGap', Number(e.target.value))} className="w-full h-3 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer focus:outline-none"/>
                                    </div>
                                    <div>
                                       <label className="text-sm text-gray-600 dark:text-gray-400 flex justify-between items-center mb-2">
                                           <span>垂直間距</span>
                                           <span className="text-base font-semibold text-gray-800 dark:text-gray-200">{verticalGap}px</span>
                                       </label>
                                       <input type="range" min="0" max="48" value={verticalGap} onChange={e => updateSetting('verticalGap', Number(e.target.value))} className="w-full h-3 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer focus:outline-none"/>
                                    </div>
                               </SettingsSection>
                            </SettingsCard>}
                          </>
                        )}
                      </div>
                    </div>
                </div>
            ) : (
                <div className="relative flex flex-col items-center justify-start pt-6">
                    <div className="w-full flex flex-col items-center">
                        <div className="relative w-16 h-16 flex items-center justify-center">
                            <DownloadIcon
                                className={`w-12 h-12 text-blue-600 transition-all duration-300 
                                    ${isExporting || exportStage === 'generating_image' ? 'opacity-100 scale-100 animate-pulse' : 'opacity-0 scale-50'}`
                                }
                            />
                            <CheckIcon
                                className={`w-16 h-16 text-green-500 absolute transition-all duration-300 delay-200
                                    ${exportStage === 'completed' ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`
                                }
                            />
                        </div>

                        <p className="mt-4 text-lg font-semibold text-gray-700 dark:text-gray-200 text-center">
                            {exportStage === 'completed' ? '成功！圖片已準備就緒。' : loadingMessage}
                        </p>
                        
                        {exportStage === 'completed' && (
                            <>
                                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 text-center max-w-xs">
                                    提示：長按下方圖片即可儲存至您的裝置。
                                </p>
                                <button onClick={handleOpenInNewTab} className="absolute top-0 right-0 text-sm font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors">
                                    在新分頁開啟 ↗
                                </button>
                            </>
                        )}

                        {generatedPngDataUrl && exportStage === 'completed' && (
                            <div className="w-full max-w-sm mt-6 flex flex-col items-center gap-4 pb-32">
                                <img 
                                    src={generatedPngDataUrl} 
                                    alt="產生的班表圖片" 
                                    className="w-full h-auto rounded-lg shadow-lg border border-gray-200 dark:border-gray-700"
                                />
                            </div>
                        )}
                        {exportStage === 'generating_image' && (
                            <AdSlot className="mt-6 w-full" allowedHostnames={['your.app', 'your-short.link', 'bit.ly']} />
                        )}
                    </div>
                    {exportStage === 'completed' && (
                        <div 
                            className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-t border-gray-200 dark:border-gray-700 z-50 flex justify-center"
                            style={{ paddingBottom: `calc(1rem + env(safe-area-inset-bottom))` }}
                        >
                            <AdSlot className="w-full" allowedHostnames={['your.app', 'your-short.link', 'bit.ly']} />
                        </div>
                    )}
                </div>
            )}
        </Modal>
    );
};

export default PngExportModal;