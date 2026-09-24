/**
 * Canzey brand logos — pick by background + whether you need the name.
 * Rule: Light → primary. Dark → reversed. Name → wordmark. Symbol → mark.
 * Never recolor, stretch, rotate, or add shadows/effects.
 */
export const BRAND_COLORS = {
  shell: '#FBF5F3',
  blush: '#F5D6D1',
  rose: '#EA948A',
  ink: '#191919',
};

export const BRAND_LOGOS = {
  wordmarkPrimary: '/brand/canzey-wordmark-primary.png',
  wordmarkReversed: '/brand/canzey-wordmark-reversed.png',
  markPrimary: '/brand/canzey-mark-primary.png',
  markReversed: '/brand/canzey-mark-reversed.png',
};

const isDark = (background) => {
  if (!background) return true;
  const key = String(background).toLowerCase();
  if (['ink', 'dark', 'black'].includes(key)) return true;
  if (['shell', 'white', 'light', 'blush'].includes(key)) return false;
  // hex luminance
  const hex = key.replace('#', '');
  if (hex.length === 6) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.45;
  }
  return true;
};

export function brandWordmark(background = 'dark') {
  return isDark(background)
    ? BRAND_LOGOS.wordmarkReversed
    : BRAND_LOGOS.wordmarkPrimary;
}

export function brandMark(background = 'dark') {
  return isDark(background)
    ? BRAND_LOGOS.markReversed
    : BRAND_LOGOS.markPrimary;
}

/** Min sizes from brand guide */
export const BRAND_LOGO_MIN = {
  wordmarkWidth: 120,
  markHeight: 32,
};
