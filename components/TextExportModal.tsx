import React, { useState, useMemo } from 'react';
import type { ScheduleData, TextExportSettingsState } from '../types';
import { MONTH_NAMES, DAY_NAMES, MONTH_NAMES_EN, DAY_NAMES_EN } from '../constants';
import Modal from './Modal';
import { getEffectiveStatus, applyStrikethrough, DAY_STATUS_TEXT_MAP } from '../utils';
import { LightbulbIcon } from './icons';

interface TextExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    scheduleData: ScheduleData;
    title: string;
    currentDate: Date;
    loginPromptContent?: React.ReactNode;
    textExportSettings: TextExportSettingsState;
    setTextExportSettings: React.Dispatch<React.SetStateAction<TextExportSettingsState>>;
}

const SEPARATOR_OPTIONS = [
    { display: ',', value: ', ' },
    { display: '、', value: '、' },
    { display: '，', value: '・' },
    { display: '⟡', value: ' ⟡ ' },
    { display: '-', value: ' - ' },
    { display: '｜', value: '｜' },
    { display: '／', value: '／' },
];

const TextExportModal: React.FC<TextExportModalProps> = ({
    isOpen,
    onClose,
    scheduleData,
    title,
    currentDate,
    loginPromptContent,
    textExportSettings,
    setTextExportSettings
}) => {
    const [copyButtonText, setCopyButtonText] = useState('複製內文');

    const {
        layout, language, includeTitle, includeYear, showMonth,
        showBooked, showDayOfWeek, showFullyBooked, showDayOff, bookedStyle,
        slotSeparator
    } = textExportSettings;

    const updateSetting = <K extends keyof TextExportSettingsState>(key: K, value: TextExportSettingsState[K]) => {
        setTextExportSettings(prev => ({ ...prev, [key]: value }));
    };
    
    const generatedText = useMemo(() => {
        let text = '';
        if (includeTitle) {
            text += `${title}\n\n`;
        }

        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth();

        const sortedDates = Object.keys(scheduleData)
            .filter(key => {
                const date = new Date(key);
                return date.getFullYear() === currentYear && date.getMonth() === currentMonth;
            })
            .sort((a, b) => a.localeCompare(b));
            
        // FIX: Define ExportLine as a discriminated union to correctly correlate 'type' and the type of 'content'.
        // This resolves the type predicate error by ensuring the type is specific.
        type ExportLine = {
            datePart: string;
            dayOfWeekPart: string;
            content: string;
            type: 'status';
        } | {
            datePart: string;
            dayOfWeekPart: string;
            content: string[];
            type: 'slots';
        };

        const linesData = sortedDates
            .map(dateKey => {
                const date = new Date(dateKey);
                const dayData = scheduleData[dateKey];
                const effectiveStatus = getEffectiveStatus(dayData);

                if (effectiveStatus === 'empty') return null;
                if (effectiveStatus === 'fullyBooked' && !showFullyBooked) return null;
                if ((effectiveStatus === 'dayOff' || effectiveStatus === 'closed') && !showDayOff) return null;

                const year = date.getFullYear();
                const month = (date.getMonth() + 1).toString();
                const day = date.getDate().toString();

                const datePartStr = showMonth ? `${month}/${day}` : day;
                const finalDatePart = includeYear ? `${year}/${datePartStr}` : datePartStr;
                
                let dayOfWeekPart = '';
                if (showDayOfWeek) {
                    if (language === 'zh') {
                        const dayOfWeek = DAY_NAMES[date.getDay()];
                        dayOfWeekPart = `（${dayOfWeek}）`;
                    } else {
                        const dayOfWeek = DAY_NAMES_EN[date.getDay()];
                        dayOfWeekPart = `(${dayOfWeek})`;
                    }
                }

                if (effectiveStatus !== 'available') {
                    return { datePart: finalDatePart, dayOfWeekPart, content: DAY_STATUS_TEXT_MAP[effectiveStatus], type: 'status' as const };
                }

                const relevantSlots = dayData?.slots || [];
                const finalSlots = showBooked ? relevantSlots : relevantSlots.filter(s => s.state === 'available');

                if (finalSlots.length === 0) return null;

                const slotsToDisplay = finalSlots.map(slot => {
                    if (slot.state === 'booked') {
                        if (bookedStyle === 'strikethrough') {
                            return applyStrikethrough(slot.time);
                        }
                        return `${slot.time} ${language === 'zh' ? '(已預約)' : '(Booked)'}`;
                    }
                    return slot.time;
                });

                return { datePart: finalDatePart, dayOfWeekPart, content: slotsToDisplay, type: 'slots' as const };
            })
            .filter((line): line is ExportLine => line !== null);

        if (linesData.length === 0) {
            if (includeTitle) {
                return text.trim();
            }
            return language === 'zh' ? "根據目前的篩選條件，沒有可顯示的時段。" : "No available slots to display with the current filters.";
        }
        
        const getTextWidth = (str: string): number => {
            let width = 0;
            for (let i = 0; i < str.length; i++) {
                if (str.charCodeAt(i) > 255) {
                    width += 2;
                } else {
                    width += 1;
                }
            }
            return width;
        };

        if (layout === 'compact') {
            const maxDateWidth = Math.max(0, ...linesData.map(line => getTextWidth(line.datePart)));
            const maxDayOfWeekWidth = Math.max(0, ...linesData.map(line => getTextWidth(line.dayOfWeekPart)));
            
            const textContent = linesData.map(line => {
                const contentStr = Array.isArray(line.content) ? line.content.join(slotSeparator) : line.content;

                const datePadding = ' '.repeat(Math.max(0, maxDateWidth - getTextWidth(line.datePart)));
                const paddedDatePart = `${line.datePart}${datePadding}`;
                
                if (showDayOfWeek) {
                    const dayOfWeekPadding = ' '.repeat(Math.max(0, maxDayOfWeekWidth - getTextWidth(line.dayOfWeekPart)));
                    const paddedDayOfWeekPart = `${line.dayOfWeekPart}${dayOfWeekPadding}`;
                    return `${paddedDatePart} ${paddedDayOfWeekPart}  ${contentStr}`;
                } else {
                    return `${paddedDatePart}  ${contentStr}`;
                }
            }).join('\n');
            text += textContent;
        } else if (layout === 'double-row') {
            const textContent = linesData.map(line => {
                const prefix = line.dayOfWeekPart ? `${line.datePart}${line.dayOfWeekPart}` : line.datePart;
                const contentStr = Array.isArray(line.content) ? line.content.join(slotSeparator) : line.content;
                return `${prefix}\n${contentStr}`;
            }).join('\n\n');
            text += textContent;
        } else { // default layout
            const textContent = linesData.map(line => {
                const prefix = line.dayOfWeekPart ? `${line.datePart}${line.dayOfWeekPart}` : line.datePart;
                if (line.type === 'slots') {
                    const slotsStr = line.content.map(s => s).join('\n');
                    return `${prefix}\n${slotsStr}`;
                }
                return `${prefix}: ${line.content}`;
            }).join('\n\n');
            text += textContent;
        }

        return text.trim();
    }, [scheduleData, title, currentDate, textExportSettings]);


    const handleCopy = () => {
        navigator.clipboard.writeText(generatedText).then(() => {
            setCopyButtonText(language === 'zh' ? '已複製!' : 'Copied!');
            setTimeout(() => setCopyButtonText(language === 'zh' ? '複製內文' : 'Copy Text'), 2000);
        }).catch(err => {
            console.error('Failed to copy text: ', err);
            alert(language === 'zh' ? '複製失敗！' : 'Failed to copy!');
        });
    };

    if (!isOpen) return null;

    const header = <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100" translate="no">匯出文字格式</h2>;
    const footer = (
        <>
            {loginPromptContent}
            <div className="grid grid-cols-2 gap-3 w-full">
                <button onClick={onClose} className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold py-3 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">關閉</button>
                <button onClick={handleCopy} className="bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors">{copyButtonText}</button>
            </div>
        </>
    );
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} headerContent={header} footerContent={footer}>
            <div className="space-y-6">
                <div>
                    <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border dark:border-gray-700">
                        <textarea 
                            readOnly 
                            value={generatedText}
                            className="w-full h-48 md:h-56 bg-transparent resize-none border-none focus:ring-0 text-sm text-gray-800 dark:text-gray-200"
                        />
                    </div>
                    {layout === 'compact' && (
                        <div className="mt-4 flex items-start gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800/50">
                            <LightbulbIcon className="w-5 h-5 text-blue-500 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                            <div className="text-xs text-blue-800 dark:text-blue-300">
                                <p className="font-semibold">Instagram 限時動態對齊提示：</p>
                                <p className="mt-1">
                                    建議在 IG 限動的字體選項中，選擇
                                    <strong className="font-bold">「打字機 (Typewriter)」</strong>或
                                    <strong className="font-bold">「經典 (Editor)」</strong>才能完美對齊。
                                </p>
                            </div>
                        </div>
                    )}
                </div>


                <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">排版</label>
                    <div className="grid grid-cols-3 gap-2 rounded-xl bg-gray-200 dark:bg-gray-700 p-1">
                        <button onClick={() => updateSetting('layout', 'default')} className={`py-2 rounded-lg transition-all text-sm font-medium ${layout === 'default' ? 'bg-white dark:bg-gray-600 shadow text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'}`}>垂直</button>
                        <button onClick={() => updateSetting('layout', 'compact')} className={`py-2 rounded-lg transition-all text-sm font-medium ${layout === 'compact' ? 'bg-white dark:bg-gray-600 shadow text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'}`}>水平</button>
                        <button onClick={() => updateSetting('layout', 'double-row')} className={`py-2 rounded-lg transition-all text-sm font-medium ${layout === 'double-row' ? 'bg-white dark:bg-gray-600 shadow text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'}`}>雙排</button>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">時段分隔符</label>
                    <div className="grid grid-cols-7 gap-2 rounded-xl bg-gray-200 dark:bg-gray-700 p-1">
                        {SEPARATOR_OPTIONS.map(opt => (
                            <button 
                                key={opt.value}
                                onClick={() => updateSetting('slotSeparator', opt.value)} 
                                className={`py-2 rounded-lg transition-all text-sm font-medium ${slotSeparator === opt.value ? 'bg-white dark:bg-gray-600 shadow text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'}`}
                            >
                                {opt.display}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">語言</label>
                    <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-200 dark:bg-gray-700 p-1">
                        <button onClick={() => updateSetting('language', 'zh')} className={`py-2 rounded-lg transition-all text-sm font-medium ${language === 'zh' ? 'bg-white dark:bg-gray-600 shadow text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'}`}>中文</button>
                        <button onClick={() => updateSetting('language', 'en')} className={`py-2 rounded-lg transition-all text-sm font-medium ${language === 'en' ? 'bg-white dark:bg-gray-600 shadow text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'}`}>English</button>
                    </div>
                </div>
                
                <div className="space-y-3">
                    <label htmlFor="include-title" className="flex items-center justify-between bg-white dark:bg-gray-800 p-3 rounded-lg border dark:border-gray-700 cursor-pointer">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">顯示標題</span>
                        <div className="relative">
                            <input type="checkbox" id="include-title" className="sr-only peer" checked={includeTitle} onChange={e => updateSetting('includeTitle', e.target.checked)} />
                            <div className="block bg-gray-200 dark:bg-gray-600 w-10 h-6 rounded-full peer-checked:bg-blue-600 transition"></div>
                            <div className="dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition transform peer-checked:translate-x-full"></div>
                        </div>
                    </label>
                    <label htmlFor="include-year" className="flex items-center justify-between bg-white dark:bg-gray-800 p-3 rounded-lg border dark:border-gray-700 cursor-pointer">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">顯示年份</span>
                        <div className="relative">
                            <input type="checkbox" id="include-year" className="sr-only peer" checked={includeYear} onChange={e => updateSetting('includeYear', e.target.checked)} />
                            <div className="block bg-gray-200 dark:bg-gray-600 w-10 h-6 rounded-full peer-checked:bg-blue-600 transition"></div>
                            <div className="dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition transform peer-checked:translate-x-full"></div>
                        </div>
                    </label>
                    <label htmlFor="show-month" className="flex items-center justify-between bg-white dark:bg-gray-800 p-3 rounded-lg border dark:border-gray-700 cursor-pointer">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">顯示月份</span>
                        <div className="relative">
                            <input type="checkbox" id="show-month" className="sr-only peer" checked={showMonth} onChange={e => updateSetting('showMonth', e.target.checked)} />
                            <div className="block bg-gray-200 dark:bg-gray-600 w-10 h-6 rounded-full peer-checked:bg-blue-600 transition"></div>
                            <div className="dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition transform peer-checked:translate-x-full"></div>
                        </div>
                    </label>
                    <label htmlFor="show-day-of-week" className="flex items-center justify-between bg-white dark:bg-gray-800 p-3 rounded-lg border dark:border-gray-700 cursor-pointer">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">顯示星期</span>
                        <div className="relative">
                            <input type="checkbox" id="show-day-of-week" className="sr-only peer" checked={showDayOfWeek} onChange={e => updateSetting('showDayOfWeek', e.target.checked)} />
                            <div className="block bg-gray-200 dark:bg-gray-600 w-10 h-6 rounded-full peer-checked:bg-blue-600 transition"></div>
                            <div className="dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition transform peer-checked:translate-x-full"></div>
                        </div>
                    </label>
                    <label htmlFor="show-day-off" className="flex items-center justify-between bg-white dark:bg-gray-800 p-3 rounded-lg border dark:border-gray-700 cursor-pointer">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">顯示休假日</span>
                        <div className="relative">
                            <input type="checkbox" id="show-day-off" className="sr-only peer" checked={showDayOff} onChange={e => updateSetting('showDayOff', e.target.checked)} />
                            <div className="block bg-gray-200 dark:bg-gray-600 w-10 h-6 rounded-full peer-checked:bg-blue-600 transition"></div>
                            <div className="dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition transform peer-checked:translate-x-full"></div>
                        </div>
                    </label>
                     <label htmlFor="show-fully-booked" className="flex items-center justify-between bg-white dark:bg-gray-800 p-3 rounded-lg border dark:border-gray-700 cursor-pointer">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">顯示已額滿日</span>
                        <div className="relative">
                            <input type="checkbox" id="show-fully-booked" className="sr-only peer" checked={showFullyBooked} onChange={e => updateSetting('showFullyBooked', e.target.checked)} />
                            <div className="block bg-gray-200 dark:bg-gray-600 w-10 h-6 rounded-full peer-checked:bg-blue-600 transition"></div>
                            <div className="dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition transform peer-checked:translate-x-full"></div>
                        </div>
                    </label>
                    <label htmlFor="show-booked" className="flex items-center justify-between bg-white dark:bg-gray-800 p-3 rounded-lg border dark:border-gray-700 cursor-pointer">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">顯示已預約時段</span>
                        <div className="relative">
                            <input type="checkbox" id="show-booked" className="sr-only peer" checked={showBooked} onChange={e => updateSetting('showBooked', e.target.checked)} />
                            <div className="block bg-gray-200 dark:bg-gray-600 w-10 h-6 rounded-full peer-checked:bg-blue-600 transition"></div>
                            <div className="dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition transform peer-checked:translate-x-full"></div>
                        </div>
                    </label>
                    {showBooked && (
                        <div className="space-y-2 pt-3 border-t border-gray-200/60 dark:border-gray-700/60">
                            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">已預約樣式</label>
                            <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-200 dark:bg-gray-700 p-1">
                                <button onClick={() => updateSetting('bookedStyle', 'strikethrough')} className={`py-2 rounded-lg transition-all text-sm font-medium ${bookedStyle === 'strikethrough' ? 'bg-white dark:bg-gray-600 shadow text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'}`}>刪除線</button>
                                <button onClick={() => updateSetting('bookedStyle', 'annotation')} className={`py-2 rounded-lg transition-all text-sm font-medium ${bookedStyle === 'annotation' ? 'bg-white dark:bg-gray-600 shadow text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'}`}>文字註記</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
};

export default TextExportModal;