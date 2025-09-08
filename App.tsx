import React, { useState, useCallback, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import type { ScheduleData, CalendarDay, PngStyle, Slot } from './types';
import { MONTH_NAMES, DAY_NAMES, PREDEFINED_SLOTS, MONTH_NAMES_EN, DAY_NAMES_EN } from './constants';
import { ChevronLeftIcon, ChevronRightIcon, DownloadIcon, CloseIcon, TrashIcon, CopyIcon, ClipboardIcon, CalendarIcon, EditIcon, RainbowIcon, UserIcon, GoogleIcon } from './components/icons';
import { auth, db, googleProvider, isFirebaseConfigured } from './firebaseClient';

// This declaration is necessary because html-to-image is loaded from a CDN.
declare const htmlToImage: {
  toPng: <T extends HTMLElement>(node: T, options?: object) => Promise<string>;
};

const FONT_OPTIONS = [
    { id: "'Noto Sans TC', sans-serif", name: '思源黑體', urlValue: 'Noto+Sans+TC:wght@300;400;700' },
    { id: "'Noto Serif TC', serif", name: '思源宋體', urlValue: 'Noto+Serif+TC:wght@300;400;700' },
    { id: "'LXGW WenKai TC', cursive", name: '霞鶩文楷', urlValue: 'LXGW+WenKai+TC:wght@300;400;700' },
    { id: "'M PLUS Rounded 1c', sans-serif", name: 'M+ 圓體', urlValue: 'M+PLUS+Rounded+1c:wght@300;400;700' },
    { id: "'Cormorant Garamond', serif", name: 'Cormorant Garamond', urlValue: 'Cormorant+Garamond:wght@400;700' },
    { id: "'Roboto', sans-serif", name: 'Roboto', urlValue: 'Roboto:wght@300;400;700' },
    { id: "'Lato', sans-serif", name: 'Lato', urlValue: 'Lato:wght@300;400;700' },
    { id: "'Montserrat', sans-serif", name: 'Montserrat', urlValue: 'Montserrat:wght@300;400;700' },
    { id: "'Open Sans', sans-serif", name: 'Open Sans', urlValue: 'Open+Sans:wght@300;400;700' },
    { id: "'Poppins', sans-serif", name: 'Poppins', urlValue: 'Poppins:wght@300;400;700' },
    { id: "'Raleway', sans-serif", name: 'Raleway', urlValue: 'Raleway:wght@300;400;700' },
];

const PRESET_COLORS = {
    bg: ['transparent', '#FFFFFF', '#F9FAFB', '#F3F4F6', '#111827', '#FECACA', '#BFDBFE'],
    text: ['#111827', '#6B7280', '#FFFFFF', '#9CA3AF', '#BE123C', '#1D4ED8'],
    border: ['transparent', '#E5E7EB', '#D1D5DB', '#9CA3AF', '#374151', '#FCA5A5', '#93C5FD'],
    block: ['transparent', '#F9FAFB', '#FFFFFF', '#E5E7EB', '#1F2937', '#FEE2E2', '#DBEAFE'],
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
  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 bg-black bg-opacity-40 flex items-end md:items-center justify-center z-50 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <div className={`bg-white w-full h-full flex flex-col md:overflow-hidden md:rounded-2xl md:shadow-2xl md:h-auto md:max-h-[calc(100vh-4rem)] transition-transform duration-300 ${isOpen ? 'translate-y-0' : 'translate-y-full md:translate-y-4'} ${modalClassName || 'md:max-w-lg'}`}>
        
        <header 
          className="flex-shrink-0 flex justify-between items-center p-4 border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10"
          style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}
        >
          <div className="flex-grow">{headerContent}</div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 p-1 rounded-full flex-shrink-0 ml-4"><CloseIcon /></button>
        </header>

        <main className="flex-grow overflow-y-auto p-4 md:p-6 bg-gray-50">
          {children}
        </main>

        <footer 
          className="flex-shrink-0 p-4 border-t border-gray-200 bg-white/80 backdrop-blur-sm sticky bottom-0 z-10"
          style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
        >
          {footerContent}
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
    
    const header = <h2 className="text-xl font-bold text-center text-gray-800">{isRegistering ? '註冊帳號' : '登入'}</h2>;
    
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
                    <input type="email" placeholder="電子郵件" value={email} onChange={e => setEmail(e.target.value)} required className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 transition bg-white text-gray-800" />
                    <input type="password" placeholder="密碼 (至少6位數)" value={password} onChange={e => setPassword(e.target.value)} required className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 transition bg-white text-gray-800" />
                </div>
                
                <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-300"></div></div>
                    <div className="relative flex justify-center text-sm"><span className="px-2 bg-gray-50 text-gray-500">或</span></div>
                </div>

                <button type="button" onClick={handleGoogleLogin} disabled={isLoading} className="w-full bg-white border border-gray-300 text-gray-700 font-bold py-3 px-4 rounded-lg hover:bg-gray-50 transition flex items-center justify-center gap-2 disabled:opacity-50">
                    <GoogleIcon /> 使用 Google 登入
                </button>
                
                <p className="text-center text-sm text-gray-500 mt-6">
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
  onDone: (updatedDay: { date: Date, slots: Slot[] }, pastedDays: string[]) => void;
  copiedSlots: Slot[] | null;
  onCopy: (slots: Slot[]) => void;
}

