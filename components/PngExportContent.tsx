// components/PngExportContent.tsx
import React, { useMemo } from 'react';
import type { ScheduleData, CalendarDay, PngSettingsState, DayStatus, PngDateRange } from '../types';
import { DAY_NAMES, DAY_NAMES_EN } from '../constants';
import { getEffectiveStatus, getStatusText, formatDateKey } from '../utils';
import type { WeekStartDay } from '../App';

export interface PngExportContentProps extends PngSettingsState {
    scheduleData: ScheduleData;
    title: string;
    calendarDays: CalendarDay[];
    currentDate: Date;
    weekStartsOn: WeekStartDay;
}

const PngExportContent = React.forwardRef<HTMLDivElement, PngExportContentProps>(({
    scheduleData, title, currentDate, calendarDays, weekStartsOn, pngStyle, bgColor, textColor, borderColor, blockColor, showTitle, showBookedSlots, bookedStyle, strikethroughColor, strikethroughThickness, fontScale, font, language, showShadow, pngDisplayMode, pngDateRange, titleAlign, dayOffColor, closedColor, fullyBookedColor, trainingColor, pngListDateFilter, padding
}, ref) => {
    
    const BASE_FONT_SIZE = 14;

    const dayNames = useMemo(() => {
        const baseDayNames = language === 'zh' ? DAY_NAMES : DAY_NAMES_EN;
        if (weekStartsOn === 'monday') {
            const [sunday, ...restOfWeek] = baseDayNames;
            return [...restOfWeek, sunday];
        }
        return baseDayNames;
    }, [language, weekStartsOn]);

    // NEW: Create a non-reordered day names array specifically for list view lookups.
    const baseDayNamesForList = useMemo(() => {
        return language === 'zh' ? DAY_NAMES : DAY_NAMES_EN;
    }, [language]);

    // NEW: Dynamically select padding based on the current display mode
    const activePadding = useMemo(() => {
        return pngDisplayMode === 'list' ? padding.list : padding.calendar;
    }, [pngDisplayMode, padding]);

    const containerStyles: React.CSSProperties = {
        backgroundColor: bgColor,
        color: textColor,
        fontFamily: font,
        fontSize: `${BASE_FONT_SIZE * fontScale}px`,
        width: '800px',
        paddingTop: activePadding.top,
        paddingRight: activePadding.right,
        paddingBottom: activePadding.bottom,
        paddingLeft: activePadding.left,
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

    // FIX: Instead of slicing the array, calculate the start date of the visible range.
    // This allows us to hide days before this date while preserving the calendar grid structure.
    const startOfVisibleRangeDate = useMemo(() => {
        if (pngDisplayMode !== 'calendar' || pngDateRange !== 'remainingWeeks') {
            return null; // No filtering needed for full month view or list view in this logic block.
        }

        const todayIndex = calendarDays.findIndex(d => d.date.getTime() === today.getTime());
        if (todayIndex === -1) {
            const currentMonthStartDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            // If viewing a future month, show everything.
            if (today < currentMonthStartDate) {
                return null;
            }
            // If viewing a past month, show nothing by setting a future date.
            const farFutureDate = new Date();
            farFutureDate.setFullYear(farFutureDate.getFullYear() + 10);
            return farFutureDate;
        }

        let dayOfWeekForToday = today.getDay(); // 0=Sun, 1=Mon...
        if (weekStartsOn === 'monday') {
            dayOfWeekForToday = (dayOfWeekForToday === 0) ? 6 : dayOfWeekForToday - 1;
        }

        const startOfWeekIndex = todayIndex - dayOfWeekForToday;
        if (startOfWeekIndex < 0 || startOfWeekIndex >= calendarDays.length) {
             return null;
        }
        
        const startOfWeekDate = new Date(calendarDays[startOfWeekIndex].date);
        startOfWeekDate.setHours(0, 0, 0, 0);
        return startOfWeekDate;

    }, [calendarDays, pngDateRange, pngDisplayMode, today, currentDate, weekStartsOn]);

    // Use the original full calendarDays array and split it into weeks.
    // The filtering will happen during render time.
    const weeks = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
        weeks.push(calendarDays.slice(i, i + 7));
    }
    
    const listData = useMemo(() => {
        const allScheduleEntries = Object.keys(scheduleData)
            .map(key => ({ dateKey: key, date: new Date(key) }))
            .sort((a, b) => a.date.getTime() - b.date.getTime());

        let dateRangeFilteredEntries: { dateKey: string; date: Date; }[] = [];

        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth();

        switch (pngDateRange) {
            case 'full':
                dateRangeFilteredEntries = allScheduleEntries.filter(({ date }) =>
                    date.getFullYear() === currentYear && date.getMonth() === currentMonth
                );
                break;
            case 'remainingWeeks':
                dateRangeFilteredEntries = allScheduleEntries.filter(({ date }) =>
                    date.getFullYear() === currentYear &&
                    date.getMonth() === currentMonth &&
                    date.getTime() >= today.getTime()
                );
                break;
            case 'upcoming2Weeks':
                const twoWeeksFromNow = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
                dateRangeFilteredEntries = allScheduleEntries.filter(({ date }) =>
                    date.getTime() >= today.getTime() &&
                    date.getTime() < twoWeeksFromNow.getTime()
                );
                break;
        }

        // Apply the new weekday/weekend filter on top of the date range filter
        const finalListEntries = dateRangeFilteredEntries.filter(({ date }) => {
            const dayOfWeek = date.getDay();
            if (pngListDateFilter === 'weekdays') {
                return dayOfWeek >= 1 && dayOfWeek <= 5;
            }
            if (pngListDateFilter === 'weekends') {
                return dayOfWeek === 0 || dayOfWeek === 6;
            }
            return true; // for 'all'
        });

        return finalListEntries;

    }, [scheduleData, currentDate, pngDateRange, today, pngListDateFilter]);
    
    const contentStyle: React.CSSProperties = {
        marginTop: showTitle ? '24px' : '0px',
    };

    return (
        <div ref={ref} style={containerStyles}>
            {showTitle && <h1 className="text-3xl font-bold" style={{ color: textColor, textAlign: titleAlign, margin: 0, letterSpacing: '0.05em' }}>{title}</h1>}
            
            <div style={contentStyle}>
                {pngDisplayMode === 'list' ? (
                    // FIX: Add a minimum height and a placeholder message for when listData is empty. This prevents the preview area from collapsing and covering the toggle icons.
                    <div className="space-y-4" style={{ minHeight: listData.length === 0 ? '200px' : 'auto' }}>
                        {listData.length > 0 ? (
                            listData.map(({dateKey, date}) => {
                                const dayData = scheduleData[dateKey];
                                const effectiveStatus = getEffectiveStatus(dayData);

                                if (effectiveStatus === 'empty') return null;

                                if (effectiveStatus === 'fullyBooked' && !showBookedSlots) {
                                    return null;
                                }
                                
                                if (effectiveStatus === 'available') {
                                    const slots = dayData?.slots || [];
                                    const hasVisibleSlots = showBookedSlots || slots.some(s => s.state === 'available');
                                    if (!hasVisibleSlots) return null;
                                }

                                return (
                                    <div key={dateKey} className="grid grid-cols-3 gap-4 items-start pb-4 border-b" style={{ borderColor: borderColor === 'transparent' ? '#e5e7eb' : borderColor }}>
                                        <div className="col-span-1 font-bold">
                                            {/* FIX: Use the non-reordered `baseDayNamesForList` to prevent incorrect day name lookup when `weekStartsOn` is 'monday'. */}
                                            {`${date.getMonth() + 1}/${date.getDate()} (${baseDayNamesForList[date.getDay()]})`}
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
                            })
                        ) : (
                            <div className="flex items-center justify-center h-full text-center" style={{ color: textColor, opacity: 0.6 }}>
                                <p>{language === 'zh' ? '在此範圍內沒有可顯示的時段。' : 'No available slots in this range.'}</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-7" style={{ gap: '8px' }}>
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
                                
                                const isFullyBookedAndHidden = effectiveStatus === 'fullyBooked' && !showBookedSlots;

                                // FIX: This is the core logic fix. A day is only visible if it's in the current
                                // month AND it's not before the calculated start of the visible range.
                                const isVisibleDay = day.isCurrentMonth && (!startOfVisibleRangeDate || day.date >= startOfVisibleRangeDate);

                                return (
                                    <div key={`${weekIndex}-${dayIndex}`} style={getBlockStyles(isVisibleDay, isPlaceholderRow)}>
                                        <p className="font-bold" style={{ color: isVisibleDay ? textColor : 'transparent' }}>
                                            {day.date.getDate()}
                                        </p>
                                        {isVisibleDay && effectiveStatus !== 'available' && effectiveStatus !== 'empty' && !isFullyBookedAndHidden && (
                                            <div className="flex-grow flex items-center justify-center">
                                                <span className="font-bold" style={{ color: getStatusColor(effectiveStatus), textAlign: 'center' }}>{getStatusText(effectiveStatus, language)}</span>
                                            </div>
                                        )}
                                        {isVisibleDay && effectiveStatus === 'available' && dayData?.slots && dayData.slots.length > 0 && (
                                            (() => {
                                                const finalSlots = showBookedSlots ? dayData.slots : dayData.slots.filter(s => s.state === 'available');
                                                if (finalSlots.length === 0) return null;
                                                
                                                return (
                                                    <ul className="space-y-1 mt-1 text-center font-bold">
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
        </div>
    );
});

export default PngExportContent;
