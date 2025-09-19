// components/PngExportModal.hooks.ts
import { useState, useCallback, useLayoutEffect, useRef } from 'react';
import { FontOption, FontStatus } from './PngExportModal.helpers';
import type { CustomFont } from '../types';
import { getPrimaryFamily } from '../fonts';

/**
 * Hook to manage loading and status tracking of web fonts.
 * This version supports both Google Fonts and custom uploaded fonts.
 */
export const useFontLoader = (customFonts: CustomFont[]) => {
    const [fontStatuses, setFontStatuses] = useState<Record<string, FontStatus>>({});
    const addedLinks = useRef(new Set<string>());
    const addedCustomStyles = useRef(new Set<string>());

    const loadFont = useCallback(async (fontOption: FontOption): Promise<void> => {
        const { id, urlValue, name } = fontOption;

        if (fontStatuses[id] === 'loaded' || fontStatuses[id] === 'loading') {
            return;
        }

        const customFont = customFonts.find(cf => cf.name === id);

        try {
            setFontStatuses(prev => ({ ...prev, [id]: 'loading' }));
            
            let primaryFontFamily = getPrimaryFamily(id);

            // Step 1: Ensure the font stylesheet is in the document.
            if (customFont) {
                // Handle custom uploaded font
                if (!addedCustomStyles.current.has(id)) {
                    const style = document.createElement('style');
                    style.id = `font-style-${id}`;
                    style.textContent = `
                        @font-face {
                            font-family: "${primaryFontFamily}";
                            src: url(${customFont.data});
                        }
                    `;
                    document.head.appendChild(style);
                    addedCustomStyles.current.add(id);
                }
            } else {
                // Handle Google Font
                if (!addedLinks.current.has(id)) {
                    await new Promise<void>((resolve, reject) => {
                        const link = document.createElement('link');
                        link.rel = 'stylesheet';
                        link.href = `https://fonts.googleapis.com/css2?family=${urlValue.replace(/ /g, '+')}&display=swap`;
                        link.onload = () => resolve();
                        link.onerror = (e) => {
                            console.error(`Font stylesheet failed to load for: ${name}`, e);
                            reject(new Error(`Stylesheet load error for ${name}`));
                        };
                        document.head.appendChild(link);
                    });
                    addedLinks.current.add(id);
                }
            }
            
            // Step 2: Use the deterministic `document.fonts.load()` API.
            await document.fonts.load(`1em "${primaryFontFamily}"`);

            setFontStatuses(prev => ({ ...prev, [id]: 'loaded' }));
        } catch (error) {
            console.error(`Failed to load font "${name}":`, error);
            setFontStatuses(prev => ({ ...prev, [id]: 'idle' }));
            throw error;
        }
    }, [fontStatuses, customFonts]);

    return { fontStatuses, loadFont };
};


/**
 * A debounced function executor.
 */
function debounce<F extends (...args: any[]) => any>(func: F, wait: number): (...args: Parameters<F>) => void {
    let timeout: ReturnType<typeof setTimeout> | null;
    return function(this: any, ...args: Parameters<F>) {
        const context = this;
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => {
            timeout = null;
            func.apply(context, args);
        }, wait);
    };
}

/**
 * A robust hook to manage the scaling of a preview element to fit its container.
 * It incorporates debouncing, double requestAnimationFrame, and guards against edge cases.
 */
export const usePreviewScaling = (
    isOpen: boolean,
    selectedFontStatus: FontStatus,
    dependencies: any[],
    options: {
        previewContainerRef: React.RefObject<HTMLDivElement>;
        scaleWrapperRef: React.RefObject<HTMLDivElement>;
        exportRef: React.RefObject<HTMLDivElement>;
        exportWidth: number; // The native width of the content being scaled.
    }
) => {
    useLayoutEffect(() => {
        const { previewContainerRef, scaleWrapperRef, exportRef, exportWidth } = options;
        const containerNode = previewContainerRef.current;
        const wrapperNode = scaleWrapperRef.current;
        const exportNode = exportRef.current;

        if (!isOpen || !containerNode || !wrapperNode || !exportNode) {
            return;
        }

        // The layout calculation should only run when the font is confirmed to be ready.
        if (selectedFontStatus !== 'loaded') {
            return;
        }
        
        const updatePreviewLayout = () => {
            if (!containerNode || !wrapperNode || !exportNode) return;
            
            const containerWidth = containerNode.offsetWidth;

            // Guard against 0 width, which can happen during initial render.
            if (exportWidth <= 0 || containerWidth <= 0) {
                 return;
            }

            // Only scale down, never enlarge. Clamp scale to a maximum of 1.
            const scale = Math.min(1, containerWidth / exportWidth);
            
            // The `transform-origin: top left` is set on the element via style prop.
            wrapperNode.style.transform = `scale(${scale})`;
            
            const exportHeight = exportNode.offsetHeight;
            const scaledHeight = exportHeight * scale;
            wrapperNode.style.height = `${scaledHeight}px`;
        };

        // Use a debounced function that triggers a double RAF to ensure layout is stable.
        const scheduledUpdate = debounce(() => {
            requestAnimationFrame(() => {
                requestAnimationFrame(updatePreviewLayout);
            });
        }, 50); // A small debounce to handle rapid resize events smoothly.

        // Run the initial layout calculation after a short delay for animations to settle.
        const initialTimeout = setTimeout(scheduledUpdate, 100);

        // Only observe the container for changes in available space.
        const resizeObserver = new ResizeObserver(scheduledUpdate);
        resizeObserver.observe(containerNode);

        // Cleanup function.
        return () => {
            clearTimeout(initialTimeout);
            resizeObserver.disconnect();
            // Reset styles to prevent them from affecting the component when it's re-opened.
            if (wrapperNode) {
                 wrapperNode.style.height = '';
                 wrapperNode.style.transform = '';
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, selectedFontStatus, ...dependencies, options]);
};
