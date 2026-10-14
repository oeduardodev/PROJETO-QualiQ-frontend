export interface HsvColor {
  hue: number;
  saturation: number;
  brightness: number;
}

export function normalizeHex(value: string): string | null {
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toUpperCase();
  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) return `#${trimmed.toUpperCase()}`;
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    return `#${[...trimmed.slice(1)]
      .map((digit) => digit.repeat(2))
      .join('')
      .toUpperCase()}`;
  }
  return null;
}

export function textColorForBackground(value: string): '#0F172A' | '#FFFFFF' {
  const hex = normalizeHex(value);
  if (!hex) return '#0F172A';
  const channels = [1, 3, 5].map((index) => {
    const channel = parseInt(hex.slice(index, index + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  return luminance > 0.2 ? '#0F172A' : '#FFFFFF';
}

export function hexToHsv(hex: string): HsvColor {
  const normalized = normalizeHex(hex) ?? '#3B82F6';
  const red = parseInt(normalized.slice(1, 3), 16) / 255;
  const green = parseInt(normalized.slice(3, 5), 16) / 255;
  const blue = parseInt(normalized.slice(5, 7), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;
  if (delta) {
    if (max === red) hue = ((green - blue) / delta) % 6;
    else if (max === green) hue = (blue - red) / delta + 2;
    else hue = (red - green) / delta + 4;
    hue = (hue * 60 + 360) % 360;
  }
  return {
    hue,
    saturation: max ? (delta / max) * 100 : 0,
    brightness: max * 100,
  };
}

export function hsvToHex({ hue, saturation, brightness }: HsvColor): string {
  const h = ((hue % 360) + 360) % 360;
  const s = Math.max(0, Math.min(100, saturation)) / 100;
  const v = Math.max(0, Math.min(100, brightness)) / 100;
  const chroma = v * s;
  const secondary = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const base = v - chroma;
  const sectors = [
    [chroma, secondary, 0],
    [secondary, chroma, 0],
    [0, chroma, secondary],
    [0, secondary, chroma],
    [secondary, 0, chroma],
    [chroma, 0, secondary],
  ];
  const rgb = sectors[Math.floor(h / 60)].map((channel) =>
    Math.round((channel + base) * 255)
      .toString(16)
      .padStart(2, '0'),
  );
  return `#${rgb.join('').toUpperCase()}`;
}
