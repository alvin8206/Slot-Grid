import React from 'react';
import type { ScheduleData, CalendarDay, PngSettingsState, PngExportViewMode, CustomFont } from '../types';
import { DownloadIcon, SpinnerIcon, TrashIcon } from './icons';
import Modal from './Modal';
import PngExportContent from './PngExportContent';
import { embedFontForExport, embedCustomFontForExport } from '../fontUtils';
import { FONT_OPTIONS, ExportStage, PngSettingsTab } from './PngExportModal.helpers';
import { useFontLoader, usePreviewScaling } from './PngExportModal.hooks';
import { SettingsPanels, ExportCompletionView } from './PngExportModal.ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// The htmlToImage library is loaded via CDN and available on the window object.
declare const htmlToImage: any;

interface PngExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    scheduleData: ScheduleData;
    title: string;
    calendarDays: CalendarDay[];
    currentDate: Date;
    loginPromptContent?: React.ReactNode;
    pngSettings: PngSettingsState;
    setPngSettings: React.Dispatch<React.SetStateAction<PngSettingsState>>;
    customFonts: CustomFont[];
    onCustomFontsChange: (fonts: CustomFont[]) => void;
}

const PngExportModal: React.FC<PngExportModalProps> = ({
    isOpen,
    onClose,
    scheduleData,
    title,
    calendarDays,
    currentDate,
    loginPromptContent,
    pngSettings,
    setPngSettings,
    customFonts,
    onCustomFontsChange,
}) => {
    // --- Refs ---
    const exportRef = useRef<HTMLDivElement>(null);
    const previewContainerRef = useRef<HTMLDivElement>(null);
    const scaleWrapperRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // --- State Management ---
    const [activeTab, setActiveTab] = useState<PngSettingsTab>('content');
    const [localTitle, setLocalTitle] = useState(title);
    const [exportStage, setExportStage] = useState<ExportStage>('configuring');
    const [generatedPngDataUrl, setGeneratedPngDataUrl] = useState<string | null>(null);
    const [loadingMessage, setLoadingMessage] = useState('');

    const updateSetting = <K extends keyof PngSettingsState>(key: K, value: PngSettingsState[K]) => {
        setPngSettings(prev => ({ ...prev, [key]: value }));
    };

    // --- Custom Hooks for complex logic ---
    const { fontStatuses, loadFont } = useFontLoader(customFonts);
    const propsForContent = useMemo(() => ({
        scheduleData, title: localTitle, calendarDays, currentDate,
        ...pngSettings,
    }), [scheduleData, localTitle, calendarDays, currentDate, pngSettings]);
    
    const selectedFontStatus = fontStatuses[pngSettings.font] || 'idle';

    usePreviewScaling(isOpen, selectedFontStatus, [propsForContent], {
        previewContainerRef,
        scaleWrapperRef,
        exportRef,
        exportWidth: 800,
    });
    
    // --- Effects ---
    useEffect(() => {
        if (isOpen) {
            setExportStage('configuring');
            setGeneratedPngDataUrl(null);
            setLocalTitle(title);
            setActiveTab('content');
        }
    }, [isOpen, title]);
    
    useEffect(() => {
        if (isOpen) {
            const allFonts = [...FONT_OPTIONS, ...customFonts.map(cf => ({ id: cf.name, name: cf.name, urlValue: '' }))];
            const selectedFontOption = allFonts.find(f => f.id === pngSettings.font);

            if (selectedFontOption && (fontStatuses[pngSettings.font] || 'idle') === 'idle') {
                loadFont(selectedFontOption).catch(e => console.error("Failed to preload selected font:", e));
            }
        }
    }, [isOpen, pngSettings.font, fontStatuses, loadFont, customFonts]);

    // --- Event Handlers ---
    const handleFontSelect = useCallback(async (fontId: string) => {
        updateSetting('font', fontId);

        if ((fontStatuses[fontId] || 'idle') === 'idle') {
            const allFonts = [...FONT_OPTIONS, ...customFonts.map(cf => ({ id: cf.name, name: cf.name, urlValue: '' }))];
            const fontOption = allFonts.find(f => f.id === fontId);
            if(fontOption) {
                try {
                    await loadFont(fontOption);
                } catch (error) {
                    alert(`無法載入字體：${fontOption.name}。請檢查您的網路連線或檔案。`);
                }
            }
        }
    }, [fontStatuses, loadFont, updateSetting, customFonts]);
    
    const handleCustomFontUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (customFonts.some(f => f.name === file.name)) {
            alert('已存在同名字體！');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target?.result as string;
            const newFont: CustomFont = { name: file.name, data: dataUrl };
            const newCustomFonts = [...customFonts, newFont];
            onCustomFontsChange(newCustomFonts);
            handleFontSelect(newFont.name); // Select the new font immediately
        };
        reader.onerror = () => {
            alert('讀取字體檔案失敗！');
        };
        reader.readAsDataURL(file);
        
        // Reset file input to allow uploading the same file again after deletion
        if(event.target) {
            event.target.value = '';
        }
    };

    const handleCustomFontDelete = (fontNameToDelete: string) => {
        const newCustomFonts = customFonts.filter(f => f.name !== fontNameToDelete);
        onCustomFontsChange(newCustomFonts);
        // If the deleted font was the selected one, select the default font
        if (pngSettings.font === fontNameToDelete) {
            updateSetting('font', FONT_OPTIONS[0].id);
        }
    };

    const handleStartExport = useCallback(async () => {
        const exportNode = exportRef.current;
        if (!exportNode || typeof htmlToImage === 'undefined') {
            alert('匯出工具尚未準備好，請稍後再試。');
            return;
        }

        setExportStage('generating_image');
        const styleElement = document.createElement('style');
        
        // FIX: Temporarily remove external font links to prevent CORS errors in the console.
        const fontLinks = Array.from(document.querySelectorAll<HTMLLinkElement>('link[href*="fonts.googleapis.com"]'));
        const head = document.head;
        fontLinks.forEach(link => head.removeChild(link));

        try {
            // --- COMMON SETUP: Prepare font resources ---
            setLoadingMessage('準備資源...');
            const fontId = pngSettings.font;
            const customFont = customFonts.find(cf => cf.name === fontId);
            let fontEmbedCSS: string;

            if (customFont) {
                fontEmbedCSS = embedCustomFontForExport(customFont);
            } else {
                const selectedFont = FONT_OPTIONS.find(f => f.id === fontId);
                if (!selectedFont) throw new Error("錯誤：找不到選擇的字體。");
                fontEmbedCSS = await embedFontForExport(selectedFont);
            }
            
            styleElement.textContent = fontEmbedCSS;
            exportNode.appendChild(styleElement);
            await new Promise(resolve => requestAnimationFrame(resolve));

            // --- STAGE 1: THE PRIMING RENDER ---
            setLoadingMessage('正在準備引擎...');
            try {
                await htmlToImage.toPng(exportNode, {
                    pixelRatio: 0.01,
                    quality: 0.01,
                });
            } catch (primingError) {
                console.log('Priming render failed as expected, which is normal on some devices. Continuing...', primingError);
            }

            // --- STAGE 2: THE PRODUCTION RENDER ---
            setLoadingMessage('正在生成圖片...');
            const dataUrl = await htmlToImage.toPng(exportNode, {
                backgroundColor: propsForContent.bgColor === 'transparent' ? null : propsForContent.bgColor,
                quality: 1.0,
                pixelRatio: 2,
            });
            
            setGeneratedPngDataUrl(dataUrl);
            setExportStage('completed');

        } catch (error) {
            console.error('Oops, something went wrong during PNG export!', error);
            alert(`匯出圖片時發生錯誤！ ${error instanceof Error ? error.message : ''}`);
            setExportStage('configuring');
        } finally {
            // --- CLEANUP ---
            if (exportNode.contains(styleElement)) {
                exportNode.removeChild(styleElement);
            }
            // Restore the removed font links to ensure the main UI is not broken.
            fontLinks.forEach(link => head.appendChild(link));
        }
    }, [pngSettings.font, customFonts, propsForContent.bgColor]);


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

    // --- Render Helpers ---
    const isExporting = exportStage === 'generating_image';
    
    const header = <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100" translate="no">{exportStage === 'completed' ? '匯出成功！' : '匯出 PNG 圖片'}</h2>;
    
    const footer = exportStage === 'completed' ? null : (
        <>
            {loginPromptContent}
            <div className="grid grid-cols-2 gap-3 w-full">
                <button onClick={onClose} className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold py-3 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors" disabled={isExporting}>關閉</button>
                <button onClick={handleStartExport} disabled={isExporting || selectedFontStatus !== 'loaded'} className="bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-wait">
                    {isExporting ? <><SpinnerIcon className="w-5 h-5 mr-2" />{loadingMessage}</> : 
                     selectedFontStatus !== 'loaded' ? <><SpinnerIcon className="w-5 h-5 mr-2" />字體準備中...</> : 
                     <><DownloadIcon /> 下載 PNG</>}
                </button>
            </div>
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
          onClick={() => updateSetting('exportViewMode', mode)}
          className={`py-2 rounded-lg transition-all text-sm font-medium ${pngSettings.exportViewMode === mode ? 'bg-white dark:bg-gray-600 shadow text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'}`}>
          {label}
        </button>
      );

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={isExporting ? () => {} : onClose} headerContent={header} footerContent={footer} modalClassName="xl:max-w-4xl">
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleCustomFontUpload}
                accept=".ttf,.otf,.woff,.woff2"
                style={{ display: 'none' }}
            />
            <div
                style={{ position: 'fixed', top: 0, left: -99999, pointerEvents: 'none', opacity: 0 }}
              >
                <PngExportContent ref={exportRef} {...propsForContent} />
            </div>

            {exportStage === 'configuring' ? (
                <div className="flex flex-col lg:flex-row gap-6 items-start">
                    <div className="w-full lg:w-1/2 lg:sticky lg:top-0">
                        <div className="space-y-2">
                            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">預覽</h3>
                            <div ref={previewContainerRef} className="w-full bg-gray-200/50 dark:bg-gray-700/50 rounded-md overflow-x-hidden max-h-[25vh] lg:max-h-[50vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
                                <div ref={scaleWrapperRef} style={{ transformOrigin: 'top left', transition: 'transform 0.2s ease-out, height 0.2s ease-out', visibility: selectedFontStatus === 'loaded' ? 'visible' : 'hidden' }}>
                                    <PngExportContent {...propsForContent} />
                                </div>
                                {selectedFontStatus !== 'loaded' && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <SpinnerIcon className="w-8 h-8 text-gray-500" />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="w-full lg:w-1/2 space-y-4">
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                          <div className="space-y-3">
                              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">顯示範圍</h3>
                              <div className="grid grid-cols-3 gap-1 rounded-xl bg-gray-200 dark:bg-gray-700 p-1">
                                  <ViewModeButton mode="month" label="完整月曆"/>
                                  <ViewModeButton mode="remaining" label="剩餘月份"/>
                                  <ViewModeButton mode="list" label="清單模式"/>
                              </div>
                          </div>
                        </div>

                      <div className="grid grid-cols-3 gap-1 rounded-xl bg-gray-200 dark:bg-gray-700 p-1">
                          <TabButton tab="content" label="內容" />
                          <TabButton tab="style" label="樣式" />
                          <TabButton tab="layout" label="排版" />
                      </div>

                      <SettingsPanels 
                        activeTab={activeTab}
                        pngSettings={pngSettings}
                        updateSetting={updateSetting}
                        localTitle={localTitle}
                        setLocalTitle={setLocalTitle}
                        fontStatuses={fontStatuses}
                        handleFontSelect={handleFontSelect}
                        loadFont={loadFont}
                        customFonts={customFonts}
                        onUploadClick={() => fileInputRef.current?.click()}
                        onDeleteCustomFont={handleCustomFontDelete}
                      />
                    </div>
                </div>
            ) : (
                <ExportCompletionView 
                    isExporting={isExporting}
                    loadingMessage={loadingMessage}
                    generatedPngDataUrl={generatedPngDataUrl}
                    onOpenInNewTab={handleOpenInNewTab}
                />
            )}
        </Modal>
    );
};

export default PngExportModal;