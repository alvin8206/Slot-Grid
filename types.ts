// FIX: Replaced the file content with type definitions. The original content was a duplicate of App.tsx, which is incorrect for a .ts file and caused numerous errors.
export interface Slot {
  time: string;
  state: 'available' | 'booked';
}

export interface ScheduleData {
  [dateKey: string]: Slot[];
}

export interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
}

export type PngStyle = 'minimal' | 'borderless' | 'wireframe' | 'custom';

export type PngExportViewMode = 'month' | 'remaining' | 'list';

export type TitleAlign = 'left' | 'center' | 'right';
