import React, { useState, useEffect } from 'react';
// FIX: FontStatus and FontOption are not in types.ts. They are imported from the helpers file below.
import type { PngSettingsState, PngStyle, PngDateRange } from '../types';
import { SpinnerIcon, CheckIcon, ChevronLeftIcon, DownloadIcon, ExternalLinkIcon } from './icons';
import { FONT_CATEGORIES, PRESET_COLORS } from './PngExportModal.helpers';
import type { FontStatus, FontOption } from './PngExportModal.helpers';
import AdvancedColorPicker from './AdvancedColorPicker';
import AdSlot from './AdSlot';

// --- Reusable UI Components ---

const Accordion: React.FC<{ title: string; children: React.ReactNode; defaultOpen?: boolean }> = ({ title, children, defaultOpen = false }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <button onClick={() => setIsOpen(!isOpen)} className="w-full flex justify-between items-center p-3 font-semibold text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-800 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700">
                <span>{title}</span>
                <ChevronLeftIcon className={`w-5 h-5 transition-transform text-gray-400 ${isOpen ? '-rotate-90' : 'rotate-0'}`} />
            </button>
            {isOpen && <div className="p-3 bg-white dark:bg-gray-800/50 space-y-3">{children}</div>}
        </div>
    );
};

const ColorPickerControl: React.FC<{ label: string; value: string; onChange: (value: string) => void; presetColors: string[]; }> = ({ label, value, onChange, presetColors }) => (
    <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
        <AdvancedColorPicker value={value} onChange={onChange} presetColors={presetColors} />
    </div>
);

const ToggleSwitch: React.FC<{ label: string; checked: boolean; onChange: (checked: boolean) => void; }> = ({ label, checked, onChange }) => (
    <label className="flex items-center justify-between cursor-pointer">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
        <div className="relative">
            <input type="checkbox" className="sr-only peer" checked={checked} onChange={(e) => onChange(e.target.checked)} />
            <div className="block bg-gray-200 dark:bg-gray-600 w-10 h-6 rounded-full peer-checked:bg-blue-600 transition"></div>
            <div className="dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition transform peer-checked:translate-x-full"></div>
        </div>
    </label>
);

const SegmentedControl: React.FC<{ options: { label: string; value: string }[]; value: string; onChange: (value: string) => void; }> = ({ options, value, onChange }) => (
    <div className="grid w-full p-1 bg-gray-200 dark:bg-gray-700 rounded-lg" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map(opt => (
            <button key={opt.value} onClick={() => onChange(opt.value)} className={`py-1.5 rounded-md transition-all text-xs font-semibold ${value === opt.value ? 'bg-white dark:bg-gray-600 shadow text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-300/50 dark:hover:bg-gray-600/50'}`}>
                {opt.label}
            </button>
        ))}
    </div>
);

// --- Prop Interfaces ---

interface SettingsPanelsProps {
    pngSettings: PngSettingsState;
    updateSetting: <K extends keyof PngSettingsState>(key: K, value: PngSettingsState[K]) => void;
    localTitle: string;
    setLocalTitle: React.Dispatch<React.SetStateAction<string>>;
    fontStatuses: Record<string, FontStatus>;
    handleFontSelect: (fontId: string) => Promise<void>;
}

interface ExportCompletionViewProps {
    isExporting: boolean;
    loadingMessage: string;
    generatedPngDataUrl: string | null;
    onOpenInNewTab: () => void;
}

// --- Main Exported Components ---

