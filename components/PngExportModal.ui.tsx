import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { PngSettingsState, PngStyle, PngExportViewMode, TitleAlign } from '../types';
import { DownloadIcon, CheckIcon, SpinnerIcon, RainbowIcon, TrashIcon } from './icons';
import { AdSlot } from './AdSlot';
import { FONT_CATEGORIES, FONT_OPTIONS, PRESET_COLORS, FontOption, FontStatus, PngSettingsTab } from './PngExportModal.helpers';
import { parseColor, hexToRgb } from '../utils';

// --- Reusable Basic UI Components ---

export const SettingsSection: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({ title, children, className }) => (
    <div className={className}>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{title}</h3>
        <div className="space-y-3">{children}</div>
    </div>
);

export const SettingsCard: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ children, className }) => (
    <div className={`bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 ${className}`}>
        {children}
    </div>
);

// --- Color Picker Components ---

const ColorPickerInput: React.FC<{
  value: string;
  onChange: (color: string) => void;
  isCustom: boolean;
}> = ({ value, onChange, isCustom }) => {
    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const [popoverPosition, setPopoverPosition] = useState<'top' | 'bottom'>('top');
    const [popoverAlign, setPopoverAlign] = useState<'center' | 'left' | 'right'>('center');
    const { hex, alpha } = useMemo(() => parseColor(value), [value]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsPickerOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleTogglePicker = () => {
        if (isPickerOpen) {
            setIsPickerOpen(false);
            return;
        }

        if (containerRef.current) {
            const modalDialog = containerRef.current.closest('[data-modal-dialog="true"]');
            const viewport = modalDialog 
                ? modalDialog.getBoundingClientRect() 
                : { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight, right: window.innerWidth, bottom: window.innerHeight };

            const buttonRect = containerRef.current.getBoundingClientRect();
            const popoverHeight = 150; // Approx height in px
            const popoverWidth = 240;  // w-60 = 15rem = 240px
            const boundaryPadding = 16; // A small buffer from the modal edge

            // --- Vertical Positioning ---
            const spaceAbove = buttonRect.top - viewport.top;
            const spaceBelow = viewport.bottom - buttonRect.bottom;
            if (spaceAbove < popoverHeight && spaceBelow > popoverHeight) {
                setPopoverPosition('bottom');
            } else {
                setPopoverPosition('top');
            }

            // --- Horizontal Positioning ---
            const buttonCenter = buttonRect.left + buttonRect.width / 2;
            const popoverLeftWhenCentered = buttonCenter - (popoverWidth / 2);
            const popoverRightWhenCentered = buttonCenter + (popoverWidth / 2);

            if (popoverRightWhenCentered > (viewport.right - boundaryPadding)) {
                setPopoverAlign('right'); // Align to the right edge of the button
            } else if (popoverLeftWhenCentered < (viewport.left + boundaryPadding)) {
                setPopoverAlign('left'); // Align to the left edge of the button
            } else {
                setPopoverAlign('center'); // Default centered behavior
            }
        } else {
            // Fallback if ref is not ready
            setPopoverPosition('top');
            setPopoverAlign('center');
        }
        
        setIsPickerOpen(true);
    };

    const getPopoverPositionClasses = () => {
        const verticalClass = popoverPosition === 'top' ? 'bottom-full mb-2' : 'top-full mt-2';
        const horizontalClasses = {
            center: 'left-1/2 -translate-x-1/2',
            left: 'left-0',
            right: 'right-0',
        };
        return `${verticalClass} ${horizontalClasses[popoverAlign]}`;
    };

    const handleColorChange = (newHex: string) => {
        const rgb = hexToRgb(newHex);
        if (!rgb) return;
        const newAlpha = (alpha === 0 && value === 'transparent') ? 1 : alpha;
        onChange(`rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${newAlpha})`);
    };

    const handleAlphaChange = (newAlpha: number) => {
        const rgb = hexToRgb(hex);
        if (!rgb) return;
        
        if (newAlpha === 0) {
            onChange('transparent');
        } else {
            onChange(`rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${newAlpha})`);
        }
    };

    const rgb = hexToRgb(hex);
    const previewColor = rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})` : 'transparent';
    const isTransparent = alpha === 0;

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                onClick={handleTogglePicker}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform transform hover:scale-110 shadow-sm ${isCustom ? 'ring-2 ring-offset-2 ring-blue-500' : 'ring-1 ring-inset ring-gray-300 dark:ring-gray-600'}`}
                style={{
                  backgroundColor: isTransparent ? 'transparent' : previewColor,
                  backgroundImage: isTransparent ? `url('data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path fill="%23d1d5db" d="M0 0h8v8H0zM8 8h8v8H8z" fill-opacity="0.2"/></svg>')` : 'none',
                }}
            >
                <div className="flex items-center justify-center" aria-hidden="true">
                    <RainbowIcon />
                </div>
            </button>

            {isPickerOpen && (
                <div
                    className={`absolute z-10 w-60 bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-4 border border-gray-200 dark:border-gray-700 ${getPopoverPositionClasses()}`}
                >
                    <div className="flex items-center gap-3">
                        <div className="relative w-10 h-10 rounded-md overflow-hidden border border-gray-300 dark:border-gray-500 shrink-0">
                            <div className="absolute inset-0 bg-white" style={{ backgroundImage: `url('data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path fill="%23d1d5db" d="M0 0h8v8H0zM8 8h8v8H8z" fill-opacity="0.2"/></svg>')`}}></div>
                            <div className="absolute inset-0" style={{ backgroundColor: previewColor }}></div>
                            <input
                                type="color"
                                value={hex}
                                onChange={(e) => handleColorChange(e.target.value)}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                        </div>
                        <div className="flex-grow">
                             <label htmlFor="color-hex-value" className="text-xs font-medium text-gray-500 dark:text-gray-400">顏色</label>
                             <div id="color-hex-value" className="text-sm font-semibold text-gray-800 dark:text-gray-100 uppercase tracking-wider">{hex}</div>
                        </div>
                    </div>
                    <div>
                        <div className="flex justify-between items-baseline mb-1">
                          <label htmlFor="alpha-slider" className="text-xs font-medium text-gray-500 dark:text-gray-400">透明度</label>
                          <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{Math.round(alpha * 100)}%</span>
                        </div>
                        <input
                            id="alpha-slider"
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={alpha}
                            onChange={(e) => handleAlphaChange(parseFloat(e.target.value))}
                            className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer"
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

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

// --- Font Selector Components ---

const FontCard: React.FC<{
  fontId: string;
  fontName: string;
  isSelected: boolean;
  status: FontStatus;
  onSelect: () => void;
  preloadFont: () => void;
}> = ({ fontId, fontName, isSelected, status, onSelect, preloadFont }) => {
  const cardRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (status !== 'idle' || !cardRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          preloadFont();
          observer.unobserve(entry.target);
        }
      },
      { root: null, rootMargin: '0px 200px 0px 0px', threshold: 0.01 }
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
      className={`group relative flex-shrink-0 w-28 h-16 flex items-center justify-center p-2 border-2 rounded-lg transition-all duration-200 text-center ${isSelected ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/50' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 hover:border-blue-400'}`}
      style={{ fontFamily: status === 'loaded' ? fontId : 'sans-serif' }}
    >
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70 dark:bg-gray-700/70 rounded-md">
          <SpinnerIcon className="w-6 h-6 text-blue-500" />
        </div>
      )}
      <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{fontName}</span>
    </button>
  );
};


