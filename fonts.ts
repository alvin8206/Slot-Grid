// utils/fonts.ts
export function getPrimaryFamily(fontFamily: string) {
  const first = fontFamily.split(',')[0].trim();
  return first.replace(/^['"]|['"]$/g, '');
}