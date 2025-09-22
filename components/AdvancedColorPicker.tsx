// components/AdvancedColorPicker.tsx
// FIX: Add 'useMemo' to the React import to resolve reference errors.
import React, { useState, useRef, useLayoutEffect, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { colorToRgba, rgbaToCssString } from '../utils';

interface AdvancedColorPickerProps {
    value: string;
    onChange: (value: string) => void;
    presetColors: string[];
}

const AdvancedColorPicker: React.FC<AdvancedColorPickerProps> = ({ value, onChange, presetColors }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});
    
    const triggerRef = useRef<HTMLButtonElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);

    const parsedColor = useMemo(() => colorToRgba(value), [value]);
    const hexColor = useMemo(() => rgbaToCssString({ ...parsedColor, a: 1 }), [parsedColor]);

    useLayoutEffect(() => {
        if (!isOpen || !triggerRef.current || !popoverRef.current) return;

        const triggerRect = triggerRef.current.getBoundingClientRect();
        const popoverRect = popoverRef.current.getBoundingClientRect();
        const viewHeight = window.innerHeight;
        const viewWidth = window.innerWidth;
        const margin = 8;

        let top = triggerRect.bottom + margin;
        let left = triggerRect.left;

        if (top + popoverRect.height > viewHeight) {
            top = triggerRect.top - popoverRect.height - margin;
        }
        if (left + popoverRect.width > viewWidth) {
            left = triggerRect.right - popoverRect.width;
        }
        if (left < 0) {
            left = margin;
        }

        setPopoverStyle({
            top: `${top}px`,
            left: `${left}px`,
        });
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (event: MouseEvent) => {
            if (
                popoverRef.current && !popoverRef.current.contains(event.target as Node) &&
                triggerRef.current && !triggerRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const handleHexChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const newRgb = colorToRgba(e.target.value);
        onChange(rgbaToCssString({ ...newRgb, a: parsedColor.a }));
    }, [onChange, parsedColor.a]);

    const handleAlphaChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(rgbaToCssString({ ...parsedColor, a: parseFloat(e.target.value) }));
    }, [onChange, parsedColor]);

    const handlePresetClick = (color: string) => {
        if (color === 'transparent') {
            onChange('rgba(0,0,0,0)');
        } else {
            onChange(color);
        }
    };
    
    const checkerboardBg = "url('data:image/svg+xml,%3Csvg xmlns=\"http://www.w3.org/2000/svg\" width=\"16\" height=\"16\" viewBox=\"0 0 16 16\"%3E%3Crect x=\"0\" y=\"0\" width=\"16\" height=\"16\" fill=\"%23fff\"/%3E%3Crect x=\"0\" y=\"0\" width=\"8\" height=\"8\" fill=\"%23ccc\"/%3E%3Crect x=\"8\" y=\"8\" width=\"8\" height=\"8\" fill=\"%23ccc\"/%3E%3C/svg%3E')";

    return (
        <div className="relative">
            <button
                ref={triggerRef}
                onClick={() => setIsOpen(!isOpen)}
                className="w-8 h-6 rounded-md border border-gray-300 dark:border-gray-600 relative overflow-hidden"
                style={{ background: checkerboardBg }}
            >
                <span className="absolute inset-0" style={{ backgroundColor: value }} />
            </button>
            
            {isOpen && createPortal(
                <div
                    ref={popoverRef}
                    style={popoverStyle}
                    className="fixed z-[60] bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 p-3 space-y-3 w-60"
                >
                    <div className="grid grid-cols-7 gap-1.5">
                        {presetColors.map(color => (
                            <button
                                key={color}
                                onClick={() => handlePresetClick(color)}
                                className="w-full aspect-square rounded-sm transition-transform hover:scale-110 relative overflow-hidden"
                                style={{
                                    background: color === 'transparent' ? checkerboardBg : undefined,
                                    border: color === 'transparent' ? '1px dashed #9ca3af' : `1px solid rgba(0,0,0,0.1)`,
                                }}
                                title={color}
                            >
                                <span className="absolute inset-0" style={{ backgroundColor: color }} />
                            </button>
                        ))}
                    </div>
                    
                    <div className="flex items-center gap-2">
                         <div className="relative w-8 h-8 rounded-md overflow-hidden border border-gray-300 dark:border-gray-600">
                             <input
                                type="color"
                                value={hexColor}
                                onChange={handleHexChange}
                                className="absolute -top-1 -left-1 w-12 h-12 cursor-pointer"
                            />
                         </div>
                        <div className="flex-grow space-y-1">
                            <input
                                type="text"
                                value={rgbaToCssString(parsedColor)}
                                readOnly
                                className="w-full text-xs text-center bg-gray-100 dark:bg-gray-700 rounded p-1"
                            />
                        </div>
                    </div>
                    
                    <div>
                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400">透明度</label>
                        <div className="relative h-4 mt-1">
                            {/* Visual Track */}
                            <div 
                                className="absolute top-1/2 left-0 w-full h-2 -translate-y-1/2 rounded-full overflow-hidden" 
                                style={{ background: checkerboardBg }}
                            >
                                <div 
                                    className="h-full" 
                                    style={{ background: `linear-gradient(to right, transparent, ${hexColor})` }} 
                                />
                            </div>

                            {/* Slider Input Control */}
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.01"
                                value={parsedColor.a}
                                onChange={handleAlphaChange}
                                className="
                                    relative
                                    appearance-none
                                    w-full h-4
                                    bg-transparent
                                    cursor-pointer
                                    focus:outline-none
                                    
                                    [&::-webkit-slider-thumb]:appearance-none
                                    [&::-webkit-slider-thumb]:h-4
                                    [&::-webkit-slider-thumb]:w-4
                                    [&::-webkit-slider-thumb]:bg-white
                                    [&::-webkit-slider-thumb]:rounded-full
                                    [&::-webkit-slider-thumb]:shadow-md
                                    [&::-webkit-slider-thumb]:ring-1
                                    [&::-webkit-slider-thumb]:ring-gray-300
                                    dark:[&::-webkit-slider-thumb]:ring-gray-600
                                    
                                    [&::-moz-range-thumb]:h-4
                                    [&::-moz-range-thumb]:w-4
                                    [&::-moz-range-thumb]:bg-white
                                    [&::-moz-range-thumb]:rounded-full
                                    [&::-moz-range-thumb]:shadow-md
                                    [&::-moz-range-thumb]:border-none
                                "
                            />
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default AdvancedColorPicker;