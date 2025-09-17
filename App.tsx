import React, { useState, useCallback, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import type { ScheduleData, CalendarDay, PngStyle, Slot, PngExportViewMode, TitleAlign, DayData, DayStatus, PngSettingsState } from './types';
import { MONTH_NAMES, DAY_NAMES, PREDEFINED_SLOTS, MONTH_NAMES_EN, DAY_NAMES_EN } from './constants';
import { ChevronLeftIcon, ChevronRightIcon, DownloadIcon, CloseIcon, TrashIcon, CopyIcon, ClipboardIcon, CalendarIcon, EditIcon, RainbowIcon, UserIcon, GoogleIcon, CheckIcon, SpinnerIcon } from './components/icons';
import { auth, db, googleProvider, isFirebaseConfigured } from './firebaseClient';
import { AdSlot } from './components/AdSlot';
import { getPrimaryFamily } from './fonts';
import { embedFontForExport } from './fontUtils';


// This declaration is necessary because html-to-image is loaded from a CDN.
declare const htmlToImage: {
  toPng: <T extends HTMLElement>(node: T, options?: object) => Promise<string>;
};

const FONT_CATEGORIES = [
    {
        name: '常用中文字體',
        fonts: [
            { id: "'Noto Sans TC', sans-serif", name: '思源黑體', urlValue: 'Noto+Sans+TC:wght@300;400;700' },
            { id: "'Noto Serif TC', serif", name: '思源宋體', urlValue: 'Noto+Serif+TC:wght@300;400;700' },
            { id: "'LXGW WenKai TC', cursive", name: '霞鶩文楷', urlValue: 'LXGW+WenKai+TC:wght@300;400;700' },
        ]
    },
    {
        name: '中文藝術字體',
        fonts: [
            { id: "'Yuji Syuku', serif", name: '佑字肅', urlValue: 'Yuji+Syuku' },
            { id: "'Hina Mincho', serif", name: '雛明朝', urlValue: 'Hina+Mincho' },
            { id: "'Zen Dots', cursive", name: '禪點體', urlValue: 'Zen+Dots' },
            { id: "'DotGothic16', sans-serif", name: '點陣哥特體', urlValue: 'DotGothic16' },
            { id: "'Reggae One', cursive", name: '雷鬼體', urlValue: 'Reggae+One' },
            { id: "'Rampart One', cursive", name: '城牆體', urlValue: 'Rampart+One' },
            { id: "'Kaisei Opti', serif", name: '解星光學體', urlValue: 'Kaisei+Opti:wght@400;700' },
            { id: "'M PLUS Rounded 1c', sans-serif", name: 'M+ 圓體', urlValue: 'M+PLUS+Rounded+1c:wght@300;400;700' },
            { id: "'Zen Maru Gothic', sans-serif", name: '禪丸哥特體', urlValue: 'Zen+Maru+Gothic:wght@400;700' },
        ]
    },
    {
        name: '英文字體 (僅適用英文)',
        fonts: [
            { id: "'Cormorant Garamond', serif", name: 'Cormorant Garamond', urlValue: 'Cormorant+Garamond:wght@400;700' },
            { id: "'Playfair Display', serif", name: 'Playfair Display', urlValue: 'Playfair+Display:wght@400;700' },
            { id: "'Lobster', cursive", name: 'Lobster', urlValue: 'Lobster' },
            { id: "'Pacifico', cursive", name: 'Pacifico', urlValue: 'Pacifico' },
            { id: "'Bebas Neue', sans-serif", name: 'Bebas Neue', urlValue: 'Bebas+Neue' },
            { id: "'Space Mono', monospace", name: 'Space Mono', urlValue: 'Space+Mono:wght@400;700' },
            { id: "'Roboto', sans-serif", name: 'Roboto', urlValue: 'Roboto:wght@300;400;700' },
            { id: "'Lato', sans-serif", name: 'Lato', urlValue: 'Lato:wght@300;400;700' },
            { id: "'Montserrat', sans-serif", name: 'Montserrat', urlValue: 'Montserrat:wght@300;400;700' },
            { id: "'Open Sans', sans-serif", name: 'Open Sans', urlValue: 'Open+Sans:wght@300;400;700' },
            { id: "'Poppins', sans-serif", name: 'Poppins', urlValue: 'Poppins:wght@300;400;700' },
            { id: "'Raleway', sans-serif", name: 'Raleway', urlValue: 'Raleway:wght@300;400;700' },
        ]
    }
];

const FONT_OPTIONS = FONT_CATEGORIES.flatMap(c => c.fonts);


const PRESET_COLORS = {
    bg: ['transparent', '#FFFFFF', '#F9FAFB', '#F3F4F6', '#111827', '#FECACA', '#BFDBFE'],
    text: ['#111827', '#6B7280', '#FFFFFF', '#9CA3AF', '#BE123C', '#1D4ED8'],
    border: ['transparent', '#E5E7EB', '#D1D5DB', '#9CA3AF', '#374151', '#FCA5A5', '#93C5FD'],
    block: ['transparent', '#F9FAFB', '#FFFFFF', '#E5E7EB', '#1F2937', '#FEE2E2', '#DBEAFE'],
    strikethrough: ['#EF4444', '#FFFFFF', '#9CA3AF', '#6B7280', '#111827'],
    // NEW: A shared palette for all status text pickers.
    status: [
        '#EF4444', // Red
        '#FBBF24', // Yellow
        '#22C55E', // Green
        '#111827', // Black
        '#FFFFFF', // White
        '#6B7280', // Gray
    ],
};

const DAY_STATUS_TEXT_MAP: Record<DayStatus, string> = {
  available: '可預約',
  dayOff: '休假',
  closed: '公休',
  fullyBooked: '已額滿'
};


// --- Helper Functions ---
const formatDateKey = (date: Date): string => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0); // Normalize to midnight
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const applyStrikethrough = (text: string) => text.split('').join('\u0336') + '\u0336';

/**
 * NEW: Determines the effective status of a day for display purposes.
 * If a day is 'available' but all its slots are 'booked', it's considered 'fullyBooked'.
 */
