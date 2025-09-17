import { getPrimaryFamily } from './fonts';

// utils/fontUtils.ts

interface FontOption {
  id: string;
  name: string;
  urlValue: string;
}

// 智慧快取：避免重複抓取和轉碼同一個字體
const fontCssCache = new Map<string, Promise<string>>();

/**
 * 將給定的 URL 資源轉碼為 Base64 格式的 Data URL。
 * @param url 資源的 URL
 * @returns Base64 Data URL
 */
async function urlToBase64(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch font file: ${response.statusText}`);
    }
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error(`Error converting font to Base64 from URL: ${url}`, error);
    throw error;
  }
}

/**
 * 核心函式：為 PNG 匯出準備自給自足的、內嵌了 Base64 字體資料的 @font-face CSS 規則。
 * 這次的實作方式是下載完整的 Google Fonts CSS，然後將其中的所有字體 URL 替換為 Base64 Data URL。
 * 帶有 Promise 快取，確保同一個字體只會被處理一次。
 * @param fontOption 要嵌入的字體選項
 * @returns 包含 @font-face 的完整 CSS 規則字串
 */
export function embedFontForExport(fontOption: FontOption): Promise<string> {
  const { id, urlValue } = fontOption;

  // 步驟 1: 檢查快取
  if (fontCssCache.has(id)) {
    return fontCssCache.get(id)!;
  }

  // 步驟 2: 如果不在快取中，則建立一個新的 Promise 來處理，並將此 Promise 存入快取
  const promise = (async (): Promise<string> => {
    const cssUrl = `https://fonts.googleapis.com/css2?family=${urlValue.replace(/ /g, '+')}&display=swap`;
    
    try {
      // 步驟 2a: 抓取完整的 Google Fonts CSS 檔案
      const response = await fetch(cssUrl, {
        headers: {
          // 使用標準的 User-Agent，讓 Google Fonts 回傳 woff2 格式
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch font CSS from Google: ${response.statusText}`);
      }
      let cssText = await response.text();

      // 步驟 2b: 使用正規表示式找出所有 .woff2 的 URL
      const urlRegex = /url\((https:\/\/[^)]+\.woff2)\)/g;
      const fontUrls = Array.from(cssText.matchAll(urlRegex), m => m[1]);
      const uniqueFontUrls = [...new Set(fontUrls)];

      if (uniqueFontUrls.length === 0) {
        console.warn(`No .woff2 URLs found for font ${fontOption.name}. Falling back to @import.`);
        return `@import url('${cssUrl}');`;
      }

      // 步驟 2c: 並行地將所有字體 URL 轉為 Base64
      const base64Promises = uniqueFontUrls.map(url => urlToBase64(url));
      const base64Urls = await Promise.all(base64Promises);
      
      const urlToBase64Map = new Map<string, string>();
      uniqueFontUrls.forEach((url, index) => {
        urlToBase64Map.set(url, base64Urls[index]);
      });

      // 步驟 2d: 在原始 CSS 文字中，將所有 URL 替換為對應的 Base64 Data URL
      cssText = cssText.replace(urlRegex, (match, url) => {
          const base64 = urlToBase64Map.get(url);
          return base64 ? `url(${base64})` : match;
      });
      
      return cssText;

    } catch (error) {
      console.error(`Font embedding process failed for ${fontOption.name}:`, error);
      fontCssCache.delete(id);
      return `@import url('${cssUrl}');`;
    }
  })();

  fontCssCache.set(id, promise);
  return promise;
}
