const FALLBACK = '#f97316';

/** Relative luminance (0 = black, 1 = white) of a #rgb / #rrggbb color, or null if unparseable. */
function luminance(hex: string): number | null {
  let h = hex.trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Habit colors are drawn behind white ticks and on both dark and light cards,
 * so near-white and near-black colors (and invalid ones) are shown in brand orange.
 */
export function safeHabitColor(color?: string | null): string {
  if (!color) return FALLBACK;
  const l = luminance(color);
  if (l === null || l > 0.7 || l < 0.03) return FALLBACK;
  return color;
}