const getEffectiveStatus = (dayData: DayData | undefined): DayStatus | 'empty' => {
  if (!dayData || (!dayData.slots?.length && dayData.status === 'available')) {
    return 'empty';
  }

  // If status is already set to something other than available, respect it.
  if (dayData.status !== 'available') {
    return dayData.status;
  }
  
  const { slots } = dayData;

  // If it's 'available' but has no slots, it's just empty (and will be treated as available for editing).
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


// --- Child Components ---
// A simple interface for the user object from Firebase Auth
interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  headerContent: React.ReactNode;
  footerContent: React.ReactNode;
  children: React.ReactNode;
  modalClassName?: string;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, headerContent, footerContent, children, modalClassName }) => {
  const footerRef = useRef<HTMLElement>(null);
  const [footerHeight, setFooterHeight] = useState(0);

  useLayoutEffect(() => {
    if (!isOpen || !footerRef.current) return;
    
    const observer = new ResizeObserver(entries => {
      for (let entry of entries) {
        setFooterHeight(entry.target.getBoundingClientRect().height);
      }
    });

    observer.observe(footerRef.current);
    return () => observer.disconnect();
  }, [isOpen, footerContent]);

  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      onClick={onClose}
      className={`fixed inset-0 bg-black bg-opacity-70 flex items-end xl:items-center justify-center z-50 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className={`relative bg-white dark:bg-gray-800 w-full h-[100dvh] xl:rounded-2xl xl:shadow-2xl xl:h-auto xl:max-h-[calc(100vh-4rem)] flex flex-col transition-transform duration-300 ${isOpen ? 'translate-y-0' : 'translate-y-full xl:translate-y-4'} ${modalClassName || 'xl:max-w-lg'}`}
      >
        
        <header 
          className="flex-shrink-0 flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm z-30"
          style={{ paddingTop: `calc(1rem + env(safe-area-inset-top))` }}
        >
          <div className="flex-grow">{headerContent}</div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-1 rounded-full flex-shrink-0 ml-4"><CloseIcon /></button>
        </header>

        <main className="flex-grow overflow-y-auto bg-gray-50 dark:bg-gray-900" style={{ paddingBottom: footerHeight ? `${footerHeight}px` : '8rem' }}>
            <div className="p-4 md:p-6">
                {children}
            </div>
        </main>
        
        <footer 
            ref={footerRef}
            className="absolute bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-white dark:from-gray-800 to-white/0 dark:to-gray-800/0 backdrop-blur-sm pt-8 pb-4"
            style={{ paddingBottom: `calc(1rem + env(safe-area-inset-bottom))` }}
        >
            <div className="container mx-auto px-4">
                 {footerContent}
            </div>
        </footer>
      </div>
    </div>
  );
};


interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isRegistering, setIsRegistering] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setError(null);
            setEmail('');
            setPassword('');
        }
    }, [isOpen]);

    const handleGoogleLogin = async () => {
        setIsLoading(true);
        setError(null);
        try {
            await auth.signInWithPopup(googleProvider);
            onClose();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        try {
            if (isRegistering) {
                await auth.createUserWithEmailAndPassword(email, password);
            } else {
                await auth.signInWithEmailAndPassword(email, password);
            }
            onClose();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };
    
    const header = <h2 className="text-xl font-bold text-center text-gray-800 dark:text-gray-100">{isRegistering ? '註冊帳號' : '登入'}</h2>;
    
    const footer = (
      <button type="submit" disabled={isLoading} className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
          {isLoading ? '處理中...' : (isRegistering ? '註冊' : '登入')}
      </button>
    );

    return (
        <form onSubmit={handleEmailAuth}>
            <Modal isOpen={isOpen} onClose={onClose} headerContent={header} footerContent={footer}>
                 {error && <p className="bg-red-100 text-red-700 text-sm p-3 rounded-lg mb-4">{error}</p>}
                
                <div className="space-y-4">
                    <input type="email" placeholder="電子郵件" value={email} onChange={e => setEmail(e.target.value)} required className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 transition bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100" />
                    <input type="password" placeholder="密碼 (至少6位數)" value={password} onChange={e => setPassword(e.target.value)} required className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 transition bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100" />
                </div>
                
                <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-300 dark:border-gray-600"></div></div>
                    <div className="relative flex justify-center text-sm"><span className="px-2 bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400">或</span></div>
                </div>

                <button type="button" onClick={handleGoogleLogin} disabled={isLoading} className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-bold py-3 px-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition flex items-center justify-center gap-2 disabled:opacity-50">
                    <GoogleIcon /> 使用 Google 登入
                </button>
                
                <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
                    {isRegistering ? '已經有帳號了？' : '還沒有帳號？'}
                    <button type="button" onClick={() => setIsRegistering(!isRegistering)} className="font-semibold text-blue-600 hover:underline ml-1">
                        {isRegistering ? '立即登入' : '立即註冊'}
                    </button>
                </p>
            </Modal>
        </form>
    );
};

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

  useEffect(() => {
    if (selectedDay) {
        const dateKey = formatDateKey(selectedDay);
        const dayData = scheduleData[dateKey]; // Can be undefined
        
        // Use the smart helper function to determine the true initial state
        const effectiveStatus = getEffectiveStatus(dayData);

        // If the day is effectively empty, treat it as 'available' for editing purposes.
        const initialStatus = effectiveStatus === 'empty' ? 'available' : effectiveStatus;
        
        setLocalStatus(initialStatus);
        
        // FIX: Add a safety check to ensure .map is not called on undefined.
        // `(dayData?.slots || [])` ensures we always have an array to map over.
        setLocalSlots(new Map((dayData?.slots || []).map(slot => [slot.time, slot])));

        // Reset other modal-specific states
        setCopySuccess(false);
        setMultiPasteDates(new Set());
        setIsMultiPasteExpanded(false);
        setLastSelectedDateKey(null);
    }
  }, [selectedDay, scheduleData, isOpen]);

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
      const newSlots = new Map<string, Slot>(copiedSlots.map(slot => [slot.time, {...slot, state: 'available'} as Slot]));
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
      <div>
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
            <div className="grid grid-cols-3 gap-2">
                <StatusButton status="dayOff" label="設為休假" />
                <StatusButton status="closed" label="設為公休" />
                <StatusButton status="fullyBooked" label="設為已額滿" />
            </div>
        </div>

        {localStatus !== 'available' && (
            <div className="text-center p-4 my-4 bg-blue-50 dark:bg-blue-900/50 rounded-lg">
                <p className="font-semibold text-blue-800 dark:text-blue-200">目前狀態為：{DAY_STATUS_TEXT_MAP[localStatus]}</p>
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
                                    <span>{date.getDate()}</span>
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
                                    <span>{slot.time}</span>
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

interface TextExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    scheduleData: ScheduleData;
    title: string;
    currentDate: Date;
    loginPromptContent?: React.ReactNode;
}

const TextExportModal: React.FC<TextExportModalProps> = ({ isOpen, onClose, scheduleData, title, currentDate, loginPromptContent }) => {
    const [copyButtonText, setCopyButtonText] = useState('複製內文');
    const [layout, setLayout] = useState<'default' | 'compact'>('default');
    const [language, setLanguage] = useState<'zh' | 'en'>('zh');
    const [includeYear, setIncludeYear] = useState(true);
    const [showBooked, setShowBooked] = useState(false);
    const [bookedStyle, setBookedStyle] = useState<'strikethrough' | 'annotation'>('strikethrough');
    
    const generatedText = useMemo(() => {
        let text = `${title}\n\n`;
        
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth();

        const sortedDates = Object.keys(scheduleData)
            .filter(key => {
                const date = new Date(key);
                return date.getFullYear() === currentYear && date.getMonth() === currentMonth;
            })
            .sort((a,b) => a.localeCompare(b));
        
        if (sortedDates.length === 0) {
            return language === 'zh' ? "此月份尚未安排任何時段。" : "No slots scheduled for this month yet.";
        }
        
        sortedDates.forEach(dateKey => {
            const date = new Date(dateKey);
            const dayData = scheduleData[dateKey];
            const effectiveStatus = getEffectiveStatus(dayData); // Use the smart helper

            if (effectiveStatus === 'empty') {
                return; // Skip empty days entirely
            }

            const year = date.getFullYear();
            const month = (date.getMonth() + 1).toString();
            const day = date.getDate().toString();
            const dayOfWeek = language === 'zh' ? DAY_NAMES[date.getDay()] : DAY_NAMES_EN[date.getDay()];
            const dateString = includeYear ? `${year}/${month}/${day}` : `${month}/${day}`;

            if (effectiveStatus !== 'available') {
                text += `${dateString} (${dayOfWeek}): ${DAY_STATUS_TEXT_MAP[effectiveStatus]}\n`;
                if (layout === 'default') text += '\n';
                return;
            }
            
            // This part now only runs for 'available' days
            const relevantSlots = dayData?.slots || [];
            const finalSlots = showBooked ? relevantSlots : relevantSlots.filter(s => s.state === 'available');

            if (finalSlots.length === 0) return;

            const slotsToDisplay = finalSlots.map(slot => {
                if (slot.state === 'booked') {
                    if (bookedStyle === 'strikethrough') {
                        return applyStrikethrough(slot.time);
                    }
                    return `${slot.time} ${language === 'zh' ? '(已預約)' : '(Booked)'}`;
                }
                return slot.time;
            });

            if (layout === 'compact') {
                 text += `${dateString} (${dayOfWeek}): ${slotsToDisplay.join(', ')}\n`;
            } else { // default
                text += `${dateString} (${dayOfWeek})\n`;
                slotsToDisplay.forEach(slot => {
                    text += `- ${slot}\n`;
                });
                text += '\n';
            }
        });
        return text.trim();
    }, [scheduleData, title, layout, language, includeYear, currentDate, showBooked, bookedStyle]);

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

    const header = <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">匯出文字格式</h2>;
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
                <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">排版</label>
                    <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-200 dark:bg-gray-700 p-1">
                        <button onClick={() => setLayout('default')} className={`py-2 rounded-lg transition-all text-sm font-medium ${layout === 'default' ? 'bg-white dark:bg-gray-600 shadow text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'}`}>詳細</button>
                        <button onClick={() => setLayout('compact')} className={`py-2 rounded-lg transition-all text-sm font-medium ${layout === 'compact' ? 'bg-white dark:bg-gray-600 shadow text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'}`}>緊湊</button>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">語言</label>
                    <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-200 dark:bg-gray-700 p-1">
                        <button onClick={() => setLanguage('zh')} className={`py-2 rounded-lg transition-all text-sm font-medium ${language === 'zh' ? 'bg-white dark:bg-gray-600 shadow text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'}`}>中文</button>
                        <button onClick={() => setLanguage('en')} className={`py-2 rounded-lg transition-all text-sm font-medium ${language === 'en' ? 'bg-white dark:bg-gray-600 shadow text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'}`}>English</button>
                    </div>
                </div>
                
                <div className="space-y-3">
                    <label htmlFor="include-year" className="flex items-center justify-between bg-white dark:bg-gray-800 p-3 rounded-lg border dark:border-gray-700 cursor-pointer">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">包含年份</span>
                        <div className="relative">
                            <input type="checkbox" id="include-year" className="sr-only peer" checked={includeYear} onChange={e => setIncludeYear(e.target.checked)} />
                            <div className="block bg-gray-200 dark:bg-gray-600 w-10 h-6 rounded-full peer-checked:bg-blue-600 transition"></div>
                            <div className="dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition transform peer-checked:translate-x-full"></div>
                        </div>
                    </label>
                    <label htmlFor="show-booked" className="flex items-center justify-between bg-white dark:bg-gray-800 p-3 rounded-lg border dark:border-gray-700 cursor-pointer">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">顯示已預約時段</span>
                        <div className="relative">
                            <input type="checkbox" id="show-booked" className="sr-only peer" checked={showBooked} onChange={e => setShowBooked(e.target.checked)} />
                            <div className="block bg-gray-200 dark:bg-gray-600 w-10 h-6 rounded-full peer-checked:bg-blue-600 transition"></div>
                            <div className="dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition transform peer-checked:translate-x-full"></div>
                        </div>
                    </label>
                    {showBooked && (
                        <div className="space-y-2 pt-3 border-t border-gray-200/60 dark:border-gray-700/60">
                            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">已預約樣式</label>
                            <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-200 dark:bg-gray-700 p-1">
                                <button onClick={() => setBookedStyle('strikethrough')} className={`py-2 rounded-lg transition-all text-sm font-medium ${bookedStyle === 'strikethrough' ? 'bg-white dark:bg-gray-600 shadow text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'}`}>刪除線</button>
                                <button onClick={() => setBookedStyle('annotation')} className={`py-2 rounded-lg transition-all text-sm font-medium ${bookedStyle === 'annotation' ? 'bg-white dark:bg-gray-600 shadow text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'}`}>文字註記</button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border dark:border-gray-700">
                    <textarea 
                        readOnly 
                        value={generatedText}
                        className="w-full h-48 md:h-56 bg-transparent resize-none border-none focus:ring-0 text-sm text-gray-800 dark:text-gray-200"
                    />
                </div>
            </div>
        </Modal>
    );
};

interface ColorPickerInputProps {
  value: string;
  onChange: (color: string) => void;
  isCustom: boolean;
}

const ColorPickerInput: React.FC<ColorPickerInputProps> = ({ value, onChange, isCustom }) => {
  return (
    <div className={`relative w-8 h-8 rounded-full flex items-center justify-center transition-transform transform hover:scale-110 shadow-sm ${isCustom ? 'ring-2 ring-offset-2 ring-blue-500' : 'ring-1 ring-inset ring-gray-300 dark:ring-gray-600'}`}>
        <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
            <RainbowIcon />
        </div>
        <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
    </div>
  );
};


interface PngExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    scheduleData: ScheduleData;
    title: string;
    calendarDays: CalendarDay[];
    currentDate: Date;
    loginPromptContent?: React.ReactNode;
    // Props for lifted state
    pngSettings: PngSettingsState;
    setPngSettings: React.Dispatch<React.SetStateAction<PngSettingsState>>;
}

const SettingsSection: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({ title, children, className }) => (
    <div className={className}>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{title}</h3>
        <div className="space-y-3">{children}</div>
    </div>
);

const SettingsCard: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ children, className }) => (
    <div className={`bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 ${className}`}>
        {children}
    </div>
);


const ColorSelectorRow: React.FC<{ value: string; onChange: (color: string) => void; presets: string[]; }> = ({ value, onChange, presets }) => {
    const isCustom = !presets.includes(value);
    return (
        <div className="flex items-center justify-end gap-2">
            {presets.map(color => {
                if (color === 'transparent') {
                   return (
                        <button
                            key={color}
                            type="button"
                            onClick={() => onChange(color)}
                            className={`w-6 h-6 rounded-full transition-transform transform hover:scale-110 shadow-sm border bg-[conic-gradient(from_90deg_at_50%_50%,#ccc_25%,#fff_0,#fff_50%,#ccc_0,#ccc_75%,#fff_0)] bg-[length:10px_10px] ${value === color ? 'ring-2 ring-offset-1 ring-blue-500' : 'border-gray-300 dark:border-gray-600'}`}
                        />
                   );
                }
                return (
                    <button key={color} type="button" onClick={() => onChange(color)} className={`w-6 h-6 rounded-full transition-transform transform hover:scale-110 shadow-sm border dark:border-gray-700 ${value.toUpperCase() === color.toUpperCase() ? 'ring-2 ring-offset-1 ring-blue-500' : ''}`} style={{ backgroundColor: color }} />
                )
            })}
            <ColorPickerInput value={value} onChange={onChange} isCustom={isCustom} />
        </div>
    );
};

