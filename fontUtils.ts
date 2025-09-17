// utils/fontUtils.ts
import { getPrimaryFamily } from './fonts';

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

  // 步驟 1: 快取鍵現在只基於字體 ID，因為我們請求的是完整的字體檔。
  const cacheKey = id;

  if (fontCssCache.has(cacheKey)) {
    return fontCssCache.get(cacheKey)!;
  }

  // 步驟 2: 如果不在快取中，則建立一個新的 Promise 來處理，並將此 Promise 存入快取
  const promise = (async (): Promise<string> => {
    // 移除 text=... 參數，以獲取包含所有可用字集（如拉丁文、日文等）的完整字體 CSS。
    // 這對於不完全支援動態子集化的藝術或日文字體更為可靠。
    const cssUrl = `https://fonts.googleapis.com/css2?family=${urlValue.replace(/ /g, '+')}&display=swap`;
    
    try {
      // 步驟 2a: 抓取完整的 Google Fonts CSS 檔案
      const response = await fetch(cssUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch font CSS from Google: ${response.statusText}`);
      }
      let cssText = await response.text();

      // 步驟 2b: 使用正規表示式找出所有字體 URL (woff2, woff, ttf)
      const urlRegex = /url\((https:\/\/[^)]+\.(?:woff2|woff|ttf))\)/g;
      const fontUrls = Array.from(cssText.matchAll(urlRegex), m => m[1]);
      const uniqueFontUrls = [...new Set(fontUrls)];

      if (uniqueFontUrls.length === 0) {
        console.warn(`No font URLs found for font ${fontOption.name}. Falling back to @import.`);
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
      fontCssCache.delete(cacheKey);
      // 發生錯誤時，回退到簡單的 @import，雖然可能不完美，但比完全失敗好
      const fallbackCssUrl = `https://fonts.googleapis.com/css2?family=${urlValue.replace(/ /g, '+')}&display=swap`;
      return `@import url('${fallbackCssUrl}');`;
    }
  })();

  fontCssCache.set(cacheKey, promise);
  return promise;
}