const SlotEditorModal: React.FC<SlotEditorModalProps> = ({ isOpen, selectedDay, scheduleData, calendarDays, onClose, onDone, copiedSlots, onCopy }) => {
  const [localSlots, setLocalSlots] = useState<Map<string, Slot>>(new Map());
  const [customSlot, setCustomSlot] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [multiPasteDates, setMultiPasteDates] = useState<Set<string>>(new Set());
  const [isMultiPasteExpanded, setIsMultiPasteExpanded] = useState(false);

  useEffect(() => {
    if (selectedDay) {
      const dateKey = formatDateKey(selectedDay);
      const daySlots = scheduleData[dateKey] || [];
      setLocalSlots(new Map(daySlots.map(slot => [slot.time, slot])));
      setCopySuccess(false);
      setMultiPasteDates(new Set());
      setIsMultiPasteExpanded(false);
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
      const newSlots = new Map<string, Slot>(copiedSlots.map(slot => [slot.time, {...slot, state: 'available'} as Slot]));
      handleSlotUpdate(newSlots);
    }
  };

  const toggleMultiPasteDate = (date: Date) => {
    const key = formatDateKey(date);
    const newSet = new Set(multiPasteDates);
    if (newSet.has(key)) {
        newSet.delete(key);
    } else {
        newSet.add(key);
    }
    setMultiPasteDates(newSet);
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
      onDone({ date: selectedDay, slots: getSortedSlots(localSlots) }, Array.from(multiPasteDates));
    }
    onClose();
  };
  
  if (!isOpen || !selectedDay) return null;
  const currentSlotsArray = getSortedSlots(localSlots);

  const header = (
      <div>
        <h2 className="text-xl font-bold text-gray-800">編輯時段</h2>
        <p className="text-sm text-gray-500">{`${selectedDay.getFullYear()} 年 ${MONTH_NAMES[selectedDay.getMonth()]} ${selectedDay.getDate()} 日`}</p>
      </div>
  );

  const footer = (
    <div className="grid grid-cols-2 gap-3 w-full">
        <button onClick={onClose} className="bg-gray-200 text-gray-700 font-bold py-3 px-4 rounded-lg hover:bg-gray-300 transition-colors">
            關閉
        </button>
        <button onClick={handleDone} className="bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors">
            完成
        </button>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} headerContent={header} footerContent={footer}>
        <div className="grid grid-cols-2 gap-2 mb-4">
            <button onClick={handleCopy} className="flex items-center justify-center text-sm bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 font-semibold py-2 px-4 rounded-lg transition-colors"><CopyIcon/>{copySuccess ? '已複製!' : '複製此日時段'}</button>
            <button onClick={handlePaste} disabled={!copiedSlots} className="flex items-center justify-center text-sm bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"><ClipboardIcon/>貼上至此日</button>
        </div>

        {copiedSlots && !isMultiPasteExpanded && (
            <button 
                onClick={() => setIsMultiPasteExpanded(true)}
                className="w-full text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold py-2 px-4 rounded-lg transition-colors mb-4"
            >
                貼上至多個日期...
            </button>
        )}

        {copiedSlots && isMultiPasteExpanded && (
            <div className="mb-4 bg-white p-3 rounded-lg border border-gray-200">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="font-semibold text-blue-800">貼上至多個日期</h3>
                    <button 
                        onClick={handlePasteToAll}
                        className="text-xs bg-blue-200 text-blue-800 font-semibold px-2 py-1 rounded-md hover:bg-blue-300 transition-colors"
                    >
                        貼上全部
                    </button>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center font-semibold text-gray-500 text-xs mb-2">
                    {DAY_NAMES.map(day => <div key={day}>{day}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-1">
                    {calendarDays.map(({ date, isCurrentMonth }, index) => {
                        const key = formatDateKey(date);
                        const isSelected = multiPasteDates.has(key);
                        const isTargetDay = selectedDay && formatDateKey(selectedDay) === key;
                        return (
                            <div key={index} onClick={() => isCurrentMonth && !isTargetDay && toggleMultiPasteDate(date)} 
                                className={`aspect-square border rounded-lg p-1 text-xs transition-all flex items-center justify-center 
                                ${!isCurrentMonth ? 'bg-gray-100 text-gray-400' : (isTargetDay ? 'bg-gray-300' : 'cursor-pointer')}
                                ${isSelected ? 'bg-blue-600 border-blue-700 font-bold text-white' : (isCurrentMonth && !isTargetDay ? 'bg-white hover:bg-blue-100 text-gray-800' : '')}
                                `}>
                                {date.getDate()}
                            </div>
                        );
                    })}
                </div>
            </div>
            )}

        <div className="mb-4">
            <h3 className="font-semibold text-gray-700 mb-2">已選時段 ({currentSlotsArray.length})</h3>
            <div className="bg-white p-3 rounded-lg min-h-[80px] border">
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
        
        <div className="mb-4">
            <h3 className="font-semibold text-gray-700 mb-2">快速新增</h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {PREDEFINED_SLOTS.map(slot => (
                    <button key={slot} onClick={() => handleQuickAdd(slot)} disabled={localSlots.has(slot)} className="p-2 rounded-lg text-sm text-center transition-colors font-medium border bg-white text-gray-700 hover:bg-gray-100 border-gray-300 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed">{slot}</button>
                ))}
            </div>
        </div>

        <div>
            <h3 className="font-semibold text-gray-700 mb-2">自訂時段</h3>
            <div className="flex gap-2">
                <input type="time" value={customSlot} onChange={e => setCustomSlot(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 transition bg-white text-gray-800"/>
                <button onClick={handleAddCustomSlot} className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors flex-shrink-0">新增</button>
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
}

const TextExportModal: React.FC<TextExportModalProps> = ({ isOpen, onClose, scheduleData, title, currentDate }) => {
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
                return date.getFullYear() === currentYear && date.getMonth() === currentMonth && scheduleData[key]?.length > 0;
            })
            .sort((a,b) => a.localeCompare(b));
        
        if (sortedDates.length === 0) {
            return language === 'zh' ? "此月份尚未安排任何時段。" : "No slots scheduled for this month yet.";
        }
        
        sortedDates.forEach(dateKey => {
            const date = new Date(dateKey);
            const year = date.getFullYear();
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            const dayOfWeek = language === 'zh' ? DAY_NAMES[date.getDay()] : DAY_NAMES_EN[date.getDay()];
            
            let slotsToDisplay: string[] = [];
            const bookedText = language === 'zh' ? '(已預約)' : '(Booked)';

            const relevantSlots = scheduleData[dateKey] || [];
            const finalSlots = showBooked ? relevantSlots : relevantSlots.filter(s => s.state === 'available');

            if (finalSlots.length === 0) return;

            slotsToDisplay = finalSlots.map(slot => {
                if (slot.state === 'booked') {
                    if (bookedStyle === 'strikethrough') {
                        return applyStrikethrough(slot.time);
                    }
                    return `${slot.time} ${bookedText}`;
                }
                return slot.time;
            });


            const dateString = includeYear ? `${year}/${month}/${day}` : `${month}/${day}`;
            
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

    const header = <h2 className="text-xl font-bold text-gray-800">匯出文字格式</h2>;
    const footer = (
        <div className="grid grid-cols-2 gap-3 w-full">
            <button onClick={onClose} className="bg-gray-200 text-gray-700 font-bold py-3 px-4 rounded-lg hover:bg-gray-300 transition-colors">關閉</button>
            <button onClick={handleCopy} className="bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors">{copyButtonText}</button>
        </div>
    );
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} headerContent={header} footerContent={footer}>
            <div className="space-y-6">
                <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">排版</label>
                    <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-200 p-1">
                        <button onClick={() => setLayout('default')} className={`py-2 rounded-lg transition-all text-sm font-medium ${layout === 'default' ? 'bg-white shadow text-gray-800' : 'text-gray-600'}`}>詳細</button>
                        <button onClick={() => setLayout('compact')} className={`py-2 rounded-lg transition-all text-sm font-medium ${layout === 'compact' ? 'bg-white shadow text-gray-800' : 'text-gray-600'}`}>緊湊</button>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">語言</label>
                    <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-200 p-1">
                        <button onClick={() => setLanguage('zh')} className={`py-2 rounded-lg transition-all text-sm font-medium ${language === 'zh' ? 'bg-white shadow text-gray-800' : 'text-gray-600'}`}>中文</button>
                        <button onClick={() => setLanguage('en')} className={`py-2 rounded-lg transition-all text-sm font-medium ${language === 'en' ? 'bg-white shadow text-gray-800' : 'text-gray-600'}`}>English</button>
                    </div>
                </div>
                
                <div className="space-y-3">
                    <label htmlFor="include-year" className="flex items-center justify-between bg-white p-3 rounded-lg border cursor-pointer">
                        <span className="text-sm font-medium text-gray-700">包含年份</span>
                        <div className="relative">
                            <input type="checkbox" id="include-year" className="sr-only peer" checked={includeYear} onChange={e => setIncludeYear(e.target.checked)} />
                            <div className="block bg-gray-200 w-10 h-6 rounded-full peer-checked:bg-blue-600 transition"></div>
                            <div className="dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition transform peer-checked:translate-x-full"></div>
                        </div>
                    </label>
                    <label htmlFor="show-booked" className="flex items-center justify-between bg-white p-3 rounded-lg border cursor-pointer">
                        <span className="text-sm font-medium text-gray-700">顯示已預約時段</span>
                        <div className="relative">
                            <input type="checkbox" id="show-booked" className="sr-only peer" checked={showBooked} onChange={e => setShowBooked(e.target.checked)} />
                            <div className="block bg-gray-200 w-10 h-6 rounded-full peer-checked:bg-blue-600 transition"></div>
                            <div className="dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition transform peer-checked:translate-x-full"></div>
                        </div>
                    </label>
                    {showBooked && (
                        <div className="space-y-2 pt-3 border-t border-gray-200/60">
                            <label className="text-sm font-semibold text-gray-700">已預約樣式</label>
                            <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-200 p-1">
                                <button onClick={() => setBookedStyle('strikethrough')} className={`py-2 rounded-lg transition-all text-sm font-medium ${bookedStyle === 'strikethrough' ? 'bg-white shadow text-gray-800' : 'text-gray-600'}`}>刪除線</button>
                                <button onClick={() => setBookedStyle('annotation')} className={`py-2 rounded-lg transition-all text-sm font-medium ${bookedStyle === 'annotation' ? 'bg-white shadow text-gray-800' : 'text-gray-600'}`}>文字註記</button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-white p-3 rounded-lg border">
                    <textarea 
                        readOnly 
                        value={generatedText}
                        className="w-full h-48 md:h-56 bg-transparent resize-none border-none focus:ring-0 text-sm text-gray-800"
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
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform transform hover:scale-110 shadow-sm ${isCustom ? 'ring-2 ring-offset-2 ring-blue-500' : 'ring-1 ring-inset ring-gray-300'}`}
      >
        <RainbowIcon />
      </button>
      <input
        ref={inputRef}
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute w-0 h-0 top-0 left-0 opacity-0"
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
    onAuthRequest: () => void;
    isLoggedIn: boolean;
}

const SettingsSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">{title}</h3>
        <div className="space-y-3">{children}</div>
    </div>
);

const ColorSelector: React.FC<{ label: string; value: string; onChange: (color: string) => void; presets: string[]; }> = ({ label, value, onChange, presets }) => {
    const isCustom = !presets.includes(value);
    return (
        <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">{label}</span>
            <div className="flex items-center gap-2">
                {presets.map(color => {
                    if (color === 'transparent') {
                       return (
                            <button
                                key={color}
                                type="button"
                                onClick={() => onChange(color)}
                                className={`w-6 h-6 rounded-full transition-transform transform hover:scale-110 shadow-sm border bg-[conic-gradient(from_90deg_at_50%_50%,#ccc_25%,#fff_0,#fff_50%,#ccc_0,#ccc_75%,#fff_0)] bg-[length:10px_10px] ${value === color ? 'ring-2 ring-offset-1 ring-blue-500' : 'border-gray-300'}`}
                            />
                       );
                    }
                    return (
                        <button key={color} type="button" onClick={() => onChange(color)} className={`w-6 h-6 rounded-full transition-transform transform hover:scale-110 shadow-sm border ${value.toUpperCase() === color.toUpperCase() ? 'ring-2 ring-offset-1 ring-blue-500' : ''}`} style={{ backgroundColor: color }} />
                    )
                })}
                <ColorPickerInput value={value} onChange={onChange} isCustom={isCustom} />
            </div>
        </div>
    );
};

const PngExportModal: React.FC<PngExportModalProps> = ({ isOpen, onClose, scheduleData, title, calendarDays, currentDate, onAuthRequest, isLoggedIn }) => {
    const exportRef = useRef<HTMLDivElement>(null);
    const previewContainerRef = useRef<HTMLDivElement>(null);
    const scaleWrapperRef = useRef<HTMLDivElement>(null);
    
    const [pngStyle, setPngStyle] = useState<PngStyle>('minimal');
    const [bgColor, setBgColor] = useState('transparent');
    const [textColor, setTextColor] = useState('#111827');
    const [borderColor, setBorderColor] = useState('transparent');
    const [blockColor, setBlockColor] = useState('transparent');
    const [showTitle, setShowTitle] = useState(true);
    const [showYearMonth, setShowYearMonth] = useState(true);
    const [showBookedSlots, setShowBookedSlots] = useState(true);
    const [bookedStyle, setBookedStyle] = useState<'red-strikethrough' | 'fade'>('red-strikethrough');
    const [fontScale, setFontScale] = useState(1);
    const [font, setFont] = useState(FONT_OPTIONS[0].id);
    const [language, setLanguage] = useState<'zh' | 'en'>('zh');
    const [horizontalGap, setHorizontalGap] = useState(8);
    const [verticalGap, setVerticalGap] = useState(8);
    const [localTitle, setLocalTitle] = useState(title);
    const [isLoading, setIsLoading] = useState(false);
    
    useEffect(() => {
        setLocalTitle(title);
    }, [title]);

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
    }, [isOpen]);
    
    const handleDownload = useCallback(async () => {
        if (!exportRef.current) {
            alert('無法匯出圖片，預覽元件不存在。');
            return;
        }
        if (!isLoggedIn) {
            onAuthRequest();
            return;
        }

        setIsLoading(true);
        try {
            const dataUrl = await htmlToImage.toPng(exportRef.current, {
                quality: 1,
                pixelRatio: 2,
                backgroundColor: bgColor,
            });
            const link = document.createElement('a');
            const monthName = MONTH_NAMES_EN[currentDate.getMonth()];
            const year = currentDate.getFullYear();
            link.download = `${localTitle}-${year}-${monthName}.png`;
            link.href = dataUrl;
            link.click();
        } catch (error) {
            console.error('oops, something went wrong!', error);
            alert('匯出圖片時發生錯誤！');
        } finally {
            setIsLoading(false);
        }
    }, [isLoggedIn, onAuthRequest, bgColor, localTitle, currentDate]);

    if (!isOpen) return null;

    const propsForContent = { scheduleData, title: localTitle, calendarDays, currentDate, pngStyle, bgColor, textColor, borderColor, blockColor, showTitle, showYearMonth, showBookedSlots, bookedStyle, fontScale, font, language, horizontalGap, verticalGap };

    const header = <h2 className="text-xl font-bold text-gray-800">匯出 PNG 圖片</h2>;
    const footer = (
        <div className="grid grid-cols-2 gap-3 w-full">
            <button onClick={onClose} className="bg-gray-200 text-gray-700 font-bold py-3 px-4 rounded-lg hover:bg-gray-300 transition-colors">關閉</button>
            <button onClick={handleDownload} disabled={isLoading} className="bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center disabled:opacity-50">
                {isLoading ? '匯出中...' : <><DownloadIcon /> {isLoggedIn ? '下載 PNG' : '登入以下載'}</>}
            </button>
        </div>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} headerContent={header} footerContent={footer} modalClassName="md:max-w-4xl">
            <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="w-full md:w-1/2 md:sticky md:top-[calc(4rem+env(safe-area-inset-top))]">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">預覽</h3>
                    <div ref={previewContainerRef} className="w-full bg-gray-200/50 rounded-md">
                        <div ref={scaleWrapperRef} style={{ transformOrigin: 'top left', transition: 'transform 0.2s ease-out' }}>
                            <PngExportContent ref={exportRef} {...propsForContent} />
                        </div>
                    </div>
                </div>
                <div className="w-full md:w-1/2 space-y-6">
                    <SettingsSection title="標題">
                        <input type="text" value={localTitle} onChange={e => setLocalTitle(e.target.value)} className="w-full p-2 bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 transition text-gray-800"/>
                    </SettingsSection>

                    <SettingsSection title="內容顯示">
                            <label htmlFor="png-show-title" className="flex items-center justify-between cursor-pointer">
                            <span className="text-sm font-medium text-gray-700">顯示主標題</span>
                            <div className="relative">
                                <input type="checkbox" id="png-show-title" className="sr-only peer" checked={showTitle} onChange={e => setShowTitle(e.target.checked)} />
                                <div className="block bg-gray-200 w-10 h-6 rounded-full peer-checked:bg-blue-600 transition"></div>
                                <div className="dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition transform peer-checked:translate-x-full"></div>
                            </div>
                        </label>
                        <label htmlFor="png-show-year-month" className="flex items-center justify-between cursor-pointer">
                            <span className="text-sm font-medium text-gray-700">顯示年月份</span>
                            <div className="relative">
                                <input type="checkbox" id="png-show-year-month" className="sr-only peer" checked={showYearMonth} onChange={e => setShowYearMonth(e.target.checked)} />
                                <div className="block bg-gray-200 w-10 h-6 rounded-full peer-checked:bg-blue-600 transition"></div>
                                <div className="dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition transform peer-checked:translate-x-full"></div>
                            </div>
                        </label>
                        <label htmlFor="png-show-booked" className="flex items-center justify-between cursor-pointer">
                            <span className="text-sm font-medium text-gray-700">顯示已預約時段</span>
                            <div className="relative">
                                <input type="checkbox" id="png-show-booked" className="sr-only peer" checked={showBookedSlots} onChange={e => setShowBookedSlots(e.target.checked)} />
                                <div className="block bg-gray-200 w-10 h-6 rounded-full peer-checked:bg-blue-600 transition"></div>
                                <div className="dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition transform peer-checked:translate-x-full"></div>
                            </div>
                        </label>
                        {showBookedSlots && (
                            <div className="space-y-2 pt-3 border-t border-gray-200/60">
                                <label className="text-sm font-semibold text-gray-700">已預約樣式</label>
                                <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-200 p-1">
                                    <button onClick={() => setBookedStyle('red-strikethrough')} className={`py-2 rounded-lg transition-all text-sm font-medium ${bookedStyle === 'red-strikethrough' ? 'bg-white shadow text-gray-800' : 'text-gray-600'}`}>畫紅色橫線</button>
                                    <button onClick={() => setBookedStyle('fade')} className={`py-2 rounded-lg transition-all text-sm font-medium ${bookedStyle === 'fade' ? 'bg-white shadow text-gray-800' : 'text-gray-600'}`}>降低透明度</button>
                                </div>
                            </div>
                        )}
                    </SettingsSection>
                    
                    <SettingsSection title="整體樣式">
                            <div className="grid grid-cols-3 gap-2 rounded-xl bg-gray-200 p-1">
                            <button onClick={() => setPngStyle('minimal')} className={`py-2 rounded-lg transition-all text-sm font-medium ${pngStyle === 'minimal' ? 'bg-white shadow text-gray-800' : 'text-gray-600'}`}>簡約</button>
                            <button onClick={() => setPngStyle('borderless')} className={`py-2 rounded-lg transition-all text-sm font-medium ${pngStyle === 'borderless' ? 'bg-white shadow text-gray-800' : 'text-gray-600'}`}>區塊</button>
                            <button onClick={() => setPngStyle('wireframe')} className={`py-2 rounded-lg transition-all text-sm font-medium ${pngStyle === 'wireframe' ? 'bg-white shadow text-gray-800' : 'text-gray-600'}`}>線框</button>
                        </div>
                    </SettingsSection>
                    
                    <SettingsSection title="顏色">
                        <ColorSelector label="背景" value={bgColor} onChange={setBgColor} presets={PRESET_COLORS.bg} />
                        <ColorSelector label="文字" value={textColor} onChange={setTextColor} presets={PRESET_COLORS.text} />
                        <ColorSelector label="邊框" value={borderColor} onChange={setBorderColor} presets={PRESET_COLORS.border} />
                        <ColorSelector label="區塊" value={blockColor} onChange={setBlockColor} presets={PRESET_COLORS.block} />
                    </SettingsSection>

                    <SettingsSection title="字體">
                        <select value={font} onChange={e => setFont(e.target.value)} className="w-full p-2 bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 transition text-gray-800">
                            {FONT_OPTIONS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                        <div className="bg-white p-3 rounded-lg border">
                            <label className="text-sm text-gray-600 flex justify-between items-center mb-2">
                                <span>字體縮放</span>
                                <span className="text-base font-semibold text-gray-800">{Math.round(fontScale * 100)}%</span>
                            </label>
                            <input type="range" min="0.5" max="5" step="0.1" value={fontScale} onChange={e => setFontScale(Number(e.target.value))} className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer focus:outline-none"/>
                        </div>
                    </SettingsSection>

                        <SettingsSection title="排版">
                        <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-200 p-1">
                            <button onClick={() => setLanguage('zh')} className={`py-2 rounded-lg transition-all text-sm font-medium ${language === 'zh' ? 'bg-white shadow text-gray-800' : 'text-gray-600'}`}>中文</button>
                            <button onClick={() => setLanguage('en')} className={`py-2 rounded-lg transition-all text-sm font-medium ${language === 'en' ? 'bg-white shadow text-gray-800' : 'text-gray-600'}`}>English</button>
                        </div>
                        <div className="bg-white p-3 rounded-lg border">
                            <label className="text-sm text-gray-600 flex justify-between items-center mb-2">
                                <span>水平間距</span>
                                <span className="text-base font-semibold text-gray-800">{horizontalGap}px</span>
                            </label>
                            <input type="range" min="0" max="48" value={horizontalGap} onChange={e => setHorizontalGap(Number(e.target.value))} className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer focus:outline-none"/>
                        </div>
                        <div className="bg-white p-3 rounded-lg border">
                            <label className="text-sm text-gray-600 flex justify-between items-center mb-2">
                                <span>垂直間距</span>
                                <span className="text-base font-semibold text-gray-800">{verticalGap}px</span>
                            </label>
                            <input type="range" min="0" max="48" value={verticalGap} onChange={e => setVerticalGap(Number(e.target.value))} className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer focus:outline-none"/>
                        </div>
                    </SettingsSection>
                </div>
            </div>
        </Modal>
    );
};

