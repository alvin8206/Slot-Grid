// components/Modal.tsx
import React, { useState, useCallback, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import { CloseIcon } from './icons';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  headerContent: React.ReactNode;
  footerContent: React.ReactNode;
  children: React.ReactNode;
  modalClassName?: string;
  fullHeightContent?: boolean; // NEW PROP
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, headerContent, footerContent, children, modalClassName, fullHeightContent = false }) => {
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
        data-modal-dialog="true"
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

        <main 
            className="flex-grow overflow-y-auto bg-gray-50 dark:bg-gray-900" 
            style={{ paddingBottom: fullHeightContent ? '0' : (footerHeight ? `${footerHeight}px` : '8rem') }}
        >
            <div className={`p-4 md:p-6 ${fullHeightContent ? 'h-full p-0 md:p-0' : ''}`}>
                {children}
            </div>
        </main>
        
        {footerContent && (
            <footer 
                ref={footerRef}
                className="absolute bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-white dark:from-gray-800 to-white/0 dark:to-gray-800/0 backdrop-blur-sm pt-8 pb-4"
                style={{ paddingBottom: `calc(1rem + env(safe-area-inset-bottom))` }}
            >
                <div className="container mx-auto px-4">
                     {footerContent}
                </div>
            </footer>
        )}
      </div>
    </div>
  );
};

export default Modal;