type FontStatus = 'idle' | 'loading' | 'loaded';
type PngSettingsTab = 'content' | 'style' | 'layout';
type ExportStage = 'configuring' | 'generating_image' | 'completed';


const FontCard: React.FC<{
  fontOption: typeof FONT_OPTIONS[0];
  isSelected: boolean;
  status: FontStatus;
  onSelect: () => void;
  preloadFont: () => void;
}> = ({ fontOption, isSelected, status, onSelect, preloadFont }) => {
  const cardRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (status !== 'idle' || !cardRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          preloadFont(); // Pre-load when visible
          observer.unobserve(entry.target);
        }
      },
      {
        root: null,
        rootMargin: '0px 200px 0px 0px', // Preload 200px ahead of the scroll direction
        threshold: 0.01,
      }
    );

    observer.observe(cardRef.current);

    return () => observer.disconnect();
  }, [status, preloadFont]);

  return (
    <button
      ref={cardRef}
      type="button"
      onClick={onSelect}
      disabled={status === 'loading'}
      className={`relative flex-shrink-0 w-28 h-16 flex items-center justify-center p-2 border-2 rounded-lg transition-all duration-200 text-center ${isSelected ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/50' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 hover:border-blue-400'}`}
      style={{ fontFamily: status === 'loaded' ? fontOption.id : 'sans-serif' }}
    >
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70 dark:bg-gray-700/70 rounded-md">
          <SpinnerIcon className="w-6 h-6 text-blue-500" />
        </div>
      )}
      <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{fontOption.name}</span>
    </button>
  );
};