export const SettingsPanels: React.FC<SettingsPanelsProps> = ({ pngSettings, updateSetting, localTitle, setLocalTitle, fontStatuses, handleFontSelect }) => {
    
    const dateRangeOptions: { label: string; value: PngDateRange }[] = [
        { label: '本月完整', value: 'full' },
        { label: '本月剩餘', value: 'remainingWeeks' },
    ];

    if (pngSettings.pngDisplayMode === 'list') {
        dateRangeOptions.push({ label: '未來兩週', value: 'upcoming2Weeks' });
    }

    return (
        <div className="space-y-4">
            <Accordion title="通用設定">
                <div className="space-y-3">
                    <ToggleSwitch label="顯示標題" checked={pngSettings.showTitle} onChange={c => updateSetting('showTitle', c)} />
                    {pngSettings.showTitle && (
                        <div className="pl-4 space-y-3">
                             <input
                                type="text"
                                value={localTitle}
                                onChange={(e) => setLocalTitle(e.target.value)}
                                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 transition bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                                placeholder="輸入圖片標題..."
                            />
                            <SegmentedControl
                                value={pngSettings.titleAlign}
                                onChange={v => updateSetting('titleAlign', v as 'left' | 'center' | 'right')}
                                options={[ { label: '靠左', value: 'left' }, { label: '置中', value: 'center' }, { label: '靠右', value: 'right' } ]}
                            />
                        </div>
                    )}

                    <hr className="!my-4 border-gray-200 dark:border-gray-700" />
                    
                    <ToggleSwitch label="顯示已預約" checked={pngSettings.showBookedSlots} onChange={c => updateSetting('showBookedSlots', c)} />
                    {pngSettings.showBookedSlots && (
                        <div className="pl-4 space-y-3">
                            <SegmentedControl
                                value={pngSettings.bookedStyle}
                                onChange={v => updateSetting('bookedStyle', v as 'strikethrough' | 'fade')}
                                options={[ { label: '刪除線', value: 'strikethrough' }, { label: '淡化', value: 'fade' } ]}
                            />
                            {pngSettings.bookedStyle === 'strikethrough' && (
                                <SegmentedControl
                                    value={pngSettings.strikethroughThickness}
                                    onChange={v => updateSetting('strikethroughThickness', v as 'thin' | 'thick')}
                                    options={[ { label: '細線', value: 'thin' }, { label: '粗線', value: 'thick' } ]}
                                />
                            )}
                        </div>
                    )}
                    
                    <hr className="!my-4 border-gray-200 dark:border-gray-700" />
                    
                     <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 pt-1 block">語言</label>
                    <SegmentedControl
                        value={pngSettings.language}
                        onChange={v => updateSetting('language', v as 'zh' | 'en')}
                        options={[ { label: '中文', value: 'zh' }, { label: 'English', value: 'en' } ]}
                    />
                </div>
            </Accordion>
            
            <Accordion title="顯示範圍">
                <div className="space-y-3">
                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">日期範圍</label>
                    <SegmentedControl
                        value={pngSettings.pngDateRange}
                        onChange={v => updateSetting('pngDateRange', v as PngDateRange)}
                        options={dateRangeOptions}
                    />
                    {pngSettings.pngDisplayMode === 'list' && (
                        <>
                            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 pt-2 block">日期篩選 (僅清單)</label>
                            <SegmentedControl
                                value={pngSettings.pngListDateFilter}
                                onChange={v => updateSetting('pngListDateFilter', v as 'all' | 'weekdays' | 'weekends')}
                                options={[
                                    { label: '全部', value: 'all' },
                                    { label: '僅平日', value: 'weekdays' },
                                    { label: '僅假日', value: 'weekends' },
                                ]}
                            />
                        </>
                    )}
                </div>
            </Accordion>
            
            <Accordion title="顏色設定">
                <div className="space-y-3">
                    <div>
                        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block">風格</label>
                        <SegmentedControl
                            value={pngSettings.pngStyle}
                            onChange={v => updateSetting('pngStyle', v as PngStyle)}
                            options={[
                                { label: '簡約', value: 'minimal' },
                                { label: '區塊', value: 'borderless' },
                                { label: '線框', value: 'wireframe' },
                                { label: '自訂', value: 'custom' },
                            ]}
                        />
                    </div>
                    
                    <hr className="!my-4 border-gray-200 dark:border-gray-700" />
                    
                    <div className="space-y-2">
                        <ColorPickerControl label="背景色" value={pngSettings.bgColor} onChange={v => updateSetting('bgColor', v)} presetColors={PRESET_COLORS.bg} />
                        <ColorPickerControl label="文字顏色" value={pngSettings.textColor} onChange={v => updateSetting('textColor', v)} presetColors={PRESET_COLORS.text} />
                        { (pngSettings.pngStyle === 'wireframe' || pngSettings.pngStyle === 'custom') && 
                          <ColorPickerControl label="邊框顏色" value={pngSettings.borderColor} onChange={v => updateSetting('borderColor', v)} presetColors={PRESET_COLORS.border} /> }
                        { (pngSettings.pngStyle === 'borderless' || pngSettings.pngStyle === 'custom') && 
                          <ColorPickerControl label="區塊顏色" value={pngSettings.blockColor} onChange={v => updateSetting('blockColor', v)} presetColors={PRESET_COLORS.block} /> }
                        { pngSettings.showBookedSlots && pngSettings.bookedStyle === 'strikethrough' &&
                          <ColorPickerControl label="刪除線顏色" value={pngSettings.strikethroughColor} onChange={v => updateSetting('strikethroughColor', v)} presetColors={PRESET_COLORS.strikethrough} /> }
                        
                        <hr className="!my-4 border-gray-200 dark:border-gray-700" />
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">狀態顏色</h4>
                        <ColorPickerControl label="休假日" value={pngSettings.dayOffColor} onChange={v => updateSetting('dayOffColor', v)} presetColors={PRESET_COLORS.status} />
                        <ColorPickerControl label="公休日" value={pngSettings.closedColor} onChange={v => updateSetting('closedColor', v)} presetColors={PRESET_COLORS.status} />
                        <ColorPickerControl label="已額滿" value={pngSettings.fullyBookedColor} onChange={v => updateSetting('fullyBookedColor', v)} presetColors={PRESET_COLORS.status} />
                        <ColorPickerControl label="進修日" value={pngSettings.trainingColor} onChange={v => updateSetting('trainingColor', v)} presetColors={PRESET_COLORS.status} />
                    </div>
                </div>
            </Accordion>

            <Accordion title="字體設定">
                <div className="space-y-3">
                    <div>
                        <label htmlFor="font-scale" className="flex items-center justify-between text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            <span>字體縮放</span>
                            <span>{pngSettings.fontScale.toFixed(2)}x</span>
                        </label>
                        <input
                            id="font-scale"
                            type="range"
                            min="0.5"
                            max="2"
                            step="0.05"
                            value={pngSettings.fontScale}
                            onChange={(e) => updateSetting('fontScale', parseFloat(e.target.value))}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">選擇字體</label>
                        <div className="max-h-60 overflow-y-auto space-y-3 p-1">
                            {FONT_CATEGORIES.map(category => (
                                <div key={category.name}>
                                    <h5 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1 px-2">{category.name}</h5>
                                    <div className="space-y-1">
                                        {category.fonts.map(font => {
                                            const status = fontStatuses[font.id] || 'idle';
                                            return (
                                                <button
                                                    key={font.id}
                                                    onClick={() => handleFontSelect(font.id)}
                                                    className={`w-full text-left p-2 rounded-md transition-colors text-sm flex items-center justify-between ${pngSettings.font === font.id ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                                >
                                                    <span style={{ fontFamily: status === 'loaded' ? font.id : 'sans-serif' }}>{font.name}</span>
                                                    {status === 'loading' && <SpinnerIcon className="w-4 h-4 text-gray-400" />}
                                                    {status === 'loaded' && pngSettings.font === font.id && <CheckIcon className="w-4 h-4 text-blue-600" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </Accordion>
        </div>
    );
};


export const ExportCompletionView: React.FC<ExportCompletionViewProps> = ({ isExporting, loadingMessage, generatedPngDataUrl, onOpenInNewTab }) => {
    if (isExporting) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[24rem] py-8 px-4 md:px-6">
                <SpinnerIcon className="w-12 h-12 text-blue-600" />
                <p className="mt-4 text-lg font-semibold text-gray-700 dark:text-gray-200">{loadingMessage}</p>
                <div className="mt-8 w-full flex justify-center">
                    <AdSlot compact={true} />
                </div>
            </div>
        );
    }
    
    if (generatedPngDataUrl) {
        return (
            <div className="h-full">
                {/* --- DESKTOP LAYOUT --- */}
                <div className="hidden lg:flex flex-row gap-8 p-6 h-full">
                    {/* Left Column: Image */}
                    <div className="w-2/3 h-full">
                        <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-2 h-full overflow-auto">
                            <img src={generatedPngDataUrl} alt="Generated Schedule" className="max-w-full h-auto mx-auto rounded-md shadow-lg" />
                        </div>
                    </div>
                    {/* Right Column: Info, Buttons, Ad */}
                    <div className="w-1/3 flex flex-col space-y-6">
                        <div className="flex flex-col items-center justify-center text-center gap-1">
                            <div className="w-20 h-20 flex items-center justify-center">
                                <CheckIcon className="w-16 h-16 text-green-500" />
                            </div>
                            <p className="text-lg font-semibold text-gray-800 dark:text-gray-100">圖片已成功生成！</p>
                        </div>
                        <div className="space-y-3">
                            <a
                                href={generatedPngDataUrl}
                                download={`schedule-${new Date().toISOString().slice(0, 10)}.png`}
                                className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors inline-block text-center"
                            >
                                下載圖片
                            </a>
                            <button
                                onClick={onOpenInNewTab}
                                className="w-full bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 font-bold py-3 px-4 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors shadow-sm"
                            >
                                在新分頁中開啟
                            </button>
                        </div>
                        <div className="pt-4 border-t border-gray-200 dark:border-gray-700 flex-grow flex items-end justify-center">
                            <AdSlot compact={true} />
                        </div>
                    </div>
                </div>

                {/* --- MOBILE/TABLET LAYOUT --- */}
                <div className="lg:hidden flex flex-col h-full bg-white dark:bg-gray-800">
                    {/* Scrollable Content Area */}
                    <div className="relative flex-grow overflow-y-auto">
                        {/* Action Icons Top Right */}
                        <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
                            <a
                                href={generatedPngDataUrl}
                                download={`schedule-${new Date().toISOString().slice(0, 10)}.png`}
                                className="flex items-center justify-center w-10 h-10 bg-black/40 text-white rounded-full hover:bg-black/60 transition-colors"
                                aria-label="下載圖片"
                            >
                                <DownloadIcon className="w-5 h-5 !mr-0" />
                            </a>
                            <button
                                onClick={onOpenInNewTab}
                                className="flex items-center justify-center w-10 h-10 bg-black/40 text-white rounded-full hover:bg-black/60 transition-colors"
                                aria-label="在新分頁中開啟"
                            >
                                <ExternalLinkIcon className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-4 pt-6 space-y-4 md:max-w-xl md:mx-auto">
                            <div className="flex flex-col items-center justify-center text-center gap-2">
                                <div className="w-20 h-20 flex items-center justify-center">
                                    <CheckIcon className="w-16 h-16 text-green-500" />
                                </div>
                                <p className="text-lg font-bold text-gray-800 dark:text-gray-100">圖片已成功生成！</p>
                                <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                                    提示：長按圖片即可儲存或分享。
                                </p>
                            </div>
                            <div className="max-w-[16rem] md:max-w-xl mx-auto">
                                <div className="shadow-2xl rounded-lg">
                                    <div className="bg-white dark:bg-gray-900 rounded-lg overflow-hidden">
                                        <img src={generatedPngDataUrl} alt="Generated Schedule" className="max-w-full h-auto mx-auto" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    {/* Fixed Ad Area */}
                    <div
                        className="flex-shrink-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4"
                        style={{ paddingBottom: `calc(1rem + env(safe-area-inset-bottom))` }}
                    >
                        <div className="md:max-w-xl md:mx-auto">
                            <AdSlot compact={true} className="mx-auto" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center h-96">
             <p className="mt-4 text-lg font-semibold text-gray-700 dark:text-gray-200">發生未知的錯誤，請再試一次。</p>
        </div>
    );
};