export interface Slot {
  time: string;
  state: 'available' | 'booked';
}

export interface ScheduleData {
  [date: string]: Slot[];
}

export interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
}

export type PngStyle = 'minimal' | 'borderless' | 'wireframe' | 'custom';