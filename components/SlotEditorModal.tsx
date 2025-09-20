// components/SlotEditorModal.tsx
import React, { useState, useEffect, useMemo } from 'react';
import type { Slot, DayStatus, DayData, ScheduleData, CalendarDay } from '../types';
import { MONTH_NAMES, DAY_NAMES, PREDEFINED_SLOTS } from '../constants';
import { CopyIcon, ClipboardIcon, TrashIcon, CheckIcon } from './icons';
import Modal from './Modal';
import { getEffectiveStatus, formatDateKey, DAY_STATUS_TEXT_MAP } from '../utils';

interface SlotEditorModalProps {
  isOpen: boolean;
  selectedDay: Date | null;
  scheduleData: ScheduleData;
  calendarDays: CalendarDay[];
  onClose: () => void;
  onDone: (updatedDay: { date: Date, dayData: DayData }, pastedDays: string[]) => void;
  copiedSlots: Slot[] | null;
  onCopy: (slots: Slot[]) => void;
  loginPromptContent?: React.ReactNode;
}

const SlotEditorModal: React.FC<SlotEditorModalProps> = ({ isOpen, selectedDay, scheduleData, calendarDays, onClose, onDone, copiedSlots, onCopy, loginPromptContent }) => {
  const [localSlots, setLocalSlots] = useState<Map<string, Slot>>(new Map());
  const [localStatus, setLocalStatus] = useState<DayStatus>('available');
  const [customSlot, setCustomSlot] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [multiPasteDates, setMultiPasteDates] = useState<Set<string>>(new Set());
  const [isMultiPasteExpanded, setIsMultiPasteExpanded] = useState(false);
  const [lastSelectedDateKey, setLastSelectedDateKey] = useState<string | null>(null);

  // Memoize the effective status to avoid re-calculating on every render inside the modal
  const effectiveStatus = useMemo(() => {
    if (!selectedDay) return 'empty';
    const dayData = scheduleData[formatDateKey(selectedDay)];
    return getEffectiveStatus(dayData);
  }, [selectedDay, scheduleData]);

  useEffect(() => {
    if (selectedDay) {
        const dayData = scheduleData[formatDateKey(selectedDay)];
        
        // If the day is effectively empty, we want the editor to start in a clean 'available' state.
        const initialStatus = effectiveStatus === 'empty' ? 'available' : effectiveStatus;
        setLocalStatus(initialStatus);
        
        setLocalSlots(new Map((dayData?.slots || []).map(slot => [slot.time, slot])));

        // Reset other modal-specific states
        setCopySuccess(false);
        setMultiPasteDates(new Set());
        setIsMultiPasteExpanded(false);
        setLastSelectedDateKey(null);
    }
  }, [selectedDay, scheduleData, isOpen, effectiveStatus]);

  const getSortedSlots = (slotsMap: Map<string, Slot>): Slot[] => {
    return Array.from(slotsMap.values()).sort((a, b) => a.time.localeCompare(b.time));
  };
  
  const handleSlotUpdate = (newSlotsMap: Map<string, Slot>) => {
      const sortedSlots = getSortedSlots(newSlotsMap);
      setLocalSlots(new Map<string, Slot>(sortedSlots.map(s => [s.time, s])));
  }

  const handleAddCustomSlot = () => {
    if (customSlot.match(/^\d{2}:\d{2}$/) && !localSlots.has(customSlot)) {
      const newSlots = new Map<string, Slot>(localSlots);
      newSlots.set(customSlot, { time: customSlot, state: 'available' });
      handleSlotUpdate(newSlots);
      setCustomSlot('');
    } else {
        alert("請輸入有效的時間格式 (HH:MM)，且該時段尚未存在。");
    }
  };

  const handleRemoveSlot = (slotTime: string) => {
    const newSlots = new Map<string, Slot>(localSlots);
    newSlots.delete(slotTime);
    handleSlotUpdate(newSlots);
  };
  
  const handleQuickAdd = (slotTime: string) => {
    if (!localSlots.has(slotTime)) {
        const newSlots = new Map<string, Slot>(localSlots);
        newSlots.set(slotTime, { time: slotTime, state: 'available' });
        handleSlotUpdate(newSlots);
    }
  };
  
  const handleCopy = () => {
    onCopy(getSortedSlots(localSlots));
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2500);
  };

  const handlePaste = () => {
    if (copiedSlots) {
      setLocalStatus('available');
      const newSlots = new Map<string, Slot>(copiedSlots.map(slot => [slot.time, {...slot, state: 'available'}as Slot]));
      handleSlotUpdate(newSlots);
    }
  };

  const toggleMultiPasteDate = (date: Date, event?: React.MouseEvent) => {
    const key = formatDateKey(date);
    const newSet = new Set(multiPasteDates);
    
    // Shift+Click range selection logic
    if (event?.shiftKey && lastSelectedDateKey && lastSelectedDateKey !== key) {
        const allKeysInMonth = calendarDays
            .filter(d => d.isCurrentMonth)
            .map(d => formatDateKey(d.date));
        
        const startIndex = allKeysInMonth.indexOf(lastSelectedDateKey);
        const endIndex = allKeysInMonth.indexOf(key);

        if (startIndex !== -1 && endIndex !== -1) {
            const [start, end] = [startIndex, endIndex].sort((a,b) => a - b);
            for (let i = start; i <= end; i++) {
                const dayKey = allKeysInMonth[i];
                const isTargetDay = selectedDay && formatDateKey(selectedDay) === dayKey;
                if(!isTargetDay) {
                   newSet.add(dayKey);
                }
            }
        }
        setMultiPasteDates(newSet);
        setLastSelectedDateKey(key);
    } else {
        // Normal toggle logic
        if (newSet.has(key)) {
            newSet.delete(key);
        } else {
            newSet.add(key);
        }
        setMultiPasteDates(newSet);
        setLastSelectedDateKey(key);
    }
  };

  const handlePasteToAll = () => {
    const allCurrentMonthDays = calendarDays
      .filter(day => day.isCurrentMonth)
      .map(day => formatDateKey(day.date));
    
    const targetDayKey = selectedDay ? formatDateKey(selectedDay) : null;
    const finalSelection = new Set(allCurrentMonthDays.filter(key => key !== targetDayKey));
    setMultiPasteDates(finalSelection);
  };

  const handleDone = () => {
    if (selectedDay) {
      const finalSlots = getSortedSlots(localSlots);
      let finalStatus = localStatus;
      
      const originalDayData = scheduleData[formatDateKey(selectedDay)];
      const wasAvailable = !originalDayData || originalDayData.status === 'available';

      if (wasAvailable && localStatus === 'available' && finalSlots.length === 0) {
        finalStatus = 'fullyBooked';
      }
      
      onDone({ date: selectedDay, dayData: { status: finalStatus, slots: finalSlots } }, Array.from(multiPasteDates));
    }
    onClose();
  };
  
  const handleSetDayStatus = (status: DayStatus) => {
    setLocalStatus(status);
    setLocalSlots(new Map());
  }

  const handleCustomSlotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/[^0-9]/g, '');
    let formattedValue = rawValue;

    if (rawValue.length > 2) {
      formattedValue = `${rawValue.slice(0, 2)}:${rawValue.slice(2, 4)}`;
    }
    
    setCustomSlot(formattedValue);
  };
  
  // UPDATED: Now clears both day status and individual slot states.
  const handleClearStatusAndSlots = () => {
    setLocalStatus('available'); // Set status to available
    
    // Also reset all individual slots to 'available' (un-strike them)
    const resetSlots = new Map<string, Slot>();
    localSlots.forEach((slot, time) => {
        resetSlots.set(time, { ...slot, state: 'available' });
    });
    setLocalSlots(resetSlots);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddCustomSlot();
    }
  };
  
  if (!isOpen || !selectedDay) return null;
  const currentSlotsArray = getSortedSlots(localSlots);

  const header = (
      <div translate="no">
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">編輯時段</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">{`${selectedDay.getFullYear()} 年 ${MONTH_NAMES[selectedDay.getMonth()]} ${selectedDay.getDate()} 日`}</p>
      </div>
  );

  const footer = (
    <>
      {loginPromptContent}
      <div className="grid grid-cols-2 gap-3 w-full">
          <button onClick={onClose} className="bg-gray-200 text-gray-700 font-bold py-3 px-4 rounded-lg hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 transition-colors">
              關閉
          </button>
          <button onClick={handleDone} className="bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors">
              完成
          </button>
      </div>
    </>
  );
  
  const StatusButton: React.FC<{status: DayStatus, label: string}> = ({ status, label }) => (
    <button onClick={() => handleSetDayStatus(status)} className="text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-semibold py-2 px-3 rounded-lg transition-colors">
        {label}
    </button>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} headerContent={header} footerContent={footer}>
        <div className="mb-4">
            <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">設定整日狀態</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <StatusButton status="dayOff" label="設為休假" />
                <StatusButton status="closed" label="設為公休" />
                <StatusButton status="fullyBooked" label="設為已額滿" />
                <StatusButton status="training" label="設為進修" />
            </div>
        </div>

        {localStatus !== 'available' && (
            <div className="text-center p-4 my-4 bg-blue-50 dark:bg-blue-900/50 rounded-lg">
                <p className="font-semibold text-blue-800 dark:text-blue-200" translate="no">目前狀態為：{DAY_STATUS_TEXT_MAP[localStatus]}</p>
                <button onClick={handleClearStatusAndSlots} className="mt-2 text-sm text-blue-600 dark:text-blue-300 hover:underline font-medium">
                    清除狀態，返回時段編輯
                </button>
            </div>
        )}

        <div className={localStatus !== 'available' ? 'hidden' : 'space-y-4'}>
            <hr className="border-gray-200 dark:border-gray-700"/>
            <div className="grid grid-cols-2 gap-2">
                <button onClick={handleCopy} className="flex items-center justify-center text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-semibold py-2 px-4 rounded-lg transition-colors"><CopyIcon/>{copySuccess ? '已複製!' : '複製此日時段'}</button>
                <button onClick={handlePaste} disabled={!copiedSlots} className="flex items-center justify-center text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"><ClipboardIcon/>貼上至此日</button>
            </div>

            {copiedSlots && !isMultiPasteExpanded && (
                <button 
                    onClick={() => setIsMultiPasteExpanded(true)}
                    className="w-full text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold py-2 px-4 rounded-lg dark:bg-blue-900/50 dark:hover:bg-blue-900 dark:text-blue-300 transition-colors"
                >
                    貼上至多個日期...
                </button>
            )}

            {copiedSlots && isMultiPasteExpanded && (
                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="font-semibold text-blue-800 dark:text-blue-300">貼上至多個日期</h3>
                        <button 
                            onClick={handlePasteToAll}
                            className="text-xs bg-blue-200 text-blue-800 font-semibold px-2 py-1 rounded-md hover:bg-blue-300 dark:bg-blue-900 dark:text-blue-200 dark:hover:bg-blue-800 transition-colors"
                        >
                            貼上全部
                        </button>
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-center font-semibold text-gray-500 dark:text-gray-400 text-xs mb-2">
                        {DAY_NAMES.map(day => <div key={day}>{day}</div>)}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                        {calendarDays.map(({ date, isCurrentMonth }, index) => {
                            const key = formatDateKey(date);
                            const isSelected = multiPasteDates.has(key);
                            const isTargetDay = selectedDay && formatDateKey(selectedDay) === key;
                            return (
                                <div key={index} onClick={(e) => isCurrentMonth && !isTargetDay && toggleMultiPasteDate(date, e)} 
                                    className={`relative aspect-square border rounded-lg p-1 text-xs transition-all flex items-center justify-center 
                                    ${!isCurrentMonth ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500' : (isTargetDay ? 'bg-gray-300 dark:bg-gray-600' : 'cursor-pointer')}
                                    ${isSelected ? 'bg-blue-600 border-blue-700 font-bold text-white' : (isCurrentMonth && !isTargetDay ? 'bg-white dark:bg-gray-700 hover:bg-blue-100 dark:hover:bg-blue-600 text-gray-800 dark:text-gray-200' : '')}
                                    `}>
                                    {isSelected && <CheckIcon className="absolute top-0.5 right-0.5 h-3 w-3 text-white" />}
                                    <span translate="no">{date.getDate()}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <div>
                <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">已選時段 ({currentSlotsArray.length})</h3>
                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg min-h-[80px] border dark:border-gray-700">
                    {currentSlotsArray.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {currentSlotsArray.map(slot => (
                                <div key={slot.time} className="bg-blue-500 text-white text-sm font-medium pl-3 pr-2 py-1 rounded-full flex items-center gap-2">
                                    <span translate="no">{slot.time}</span>
                                    <button onClick={() => handleRemoveSlot(slot.time)} className="bg-blue-400 hover:bg-blue-300 rounded-full p-0.5"><TrashIcon/></button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-400 text-sm text-center py-4">尚未選擇任何時段</p>
                    )}
                </div>
            </div>
            
            <div>
                <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">快速新增</h3>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {PREDEFINED_SLOTS.map(slot => (
                        <button key={slot} onClick={() => handleQuickAdd(slot)} disabled={localSlots.has(slot)} className="p-2 rounded-lg text-sm text-center transition-colors font-medium border bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 border-gray-300 dark:border-gray-600 disabled:bg-gray-200 dark:disabled:bg-gray-800/50 disabled:text-gray-400 disabled:cursor-not-allowed">{slot}</button>
                    ))}
                </div>
            </div>

            <div>
                <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">自訂時段</h3>
                <div className="flex gap-2">
                    <input 
                        type="text"
                        value={customSlot}
                        onChange={handleCustomSlotChange}
                        onKeyDown={handleKeyDown}
                        placeholder="HH:MM"
                        maxLength={5}
                        inputMode="numeric"
                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 transition bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                    />
                    <button onClick={handleAddCustomSlot} className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors flex-shrink-0">新增</button>
                </div>
            </div>
        </div>
    </Modal>
  );
};

export default SlotEditorModal;