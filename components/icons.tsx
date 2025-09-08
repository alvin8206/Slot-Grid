import React from 'react';

// FIX: Update icon to accept props and merge classNames to fix type error and improve reusability.
export const ChevronLeftIcon = ({ className, ...props }: React.ComponentProps<'svg'>) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={['h-6 w-6', className].filter(Boolean).join(' ')} fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);

// FIX: Update icon to accept props and merge classNames.
export const ChevronRightIcon = ({ className, ...props }: React.ComponentProps<'svg'>) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={['h-6 w-6', className].filter(Boolean).join(' ')} fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

// FIX: Update icon to accept props and merge classNames.
export const DownloadIcon = ({ className, ...props }: React.ComponentProps<'svg'>) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={['h-5 w-5 mr-2', className].filter(Boolean).join(' ')} fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
);

// FIX: Update icon to accept props and merge classNames.
export const CloseIcon = ({ className, ...props }: React.ComponentProps<'svg'>) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={['h-6 w-6', className].filter(Boolean).join(' ')} fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
);

// FIX: Update icon to accept props and merge classNames.
export const TrashIcon = ({ className, ...props }: React.ComponentProps<'svg'>) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={['h-4 w-4', className].filter(Boolean).join(' ')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
);

// FIX: Update icon to accept props and merge classNames.
export const CopyIcon = ({ className, ...props }: React.ComponentProps<'svg'>) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={['h-5 w-5 mr-1.5', className].filter(Boolean).join(' ')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
);

// FIX: Update icon to accept props and merge classNames.
export const ClipboardIcon = ({ className, ...props }: React.ComponentProps<'svg'>) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={['h-5 w-5 mr-1.5', className].filter(Boolean).join(' ')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
);

// FIX: Update icon to accept props and merge classNames.
export const CalendarIcon = ({ className, ...props }: React.ComponentProps<'svg'>) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={['h-6 w-6', className].filter(Boolean).join(' ')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
);

// FIX: Update icon to accept props and merge classNames to fix the type error.
export const EditIcon = ({ className, ...props }: React.ComponentProps<'svg'>) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={['h-4 w-4', className].filter(Boolean).join(' ')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z" />
    </svg>
);

// FIX: Update icon to accept props and merge classNames.
export const RainbowIcon = ({ className, ...props }: React.ComponentProps<'svg'>) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={['w-5 h-5', className].filter(Boolean).join(' ')} fill="none" {...props}>
        <defs>
            <linearGradient id="rainbow" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FF0000" />
                <stop offset="16.6%" stopColor="#FF7F00" />
                <stop offset="33.3%" stopColor="#FFFF00" />
                <stop offset="50%" stopColor="#00FF00" />
                <stop offset="66.6%" stopColor="#0000FF" />
                <stop offset="83.3%" stopColor="#4B0082" />
                <stop offset="100%" stopColor="#9400D3" />
            </linearGradient>
        </defs>
        <path stroke="url(#rainbow)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

// FIX: Update icon to accept props and merge classNames.
export const UserIcon = ({ className, ...props }: React.ComponentProps<'svg'>) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={['h-5 w-5', className].filter(Boolean).join(' ')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
);

// FIX: Update icon to accept props and merge classNames.
export const GoogleIcon = ({ className, ...props }: React.ComponentProps<'svg'>) => (
    <svg className={['w-5 h-5', className].filter(Boolean).join(' ')} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
        <path d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z" fill="#FFC107"/>
        <path d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z" fill="url(#paint0_linear_2_2)"/>
        <path d="M24 46c5.9 0 11.2-2.2 15-5.8l-6.4-6.4C30.1 36.3 27.2 37 24 37c-4.9 0-9-3.2-10.7-7.5H6.3v7.3C9.5 42.1 16.3 46 24 46z" fill="#4CAF50"/>
        <path d="M24 46c5.9 0 11.2-2.2 15-5.8l-6.4-6.4C30.1 36.3 27.2 37 24 37c-4.9 0-9-3.2-10.7-7.5H6.3v7.3C9.5 42.1 16.3 46 24 46z" fill="url(#paint1_linear_2_2)"/>
        <path d="M13.3 29.5C12.8 28.3 12.5 27 12.5 26s.3-2.3.8-3.5V16H6.3C4.2 20.2 4 22.8 4 26s.2 5.8 2.3 9.6l7-6.1z" fill="#F44336"/>
        <path d="M13.3 29.5C12.8 28.3 12.5 27 12.5 26s.3-2.3.8-3.5V16H6.3C4.2 20.2 4 22.8 4 26s.2 5.8 2.3 9.6l7-6.1z" fill="url(#paint2_linear_2_2)"/>
        <path d="M46 24c0-1.3-.2-2.7-.5-4l-6.4 6.4v.1c0 2.2-1.8 4-4 4-2.2 0-4-1.8-4-4s1.8-4 4-4c1.1 0 2.1.4 2.8 1.2l6.4-6.4C38.9 9.3 35.8 8 32 8c-6.2 0-11.4 4.1-13.4 9.6l7 6.1C17.2 20.2 20.4 18 24 18c3.6 0 6.8 2.2 8.3 5.3l-6.5 6.5C25.4 30.3 24.7 30 24 30c-2.2 0-4 1.8-4 4s1.8 4 4 4c2.8 0 5.2-1.8 6.3-4.3H24v-8h22z" fill="#1976D2"/>
        <path d="M46 24c0-1.3-.2-2.7-.5-4l-6.4 6.4v.1c0 2.2-1.8 4-4 4-2.2 0-4-1.8-4-4s1.8-4 4-4c1.1 0 2.1.4 2.8 1.2l6.4-6.4C38.9 9.3 35.8 8 32 8c-6.2 0-11.4 4.1-13.4 9.6l7 6.1C17.2 20.2 20.4 18 24 18c3.6 0 6.8 2.2 8.3 5.3l-6.5 6.5C25.4 30.3 24.7 30 24 30c-2.2 0-4 1.8-4 4s1.8 4 4 4c2.8 0 5.2-1.8 6.3-4.3H24v-8h22z" fill="url(#paint3_linear_2_2)"/>
        <defs>
            <linearGradient id="paint0_linear_2_2" x1="-1.677" y1="21.053" x2="27.01" y2="43.142" gradientUnits="userSpaceOnUse"><stop stopColor="#FF3D00" stopOpacity="0.2"/><stop offset="1" stopColor="#FF3D00" stopOpacity="0"/></linearGradient>
            <linearGradient id="paint1_linear_2_2" x1="23" y1="31" x2="43" y2="45" gradientUnits="userSpaceOnUse"><stop stopColor="#1B5E20" stopOpacity="0.2"/><stop offset="1" stopColor="#1B5E20" stopOpacity="0"/></linearGradient>
            <linearGradient id="paint2_linear_2_2" x1="8.666" y1="16.11" x2="13.333" y2="29.5" gradientUnits="userSpaceOnUse"><stop stopColor="#B71C1C" stopOpacity="0.2"/><stop offset="1" stopColor="#B71C1C" stopOpacity="0"/></linearGradient>
            <linearGradient id="paint3_linear_2_2" x1="45" y1="2" x2="11" y2="46" gradientUnits="userSpaceOnUse"><stop stopColor="#0D47A1" stopOpacity="0.2"/><stop offset="1" stopColor="#0D47A1" stopOpacity="0"/></linearGradient>
        </defs>
    </svg>
);
