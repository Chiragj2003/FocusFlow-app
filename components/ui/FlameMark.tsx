import { useTheme } from '@/lib/ThemeContext';
import React from 'react';
import { Image } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

const LOGO = require('@/assets/brand/logo.png');
const LOGO_LIGHT = require('@/assets/brand/logo-light.png');

interface FlameMarkProps {
  size?: number;
  /** 'brand' = official logo art, otherwise a solid-color vector (e.g. '#ffffff') */
  color?: 'brand' | string;
  /** Use the dark-surface logo even in light mode (for always-dark tiles) */
  onDark?: boolean;
}

/**
 * The FocusFlow flame-check mark: a flame rising out of a checkmark.
 * 'brand' shows the official logo art (dark- or light-surface version);
 * any other color draws a single-color vector of the mark.
 */
export function FlameMark({ size = 32, color = 'brand', onDark }: FlameMarkProps) {
  const { isDark } = useTheme();
  if (color === 'brand') {
    // Official logo art: standard on dark surfaces, deeper-orange version on light ones
    const source = onDark || isDark ? LOGO : LOGO_LIGHT;
    return <Image source={source} style={{ width: size, height: size }} resizeMode="contain" accessibilityIgnoresInvertColors />;
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
