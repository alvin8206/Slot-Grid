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
 * Parses a color string (rgba, hex, transparent) into a hex value and an alpha channel.
 * @param color The color string to parse.
 * @returns An object with hex and alpha properties.
 */
export function parseColor(color: string): { hex: string; alpha: number } {
  if (color === 'transparent') {
    return { hex: '#000000', alpha: 0 };
  }

  if (color.startsWith('#')) {
    return { hex: color, alpha: 1 };
  }

  if (color.startsWith('rgba')) {
    const parts = color.substring(color.indexOf('(') + 1, color.lastIndexOf(')')).split(/,\s*/);
    if (parts.length === 4) {
      const r = parseInt(parts[0], 10);
      const g = parseInt(parts[1], 10);
      const b = parseInt(parts[2], 10);
      const alpha = parseFloat(parts[3]);
      
      const toHex = (c: number) => `0${c.toString(16)}`.slice(-2);
      const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
      
      return { hex, alpha };
    }
  }

  // Fallback for rgb() or other formats is not fully implemented.
  if (color.startsWith('rgb')) {
    const parts = color.substring(color.indexOf('(') + 1, color.lastIndexOf(')')).split(/,\s*/);
     if (parts.length === 3) {
      const r = parseInt(parts[0], 10);
      const g = parseInt(parts[1], 10);
      const b = parseInt(parts[2], 10);
      const toHex = (c: number) => `0${c.toString(16)}`.slice(-2);
      const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
      return { hex, alpha: 1 };
    }
  }

  // A simple fallback to opaque black for safety.
  return { hex: '#000000', alpha: 1 };
}
