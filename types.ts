import React from 'react';

// types.ts

export interface Slot {
  time: string;
  state: 'available' | 'booked';
}

export type DayStatus = 'available' | 'dayOff' | 'closed' | 'fullyBooked' | 'training';

export interface DayData {
  status: DayStatus;
  slots: Slot[];
}

export interface ScheduleData {
  [dateKey: string]: DayData;
}

export interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
}

// --- Shared Types ---

export type Language = 'zh' | 'en';
export type DateFilter = 'all' | 'weekdays' | 'weekends';


// --- PNG Export Related Types ---

export type PngDisplayMode = 'calendar' | 'list';
export type PngDateRange = 'full' | 'remainingWeeks' | 'upcoming2Weeks';
export type PngStyle = 'minimal' | 'borderless' | 'wireframe' | 'custom';
export type PngTitleAlign = 'left' | 'center' | 'right';
export type PngBookedStyle = 'strikethrough' | 'fade';
export type PngStrikethroughThickness = 'thin' | 'thick';

// NEW: Define a type for padding values
interface Padding {
    top: string;
    right: string;
    bottom: string;
    left: string;
}

export interface PngSettingsState {
    pngDisplayMode: PngDisplayMode;
    pngDateRange: PngDateRange;
    pngListDateFilter: DateFilter;
    pngStyle: PngStyle;
    bgColor: string;
    textColor: string;
    borderColor: string;
    blockColor: string;
    showShadow: boolean;
    showTitle: boolean;
    titleAlign: PngTitleAlign;
    showBookedSlots: boolean;
    bookedStyle: PngBookedStyle;
    strikethroughColor: string;
    strikethroughThickness: PngStrikethroughThickness;
    fontScale: number;
    font: string;
    language: Language;
    dayOffColor: string;
    closedColor: string;
    fullyBookedColor: string;
    trainingColor: string;
    // NEW: Add separate padding controls for calendar and list views
    padding: {
        calendar: Padding;
        list: Padding;
    };
}

// --- Text Export Related Types ---

export type TextExportLayout = 'compact' | 'default' | 'double-row';
export type TextExportBookedStyle = 'strikethrough' | 'annotation';

export interface TextExportSettingsState {
    layout: TextExportLayout;
    language: Language;
    includeTitle: boolean;
    includeYear: boolean;
    showMonth: boolean;
    showBooked: boolean;
    showDayOfWeek: boolean;
    showFullyBooked: boolean;
    showDayOff: boolean;
    showTraining: boolean;
    bookedStyle: TextExportBookedStyle;
    slotSeparator: string;
    dateFilter: DateFilter;
}