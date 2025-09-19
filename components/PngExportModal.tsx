import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { ScheduleData, CalendarDay, PngSettingsState, PngExportViewMode } from '../types';
import { DownloadIcon, SpinnerIcon } from './icons';
import Modal from './Modal';
import PngExportContent from './PngExportContent';
import { embedFontForExport } from '../fontUtils';
import { getPrimaryFamily } from '../fonts';
import { FONT_OPTIONS, ExportStage, PngSettingsTab } from './PngExportModal.helpers';
import { useFontLoader, usePreviewScaling } from './PngExportModal.hooks';
import { SettingsPanels, ExportCompletionView } from './PngExportModal.ui';

// This declaration is necessary because html-to-image is loaded from a CDN.
declare const htmlToImage: {
  toPng: <T extends HTMLElement>(node: T, options?: object) => Promise<string>;
};

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
    setPngSettings
}) => {
    // --- Refs ---
    const exportRef = useRef<HTMLDivElement>(null);
    const previewContainerRef = useRef<HTMLDivElement>(null);
    const scaleWrapperRef = useRef<HTMLDivElement>(null);
    
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
    const { fontStatuses, loadFont } = useFontLoader();
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
            const selectedFontOption = FONT_OPTIONS.find(f => f.id === pngSettings.font);
            if (selectedFontOption && selectedFontStatus === 'idle') {
                loadFont(selectedFontOption).catch(e => console.error("Failed to preload selected font:", e));
            }
        }
    }, [isOpen, pngSettings.font, selectedFontStatus, loadFont]);

    // --- Event Handlers ---
    const handleFontSelect = useCallback(async (fontOption: typeof FONT_OPTIONS[0]) => {
        const { id } = fontOption;
        updateSetting('font', id);
        if ((fontStatuses[id] || 'idle') !== 'loaded') {
            try {
                await loadFont(fontOption);
            } catch (error) {
                alert(`無法載入字體：${fontOption.name}。請稍後再試。`);
            }
        }
    }, [fontStatuses, loadFont, updateSetting]);

    const handleStartExport = useCallback(async () => {
        const exportNode = exportRef.current;
        if (!exportNode) {
            alert('無法匯出：預覽元件尚未準備好。');
            return;
        }

        setExportStage('generating_image');
        const delayPromise = new Promise(resolve => setTimeout(resolve, 2000));

        const generationTask = async () => {
            const selectedFont = FONT_OPTIONS.find(f => f.id === pngSettings.font);
            if (!selectedFont) throw new Error("錯誤：找不到選擇的字體。");
            
            const styleNodeId = 'dynamic-font-for-export';
            
            try {
                // Step 1: Get the self-contained @font-face CSS string with Base64 data.
                setLoadingMessage('正在內嵌字體...');
                const fontEmbedCSS = await embedFontForExport(selectedFont);

                // Step 2: Manually inject the font CSS into the document head.
                const styleNode = document.createElement('style');
                styleNode.id = styleNodeId;
                styleNode.innerHTML = fontEmbedCSS;
                document.head.appendChild(styleNode);

                // Step 3: Crucially, wait for the browser to acknowledge and load the font.
                setLoadingMessage('等待字體渲染...');
                const primaryFontFamily = getPrimaryFamily(selectedFont.id);
                await document.fonts.load(`1em "${primaryFontFamily}"`);
                
                // Step 4 (Insurance for iOS): Wait for a repaint cycle.
                await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

                setLoadingMessage('正在繪製圖片...');
                
                // Step 5: Call html-to-image. The font is now globally available.
                const dataUrl = await htmlToImage.toPng(exportNode, {
                    quality: 1,
                    pixelRatio: 2,
                    backgroundColor: pngSettings.bgColor,
                    filter: (node: HTMLElement) => {
                        if (node.tagName === 'LINK') {
                            const linkNode = node as HTMLLinkElement;
                            if (linkNode.href && linkNode.href.includes('fonts.googleapis.com')) {
                                return false;
                            }
                        }
                        return true;
                    },
                });
                
                setGeneratedPngDataUrl(dataUrl);

            } catch (error) {
                throw error;
            } finally {
                // Step 6: Clean up by removing the injected style node.
                const nodeToRemove = document.getElementById(styleNodeId);
                if (nodeToRemove) {
                    nodeToRemove.remove();
                }
            }
        };

        try {
            await Promise.all([generationTask(), delayPromise]);
            setExportStage('completed');
        } catch (error) {
            console.error('Oops, something went wrong during PNG export!', error);
            alert(`匯出圖片時發生錯誤！ ${error instanceof Error ? error.message : ''}`);
            setExportStage('configuring');
        }
    }, [pngSettings.font, pngSettings.bgColor]);

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
                <button onClick={handleStartExport} disabled={isExporting} className="bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-wait">
                    {isExporting ? <><SpinnerIcon className="w-5 h-5 mr-2" />{loadingMessage}</> : <><DownloadIcon /> 下載 PNG</>}
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