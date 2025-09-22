// FIX: Create the missing utils.ts file with all the necessary helper functions.
import type { DayData, DayStatus } from './types';

/**
 * Formats a Date object into a 'YYYY-MM-DD' string key.
 * @param date The date to format.
 * @returns A string in 'YYYY-MM-DD' format.
 */
export const formatDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Determines the effective status of a day based on its data.
 * @param dayData The data for a specific day.
 * @returns The effective status: 'dayOff', 'closed', 'fullyBooked', 'training', 'available', or 'empty'.
 */
export const getEffectiveStatus = (dayData: DayData | undefined | null): DayStatus | 'empty' => {
  if (!dayData) {
    return 'empty';
  }
  if (dayData.status !== 'available') {
    return dayData.status;
  }
  // When status is 'available':
  if (!dayData.slots || dayData.slots.length === 0) {
    // A day marked 'available' but with no slots has no bookable times.
    return 'empty';
  }
  if (dayData.slots.every(s => s.state === 'booked')) {
    return 'fullyBooked';
  }
  return 'available';
};

/**
 * Map of day statuses to their Chinese text representation.
 */
export const DAY_STATUS_TEXT_MAP: { [key in DayStatus | 'empty']: string } = {
  available: '可預約',
  dayOff: '休假',
  closed: '公休',
  fullyBooked: '已額滿',
  training: '進修',
  empty: ''
};

/**
 * Map of day statuses to their English text representation.
 */
export const DAY_STATUS_TEXT_MAP_EN: { [key in DayStatus | 'empty']: string } = {
  available: 'Available',
  dayOff: 'Day Off',
  closed: 'Closed',
  fullyBooked: 'Fully Booked',
  training: 'Training',
  empty: ''
};

/**
 * Gets the display text for a given status and language.
 * @param status The day status.
 * @param language The target language ('zh' or 'en').
 * @returns The localized status text.
 */
export const getStatusText = (status: DayStatus | 'empty', language: 'zh' | 'en'): string => {
  return language === 'en' ? DAY_STATUS_TEXT_MAP_EN[status] : DAY_STATUS_TEXT_MAP[status];
};

/**
 * Applies a strikethrough effect to text using Unicode combining characters.
 * @param text The text to apply strikethrough to.
 * @returns The text with strikethrough.
 */
export const applyStrikethrough = (text: string): string => {
  return text.split('').map(char => char + '\u0336').join('');
};

/**
 * Converts a hex color string to an RGB object.
 * @param hex The hex color string (e.g., '#RRGGBB').
 * @returns An object with r, g, b properties, or null if invalid.
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  hex = hex.replace(shorthandRegex, (m, r, g, b) => {
    return r + r + g + g + b + b;
  });

  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Parses any valid CSS color string into an RGBA object.
 * @param color The color string to parse (hex, rgb, rgba, transparent).
 * @returns An object with r, g, b, a properties.
 */
export function colorToRgba(color: string): { r: number; g: number; b: number; a: number } {
    if (color === 'transparent') {
        return { r: 0, g: 0, b: 0, a: 0 };
    }

    if (color.startsWith('#')) {
        const rgb = hexToRgb(color);
        return rgb ? { ...rgb, a: 1 } : { r: 0, g: 0, b: 0, a: 1 };
    }

    const matchRgba = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (matchRgba) {
        return {
            r: parseInt(matchRgba[1], 10),
            g: parseInt(matchRgba[2], 10),
            b: parseInt(matchRgba[3], 10),
            a: matchRgba[4] !== undefined ? parseFloat(matchRgba[4]) : 1,
        };
    }
    
    // Fallback for invalid formats
    return { r: 0, g: 0, b: 0, a: 1 };
}

/**
 * Converts an RGBA object back to a CSS string (hex if opaque, rgba otherwise).
 * @param rgba The RGBA object.
 * @returns A CSS color string.
 */
export function rgbaToCssString(rgba: { r: number; g: number; b: number; a: number }): string {
    const { r, g, b, a } = rgba;
    if (a >= 1) {
        const toHex = (c: number) => `0${Math.round(c).toString(16)}`.slice(-2);
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }
    return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${Number(a.toFixed(3))})`;
}
