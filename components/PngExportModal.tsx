import React from 'react';
import type { ScheduleData, CalendarDay, PngSettingsState, PngDisplayMode, PngDateRange } from '../types';
import { DownloadIcon, SpinnerIcon, CalendarIcon, ListIcon } from './icons';
import Modal from './Modal';
import PngExportContent from './PngExportContent';
import { embedFontForExport } from '../fontUtils';
import { FONT_OPTIONS, ExportStage } from './PngExportModal.helpers';
import { useFontLoader, usePreviewScaling } from './PngExportModal.hooks';
import { SettingsPanels, ExportCompletionView } from './PngExportModal.ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { colorToRgba } from '../utils';
import type { WeekStartDay } from '../App';

// The htmlToImage library is loaded via CDN and available on the window object.
declare const htmlToImage: any;

interface PngExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    scheduleData: ScheduleData;
    title: string;
    onTitleChange: (newTitle: string) => void;
    calendarDays: CalendarDay[];
    currentDate: Date;
    weekStartsOn: WeekStartDay;
    loginPromptContent?: React.ReactNode;
    pngSettings: PngSettingsState;
    setPngSettings: React.Dispatch<React.SetStateAction<PngSettingsState>>;
}

const PngExportModal: React.FC<PngExportModalProps> = ({
    isOpen,
    onClose,
    scheduleData,
    title,
    onTitleChange,
    calendarDays,
    currentDate,
    weekStartsOn,
    loginPromptContent,
    pngSettings,
    setPngSettings,
}) => {
    // --- Refs ---
    const exportRef = useRef<HTMLDivElement>(null);
    const previewContainerRef = useRef<HTMLDivElement>(null);
    const scaleWrapperRef = useRef<HTMLDivElement>(null);
    
    // --- State Management ---
    const [localTitle, setLocalTitle] = useState(title);
    const [exportStage, setExportStage] = useState<ExportStage>('configuring');
    const [generatedPngDataUrl, setGeneratedPngDataUrl] = useState<string | null>(null);
    const [loadingMessage, setLoadingMessage] = useState('');

    // NEW: Define a memoized checkerboard background for the preview area
    const checkerboardBg = useMemo(() => "url('data:image/svg+xml,%3Csvg xmlns=\"http://www.w3.org/2000/svg\" width=\"16\" height=\"16\" viewBox=\"0 0 16 16\"%3E%3Crect x=\"0\" y=\"0\" width=\"16\" height=\"16\" fill=\"%23ffffff\"/%3E%3Crect x=\"0\" y=\"0\" width=\"8\" height=\"8\" fill=\"%23e5e5e5\"/%3E%3Crect x=\"8\" y=\"8\" width=\"8\" height=\"8\" fill=\"%23e5e5e5\"/%3E%3C/svg%3E')", []);

    const updateSetting = <K extends keyof PngSettingsState>(key: K, value: PngSettingsState[K]) => {
        setPngSettings(prev => {
            const newState = { ...prev, [key]: value };
            if (key === 'pngDisplayMode' && value === 'calendar' && newState.pngDateRange === 'upcoming2Weeks') {
                newState.pngDateRange = 'full';
            }
            return newState;
        });
    };

    // --- Custom Hooks for complex logic ---
    const { fontStatuses, loadFont } = useFontLoader();
    const propsForContent = useMemo(() => ({
        scheduleData, title: localTitle, calendarDays, currentDate, weekStartsOn,
        ...pngSettings,
    }), [scheduleData, localTitle, calendarDays, currentDate, weekStartsOn, pngSettings]);
    
    const selectedFontStatus = fontStatuses[pngSettings.font] || 'idle';

    usePreviewScaling(isOpen, selectedFontStatus, [propsForContent], {
        previewContainerRef,
        scaleWrapperRef,
        exportRef,
        exportWidth: 800,
        displayMode: pngSettings.pngDisplayMode,
    });
    
    // --- Effects ---
    useEffect(() => {
        if (isOpen) {
            setExportStage('configuring');
            setGeneratedPngDataUrl(null);
            setLocalTitle(title);
        }
    }, [isOpen, title]);

    useEffect(() => {
        if (!isOpen || localTitle === title) {
            return;
        }

        const handler = setTimeout(() => {
            onTitleChange(localTitle);
        }, 1000);

        return () => clearTimeout(handler);
    }, [localTitle, title, onTitleChange, isOpen]);
    
    // EFFECT 1: Immediately load the currently selected font for a fast main preview.
    useEffect(() => {
        if (isOpen) {
            const selectedFontOption = FONT_OPTIONS.find(f => f.id === pngSettings.font);
            if (selectedFontOption && (fontStatuses[selectedFontOption.id] || 'idle') === 'idle') {
                loadFont(selectedFontOption).catch(e => console.error(`Failed to preload selected font: ${selectedFontOption.name}`, e));
            }
        }
    }, [isOpen, pngSettings.font, loadFont, fontStatuses]);

    // EFFECT 2: In the background, lazy-load all other fonts to populate the preview list styles.
    useEffect(() => {
        if (isOpen) {
            // Use a small timeout to ensure this runs after the critical initial render.
            const timer = setTimeout(() => {
                FONT_OPTIONS.forEach(fontOption => {
                    // `loadFont` is stable and has an internal check, so we can just call it.
                    loadFont(fontOption).catch(e => console.error(`Failed to lazy-load font: ${fontOption.name}`, e));
                });
            }, 100);

            return () => clearTimeout(timer);
        }
    }, [isOpen, loadFont]);


    // --- Event Handlers ---
    const handleFontSelect = useCallback(async (fontId: string) => {
        updateSetting('font', fontId);

        if ((fontStatuses[fontId] || 'idle') === 'idle') {
            const fontOption = FONT_OPTIONS.find(f => f.id === fontId);
            if(fontOption) {
                try {
                    await loadFont(fontOption);
                } catch (error) {
                    alert(`無法載入字體：${fontOption.name}。請檢查您的網路連線或檔案。`);
                }
            }
        }
    }, [fontStatuses, loadFont, updateSetting]);
    
    /**
     * Pauses execution until the browser has completed its next paint cycle.
     * This is crucial for ensuring DOM updates (like applying a new font)
     * are fully rendered before capturing an image.
     */
    const yieldToBrowser = async (): Promise<void> => {
        return new Promise(resolve => {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => resolve());
            });
        });
    };
    
    const handleStartExport = useCallback(async () => {
        const exportNode = exportRef.current;
        if (!exportNode || typeof htmlToImage === 'undefined') {
            alert('匯出工具尚未準備好，請稍後再試。');
            return;
        }
    
        setExportStage('generating_image');
        
        const linksToRemove: HTMLLinkElement[] = [];
        const styleNodeToAdd: HTMLStyleElement | null = document.createElement('style');
    
        try {
            // Step 1: Temporarily remove Google Fonts links to prevent CORS conflicts
            setLoadingMessage('準備資源...');
            document.querySelectorAll('link[href*="fonts.googleapis.com"]').forEach(linkNode => {
                const linkEl = linkNode as HTMLLinkElement;
                if (document.head.contains(linkEl)) {
                    document.head.removeChild(linkEl);
                    linksToRemove.push(linkEl);
                }
            });
    
            // Step 2: Get the chosen font and its Base64 CSS
            const fontId = pngSettings.font;
            const selectedFont = FONT_OPTIONS.find(f => f.id === fontId);
            if (!selectedFont) throw new Error("錯誤：找不到選擇的字體。");
    
            const fontEmbedCSS = await embedFontForExport(selectedFont);
            
            // Step 3: Inject the Base64 CSS directly into the document head
            styleNodeToAdd.id = `dynamic-font-style-for-export-${Date.now()}`;
            styleNodeToAdd.appendChild(document.createTextNode(fontEmbedCSS));
            document.head.appendChild(styleNodeToAdd);
    
            // Step 4: Wait for the browser to acknowledge and load the injected font
            setLoadingMessage('同步字體引擎...');
            const primaryFontFamily = selectedFont.familyName;
            const loadPromises = selectedFont.weights.map(weight =>
                document.fonts.load(`${weight} 1em "${primaryFontFamily}"`)
            );
            await Promise.all(loadPromises);
    
            // Step 5: Wait for the browser to complete a paint cycle
            setLoadingMessage('等待瀏覽器繪製...');
            await yieldToBrowser();

            // Step 6: Force a reflow to ensure styles are applied before cloning
            setLoadingMessage('強制同步畫面...');
            const _ = exportNode.offsetHeight;

            // Step 7: "Priming" render to warm up html-to-image
            setLoadingMessage('準備引擎...');
            try {
                await htmlToImage.toPng(exportNode, {
                    pixelRatio: 0.01,
                    quality: 0.01,
                });
            } catch (primingError) {
                console.log('Priming render failed as expected, continuing...', primingError);
            }
    
            // Step 8: Final high-quality render
            setLoadingMessage('正在生成圖片...');
            const bgColorRgba = colorToRgba(propsForContent.bgColor);
            const finalBgColor = bgColorRgba.a < 0.01 ? null : `rgba(${bgColorRgba.r}, ${bgColorRgba.g}, ${bgColorRgba.b}, ${bgColorRgba.a})`;
    
            const dataUrl = await htmlToImage.toPng(exportNode, {
                backgroundColor: finalBgColor,
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
            // Step 9: CRITICAL cleanup block
            if (styleNodeToAdd && document.head.contains(styleNodeToAdd)) {
                document.head.removeChild(styleNodeToAdd);
            }
            linksToRemove.forEach(linkEl => document.head.appendChild(linkEl));
        }
    }, [pngSettings.font, propsForContent.bgColor]);


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
    
    let footer: React.ReactNode = null;
    if (exportStage === 'configuring') {
        footer = (
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
    }
    // REMOVED: Footer logic for 'completed' stage is now handled inside ExportCompletionView


    if (!isOpen) return null;

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={isExporting ? () => {} : onClose} 
            headerContent={header} 
            footerContent={footer} 
            modalClassName="xl:max-w-4xl"
            fullHeightContent={exportStage === 'completed'}
        >
            <div
                style={{ position: 'fixed', top: 0, left: -99999, pointerEvents: 'none', opacity: 0 }}
              >
                <PngExportContent ref={exportRef} {...propsForContent} />
            </div>

            {exportStage === 'configuring' ? (
                <div className="flex flex-col lg:flex-row gap-6 items-start">
                    <div className="w-full lg:w-1/2 sticky top-0 z-10 bg-gray-50 dark:bg-gray-900 pb-4">
                        <div
                          ref={previewContainerRef}
                          className={`
                            relative w-full rounded-md max-h-[25vh] lg:max-h-[35vh]
                            flex justify-center items-start overflow-y-auto overflow-x-hidden
                          `}
                          style={{ backgroundImage: checkerboardBg }}
                        >
                            <div className="absolute top-2 right-2 z-20 bg-gray-200/80 dark:bg-gray-900/80 backdrop-blur-sm p-1 rounded-lg flex items-center gap-1">
                                <button
                                    onClick={() => updateSetting('pngDisplayMode', 'calendar')}
                                    className={`p-1.5 rounded-md transition-colors ${pngSettings.pngDisplayMode === 'calendar' ? 'bg-white dark:bg-gray-600 shadow text-blue-600 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-gray-500/50'}`}
                                    title="月曆模式"
                                    aria-label="Calendar view"
                                >
                                    <CalendarIcon className="w-5 h-5"/>
                                </button>
                                <button
                                    onClick={() => updateSetting('pngDisplayMode', 'list')}
                                    className={`p-1.5 rounded-md transition-colors ${pngSettings.pngDisplayMode === 'list' ? 'bg-white dark:bg-gray-600 shadow text-blue-600 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-gray-500/50'}`}
                                    title="清單模式"
                                    aria-label="List view"
                                >
                                    <ListIcon className="w-5 h-5"/>
                                </button>
                            </div>

                            <div 
                                ref={scaleWrapperRef} 
                                draggable="false" 
                                className="touch-none select-none"
                                style={{ transition: 'transform 0.2s ease-out', visibility: selectedFontStatus === 'loaded' ? 'visible' : 'hidden' }}
                            >
                                <PngExportContent {...propsForContent} />
                            </div>
                            {selectedFontStatus !== 'loaded' && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <SpinnerIcon className="w-8 h-8 text-gray-500" />
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="w-full lg:w-1/2 space-y-4">
                        <SettingsPanels 
                            pngSettings={pngSettings}
                            updateSetting={updateSetting}
                            localTitle={localTitle}
                            setLocalTitle={setLocalTitle}
                            fontStatuses={fontStatuses}
                            handleFontSelect={handleFontSelect}
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
