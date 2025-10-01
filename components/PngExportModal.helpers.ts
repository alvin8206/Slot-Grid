// components/PngExportModal.helpers.ts

// --- Types ---

export type FontStatus = 'idle' | 'loading' | 'loaded';
export type ExportStage = 'configuring' | 'generating_image' | 'completed';

export interface FontOption {
  id: string;
  name: string;
  urlValue: string;
  weights: number[];
  familyName: string; // NEW: The exact font-family name for matching.
}

// --- Constants ---

export const FONT_CATEGORIES: { name: string, fonts: FontOption[] }[] = [
    {
        name: '常用中文字體',
        fonts: [
            { id: "'Noto Sans TC', sans-serif", name: '思源黑體', urlValue: 'Noto+Sans+TC:wght@300;400;700', weights: [400, 700], familyName: 'Noto Sans TC' },
            { id: "'Noto Serif TC', serif", name: '思源宋體', urlValue: 'Noto+Serif+TC:wght@300;400;700', weights: [400, 700], familyName: 'Noto Serif TC' },
            { id: "'LXGW WenKai TC', cursive", name: '霞鶩文楷', urlValue: 'LXGW+WenKai+TC:wght@300;400;700', weights: [400, 700], familyName: 'LXGW WenKai TC' },
        ]
    },
    {
        name: '中文藝術字體',
        fonts: [
            { id: "'Yuji Syuku', serif", name: '佑字肅', urlValue: 'Yuji+Syuku', weights: [400], familyName: 'Yuji Syuku' },
            { id: "'Hina Mincho', serif", name: '雛明朝', urlValue: 'Hina+Mincho', weights: [400], familyName: 'Hina Mincho' },
            { id: "'Zen Dots', cursive", name: '禪點體', urlValue: 'Zen+Dots', weights: [400], familyName: 'Zen Dots' },
            { id: "'DotGothic16', sans-serif", name: '點陣哥特體', urlValue: 'DotGothic16', weights: [400], familyName: 'DotGothic16' },
            { id: "'Reggae One', cursive", name: '雷鬼體', urlValue: 'Reggae+One', weights: [400], familyName: 'Reggae One' },
            { id: "'Rampart One', cursive", name: '城牆體', urlValue: 'Rampart+One', weights: [400], familyName: 'Rampart One' },
            { id: "'Kaisei Opti', serif", name: '解星光學體', urlValue: 'Kaisei+Opti:wght@400;700', weights: [400, 700], familyName: 'Kaisei Opti' },
            { id: "'M PLUS Rounded 1c', sans-serif", name: 'M+ 圓體', urlValue: 'M+PLUS+Rounded+1c:wght@300;400;700', weights: [400, 700], familyName: 'M PLUS Rounded 1c' },
            { id: "'Zen Maru Gothic', sans-serif", name: '禪丸哥特體', urlValue: 'Zen+Maru+Gothic:wght@400;700', weights: [400, 700], familyName: 'Zen Maru Gothic' },
        ]
    },
    {
        name: '英文字體 (僅適用英文)',
        fonts: [
            { id: "'Cormorant Garamond', serif", name: 'Cormorant Garamond', urlValue: 'Cormorant+Garamond:wght@400;700', weights: [400, 700], familyName: 'Cormorant Garamond' },
            { id: "'Playfair Display', serif", name: 'Playfair Display', urlValue: 'Playfair+Display:wght@400;700', weights: [400, 700], familyName: 'Playfair Display' },
            { id: "'Lobster', cursive", name: 'Lobster', urlValue: 'Lobster', weights: [400], familyName: 'Lobster' },
            { id: "'Pacifico', cursive", name: 'Pacifico', urlValue: 'Pacifico', weights: [400], familyName: 'Pacifico' },
            { id: "'Bebas Neue', sans-serif", name: 'Bebas Neue', urlValue: 'Bebas+Neue', weights: [400], familyName: 'Bebas Neue' },
            { id: "'Space Mono', monospace", name: 'Space Mono', urlValue: 'Space+Mono:wght@400;700', weights: [400, 700], familyName: 'Space Mono' },
            { id: "'Roboto', sans-serif", name: 'Roboto', urlValue: 'Roboto:wght@300;400;700', weights: [400, 700], familyName: 'Roboto' },
            { id: "'Lato', sans-serif", name: 'Lato', urlValue: 'Lato:wght@300;400;700', weights: [400, 700], familyName: 'Lato' },
            { id: "'Montserrat', sans-serif", name: 'Montserrat', urlValue: 'Montserrat:wght@300;400;700', weights: [400, 700], familyName: 'Montserrat' },
            { id: "'Open Sans', sans-serif", name: 'Open Sans', urlValue: 'Open+Sans:wght@300;400;700', weights: [400, 700], familyName: 'Open Sans' },
            { id: "'Poppins', sans-serif", name: 'Poppins', urlValue: 'Poppins:wght@300;400;700', weights: [400, 700], familyName: 'Poppins' },
            { id: "'Raleway', sans-serif", name: 'Raleway', urlValue: 'Raleway:wght@300;400;700', weights: [400, 700], familyName: 'Raleway' },
        ]
    }
];

export const FONT_OPTIONS: FontOption[] = FONT_CATEGORIES.flatMap(c => c.fonts);

export const PRESET_COLORS = {
    bg: ['transparent', '#000000', '#FFFFFF', '#0a296b', '#3b2104'],
    text: ['#000000', '#d2d4d9', '#FFFFFF', '#a1d6d5', '#a9d6a1'],
    border: ['transparent', '#000000', '#FFFFFF', '#806fbf', '#6fbf9a'],
    block: ['transparent', '#000000', '#FFFFFF', '#b1d9e0', '#b8f2d7'],
    strikethrough: ['#000000', '#d2d4d9', '#FFFFFF', '#dbc602', '#c2002d'],
    status: [
        '#c2002d', // Red
        '#dbc602', // Yellow
        '#b8f2d7', // Green
        '#111827', // Black
        '#FFFFFF', // White
        '#6B7280', // Gray
    ],
    slotBg: [
        'transparent',
        '#EFF6FF', // blue-50
        '#F0FDF4', // green-50
        '#FEFCE8', // yellow-50
        '#FDF2F8', // pink-50
    ],
};