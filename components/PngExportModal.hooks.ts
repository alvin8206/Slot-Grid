// components/PngExportModal.hooks.ts
// FIX: Add the default `React` import to resolve the `Cannot find namespace 'React'` error when using `React.RefObject` type.
import React, { useState, useCallback, useLayoutEffect, useRef, useEffect } from 'react';
import { FontOption, FontStatus } from './PngExportModal.helpers';
import type { PngDisplayMode } from '../types';

/**
 * Hook to manage loading and status tracking of web fonts.
 */
export const useFontLoader = () => {
    const [fontStatuses, setFontStatuses] = useState<Record<string, FontStatus>>({});
    
    // Use a ref to hold the latest statuses, making `loadFont` stable across re-renders.
    const statusesRef = useRef(fontStatuses);
    useEffect(() => {
        statusesRef.current = fontStatuses;
    }, [fontStatuses]);

    const addedLinks = useRef(new Set<string>());

    const loadFont = useCallback(async (fontOption: FontOption): Promise<void> => {
        const { id, urlValue, name } = fontOption;

        // Use the ref to check the *current* status without needing it as a dependency.
        if (statusesRef.current[id] === 'loaded' || statusesRef.current[id] === 'loading') {
            return;
        }

        try {
            setFontStatuses(prev => ({ ...prev, [id]: 'loading' }));
            
            const primaryFontFamily = fontOption.familyName;

            // Step 1: Ensure the font stylesheet is in the document for Google Fonts
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
            
            // Step 2: Use the deterministic `document.fonts.load()` API for all required weights.
            const loadPromises = fontOption.weights.map(weight => 
                document.fonts.load(`${weight} 1em "${primaryFontFamily}"`)
            );
            await Promise.all(loadPromises);

            setFontStatuses(prev => ({ ...prev, [id]: 'loaded' }));
        } catch (error) {
            console.error(`Failed to load font "${name}":`, error);
            setFontStatuses(prev => ({ ...prev, [id]: 'idle' }));
            throw error;
        }
    }, []); // The dependency array is empty, so this function is stable.

    return { fontStatuses, loadFont };
};


/**
 * A robust hook to manage the scaling of a preview element to fit its container.
 * It now calculates the scale once and avoids using ResizeObserver to prevent jumps on mobile scroll.
 */
export const usePreviewScaling = (
    isOpen: boolean,
    selectedFontStatus: FontStatus,
    dependencies: any[],
    options: {
        previewContainerRef: React.RefObject<HTMLDivElement>;
        scaleWrapperRef: React.RefObject<HTMLDivElement>;
        exportRef: React.RefObject<HTMLDivElement>;
        exportWidth: number;
        displayMode: PngDisplayMode;
    }
) => {
    useLayoutEffect(() => {
        const { previewContainerRef, scaleWrapperRef, exportRef, exportWidth } = options;
        const containerNode = previewContainerRef.current;
        const wrapperNode = scaleWrapperRef.current;
        const exportNode = exportRef.current;

        if (!isOpen || !containerNode || !wrapperNode || !exportNode || selectedFontStatus !== 'loaded') {
            return;
        }
        
        const updatePreviewLayout = () => {
            if (!containerNode || !wrapperNode || !exportNode) {
                return;
            }
            
            wrapperNode.style.transform = '';
            wrapperNode.style.height = '';
            wrapperNode.style.transformOrigin = '';
            wrapperNode.style.width = '';

            const containerWidth = containerNode.clientWidth;
            const exportHeight = exportNode.offsetHeight;

            if (exportWidth <= 0 || containerWidth <= 0 || exportHeight <= 0) {
                 return;
            }

            // FIX: Explicitly set the wrapper's width to match the export content's width.
            // This makes the layout calculation predictable before applying the scale transform,
            // preventing cropping issues on mobile where flexbox might otherwise miscalculate the available space.
            wrapperNode.style.width = `${exportWidth}px`;

            const scale = containerWidth / exportWidth;
            wrapperNode.style.transformOrigin = 'top center';
            wrapperNode.style.transform = `scale(${scale})`;
            
            const scaledHeight = exportHeight * scale;
            wrapperNode.style.height = `${scaledHeight}px`;
        };

        // Run the calculation after a couple of frames to ensure the DOM is ready.
        // This replaces the ResizeObserver to provide a stable, non-jumping scale.
        const timer = setTimeout(() => {
            requestAnimationFrame(() => {
                requestAnimationFrame(updatePreviewLayout);
            });
        }, 0);


        return () => {
            clearTimeout(timer);
            if (wrapperNode) {
                 wrapperNode.style.height = '';
                 wrapperNode.style.transform = '';
                 wrapperNode.style.transformOrigin = '';
                 wrapperNode.style.width = '';
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, selectedFontStatus, ...dependencies, options]);
};