// --- Main Settings Panel Components ---

interface SettingsPanelsProps {
    activeTab: PngSettingsTab;
    pngSettings: PngSettingsState;
    updateSetting: <K extends keyof PngSettingsState>(key: K, value: PngSettingsState[K]) => void;
    localTitle: string;
    setLocalTitle: (title: string) => void;
    fontStatuses: Record<string, FontStatus>;
    handleFontSelect: (fontId: string) => void;
    loadFont: (fontOption: FontOption) => Promise<void>;
}

export const SettingsPanels: React.FC<SettingsPanelsProps> = ({ 
    activeTab, pngSettings, updateSetting, localTitle, setLocalTitle, 
    fontStatuses, handleFontSelect, loadFont
}) => {
    const {
        exportViewMode, pngStyle, bgColor, textColor, borderColor, blockColor, showShadow,
        showTitle, showBookedSlots, bookedStyle, strikethroughColor, strikethroughThickness,
        font, language, horizontalGap, verticalGap, titleAlign,
        dayOffColor, closedColor, fullyBookedColor, trainingColor, slotLayout, fontScale
    } = pngSettings;
    
    const handleStyleChange = (style: PngStyle) => {
        const newSettings: Partial<PngSettingsState> = { pngStyle: style };
        if (style === 'minimal') {
            newSettings.bgColor = 'transparent'; newSettings.textColor = '#111827'; newSettings.borderColor = 'transparent'; newSettings.blockColor = 'transparent'; newSettings.strikethroughColor = '#EF4444';
        } else if (style === 'borderless') {
            newSettings.bgColor = '#FFFFFF'; newSettings.textColor = '#111827'; newSettings.blockColor = '#F9FAFB'; newSettings.borderColor = 'transparent'; newSettings.strikethroughColor = '#EF4444';
        } else if (style === 'wireframe') {
            newSettings.bgColor = '#FFFFFF'; newSettings.textColor = '#111827'; newSettings.borderColor = '#374151'; newSettings.blockColor = 'transparent'; newSettings.strikethroughColor = '#EF4444';
        }
        updateSetting('pngStyle', style);
        // This is a bit of a hack to apply multiple settings. In a real scenario, you'd have a batch update function.
        setTimeout(() => setLocalTitle(localTitle), 0); // Force a re-render cycle after multiple state updates
        for (const [key, value] of Object.entries(newSettings)) {
            updateSetting(key as keyof PngSettingsState, value as any);
        }
    };

    const AlignButton: React.FC<{ align: TitleAlign, label: string }> = ({ align, label }) => (
        <button 
          onClick={() => updateSetting('titleAlign', align)} 
          className={`py-2 rounded-lg transition-all text-sm font-medium ${titleAlign === align ? 'bg-white dark:bg-gray-600 shadow text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'}`}>
          {label}
        </button>
      );
      
    return (
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
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">進修文字</span>
                          <ColorSelectorRow presets={PRESET_COLORS.status} value={trainingColor} onChange={(c) => updateSetting('trainingColor', c)} />
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
                                  <div className="flex justify-between items-center mb-2">
                                    <h4 className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400">{category.name}</h4>
                                  </div>
                                  <div className="relative">
                                      <div className="flex space-x-3 overflow-x-auto pb-4 -mb-4 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
                                          {category.fonts.map(f => (
                                              <FontCard
                                                  key={f.id}
                                                  fontId={f.id}
                                                  fontName={f.name}
                                                  isSelected={font === f.id}
                                                  status={fontStatuses[f.id] || 'idle'}
                                                  onSelect={() => handleFontSelect(f.id)}
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
              {exportViewMode !== 'list' && (
                  <SettingsCard>
                      <SettingsSection title="時段排版">
                          <div className="grid grid-cols-2 gap-1 rounded-xl bg-gray-200 dark:bg-gray-700 p-1">
                              <button onClick={() => updateSetting('slotLayout', 'vertical')} className={`py-2 rounded-lg transition-all text-sm font-medium ${slotLayout === 'vertical' ? 'bg-white dark:bg-gray-600 shadow text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'}`}>垂直排列</button>
                              <button onClick={() => updateSetting('slotLayout', 'horizontal-wrap')} className={`py-2 rounded-lg transition-all text-sm font-medium ${slotLayout === 'horizontal-wrap' ? 'bg-white dark:bg-gray-600 shadow text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'}`}>水平換行</button>
                          </div>
                      </SettingsSection>
                  </SettingsCard>
              )}
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
      );
};


// --- Export Completion View ---

interface ExportCompletionViewProps {
    isExporting: boolean;
    loadingMessage: string;
    generatedPngDataUrl: string | null;
    onOpenInNewTab: () => void;
}

export const ExportCompletionView: React.FC<ExportCompletionViewProps> = ({ isExporting, loadingMessage, generatedPngDataUrl, onOpenInNewTab }) => {
    // FIX: Render either the loading state OR the completed state, but not both.
    if (isExporting) {
        return (
            <div className="flex flex-col items-center justify-start pt-6">
                <div className="w-full flex flex-col items-center">
                    <div className="relative w-16 h-16 flex items-center justify-center">
                        <DownloadIcon className="w-12 h-12 text-blue-600 animate-pulse" />
                    </div>
                    <p className="mt-4 text-lg font-semibold text-gray-700 dark:text-gray-200 text-center">
                        {loadingMessage}
                    </p>
                    <AdSlot className="mt-6 w-full" allowedHostnames={['your.app', 'your-short.link', 'bit.ly']} />
                </div>
            </div>
        );
    }

    if (generatedPngDataUrl) {
        return (
            <div className="relative flex flex-col items-center justify-start pt-6">
                <div className="w-full flex flex-col items-center">
                    <div className="relative w-16 h-16 flex items-center justify-center">
                        <CheckIcon className="w-16 h-16 text-green-500" />
                    </div>
                    <p className="mt-4 text-lg font-semibold text-gray-700 dark:text-gray-200 text-center">
                        成功！圖片已準備就緒。
                    </p>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 text-center max-w-xs">
                        提示：長按下方圖片即可儲存至您的裝置。
                    </p>
                    <button onClick={onOpenInNewTab} className="absolute top-0 right-0 text-sm font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors">
                        在新分頁開啟 ↗
                    </button>
                    <div className="w-full max-w-sm mt-6 flex flex-col items-center gap-4 pb-32">
                        <img 
                            src={generatedPngDataUrl} 
                            alt="產生的班表圖片" 
                            className="w-full h-auto rounded-lg shadow-lg border border-gray-200 dark:border-gray-700"
                        />
                    </div>
                </div>
                <div 
                    className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-t border-gray-200 dark:border-gray-700 z-50 flex justify-center"
                    style={{ paddingBottom: `calc(1rem + env(safe-area-inset-bottom))` }}
                >
                    <AdSlot className="w-full" allowedHostnames={['your.app', 'your-short.link', 'bit.ly']} />
                </div>
            </div>
        );
    }
    
    return null; // Should not happen in normal flow
};
