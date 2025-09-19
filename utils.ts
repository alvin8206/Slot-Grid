// utils.ts
import type { DayData, DayStatus } from './types';

export const DAY_STATUS_TEXT_MAP: Record<DayStatus | 'empty', string> = {
  available: '可預約',
  dayOff: '休假',
  closed: '公休',
  fullyBooked: '已額滿',
  empty: '' // Empty status should not produce text
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
