// utils/ts
import type { DayData, DayStatus } from './types';

export const parseColor = (colorStr: string): { hex: string; alpha: number } => {
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

export const hexToRgb = (hex: string): { r: number, g: number, b: number } | null => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
};

export const DAY_STATUS_TEXT_MAP: Record<DayStatus | 'empty', string> = {
  available: '可預約',
  dayOff: '休假',
  closed: '公休',
  fullyBooked: '已額滿',
  empty: '' // Empty status should not produce text
};

export const DAY_STATUS_TEXT_MAP_EN: Record<DayStatus | 'empty', string> = {
  available: 'Available',
  dayOff: 'Day Off',
  closed: 'Closed',
  fullyBooked: 'Full',
  empty: ''
};

export const getStatusText = (status: DayStatus | 'empty', language: 'zh' | 'en'): string => {
    if (language === 'en') {
        return DAY_STATUS_TEXT_MAP_EN[status];
    }
    return DAY_STATUS_TEXT_MAP[status];
};


export const formatDateKey = (date: Date): string => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0); // Normalize to midnight
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const applyStrikethrough = (text: string) => text.split('').join('\u0336') + '\u0336';

/**
 * NEW: Determines the effective status of a day for display purposes.
 * If a day is 'available' but all its slots are 'booked', it's considered 'fullyBooked'.
 */
export const getEffectiveStatus = (dayData: DayData | undefined): DayStatus | 'empty' => {
  // FIX: This is the critical fix. This check now robustly handles `undefined`, `null`, and empty objects `{}`.
  if (!dayData || Object.keys(dayData).length === 0) {
    return 'empty';
  }
  
  const { status, slots } = dayData;

  // If status is explicitly set to something other than available, respect it.
  if (status && status !== 'available') {
    return status;
  }
  
  // From here, we're dealing with an 'available' status or cases where status is missing.
  // If it's considered 'available' but has no slots, it's effectively empty for display.
  if (!slots || slots.length === 0) {
    return 'empty';
  }

  // THE CORE LOGIC: If status is 'available' and all slots are 'booked', it's effectively 'fullyBooked'.
  if (slots.every(slot => slot.state === 'booked')) {
    return 'fullyBooked';
  }

  // Otherwise, it's still available.
  return 'available';
};