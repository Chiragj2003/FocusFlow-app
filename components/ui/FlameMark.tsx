import { useTheme } from '@/lib/ThemeContext';
import React from 'react';
import { Image } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

const LOGO = require('@/assets/brand/logo.png');

interface FlameMarkProps {
  size?: number;
  /** 'brand' = orange gradient, otherwise a solid color (e.g. '#ffffff') */
  color?: 'brand' | string;
  /** Always use the logo artwork (for surfaces that are dark in both themes) */
  onDark?: boolean;
}

/**
 * The FocusFlow flame-check mark: a flame rising out of a checkmark.
 * On dark surfaces it shows the official logo artwork; on light surfaces a vector
 * version (the artwork's inner shading only reads well on dark backgrounds).
 */
export function FlameMark({ size = 32, color = 'brand', onDark }: FlameMarkProps) {
  const { isDark } = useTheme();
  if (color === 'brand' && (onDark || isDark)) {
    return <Image source={LOGO} style={{ width: size, height: size }} resizeMode="contain" accessibilityIgnoresInvertColors />;
  }

  const fill = color === 'brand' ? 'url(#ffFlame)' : color;
  const fillCheck = color === 'brand' ? 'url(#ffCheck)' : color;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="ffFlame" x1="0.2" y1="1" x2="0.6" y2="0">
          <Stop offset="0" stopColor="#ea580c" />
          <Stop offset="0.55" stopColor="#f97316" />
          <Stop offset="1" stopColor="#fbbf24" />
        </LinearGradient>
        <LinearGradient id="ffCheck" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#fb923c" />
          <Stop offset="1" stopColor="#f59e0b" />
        </LinearGradient>
      </Defs>
      {/* Flame */}
      <Path
        d="M52 6c3 14-6 20-12 28-7 9-9 17-7 26l14 13 27-27c2-10-2-19-9-26 1 8-2 13-6 15 3-11-1-21-7-29z"
        fill={fill}
      />
      {/* Inner flame tongue */}
      <Path d="M64 30c6 7 8 14 6 21l-9 9c2-6 1-12-3-17 4-3 6-8 6-13z" fill={fill} opacity={0.75} />
      {/* Checkmark */}
      <Path
        d="M14 54c3-3 8-3 11 0l17 17 37-37c3-3 8-3 11 0s3 8 0 11L48 87c-3 3-8 3-11 0L14 65c-3-3-3-8 0-11z"
        fill={fillCheck}
      />
    </Svg>
  );
}
