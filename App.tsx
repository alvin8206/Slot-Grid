import React, { useState, useCallback, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import type { ScheduleData, CalendarDay, Slot, DayData, PngSettingsState, TextExportSettingsState } from './types';
import { MONTH_NAMES, DAY_NAMES, DAY_NAMES_EN } from './constants';
import { ChevronLeftIcon, ChevronRightIcon, CalendarIcon, EditIcon, TrashIcon, UserIcon, CheckIcon, SpinnerIcon } from './components/icons';
import { auth, db, isFirebaseConfigured } from './firebaseClient';

import Modal from './components/Modal';
import AuthModal from './components/AuthModal';
import LoginPrompt from './components/LoginPrompt';
import SlotEditorModal from './components/SlotEditorModal';
import TextExportModal from './components/TextExportModal';
import PngExportModal from './components/PngExportModal';
import { FONT_OPTIONS } from './components/PngExportModal.helpers';
import { formatDateKey, getEffectiveStatus, DAY_STATUS_TEXT_MAP } from './utils';

// A simple interface for the user object from Firebase Auth
interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';
export type WeekStartDay = 'sunday' | 'monday';

interface AppSettings {
    weekStartsOn: WeekStartDay;
}

const defaultPngSettings: PngSettingsState = {
    // REFACTORED: Changed from exportViewMode to the new structure
    pngDisplayMode: 'calendar',
    pngDateRange: 'full',
    pngStyle: 'minimal',
    bgColor: 'transparent',
    textColor: '#111827',
    borderColor: 'transparent',
    blockColor: 'transparent',
    showShadow: false,
    showTitle: false,
    showBookedSlots: false,
    bookedStyle: 'strikethrough',
    strikethroughColor: '#EF4444',
    strikethroughThickness: 'thin',
    fontScale: 1,
    font: FONT_OPTIONS[0].id,
    language: 'zh',
    titleAlign: 'center',
    dayOffColor: '#6B7280',
    closedColor: '#6B7280',
    fullyBookedColor: '#EF4444',
    trainingColor: '#3B82F6',
    pngListDateFilter: 'all',
    // NEW: Set distinct default padding for each display mode
    padding: {
        calendar: {
            top: '60px',
            right: '48px',
            bottom: '48px',
            left: '48px',
        },
        list: {
            top: '40px',
            right: '40px',
            bottom: '40px',
            left: '40px',
        }
    }
};

const defaultTextExportSettings: TextExportSettingsState = {
    layout: 'compact',
    language: 'zh',
    includeTitle: false,
    includeYear: false,
    showMonth: true,
    showBooked: false,
    showDayOfWeek: true,
    showFullyBooked: false,
    showDayOff: false,
    showTraining: false,
    bookedStyle: 'strikethrough',
    slotSeparator: ', ',
    dateFilter: 'all',
};


const App: React.FC = () => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [scheduleData, setScheduleData] = useState<ScheduleData>({});
    const [selectedDay, setSelectedDay] = useState<Date | null>(null);
    const [isSlotEditorOpen, setIsSlotEditorOpen] = useState(false);
    const [isPngExportOpen, setIsPngExportOpen] = useState(false);
    const [isTextExportOpen, setIsTextExportOpen] = useState(false);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [title, setTitle] = useState("可預約時段");
    const [copiedSlots, setCopiedSlots] = useState<Slot[] | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const footerRef = useRef<HTMLElement>(null);
    const [footerHeight, setFooterHeight] = useState(0);

    const [isDeleteMode, setIsDeleteMode] = useState(false);
    const [datesToDelete, setDatesToDelete] = useState<Set<string>>(new Set());

    const [pngSettings, setPngSettings] = useState<PngSettingsState>(defaultPngSettings);
    const [textExportSettings, setTextExportSettings] = useState<TextExportSettingsState>(defaultTextExportSettings);
    const [appSettings, setAppSettings] = useState<AppSettings>({ weekStartsOn: 'sunday' });
    
    // NEW: Auth status state to prevent race conditions
    const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');


    useLayoutEffect(() => {
        const node = footerRef.current;
        if (!node) return;
        
        const observer = new ResizeObserver(entries => {
            for (let entry of entries) {
                setFooterHeight(entry.target.getBoundingClientRect().height);
            }
        });
        
        observer.observe(node);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const isAnyModalOpen = isSlotEditorOpen || isPngExportOpen || isTextExportOpen || isAuthModalOpen;
        if (isAnyModalOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isSlotEditorOpen, isPngExportOpen, isTextExportOpen, isAuthModalOpen]);

    const docRef = useMemo(() => {
        if (!isFirebaseConfigured || !user) return null;
        return db.collection('users').doc(user.uid).collection('schedules').doc('default');
    }, [user]);

    // MODIFIED: Handle auth state changes and set the definitive authStatus
    useEffect(() => {
        if (!isFirebaseConfigured) {
            setAuthStatus('anonymous');
            return;
        }

        // REMOVED: The auth.getRedirectResult() block was removed.
        // It was causing the "operation-not-supported-in-this-environment" error
        // because the redirect flow is incompatible with the sandboxed environment.
        // The onAuthStateChanged listener below is sufficient for handling all auth states,
        // including successful pop-up logins.
        
        const unsubscribe = auth.onAuthStateChanged((user: User | null) => {
            setUser(user);
            setAuthStatus(user ? 'authenticated' : 'anonymous');
        });

        return () => unsubscribe();
    }, []);

    // MODIFIED: Data loading is now driven by authStatus, not docRef
    useEffect(() => {
        const loadData = async () => {
            if (authStatus === 'loading') {
                return; // Do nothing until auth state is resolved
            }

            if (authStatus === 'authenticated' && user) {
                const userDocRef = db.collection('users').doc(user.uid).collection('schedules').doc('default');
                try {
                    const doc = await userDocRef.get();
                    if (doc.exists) {
                        const data = doc.data();
                        if (data) {
                            setScheduleData(data.schedule || {});
                            setTitle(data.title || "可預約時段");
                            // FIX: Merge Firestore data with defaults to ensure data structure consistency.
                            setTextExportSettings(prev => ({ ...defaultTextExportSettings, ...(data.textExportSettings || {}) }));
                            setPngSettings(prev => ({ ...defaultPngSettings, ...(data.pngSettings || {}) }));
                            setAppSettings(prev => ({ ...prev, ...(data.appSettings || {}) }));
                        }
                    }
                } catch (error) {
                    console.error("Error loading data from Firestore:", error);
                }
            } else { // 'anonymous'
                try {
                    const localSchedule = localStorage.getItem('scheduleData');
                    if (localSchedule) setScheduleData(JSON.parse(localSchedule));

                    const localTitle = localStorage.getItem('scheduleTitle');
                    if (localTitle) setTitle(localTitle);
                    
                    // FIX: Merged localStorage settings with defaults to prevent crashes from old data structures.
                    // This is the primary fix for the blank PNG modal issue for anonymous users.
                    const localTextSettings = localStorage.getItem('textExportSettings');
                    if (localTextSettings) {
                        const parsed = JSON.parse(localTextSettings);
                        setTextExportSettings(prev => ({ ...defaultTextExportSettings, ...parsed }));
                    }

                    const localPngSettings = localStorage.getItem('pngSettings');
                    if (localPngSettings) {
                        const parsed = JSON.parse(localPngSettings);
                        setPngSettings(prev => ({ ...defaultPngSettings, ...parsed }));
                    }

                    const localAppSettings = localStorage.getItem('appSettings');
                    if (localAppSettings) {
                        const parsed = JSON.parse(localAppSettings);
                        setAppSettings(prev => ({ ...prev, ...parsed }));
                    }
                } catch (error) {
                    console.error("Failed to parse local storage data:", error);
                    localStorage.clear();
                }
            }
        };
        
        loadData();
    }, [authStatus, user]);
    
    const updateAndSaveState = useCallback((updates: Partial<{
        scheduleData: ScheduleData;
        title: string;
        textExportSettings: TextExportSettingsState;
        pngSettings: PngSettingsState;
        appSettings: AppSettings;
    }>) => {
        const cleanUpdates = Object.fromEntries(
            Object.entries(updates).filter(([, value]) => value !== undefined)
        ) as typeof updates;

        if (Object.keys(cleanUpdates).length === 0) {
            return;
        }

        const newState: { [key: string]: any } = {};
        if ('scheduleData' in cleanUpdates) newState.scheduleData = cleanUpdates.scheduleData;
        if ('title' in cleanUpdates) newState.title = cleanUpdates.title;
        if ('textExportSettings' in cleanUpdates) newState.textExportSettings = cleanUpdates.textExportSettings;
        if ('pngSettings' in cleanUpdates) newState.pngSettings = cleanUpdates.pngSettings;
        if ('appSettings' in cleanUpdates) newState.appSettings = cleanUpdates.appSettings;

        // Eagerly update local state for responsiveness
        setScheduleData(prev => newState.scheduleData ?? prev);
        setTitle(prev => newState.title ?? prev);
        setTextExportSettings(prev => newState.textExportSettings ?? prev);
        setPngSettings(prev => newState.pngSettings ?? prev);
        setAppSettings(prev => newState.appSettings ?? prev);

        if (docRef) {
            const firestoreUpdates: { [key: string]: any } = {};
            if ('scheduleData' in cleanUpdates) firestoreUpdates.schedule = cleanUpdates.scheduleData;
            if ('title' in cleanUpdates) firestoreUpdates.title = cleanUpdates.title;
            if ('textExportSettings' in cleanUpdates) firestoreUpdates.textExportSettings = cleanUpdates.textExportSettings;
            if ('pngSettings' in cleanUpdates) firestoreUpdates.pngSettings = cleanUpdates.pngSettings;
            if ('appSettings' in cleanUpdates) firestoreUpdates.appSettings = cleanUpdates.appSettings;

            docRef.set(firestoreUpdates, { merge: true }) // Use set with merge to be safer
                .catch((error: any) => console.error("Error saving data to Firestore:", error));
        } else {
            if ('scheduleData' in cleanUpdates) localStorage.setItem('scheduleData', JSON.stringify(cleanUpdates.scheduleData!));
            if ('title' in cleanUpdates) localStorage.setItem('title', cleanUpdates.title!);
            if ('textExportSettings' in cleanUpdates) localStorage.setItem('textExportSettings', JSON.stringify(cleanUpdates.textExportSettings!));
            if ('pngSettings' in cleanUpdates) localStorage.setItem('pngSettings', JSON.stringify(cleanUpdates.pngSettings!));
            if ('appSettings' in cleanUpdates) localStorage.setItem('appSettings', JSON.stringify(cleanUpdates.appSettings!));
        }
    }, [docRef]);

    useEffect(() => {
        if (authStatus === 'loading') return;
        const handler = setTimeout(() => {
             updateAndSaveState({ textExportSettings });
        }, 1000);
        return () => clearTimeout(handler);
    }, [textExportSettings, updateAndSaveState, authStatus]);

    useEffect(() => {
        if (authStatus === 'loading') return;
        const handler = setTimeout(() => {
            updateAndSaveState({ pngSettings });
        }, 1000);
        return () => clearTimeout(handler);
    }, [pngSettings, updateAndSaveState, authStatus]);

    useEffect(() => {
        if (authStatus === 'loading') return;
        const handler = setTimeout(() => {
            updateAndSaveState({ appSettings });
        }, 1000);
        return () => clearTimeout(handler);
    }, [appSettings, updateAndSaveState, authStatus]);


    const calendarDays = useMemo<CalendarDay[]>(() => {
        const days: CalendarDay[] = [];
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);

        let firstDayOfWeek = firstDayOfMonth.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
        if (appSettings.weekStartsOn === 'monday') {
            // Adjust so Monday is 0, Sunday is 6
            firstDayOfWeek = (firstDayOfWeek === 0) ? 6 : firstDayOfWeek - 1;
        }
        
        const lastDateOfMonth = lastDayOfMonth.getDate();

        for (let i = firstDayOfWeek; i > 0; i--) {
            const date = new Date(year, month, 1 - i);
            days.push({ date, isCurrentMonth: false, isToday: false });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        for (let i = 1; i <= lastDateOfMonth; i++) {
            const date = new Date(year, month, i);
            days.push({ date, isCurrentMonth: true, isToday: date.getTime() === today.getTime() });
        }

        const totalDaysInGrid = days.length;
        const remainingDays = (7 - (totalDaysInGrid % 7)) % 7;
        
        for (let i = 1; i <= remainingDays; i++) {
            const date = new Date(year, month + 1, i);
            days.push({ date, isCurrentMonth: false, isToday: false });
        }
        return days;
    }, [currentDate, appSettings.weekStartsOn]);
    
    const dayNamesToRender = useMemo(() => {
        if (appSettings.weekStartsOn === 'monday') {
            const [sunday, ...restOfWeek] = DAY_NAMES;
            return [...restOfWeek, sunday];
        }
        return DAY_NAMES;
    }, [appSettings.weekStartsOn]);

    const handleMonthChange = (offset: number) => {
        setCurrentDate(current => new Date(current.getFullYear(), current.getMonth() + offset, 1));
    };

    const handleDayClick = (day: CalendarDay) => {
        if (isDeleteMode) {
            toggleDateForDeletion(day);
        } else if (day.isCurrentMonth) {
            setSelectedDay(day.date);
            setIsSlotEditorOpen(true);
        }
    };
    
    const handleSlotEditorDone = (updatedDay: { date: Date, dayData: DayData }, pastedDays: string[]) => {
      const newSchedule = { ...scheduleData };
      const key = formatDateKey(updatedDay.date);

      if (updatedDay.dayData.status === 'available' && updatedDay.dayData.slots.length === 0) {
        delete newSchedule[key];
      } else {
        newSchedule[key] = updatedDay.dayData;
      }
      
      if(copiedSlots) {
        pastedDays.forEach(pastedKey => {
            const pastedSlots = copiedSlots.map(slot => ({...slot, state: 'available'}) as Slot);
            if (pastedSlots.length > 0) {
                newSchedule[pastedKey] = { status: 'available', slots: pastedSlots };
            } else {
                delete newSchedule[pastedKey];
            }
        });
      }
      
      updateAndSaveState({ scheduleData: newSchedule });
    };

    const handleToggleSlotState = (date: Date, time: string) => {
        if (isDeleteMode) return;
        const dateKey = formatDateKey(date);
        const dayData = scheduleData[dateKey];
        if (!dayData || dayData.status !== 'available') return;
        
        const daySlots = dayData.slots || [];
        const newSlots = daySlots.map(slot => {
            if (slot.time === time) {
                return { ...slot, state: slot.state === 'available' ? 'booked' : 'available' } as Slot;
            }
            return slot;
        });
        updateAndSaveState({ scheduleData: { ...scheduleData, [dateKey]: { ...dayData, slots: newSlots } } });
    };

    const handleTitleChange = (newTitle: string) => {
        updateAndSaveState({ title: newTitle });
    };

    // --- DELETE MODE LOGIC ---
    const handleToggleDeleteMode = () => {
        if (isDeleteMode) {
            setIsDeleteMode(false);
            setDatesToDelete(new Set());
        } else {
            setIsDeleteMode(true);
            setDatesToDelete(new Set());
        }
    };
    
    const toggleDateForDeletion = (day: CalendarDay) => {
        if (!day.isCurrentMonth || !scheduleData[formatDateKey(day.date)]) return;
        
        const key = formatDateKey(day.date);
        const newSet = new Set(datesToDelete);
        if (newSet.has(key)) {
            newSet.delete(key);
        } else {
            newSet.add(key);
        }
        setDatesToDelete(newSet);
    };

    const deletableKeysInMonth = useMemo(() => {
        return Object.keys(scheduleData).filter(key => {
            const date = new Date(key);
            return date.getFullYear() === currentDate.getFullYear() && date.getMonth() === currentDate.getMonth();
        });
    }, [scheduleData, currentDate]);

    const handleSelectAllForDeletion = () => {
        const allSelected = datesToDelete.size === deletableKeysInMonth.length;
        if (allSelected) {
            setDatesToDelete(new Set());
        } else {
            setDatesToDelete(new Set(deletableKeysInMonth));
        }
    };
    
    const handleConfirmDelete = () => {
        if (datesToDelete.size === 0) {
            setIsDeleteMode(false);
            return;
        }
        
        const newSchedule = { ...scheduleData };
        datesToDelete.forEach(key => {
            delete newSchedule[key];
        });
        
        updateAndSaveState({ scheduleData: newSchedule });

        setIsDeleteMode(false);
        setDatesToDelete(new Set());
    };
    
    const loginPromptContent = isFirebaseConfigured && authStatus === 'anonymous' ? <LoginPrompt onLoginClick={() => setIsAuthModalOpen(true)} /> : null;

    if (authStatus === 'loading') {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
                <div className="text-center">
                    <SpinnerIcon className="w-12 h-12 text-blue-600 mx-auto" />
                    <p className="mt-4 text-lg font-semibold text-gray-700 dark:text-gray-200">正在驗證身份...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
            <header 
                className="fixed top-0 left-0 right-0 z-40 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700"
                style={{ paddingTop: 'env(safe-area-inset-top)' }}
            >
                <div className="container mx-auto px-4 py-3 flex justify-between items-center">
                   <div className="flex items-center gap-2">
                     <CalendarIcon className="h-7 w-7 text-blue-600" />
                     <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100">SlotGrid</h1>
                   </div>
                   {isFirebaseConfigured && (
                       <div>
                           {user ? (
                               <button onClick={() => auth.signOut()} className="text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-semibold px-4 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">登出</button>
                           ) : (
                               <button onClick={() => setIsAuthModalOpen(true)} className="bg-blue-600 text-white font-bold p-2 rounded-lg hover:bg-blue-700 transition-colors"><UserIcon /></button>
                           )}
                       </div>
                   )}
                </div>
            </header>
            
            <main 
                className="flex-grow container mx-auto px-4"
                style={{ 
                    paddingTop: `calc(4.5rem + env(safe-area-inset-top))`,
                    paddingBottom: footerHeight ? `${footerHeight}px` : `8rem`
                }}
            >
                <div className="flex items-center justify-between mb-4">
                    <button onClick={() => handleMonthChange(-1)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"><ChevronLeftIcon className="text-gray-600 dark:text-gray-300"/></button>
                    <h2 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-gray-100 text-center" translate="no">{`${currentDate.getFullYear()} 年 ${MONTH_NAMES[currentDate.getMonth()]}`}</h2>
                    <button onClick={() => handleMonthChange(1)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"><ChevronRightIcon className="text-gray-600 dark:text-gray-300"/></button>
                </div>
                <div className="flex items-center justify-between gap-4 mb-4 h-10">
                    {isDeleteMode ? (
                        <div className="flex items-center justify-center w-full gap-2">
                             <button onClick={handleToggleDeleteMode} className="bg-gray-200 text-gray-700 font-bold py-2 px-4 rounded-lg hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 transition-colors">取消</button>
                             <button onClick={handleSelectAllForDeletion} className="bg-white text-gray-700 font-bold py-2 px-4 rounded-lg hover:bg-gray-100 dark:bg-gray-600 dark:text-gray-100 dark:hover:bg-gray-500 border border-gray-300 dark:border-gray-500 transition-colors">
                                {datesToDelete.size === deletableKeysInMonth.length ? '取消全選' : '全選'}
                             </button>
                            <button 
                                onClick={handleConfirmDelete} 
                                disabled={datesToDelete.size === 0}
                                className="bg-red-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-700 transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <CheckIcon className="w-4 h-4" />確認刪除 ({datesToDelete.size})
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 gap-1 rounded-full bg-gray-200 dark:bg-gray-700 p-1 text-xs font-semibold flex-shrink-0">
                                <button 
                                    onClick={() => setAppSettings({ ...appSettings, weekStartsOn: 'sunday' })}
                                    className={`px-3 py-1 rounded-full transition-colors ${appSettings.weekStartsOn === 'sunday' ? 'bg-white dark:bg-gray-600 shadow text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'}`}
                                >
                                    週日起
                                </button>
                                <button 
                                    onClick={() => setAppSettings({ ...appSettings, weekStartsOn: 'monday' })}
                                    className={`px-3 py-1 rounded-full transition-colors ${appSettings.weekStartsOn === 'monday' ? 'bg-white dark:bg-gray-600 shadow text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'}`}
                                >
                                    週一起
                                </button>
                            </div>
                            <button onClick={handleToggleDeleteMode} className="p-2 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors flex-shrink-0" title="清除資料">
                                <TrashIcon className="h-5 w-5 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors" />
                            </button>
                        </>
                    )}
                </div>
                <div className="grid grid-cols-7 gap-1 text-center font-semibold text-gray-500 dark:text-gray-400 text-sm mb-2">
                    {dayNamesToRender.map(day => <div key={day} translate="no">{day}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-1">
                    {calendarDays.map((day) => {
                        const dateKey = formatDateKey(day.date);
                        const dayData = scheduleData[dateKey];
                        const effectiveStatus = getEffectiveStatus(dayData);
                        const hasData = day.isCurrentMonth && effectiveStatus !== 'empty';
                        
                        const inDeleteModeAndHasData = isDeleteMode && hasData;
                        const isSelectedForDeletion = datesToDelete.has(dateKey);

                        return (
                            <div 
                                key={day.date.toISOString()}
                                onClick={() => handleDayClick(day)}
                                className={`relative border rounded-lg flex flex-col transition-all duration-200 
                                  ${day.isCurrentMonth ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-black/20'}
                                  ${isSelectedForDeletion ? 'border-red-500' : (day.isToday && !isDeleteMode ? 'border-blue-500' : 'border-gray-200 dark:border-gray-700')}
                                  ${isDeleteMode ? 'cursor-pointer' : (day.isCurrentMonth ? 'hover:bg-blue-50 dark:hover:bg-blue-900/50 cursor-pointer' : '')}
                                  ${inDeleteModeAndHasData ? 'animate-pulse' : ''}
                                `}
                            >
                                {inDeleteModeAndHasData && isSelectedForDeletion && (
                                    <div className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center pointer-events-none border-2 border-white dark:border-gray-800">
                                        <CheckIcon className="w-3 h-3 text-white" strokeWidth={3} />
                                    </div>
                                )}
                                <span className={`self-center p-2 text-sm font-semibold flex-shrink-0 ${!day.isCurrentMonth ? 'text-gray-400 dark:text-gray-600' : 'text-gray-800 dark:text-gray-200'}`} translate="no">
                                    {day.date.getDate()}
                                </span>
                                {day.isCurrentMonth && effectiveStatus !== 'available' && effectiveStatus !== 'empty' && (
                                    <div className="flex-grow flex items-center justify-center p-1">
                                        <span className="text-xs font-bold text-gray-500 dark:text-gray-400 text-center" translate="no">{getEffectiveStatus(dayData) === 'empty' ? '' : DAY_STATUS_TEXT_MAP[getEffectiveStatus(dayData)]}</span>
                                    </div>
                                )}
                                {dayData?.slots && dayData.slots.length > 0 && day.isCurrentMonth && effectiveStatus === 'available' && (
                                    <div className="px-1 pb-1 mt-auto flex-grow">
                                      <div className="flex flex-wrap gap-1 justify-center">
                                        {dayData.slots.map(slot => (
                                            <div 
                                                key={slot.time}
                                                onClick={(e) => { 
                                                    if (isDeleteMode) return;
                                                    e.stopPropagation(); 
                                                    handleToggleSlotState(day.date, slot.time); 
                                                }}
                                                className={`text-[8px] font-bold px-1 py-1 rounded-md transition-colors leading-none 
                                                  ${isDeleteMode ? 'cursor-default' : 'cursor-pointer'}
                                                  ${slot.state === 'available' ? 'bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:hover:bg-blue-800' : 'bg-gray-200 text-gray-500 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600 line-through'}`}
                                            >
                                                {slot.time}
                                            </div>
                                        ))}
                                       </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </main>
            
            <footer 
                ref={footerRef}
                className="fixed bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-white dark:from-gray-800 to-white/0 dark:to-gray-800/0 backdrop-blur-sm pt-8 pb-4"
                style={{ paddingBottom: `calc(1rem + env(safe-area-inset-bottom))` }}
            >
                <div className="container mx-auto px-4">
                    {loginPromptContent}
                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => setIsTextExportOpen(true)} className="bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 font-bold py-3 px-4 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors shadow-sm">匯出文字</button>
                        <button onClick={() => setIsPngExportOpen(true)} className="bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">匯出圖片 (PNG)</button>
                    </div>
                </div>
            </footer>
            
            <SlotEditorModal 
                isOpen={isSlotEditorOpen} 
                selectedDay={selectedDay} 
                scheduleData={scheduleData} 
                calendarDays={calendarDays}
                dayNames={dayNamesToRender}
                onClose={() => setIsSlotEditorOpen(false)}
                onDone={handleSlotEditorDone}
                copiedSlots={copiedSlots}
                onCopy={setCopiedSlots}
                loginPromptContent={loginPromptContent}
            />
            
            <PngExportModal 
                isOpen={isPngExportOpen} 
                onClose={() => setIsPngExportOpen(false)} 
                scheduleData={scheduleData}
                title={title}
                onTitleChange={handleTitleChange}
                calendarDays={calendarDays}
                currentDate={currentDate}
                weekStartsOn={appSettings.weekStartsOn}
                loginPromptContent={loginPromptContent}
                pngSettings={pngSettings}
                setPngSettings={setPngSettings}
            />

            <TextExportModal
                isOpen={isTextExportOpen}
                onClose={() => setIsTextExportOpen(false)}
                scheduleData={scheduleData}
                title={title}
                currentDate={currentDate}
                loginPromptContent={loginPromptContent}
                textExportSettings={textExportSettings}
                setTextExportSettings={setTextExportSettings}
            />

            {isFirebaseConfigured && <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} /> }

        </div>
    );
};

export default App;