const PngExportModal: React.FC<PngExportModalProps> = ({
    isOpen,
    onClose,
    scheduleData,
    title,
    calendarDays,
    currentDate,
    loginPromptContent,
    pngSettings,
    setPngSettings
}) => {
    const exportRef = useRef<HTMLDivElement>(null);
    const previewContainerRef = useRef<HTMLDivElement>(null);
    const scaleWrapperRef = useRef<HTMLDivElement>(null);
    
    // UI State
    const [activeTab, setActiveTab] = useState<PngSettingsTab>('content');
    const [isExporting, setIsExporting] = useState(false);

    // Destructure settings from props for easier access
    const {
        exportViewMode, pngStyle, bgColor, textColor, borderColor, blockColor, showShadow,
        showTitle, showBookedSlots, bookedStyle, strikethroughColor, strikethroughThickness,
        fontScale, font, language, horizontalGap, verticalGap, titleAlign,
        dayOffColor, closedColor, fullyBookedColor,
    } = pngSettings;

    const updateSetting = <K extends keyof PngSettingsState>(key: K, value: PngSettingsState[K]) => {
        setPngSettings(prev => ({ ...prev, [key]: value }));
    };

    // Local state for the modal's internal workings
    const [localTitle, setLocalTitle] = useState(title);
    const [exportStage, setExportStage] = useState<ExportStage>('configuring');
    const [generatedPngDataUrl, setGeneratedPngDataUrl] = useState<string | null>(null);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [fontStatuses, setFontStatuses] = useState<Record<string, FontStatus>>({});

    
    useEffect(() => {
        if (isOpen) {
            setExportStage('configuring');
            setGeneratedPngDataUrl(null);
            setLocalTitle(title);
            setIsExporting(false);
            // Reset only the tab, keep settings persistent
            setActiveTab('content');
        }
    }, [isOpen, title]);
    
    const propsForContent = useMemo(() => ({
        scheduleData, title: localTitle, calendarDays, currentDate,
        ...pngSettings,
    }), [scheduleData, localTitle, calendarDays, currentDate, pngSettings]);

    useLayoutEffect(() => {
        const containerNode = previewContainerRef.current;
        const wrapperNode = scaleWrapperRef.current;
        const exportNode = exportRef.current;

        if (!isOpen || !containerNode || !wrapperNode || !exportNode) {
            return;
        }

        let animationFrameId: number | null = null;

        const updatePreviewLayout = () => {
            animationFrameId = requestAnimationFrame(() => {
                if (!containerNode || !wrapperNode || !exportNode) {
                    return;
                }
                const exportWidth = 800;
                const containerWidth = containerNode.offsetWidth;

                if (exportWidth > 0 && containerWidth > 0) {
                    const scale = containerWidth / exportWidth;
                    wrapperNode.style.transform = `scale(${scale})`;
                    
                    const exportHeight = exportNode.offsetHeight;
                    const scaledHeight = exportHeight * scale;
                    wrapperNode.style.height = `${scaledHeight}px`;
                }
            });
        };

        updatePreviewLayout();

        const resizeObserver = new ResizeObserver(updatePreviewLayout);
        resizeObserver.observe(containerNode);
        resizeObserver.observe(exportNode);

        return () => {
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
            resizeObserver.disconnect();
            if (wrapperNode) {
                 wrapperNode.style.height = '';
                 wrapperNode.style.transform = '';
            }
        };
    }, [isOpen, propsForContent]);
    
    const loadFont = useCallback((fontOption: typeof FONT_OPTIONS[0]) => {
      return new Promise<void>((resolve, reject) => {
        const { id, urlValue, name } = fontOption;

        if (fontStatuses[id] === 'loading' || fontStatuses[id] === 'loaded') {
          resolve();
          return;
        }
        
        setFontStatuses(prev => ({ ...prev, [id]: 'loading' }));
        
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = `https://fonts.googleapis.com/css2?family=${urlValue.replace(/ /g, '+')}&display=swap`;

        link.onload = () => {
            setFontStatuses(prev => ({ ...prev, [id]: 'loaded' }));
            resolve();
        };
        link.onerror = () => {
            console.error(`Failed to load font stylesheet: ${name}`);
            setFontStatuses(prev => ({ ...prev, [id]: 'idle' }));
            reject(new Error(`Failed to load font: ${name}`));
        };
        document.head.appendChild(link);
      });
    }, [fontStatuses]);

    useEffect(() => {
        if (isOpen) {
            const selectedFontOption = FONT_OPTIONS.find(f => f.id === font);
            if (selectedFontOption && (!fontStatuses[font] || fontStatuses[font] === 'idle')) {
                loadFont(selectedFontOption).catch(e => console.error("Failed to preload selected font:", e));
            }
        }
    }, [isOpen, font, fontStatuses, loadFont]);

    const handleFontSelect = useCallback(async (fontOption: typeof FONT_OPTIONS[0]) => {
        const { id } = fontOption;
        const currentStatus = fontStatuses[id] || 'idle';
        
        updateSetting('font', id);

        if (currentStatus === 'loading') return;
        
        try {
            if (currentStatus !== 'loaded') await loadFont(fontOption);
        } catch (error) {
            alert(`無法載入字體：${fontOption.name}。請稍後再試。`);
        }
    }, [fontStatuses, loadFont, updateSetting]);


    const handleStartExport = useCallback(async () => {
        const exportNode = exportRef.current;
        if (!exportNode) {
            alert('無法匯出：預覽元件尚未準備好。');
            return;
        }

        setIsExporting(true);
        setExportStage('generating_image');
        setLoadingMessage('正在準備字體...');

        const selectedFont = FONT_OPTIONS.find(f => f.id === font);
        if (!selectedFont) {
            alert("錯誤：找不到選擇的字體。");
            setIsExporting(false);
            setExportStage('configuring');
            return;
        }
        
        const styleElementId = 'temp-font-for-export';

        try {
            // STEP 1: Get the self-contained CSS with Base64 font data.
            const fontEmbedCSS = await embedFontForExport(selectedFont);

            // STEP 2: Inject this CSS into the document so the browser can load it and we can wait for it.
            const styleElement = document.createElement('style');
            styleElement.id = styleElementId;
            styleElement.innerHTML = fontEmbedCSS;
            document.head.appendChild(styleElement);
            
            // STEP 3: Wait for the browser to confirm the INJECTED font is ready.
            const fontFamilyToLoad = getPrimaryFamily(selectedFont.id);
            await document.fonts.load(`16px "${fontFamilyToLoad}"`);

            // STEP 4: Generate the image, providing the CSS to the library for maximum reliability.
            setLoadingMessage('正在繪製高解析度圖片...');
            const dataUrl = await htmlToImage.toPng(exportNode, {
                quality: 1,
                pixelRatio: 2,
                backgroundColor: bgColor,
                fontEmbedCSS: fontEmbedCSS,
            });

            setGeneratedPngDataUrl(dataUrl);
            setExportStage('completed');

        } catch (error) {
            console.error('Oops, something went wrong during PNG export!', error);
            alert('匯出圖片時發生錯誤！');
            setExportStage('configuring');
        } finally {
            // STEP 5: Clean up the injected style element.
            const tempStyle = document.getElementById(styleElementId);
            if (tempStyle) {
                tempStyle.remove();
            }
            setIsExporting(false);
        }
    }, [font, bgColor, currentDate, localTitle]);

    const handleDownloadFile = useCallback(() => {
        if (!generatedPngDataUrl) return;
        const link = document.createElement('a');
        const monthName = MONTH_NAMES_EN[currentDate.getMonth()];
        const year = currentDate.getFullYear();
        link.download = `${localTitle.replace(/ /g, '_')}-${year}-${monthName}.png`;
        link.href = generatedPngDataUrl;
        link.click();
    }, [generatedPngDataUrl, localTitle, currentDate]);

    const handleOpenInNewTab = useCallback(async () => {
        if (!generatedPngDataUrl) return;
        try {
            const response = await fetch(generatedPngDataUrl);
            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);
            window.open(objectUrl, '_blank', 'noopener,noreferrer');
            setTimeout(() => URL.revokeObjectURL(objectUrl), 100);
        } catch (error) {
            console.error('Error opening image in new tab:', error);
            window.open(generatedPngDataUrl, '_blank', 'noopener,noreferrer');
        }
    }, [generatedPngDataUrl]);

     const handleStyleChange = (style: PngStyle) => {
        const newSettings: Partial<PngSettingsState> = { pngStyle: style };
        if (style === 'minimal') {
            newSettings.bgColor = 'transparent';
            newSettings.textColor = '#111827';
            newSettings.borderColor = 'transparent';
            newSettings.blockColor = 'transparent';
            newSettings.strikethroughColor = '#EF4444';
        } else if (style === 'borderless') {
            newSettings.bgColor = '#FFFFFF';
            newSettings.textColor = '#111827';
            newSettings.blockColor = '#F9FAFB';
            newSettings.borderColor = 'transparent';
            newSettings.strikethroughColor = '#EF4444';
        } else if (style === 'wireframe') {
            newSettings.bgColor = '#FFFFFF';
            newSettings.textColor = '#111827';
            newSettings.borderColor = '#374151';
            newSettings.blockColor = 'transparent';
            newSettings.strikethroughColor = '#EF4444';
        }
        setPngSettings(prev => ({ ...prev, ...newSettings }));
    };
    
    if (!isOpen) return null;

    const header = <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">{exportStage === 'completed' ? '匯出成功！' : '匯出 PNG 圖片'}</h2>;
    const footer = (
        <>
            {loginPromptContent}
            {exportStage === 'completed' ? (
                 <button onClick={onClose} className="w-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold py-3 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                    完成
                </button>
            ) : (
                <div className="grid grid-cols-2 gap-3 w-full">
                    <button onClick={onClose} className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold py-3 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors" disabled={isExporting}>關閉</button>
                    <button onClick={handleStartExport} disabled={isExporting} className="bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-wait">
                        {isExporting ? <><SpinnerIcon className="w-5 h-5 mr-2" />{loadingMessage}</> : <><DownloadIcon /> 下載 PNG</>}
                    </button>
                </div>
            )}
        </>
    );
    
    const TabButton: React.FC<{ tab: PngSettingsTab, label: string; disabled?: boolean }> = ({ tab, label, disabled }) => (
      <button 
        onClick={() => !disabled && setActiveTab(tab)} 
        disabled={disabled}
        className={`py-2 px-4 rounded-lg transition-all text-sm font-medium ${activeTab === tab ? 'bg-white dark:bg-gray-600 shadow text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
        {label}
      </button>
    );
    
    const ViewModeButton: React.FC<{ mode: PngExportViewMode, label: string }> = ({ mode, label }) => (
      <button 
        onClick={() => {
            updateSetting('exportViewMode', mode);
        }}
        className={`py-2 rounded-lg transition-all text-sm font-medium ${exportViewMode === mode ? 'bg-white dark:bg-gray-600 shadow text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'}`}>
        {label}
      </button>
    );
    
    const AlignButton: React.FC<{ align: TitleAlign, label: string }> = ({ align, label }) => (
        <button 
          onClick={() => updateSetting('titleAlign', align)} 
          className={`py-2 rounded-lg transition-all text-sm font-medium ${titleAlign === align ? 'bg-white dark:bg-gray-600 shadow text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'}`}>
          {label}
        </button>
      );

    return (
        <Modal isOpen={isOpen} onClose={isExporting ? () => {} : onClose} headerContent={header} footerContent={footer} modalClassName="xl:max-w-4xl">
            <div
                style={{
                  // The export node must be in the DOM for html-to-image to work,
                  // but we can hide it visually.
                  position: 'fixed',
                  top: 0,
                  left: -99999,
                  pointerEvents: 'none',
                  opacity: 0,
                }}
              >
                <PngExportContent ref={exportRef} {...propsForContent} />
            </div>

            <div className={`absolute inset-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm flex-col items-center justify-center p-4 z-20 ${isExporting || exportStage === 'completed' ? 'flex' : 'hidden'}`}>
                <div className="w-full flex flex-col items-center">
                 <div className="relative w-16 h-16 flex items-center justify-center">
                    <DownloadIcon
                        className={`w-12 h-12 text-blue-600 transition-all duration-300 
                            ${isExporting ? 'opacity-100 scale-100 animate-pulse' : 'opacity-0 scale-50'}`
                        }
                    />
                    <CheckIcon
                        className={`w-16 h-16 text-green-500 absolute transition-all duration-300 delay-200
                            ${exportStage === 'completed' ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`
                        }
                    />
                </div>

                <p className="mt-4 text-lg font-semibold text-gray-700 dark:text-gray-200 text-center">
                    {exportStage === 'completed' ? '成功！圖片已準備就緒。' : loadingMessage}
                </p>
                
                 {exportStage === 'completed' && (
                    <div className="w-full flex flex-col items-center">
                        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm mt-6">
                            <button onClick={handleOpenInNewTab} className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors">
                                在新分頁開啟
                            </button>
                            <button onClick={handleDownloadFile} className="w-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold py-3 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                                直接下載 .png
                            </button>
                        </div>
                        <AdSlot className="mt-6 w-full" allowedHostnames={['your.app', 'your-short.link', 'bit.ly']} />
                    </div>
                 )}
                </div>
            </div>

            <div className={`flex flex-col lg:flex-row gap-6 items-start ${exportStage !== 'configuring' ? 'invisible' : ''}`}>
                <div className="w-full lg:w-1/2 lg:sticky lg:top-0">
                     <div className="space-y-2">
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">預覽</h3>
                        <div ref={previewContainerRef} className="w-full bg-gray-200/50 dark:bg-gray-700/50 rounded-md overflow-x-hidden max-h-[25vh] lg:max-h-[50vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
                            <div ref={scaleWrapperRef} style={{ transformOrigin: 'top left', transition: 'transform 0.2s ease-out, height 0.2s ease-out' }}>
                                <PngExportContent {...propsForContent} />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="w-full lg:w-1/2 space-y-4">
                    <SettingsCard>
                      <SettingsSection title="顯示範圍">
                        <div className="grid grid-cols-3 gap-1 rounded-xl bg-gray-200 dark:bg-gray-700 p-1">
                            <ViewModeButton mode="month" label="完整月曆"/>
                            <ViewModeButton mode="remaining" label="剩餘月份"/>
                            <ViewModeButton mode="list" label="清單模式"/>
                        </div>
                      </SettingsSection>
                    </SettingsCard>

                  <div className="grid grid-cols-3 gap-1 rounded-xl bg-gray-200 dark:bg-gray-700 p-1">
                      <TabButton tab="content" label="內容" />
                      <TabButton tab="style" label="樣式" />
                      <TabButton tab="layout" label="排版" />
                  </div>

                  <div className="space-y-4">
                    {activeTab === 'content' && (
                      <>
                        <SettingsCard>
                          <SettingsSection title="標題">
                            <input type="text" value={localTitle} onChange={e => setLocalTitle(e.target.value)} className="w-full p-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 transition text-gray-800 dark:text-gray-100"/>
                          </SettingsSection>
                        </SettingsCard>
                        <SettingsCard>
                          <SettingsSection title="顯示項目">
                            <label htmlFor="png-show-title" className="flex items-center justify-between cursor-pointer">
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">顯示主標題</span>
                                <div className="relative">
                                    <input type="checkbox" id="png-show-title" className="sr-only peer" checked={showTitle} onChange={e => updateSetting('showTitle', e.target.checked)} />
                                    <div className="block bg-gray-200 dark:bg-gray-600 w-10 h-6 rounded-full peer-checked:bg-blue-600 transition"></div>
                                    <div className="dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition transform peer-checked:translate-x-full"></div>
                                </div>
                            </label>
                            <label htmlFor="png-show-booked" className="flex items-center justify-between cursor-pointer">
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">顯示已預約時段</span>
                                <div className="relative">
                                    <input type="checkbox" id="png-show-booked" className="sr-only peer" checked={showBookedSlots} onChange={e => updateSetting('showBookedSlots', e.target.checked)} />
                                    <div className="block bg-gray-200 dark:bg-gray-600 w-10 h-6 rounded-full peer-checked:bg-blue-600 transition"></div>
                                    <div className="dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition transform peer-checked:translate-x-full"></div>
                                </div>
                            </label>
                            {showBookedSlots && (
                                <div className="space-y-2 pt-3 border-t border-gray-200/60 dark:border-gray-700/60">
                                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">已預約樣式</label>
                                    <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-200 dark:bg-gray-700 p-1">
                                        <button onClick={() => updateSetting('bookedStyle', 'strikethrough')} className={`py-2 rounded-lg transition-all text-sm font-medium ${bookedStyle === 'strikethrough' ? 'bg-white dark:bg-gray-600 shadow text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'}`}>畫橫線</button>
                                        <button onClick={() => updateSetting('bookedStyle', 'fade')} className={`py-2 rounded-lg transition-all text-sm font-medium ${bookedStyle === 'fade' ? 'bg-white dark:bg-gray-600 shadow text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'}`}>降低透明度</button>
                                    </div>
                                </div>
                            )}
                          </SettingsSection>
                        </SettingsCard>
                        <SettingsCard>
                            <SettingsSection title="語言">
                                <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-200 dark:bg-gray-700 p-1">
                                    <button onClick={() => updateSetting('language', 'zh')} className={`py-2 rounded-lg transition-all text-sm font-medium ${language === 'zh' ? 'bg-white dark:bg-gray-600 shadow text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'}`}>中文</button>
                                    <button onClick={() => updateSetting('language', 'en')} className={`py-2 rounded-lg transition-all text-sm font-medium ${language === 'en' ? 'bg-white dark:bg-gray-600 shadow text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'}`}>English</button>
                                </div>
                            </SettingsSection>
                        </SettingsCard>
                      </>
                    )}
                    {activeTab === 'style' && (
                      <>
                        {exportViewMode !== 'list' && <SettingsCard>
                          <SettingsSection title="整體風格">
                              <div className="grid grid-cols-4 gap-2 rounded-xl bg-gray-200 dark:bg-gray-700 p-1">
                                  <button onClick={() => handleStyleChange('minimal')} className={`py-2 rounded-lg transition-all text-sm font-medium ${pngStyle === 'minimal' ? 'bg-white dark:bg-gray-600 shadow text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'}`}>簡約</button>
                                  <button onClick={() => handleStyleChange('borderless')} className={`py-2 rounded-lg transition-all text-sm font-medium ${pngStyle === 'borderless' ? 'bg-white dark:bg-gray-600 shadow text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'}`}>區塊</button>
                                  <button onClick={() => handleStyleChange('wireframe')} className={`py-2 rounded-lg transition-all text-sm font-medium ${pngStyle === 'wireframe' ? 'bg-white dark:bg-gray-600 shadow text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'}`}>線框</button>
                                  <button onClick={() => handleStyleChange('custom')} className={`py-2 rounded-lg transition-all text-sm font-medium ${pngStyle === 'custom' ? 'bg-white dark:bg-gray-600 shadow text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'}`}>自訂</button>
                              </div>
                          </SettingsSection>
                        </SettingsCard>}
                        <SettingsCard>
                          <SettingsSection title="顏色">
                            <div className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-3">
                                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">背景</span>
                                <ColorSelectorRow presets={PRESET_COLORS.bg} value={bgColor} onChange={(c) => updateSetting('bgColor', c)} />

                                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">主要文字</span>
                                <ColorSelectorRow presets={PRESET_COLORS.text} value={textColor} onChange={(c) => updateSetting('textColor', c)} />
                                
                                {(pngStyle === 'wireframe' || pngStyle === 'custom' || exportViewMode === 'list') && (
                                    <>
                                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">邊框</span>
                                        <ColorSelectorRow presets={PRESET_COLORS.border} value={borderColor} onChange={(c) => updateSetting('borderColor', c)} />
                                    </>
                                )}

                                {(pngStyle === 'borderless' || pngStyle === 'custom') && (
                                    <>
                                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">區塊</span>
                                        <ColorSelectorRow presets={PRESET_COLORS.block} value={blockColor} onChange={(c) => updateSetting('blockColor', c)} />
                                    </>
                                )}
                            </div>
                            
                            <div className="pt-4 mt-4 border-t border-gray-200/60 dark:border-gray-700/60">
                                <div className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-3">
                                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">休假文字</span>
                                    <ColorSelectorRow presets={PRESET_COLORS.status} value={dayOffColor} onChange={(c) => updateSetting('dayOffColor', c)} />
                                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">公休文字</span>
                                    <ColorSelectorRow presets={PRESET_COLORS.status} value={closedColor} onChange={(c) => updateSetting('closedColor', c)} />
                                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">約滿文字</span>
                                    <ColorSelectorRow presets={PRESET_COLORS.status} value={fullyBookedColor} onChange={(c) => updateSetting('fullyBookedColor', c)} />
                                </div>
                            </div>
                            
                            {showBookedSlots && bookedStyle === 'strikethrough' && (
                                <div className="pt-3 mt-3 border-t border-gray-200/60 dark:border-gray-700/60">
                                    <div className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-3">
                                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">橫線顏色</span>
                                        <ColorSelectorRow presets={PRESET_COLORS.strikethrough} value={strikethroughColor} onChange={(c) => updateSetting('strikethroughColor', c)} />
                                        
                                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">橫線粗細</span>
                                        <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-200 dark:bg-gray-700 p-1">
                                            <button onClick={() => updateSetting('strikethroughThickness', 'thin')} className={`py-2 rounded-lg transition-all text-sm font-medium ${strikethroughThickness === 'thin' ? 'bg-white dark:bg-gray-600 shadow text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'}`}>細</button>
                                            <button onClick={() => updateSetting('strikethroughThickness', 'thick')} className={`py-2 rounded-lg transition-all text-sm font-medium ${strikethroughThickness === 'thick' ? 'bg-white dark:bg-gray-600 shadow text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'}`}>粗</button>
                                        </div>
                                    </div>
                                </div>
                            )}
                          </SettingsSection>
                        </SettingsCard>
                        {pngStyle === 'custom' && exportViewMode !== 'list' && (
                            <SettingsCard>
                                <SettingsSection title="效果">
                                    <label htmlFor="png-show-shadow" className="flex items-center justify-between cursor-pointer">
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">顯示陰影</span>
                                        <div className="relative">
                                            <input type="checkbox" id="png-show-shadow" className="sr-only peer" checked={showShadow} onChange={e => updateSetting('showShadow', e.target.checked)} />
                                            <div className="block bg-gray-200 dark:bg-gray-600 w-10 h-6 rounded-full peer-checked:bg-blue-600 transition"></div>
                                            <div className="dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition transform peer-checked:translate-x-full"></div>
                                        </div>
                                    </label>
                                </SettingsSection>
                            </SettingsCard>
                        )}
                        <SettingsCard>
                            <SettingsSection title="字體">
                                <div className="space-y-4">
                                    {FONT_CATEGORIES.map(category => (
                                        <div key={category.name}>
                                            <h4 className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2">{category.name}</h4>
                                            <div className="relative">
                                                <div className="flex space-x-3 overflow-x-auto pb-4 -mb-4 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
                                                    {category.fonts.map(f => (
                                                        <FontCard
                                                            key={f.id}
                                                            fontOption={f}
                                                            isSelected={font === f.id}
                                                            status={fontStatuses[f.id] || 'idle'}
                                                            onSelect={() => handleFontSelect(f)}
                                                            preloadFont={() => loadFont(f)}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </SettingsSection>
                        </SettingsCard>
                      </>
                    )}
                    {activeTab === 'layout' && (
                      <>
                        <SettingsCard>
                           <SettingsSection title="主標題對齊">
                                <div className="grid grid-cols-3 gap-1 rounded-xl bg-gray-200 dark:bg-gray-700 p-1">
                                    <AlignButton align="left" label="靠左"/>
                                    <AlignButton align="center" label="置中"/>
                                    <AlignButton align="right" label="靠右"/>
                                </div>
                           </SettingsSection>
                        </SettingsCard>
                        <SettingsCard>
                           <SettingsSection title="字體縮放">
                                <label className="text-sm text-gray-600 dark:text-gray-400 flex justify-between items-center mb-2">
                                    <span>縮放比例</span>
                                    <span className="text-base font-semibold text-gray-800 dark:text-gray-200">{Math.round(fontScale * 100)}%</span>
                                </label>
                                <input type="range" min="0.5" max="5" step="0.1" value={fontScale} onChange={e => updateSetting('fontScale', Number(e.target.value))} className="w-full h-3 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer focus:outline-none"/>
                           </SettingsSection>
                        </SettingsCard>
                        {exportViewMode !== 'list' && <SettingsCard>
                           <SettingsSection title="間距">
                                <div>
                                   <label className="text-sm text-gray-600 dark:text-gray-400 flex justify-between items-center mb-2">
                                       <span>水平間距</span>
                                       <span className="text-base font-semibold text-gray-800 dark:text-gray-200">{horizontalGap}px</span>
                                   </label>
                                   <input type="range" min="0" max="48" value={horizontalGap} onChange={e => updateSetting('horizontalGap', Number(e.target.value))} className="w-full h-3 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer focus:outline-none"/>
                                </div>
                                <div>
                                   <label className="text-sm text-gray-600 dark:text-gray-400 flex justify-between items-center mb-2">
                                       <span>垂直間距</span>
                                       <span className="text-base font-semibold text-gray-800 dark:text-gray-200">{verticalGap}px</span>
                                   </label>
                                   <input type="range" min="0" max="48" value={verticalGap} onChange={e => updateSetting('verticalGap', Number(e.target.value))} className="w-full h-3 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer focus:outline-none"/>
                                </div>
                           </SettingsSection>
                        </SettingsCard>}
                      </>
                    )}
                  </div>
                </div>
            </div>
        </Modal>
    );
};

interface PngExportContentProps extends PngSettingsState {
    scheduleData: ScheduleData;
    title: string;
    calendarDays: CalendarDay[];
    currentDate: Date;
}

const PngExportContent = React.forwardRef<HTMLDivElement, PngExportContentProps>(({
    scheduleData, title, currentDate, calendarDays, pngStyle, bgColor, textColor, borderColor, blockColor, showTitle, showBookedSlots, bookedStyle, strikethroughColor, strikethroughThickness, fontScale, font, language, horizontalGap, verticalGap, showShadow, exportViewMode, titleAlign, dayOffColor, closedColor, fullyBookedColor
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
                                        <span className="font-bold" style={{ color: getStatusColor(effectiveStatus) }}>{DAY_STATUS_TEXT_MAP[effectiveStatus]}</span>
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
                            const dateKey = formatDateKey(day.date);
                            const dayData = scheduleData[dateKey];
                            const effectiveStatus = getEffectiveStatus(dayData);

                            return (
                                <div key={`${weekIndex}-${dayIndex}`} style={getBlockStyles(day.isCurrentMonth, isPlaceholderRow)}>
                                    <p className="font-bold" style={{ color: day.isCurrentMonth ? textColor : 'transparent' }}>
                                        {day.date.getDate()}
                                    </p>
                                    {day.isCurrentMonth && effectiveStatus !== 'available' && effectiveStatus !== 'empty' && (
                                        <div className="flex-grow flex items-center justify-center">
                                            <span className="font-bold" style={{ fontSize: '1.1em', color: getStatusColor(effectiveStatus) }}>{DAY_STATUS_TEXT_MAP[effectiveStatus]}</span>
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

const LoginPrompt: React.FC<{ onLoginClick: () => void }> = ({ onLoginClick }) => (
    <div className="text-center text-sm text-gray-500 dark:text-gray-400 mb-3">
        登入即可雲端同步資料，下次開啟也能繼續編輯！
        <button onClick={onLoginClick} className="font-semibold text-blue-600 hover:underline ml-2">立即登入</button>
    </div>
);


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

    // Lifted state for PngExportModal settings persistence
    const [pngSettings, setPngSettings] = useState<PngSettingsState>({
        exportViewMode: 'month',
        pngStyle: 'minimal',
        bgColor: 'transparent',
        textColor: '#111827',
        borderColor: 'transparent',
        blockColor: 'transparent',
        showShadow: false,
        showTitle: true,
        showBookedSlots: true,
        bookedStyle: 'strikethrough',
        strikethroughColor: '#EF4444',
        strikethroughThickness: 'thin',
        fontScale: 1,
        font: FONT_OPTIONS[0].id,
        language: 'zh',
        horizontalGap: 8,
        verticalGap: 8,
        titleAlign: 'center',
        // UPDATED: Set defaults as requested
        dayOffColor: '#6B7280', // Gray
        closedColor: '#6B7280', // Gray
        fullyBookedColor: '#EF4444', // Red
    });

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

    useEffect(() => {
        if (!isFirebaseConfigured) return;
        const unsubscribe = auth.onAuthStateChanged((user: User | null) => {
            setUser(user);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (docRef) {
            docRef.get().then((doc: { exists: any; data: () => any; }) => {
                if (doc.exists) {
                    const data = doc.data();
                    if(data){
                        setScheduleData(data.schedule || {});
                        setTitle(data.title || "可預約時段");
                    }
                }
            }).catch((error: any) => console.error("Error loading data from Firestore:", error));
        } else {
            try {
                const localData = localStorage.getItem('scheduleData');
                if (localData) setScheduleData(JSON.parse(localData));
                const localTitle = localStorage.getItem('scheduleTitle');
                if (localTitle) setTitle(localTitle);
            } catch (error) {
                console.error("Failed to parse local storage data:", error);
                localStorage.removeItem('scheduleData');
                localStorage.removeItem('scheduleTitle');
            }
        }
    }, [docRef]);
    
    const saveData = (newSchedule: ScheduleData, newTitle: string = title) => {
        setScheduleData(newSchedule);
        setTitle(newTitle);
        if (docRef) {
            docRef.set({ schedule: newSchedule, title: newTitle }, { merge: true })
                .catch((error: any) => console.error("Error saving data to Firestore:", error));
        } else {
            localStorage.setItem('scheduleData', JSON.stringify(newSchedule));
            localStorage.setItem('scheduleTitle', newTitle);
        }
    };

    const calendarDays = useMemo<CalendarDay[]>(() => {
        const days: CalendarDay[] = [];
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);
        const firstDayOfWeek = firstDayOfMonth.getDay();
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

        const lastDayOfWeek = lastDayOfMonth.getDay();
        for (let i = 1; i < 7 - lastDayOfWeek; i++) {
            const date = new Date(year, month + 1, i);
            days.push({ date, isCurrentMonth: false, isToday: false });
        }
        return days;
    }, [currentDate]);

    const handleMonthChange = (offset: number) => {
        setCurrentDate(current => new Date(current.getFullYear(), current.getMonth() + offset, 1));
    };

    const handleDayClick = (day: CalendarDay) => {
        if (day.isCurrentMonth) {
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
            const pastedSlots = copiedSlots.map(slot => ({...slot, state: 'available'}as Slot));
            if (pastedSlots.length > 0) {
                newSchedule[pastedKey] = { status: 'available', slots: pastedSlots };
            } else {
                delete newSchedule[pastedKey];
            }
        });
      }
      
      saveData(newSchedule);
    };

    const handleToggleSlotState = (date: Date, time: string) => {
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
        saveData({ ...scheduleData, [dateKey]: { ...dayData, slots: newSlots } });
    };

    const handleTitleChange = (newTitle: string) => {
        saveData(scheduleData, newTitle);
    };
    
    const loginPromptContent = isFirebaseConfigured && !user ? <LoginPrompt onLoginClick={() => setIsAuthModalOpen(true)} /> : null;

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
                    <h2 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-gray-100">{`${currentDate.getFullYear()} 年 ${MONTH_NAMES[currentDate.getMonth()]}`}</h2>
                    <button onClick={() => handleMonthChange(1)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"><ChevronRightIcon className="text-gray-600 dark:text-gray-300"/></button>
                </div>
                <div className="flex items-center justify-center mb-4">
                    <div className="inline-flex items-center gap-2 bg-gray-100 dark:bg-gray-800 p-2 rounded-lg">
                       <input 
                         type="text" 
                         value={title} 
                         onChange={(e) => setTitle(e.target.value)} 
                         onBlur={(e) => handleTitleChange(e.target.value)}
                         className="bg-transparent text-center font-semibold text-gray-700 dark:text-gray-200 focus:outline-none"
                       />
                       <EditIcon className="text-gray-500 dark:text-gray-400"/>
                    </div>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center font-semibold text-gray-500 dark:text-gray-400 text-sm mb-2">
                    {DAY_NAMES.map(day => <div key={day}>{day}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-1">
                    {calendarDays.map((day) => {
                        const dateKey = formatDateKey(day.date);
                        const dayData = scheduleData[dateKey];
                        const effectiveStatus = getEffectiveStatus(dayData);
                        
                        return (
                            <div 
                                key={day.date.toISOString()}
                                onClick={() => handleDayClick(day)}
                                className={`border rounded-lg flex flex-col transition-colors ${day.isCurrentMonth ? 'bg-white dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/50 cursor-pointer' : 'bg-gray-50 dark:bg-black/20'} ${day.isToday ? 'border-blue-500' : 'border-gray-200 dark:border-gray-700'}`}
                            >
                                <span className={`self-center p-2 text-sm font-semibold flex-shrink-0 ${!day.isCurrentMonth ? 'text-gray-400 dark:text-gray-600' : 'text-gray-800 dark:text-gray-200'}`}>
                                    {day.date.getDate()}
                                </span>
                                {day.isCurrentMonth && effectiveStatus !== 'available' && effectiveStatus !== 'empty' && (
                                    <div className="flex-grow flex items-center justify-center p-1">
                                        <span className="text-xs font-bold text-gray-500 dark:text-gray-400 text-center">{DAY_STATUS_TEXT_MAP[effectiveStatus]}</span>
                                    </div>
                                )}
                                {dayData?.slots && dayData.slots.length > 0 && day.isCurrentMonth && effectiveStatus === 'available' && (
                                    <div className="px-1 pb-1 mt-auto flex-grow">
                                      <div className="flex flex-wrap gap-1 justify-center">
                                        {dayData.slots.map(slot => (
                                            <div 
                                                key={slot.time}
                                                onClick={(e) => { e.stopPropagation(); handleToggleSlotState(day.date, slot.time); }}
                                                className={`text-[9px] font-bold px-1 py-1 rounded-md cursor-pointer transition-colors leading-none 
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
                calendarDays={calendarDays}
                currentDate={currentDate}
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
            />

            {isFirebaseConfigured && <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} /> }

        </div>
    );
};

export default App;