interface PngExportContentProps {
    scheduleData: ScheduleData;
    title: string;
    calendarDays: CalendarDay[];
    currentDate: Date;
    pngStyle: PngStyle;
    bgColor: string;
    textColor: string;
    borderColor: string;
    blockColor: string;
    showTitle: boolean;
    showYearMonth: boolean;
    showBookedSlots: boolean;
    bookedStyle: 'red-strikethrough' | 'fade';
    fontScale: number;
    font: string;
    language: 'zh' | 'en';
    horizontalGap: number;
    verticalGap: number;
}

const PngExportContent = React.forwardRef<HTMLDivElement, PngExportContentProps>(({
    scheduleData, title, currentDate, calendarDays, pngStyle, bgColor, textColor, borderColor, blockColor, showTitle, showYearMonth, showBookedSlots, bookedStyle, fontScale, font, language, horizontalGap, verticalGap
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
    
    const getBlockStyles = (isCurrentMonth: boolean, isPlaceholderRow: boolean): React.CSSProperties => {
        const styles: React.CSSProperties = {
            padding: '8px',
            borderRadius: '8px',
            minHeight: '100px',
            display: 'flex',
            flexDirection: 'column',
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
                styles.backgroundColor = blockColor;
                styles.border = `1px solid ${borderColor}`;
                break;
            case 'borderless':
                styles.backgroundColor = blockColor;
                styles.border = `1px solid transparent`;
                break;
            case 'wireframe':
                styles.backgroundColor = 'transparent';
                styles.border = `1px solid ${borderColor}`;
                break;
        }
        return styles;
    };

    const weeks = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
        weeks.push(calendarDays.slice(i, i + 7));
    }


    return (
        <div ref={ref} style={containerStyles}>
            {showTitle && <h1 className="text-3xl font-bold text-center mb-4" style={{ color: textColor }}>{title}</h1>}
            {showYearMonth && <h2 className="text-xl font-semibold text-center mb-6" style={{ color: textColor }}>{`${currentDate.getFullYear()} ${monthNames[currentDate.getMonth()]}`}</h2>}
            
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
                        const slots = scheduleData[dateKey] || [];
                        const finalSlots = showBookedSlots ? slots : slots.filter(s => s.state === 'available');
                        const hasSlots = day.isCurrentMonth && finalSlots.length > 0;

                        return (
                            <div key={`${weekIndex}-${dayIndex}`} style={getBlockStyles(day.isCurrentMonth, isPlaceholderRow)}>
                                <p className="font-bold" style={{ color: day.isCurrentMonth ? textColor : 'transparent' }}>
                                    {day.date.getDate()}
                                </p>
                                {hasSlots && (
                                    <ul className="space-y-1 mt-1">
                                        {finalSlots.map(slot => {
                                            const liStyle: React.CSSProperties = { color: textColor };
                                            if (slot.state === 'booked') {
                                                if (bookedStyle === 'fade') {
                                                    liStyle.opacity = 0.3;
                                                } else if (bookedStyle === 'red-strikethrough') {
                                                    liStyle.textDecoration = 'line-through';
                                                    liStyle.textDecorationColor = '#EF4444';
                                                    liStyle.textDecorationThickness = '1.5px';
                                                }
                                            }
                                            return (
                                                <li key={slot.time} style={liStyle}>
                                                  {slot.time}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </div>
                        );
                    });
                })}
            </div>
        </div>
    );
});


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
            docRef.get().then(doc => {
                if (doc.exists) {
                    const data = doc.data();
                    if(data){
                        setScheduleData(data.schedule || {});
                        setTitle(data.title || "可預約時段");
                    }
                }
            }).catch(error => console.error("Error loading data from Firestore:", error));
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
                .catch(error => console.error("Error saving data to Firestore:", error));
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
    
    const handleToggleSlotState = (date: Date, time: string) => {
        const key = formatDateKey(date);
        const daySlots = scheduleData[key] || [];
        const newSlots = daySlots.map(slot => {
            if (slot.time === time) {
                return { ...slot, state: slot.state === 'available' ? 'booked' : 'available' } as Slot;
            }
            return slot;
        });
        saveData({ ...scheduleData, [key]: newSlots });
    };

    const handleSlotUpdate = ({ date, slots }: { date: Date, slots: Slot[] }, pastedDays: string[]) => {
        const newSchedule = { ...scheduleData };
        const key = formatDateKey(date);
        newSchedule[key] = slots;

        pastedDays.forEach(pasteKey => {
            newSchedule[pasteKey] = slots.map(s => ({...s, state: 'available'} as Slot));
        });

        saveData(newSchedule);
    };

    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        saveData(scheduleData, e.target.value);
    }

    const handleLogout = async () => {
        await auth.signOut();
    }

    return (
        <div className="bg-gray-50 min-h-screen">
            <header 
                className="fixed top-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-sm border-b border-gray-200"
                style={{ paddingTop: 'env(safe-area-inset-top)' }}
            >
                <div className="max-w-6xl mx-auto grid grid-cols-3 items-center px-4 sm:px-6 lg:px-8 h-16">
                    <div className="flex justify-start">
                         <CalendarIcon className="h-7 w-7 text-gray-700" />
                    </div>
                    <div className="flex justify-center text-center">
                         <h1 className="text-base sm:text-lg font-bold text-gray-800 whitespace-nowrap truncate">預約時段匯出工具</h1>
                    </div>
                    <div className="flex justify-end">
                         {isFirebaseConfigured && (
                            <div>
                                {user ? (
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm text-gray-600 hidden sm:inline truncate max-w-[120px]">Hi, {user.displayName || user.email}</span>
                                        <button onClick={handleLogout} className="text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-3 rounded-lg transition-colors flex-shrink-0 h-10 min-w-[40px]">登出</button>
                                    </div>
                                ) : (
                                    <button onClick={() => setIsAuthModalOpen(true)} className="flex items-center justify-center gap-2 text-sm font-semibold bg-blue-600 text-white py-2.5 px-4 rounded-lg hover:bg-blue-700 transition-colors h-10 min-w-[40px]">
                                        <UserIcon />
                                        <span className="hidden sm:inline">登入 / 註冊</span>
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <main 
                className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8"
                style={{
                    paddingTop: 'calc(4rem + 1rem + env(safe-area-inset-top))',
                    paddingBottom: 'calc(5rem + 1rem + env(safe-area-inset-bottom))'
                }}
            >
                <div className="bg-white p-6 rounded-2xl shadow-lg">
                    <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                        <div className="flex items-center gap-2">
                             <button onClick={() => handleMonthChange(-1)} className="p-2 rounded-full hover:bg-gray-100 text-gray-600"><ChevronLeftIcon /></button>
                             <h2 className="text-2xl font-bold text-gray-800 w-32 text-center">{`${currentDate.getFullYear()} ${MONTH_NAMES[currentDate.getMonth()]}`}</h2>
                             <button onClick={() => handleMonthChange(1)} className="p-2 rounded-full hover:bg-gray-100 text-gray-600"><ChevronRightIcon /></button>
                        </div>
                        <div className="flex items-center gap-2 bg-gray-100 p-1.5 rounded-lg">
                             <input type="text" value={title} onChange={handleTitleChange} className="bg-transparent font-semibold text-gray-700 text-center sm:text-left text-lg px-2 py-1 w-48 focus:ring-2 focus:ring-blue-500 rounded-md outline-none" />
                             <EditIcon className="text-gray-500"/>
                        </div>
                    </div>

                    <div className="grid grid-cols-7 gap-1 text-center font-semibold text-gray-500 text-sm mb-2">
                        {DAY_NAMES.map(day => <div key={day}>{day}</div>)}
                    </div>

                    <div className="grid grid-cols-7 gap-1 md:gap-2">
                        {calendarDays.map((day, index) => {
                            const dateKey = formatDateKey(day.date);
                            const daySlots = scheduleData[dateKey] || [];
                            
                            return (
                                <div key={index} onClick={() => handleDayClick(day)}
                                    className={`flex flex-col transition-all duration-200 border rounded-lg p-1.5
                                    ${day.isCurrentMonth ? 'cursor-pointer bg-white hover:border-blue-500 hover:shadow-md' : 'bg-gray-50 text-gray-400'}
                                    ${day.isToday ? 'border-2 border-blue-500' : 'border-gray-200'}
                                    `}>
                                    <span className={`font-bold self-start flex-shrink-0 ${day.isToday ? 'text-blue-600' : day.isCurrentMonth ? 'text-gray-800' : ''}`}>{day.date.getDate()}</span>
                                    {day.isCurrentMonth && daySlots.length > 0 && (
                                        <div className="mt-1 -mx-1 px-1">
                                            <ul className="text-[9px] text-left">
                                                {daySlots.sort((a, b) => a.time.localeCompare(b.time)).map(slot => (
                                                    <li key={slot.time}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleToggleSlotState(day.date, slot.time);
                                                        }}
                                                        className={`py-1 my-px px-1 rounded cursor-pointer transition-colors text-center ${
                                                            slot.state === 'available'
                                                                ? 'text-blue-800 bg-blue-100 hover:bg-blue-200'
                                                                : 'text-gray-500 bg-gray-100 line-through hover:bg-gray-200'
                                                        }`}
                                                    >
                                                        {slot.time}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </main>

            <footer 
                className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-sm z-40 border-t border-gray-200"
                style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                     <div className="grid grid-cols-2 gap-4">
                         <button onClick={() => setIsTextExportOpen(true)} className="w-full bg-white font-semibold text-gray-700 py-3 px-4 rounded-lg shadow-md hover:shadow-lg hover:text-blue-600 transition-all flex items-center justify-center gap-2">
                            匯出文字
                        </button>
                        <button onClick={() => setIsPngExportOpen(true)} className="w-full bg-blue-600 font-semibold text-white py-3 px-4 rounded-lg shadow-md hover:shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
                            匯出圖片 (PNG)
                        </button>
                    </div>
                </div>
            </footer>
            
            <SlotEditorModal isOpen={isSlotEditorOpen} onClose={() => setIsSlotEditorOpen(false)} selectedDay={selectedDay} scheduleData={scheduleData} calendarDays={calendarDays} onDone={handleSlotUpdate} copiedSlots={copiedSlots} onCopy={setCopiedSlots} />
            <PngExportModal isOpen={isPngExportOpen} onClose={() => setIsPngExportOpen(false)} scheduleData={scheduleData} title={title} calendarDays={calendarDays} currentDate={currentDate} isLoggedIn={!!user} onAuthRequest={() => setIsAuthModalOpen(true)} />
            <TextExportModal isOpen={isTextExportOpen} onClose={() => setIsTextExportOpen(false)} scheduleData={scheduleData} title={title} currentDate={currentDate} />
            {isFirebaseConfigured && <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />}
        </div>
    );
}

export default App;