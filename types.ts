import React from 'react';

// types.ts

export interface Slot {
  time: string;
  state: 'available' | 'booked';
}

// NEW: Define the status for a whole day
export type DayStatus = 'available' | 'dayOff' | 'closed' | 'fullyBooked' | 'training';

// NEW: Define the data structure for a single day
export interface DayData {
  status: DayStatus;
  slots: Slot[];
}

// UPDATED: ScheduleData now holds DayData objects
export interface ScheduleData {
  [dateKey: string]: DayData;
}

export interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
}

export type PngStyle = 'minimal' | 'borderless' | 'wireframe' | 'custom';

export type PngExportViewMode = 'month' | 'remaining' | 'list';

export type TitleAlign = 'left' | 'center' | 'right';

export interface PngSettingsState {
  exportViewMode: PngExportViewMode;
  pngStyle: PngStyle;
  bgColor: string;
  textColor: string;
  borderColor: string;
  blockColor: string;
  showShadow: boolean;
  showTitle: boolean;
  showBookedSlots: boolean;
  bookedStyle: 'strikethrough' | 'fade';
  strikethroughColor: string;
  strikethroughThickness: 'thin' | 'thick';
  fontScale: number;
  font: string;
  language: 'zh' | 'en';
  horizontalGap: number;
  verticalGap: number;
  titleAlign: TitleAlign;
  // REVERTED: Bring back individual color settings for each status
  dayOffColor: string;
  closedColor: string;
  fullyBookedColor: string;
  trainingColor: string;
  slotLayout: 'vertical' | 'horizontal-wrap';
}

export interface TextExportSettingsState {
  layout: 'default' | 'compact' | 'double-row';
  language: 'zh' | 'en';
  includeTitle: boolean;
  includeYear: boolean;
  showMonth: boolean;
  showBooked: boolean;
  showDayOfWeek: boolean;
  showFullyBooked: boolean;
  showDayOff: boolean;
  showTraining: boolean;
  bookedStyle: 'strikethrough' | 'annotation';
  slotSeparator: string;
  dateFilter: 'all' | 'weekdays' | 'weekends';
}