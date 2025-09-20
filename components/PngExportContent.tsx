// components/PngExportContent.tsx
import React, { useMemo } from 'react';
import type { ScheduleData, CalendarDay, PngSettingsState, DayStatus } from '../types';
import { MONTH_NAMES, DAY_NAMES, MONTH_NAMES_EN, DAY_NAMES_EN } from '../constants';
import { getEffectiveStatus, getStatusText, formatDateKey } from '../utils';

export interface PngExportContentProps extends Omit<PngSettingsState, 'slotLayout'> {
    scheduleData: ScheduleData;
    title: string;
    calendarDays: CalendarDay[];
    currentDate: Date;
}

const PngExportContent = React.forwardRef<HTMLDivElement, PngExportContentProps>(({
    scheduleData, title, currentDate, calendarDays, pngStyle, bgColor, textColor, borderColor, blockColor, showTitle, showBookedSlots, bookedStyle, strikethroughColor, strikethroughThickness, fontScale, font, language, horizontalGap, verticalGap, showShadow, exportViewMode, titleAlign, dayOffColor, closedColor, fullyBookedColor, trainingColor
}, ref) => {
    
    const monthNames = language === 'zh' ? MONTH_NAMES : MONTH_NAMES_EN;
    const dayNames = language === 'zh' ? DAY_NAMES : DAY_NAMES_EN;
    const BASE_FONT_SIZE = 14;

    const containerStyles: React.CSSProperties = {
        backgroundColor: bgColor,
        color: textColor,
        fontFamily: font,
        fontSize: `${BASE_FONT_SIZE * fontScale}px`,
        width: '800px',
        padding: '24px',
        boxSizing: 'border-box',
    };
    
    const getStatusColor = (status: DayStatus): string => {
        switch (status) {
            case 'dayOff': return dayOffColor;
            case 'closed': return closedColor;
            case 'fullyBooked': return fullyBookedColor;
            case 'training': return trainingColor;
            default: return textColor;
        }
    };
    
    const getBlockStyles = (isCurrentMonth: boolean, isPlaceholderRow: boolean): React.CSSProperties => {
        const styles: React.CSSProperties = {
            padding: '8px',
            borderRadius: '8px',
            minHeight: '100px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            boxShadow: showShadow ? '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)' : 'none',
        };

        if (isPlaceholderRow) {
            styles.display = 'contents';
            return styles;
        }

        if (!isCurrentMonth) {
            styles.visibility = 'hidden';
            return styles;
        }

        switch (pngStyle) {
            case 'minimal':
                styles.backgroundColor = 'transparent';
                styles.border = `1px solid transparent`;
                break;
            case 'borderless':
                styles.backgroundColor = blockColor;
                styles.border = `1px solid transparent`;
                break;
            case 'wireframe':
                styles.backgroundColor = 'transparent';
                styles.border = `1px solid ${borderColor}`;
                break;
            case 'custom':
                 styles.backgroundColor = blockColor;
                 styles.border = `1px solid ${borderColor}`;
                 break;
        }
        return styles;
    };

    // --- Logic for different view modes ---
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const filteredCalendarDays = useMemo(() => {
      if (exportViewMode === 'remaining') {
        const todayIndex = calendarDays.findIndex(d => d.date.getTime() === today.getTime());
        if (todayIndex === -1) return calendarDays; // Today is not in this month view
        
        const startOfWeekIndex = todayIndex - calendarDays[todayIndex].date.getDay();
        return calendarDays.slice(startOfWeekIndex);
      }
      return calendarDays;
    }, [calendarDays, exportViewMode, today]);

    const weeks = [];
    for (let i = 0; i < filteredCalendarDays.length; i += 7) {
        weeks.push(filteredCalendarDays.slice(i, i + 7));
    }
    
    const listData = useMemo(() => {
        if (exportViewMode !== 'list') return [];
        
        const currentMonth = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();
        
        return Object.keys(scheduleData)
            .map(key => ({ key, date: new Date(key) }))
            .filter(({ date }) => 
                date.getFullYear() === currentYear &&
                date.getMonth() === currentMonth &&
                date.getTime() >= today.getTime()
            )
            .sort((a, b) => a.date.getTime() - b.date.getTime());
    }, [scheduleData, currentDate, today, exportViewMode]);
    

    return (
        <div ref={ref} style={containerStyles}>
            {showTitle && <h1 className="text-3xl font-bold" style={{ color: textColor, marginBottom: '3rem', textAlign: titleAlign }}>{title}</h1>}
            
            {exportViewMode === 'list' ? (
                <div className="space-y-4">
                    {listData.map(({key: dateKey, date}) => {
                        const dayData = scheduleData[dateKey];
                        const effectiveStatus = getEffectiveStatus(dayData);

                        if (effectiveStatus === 'empty') return null;
                        
                        if (effectiveStatus === 'available') {
                            const slots = dayData?.slots || [];
                            const hasVisibleSlots = showBookedSlots || slots.some(s => s.state === 'available');
                            if (!hasVisibleSlots) return null;
                        }

                        return (
                            <div key={dateKey} className="grid grid-cols-3 gap-4 items-start pb-4 border-b" style={{ borderColor: borderColor === 'transparent' ? '#e5e7eb' : borderColor }}>
                                <div className="col-span-1 font-bold">
                                    {`${date.getMonth() + 1}/${date.getDate()} (${dayNames[date.getDay()]})`}
                                </div>
                                <div className="col-span-2 flex flex-wrap gap-x-3 gap-y-1">
                                    {effectiveStatus !== 'available' ? (
                                        <span className="font-bold" style={{ color: getStatusColor(effectiveStatus) }}>{getStatusText(effectiveStatus, language)}</span>
                                    ) : (
                                        (dayData?.slots && (showBookedSlots ? dayData.slots : dayData.slots.filter(s => s.state === 'available')) || []).map(slot => {
                                            const liStyle: React.CSSProperties = { color: textColor };
                                            if (slot.state === 'booked') {
                                                if (bookedStyle === 'fade') { liStyle.opacity = 0.3; } 
                                                else if (bookedStyle === 'strikethrough') {
                                                    liStyle.textDecoration = 'line-through';
                                                    liStyle.textDecorationColor = strikethroughColor;
                                                    liStyle.textDecorationThickness = strikethroughThickness === 'thick' ? '2.5px' : '1.5px';
                                                }
                                            }
                                            return <span key={slot.time} style={liStyle}>{slot.time}</span>;
                                        })
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="grid grid-cols-7" style={{ gap: `${verticalGap}px ${horizontalGap}px` }}>
                    {dayNames.map(dayName => (
                        <div key={dayName} className="font-bold text-center pb-2" style={{ color: textColor }}>
                            {dayName}
                        </div>
                    ))}
                    
                    {weeks.map((week, weekIndex) => {
                        const isPlaceholderRow = week.every(day => !day.isCurrentMonth);
                        return week.map((day, dayIndex) => {
                            const dateKey = formatDateKey(new Date(day.date));
                            const dayData = scheduleData[dateKey];
                            const effectiveStatus = getEffectiveStatus(dayData);

                            return (
                                <div key={`${weekIndex}-${dayIndex}`} style={getBlockStyles(day.isCurrentMonth, isPlaceholderRow)}>
                                    <p className="font-bold" style={{ color: day.isCurrentMonth ? textColor : 'transparent' }}>
                                        {day.date.getDate()}
                                    </p>
                                    {day.isCurrentMonth && effectiveStatus !== 'available' && effectiveStatus !== 'empty' && (
                                        <div className="flex-grow flex items-center justify-center">
                                            <span className="font-bold" style={{ fontSize: '1.1em', color: getStatusColor(effectiveStatus) }}>{getStatusText(effectiveStatus, language)}</span>
                                        </div>
                                    )}
                                    {day.isCurrentMonth && effectiveStatus === 'available' && dayData?.slots && dayData.slots.length > 0 && (
                                        (() => {
                                            const finalSlots = showBookedSlots ? dayData.slots : dayData.slots.filter(s => s.state === 'available');
                                            if (finalSlots.length === 0) return null;
                                            
                                            return (
                                                <ul className="space-y-1 mt-1 text-center">
                                                    {finalSlots.map(slot => {
                                                        const liStyle: React.CSSProperties = { color: textColor };
                                                        if (slot.state === 'booked') {
                                                            if (bookedStyle === 'fade') {
                                                                liStyle.opacity = 0.3;
                                                            } else if (bookedStyle === 'strikethrough') {
                                                                liStyle.textDecoration = 'line-through';
                                                                liStyle.textDecorationColor = strikethroughColor;
                                                                liStyle.textDecorationThickness = strikethroughThickness === 'thick' ? '2.5px' : '1.5px';
                                                            }
                                                        }
                                                        return (
                                                            <li key={slot.time} style={liStyle}>
                                                              {slot.time}
                                                            </li>
                                                        );
                                                    })}
                                                </ul>
                                            );
                                        })()
                                    )}
                                </div>
                            );
                        });
                    })}
                </div>
            )}
        </div>
    );
});

export default PngExportContent;