import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

interface ProgressRingProps {
  size: number;
  strokeWidth?: number;
  /** 0..1 */
  progress: number;
  trackColor: string;
  /** Show a glowing knob at the end of the arc */
  knob?: boolean;
  children?: React.ReactNode;
}

/** Orange→amber gradient progress ring with an optional glowing end knob. */
export function ProgressRing({ size, strokeWidth = 12, progress, trackColor, knob = false, children }: ProgressRingProps) {
  const p = Math.max(0, Math.min(1, progress || 0));
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const cx = size / 2;
  // Knob position (ring starts at 12 o'clock, clockwise)
  const angle = p * 2 * Math.PI - Math.PI / 2;
  const kx = cx + r * Math.cos(angle);
  const ky = cx + r * Math.sin(angle);

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#fbbf24" />
            <Stop offset="1" stopColor="#f97316" />
          </LinearGradient>
        </Defs>
        <Circle cx={cx} cy={cx} r={r} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
        {p > 0 && (
          <Circle
            cx={cx}
            cy={cx}
            r={r}
            stroke="url(#ringGrad)"
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={`${c} ${c}`}
            strokeDashoffset={c * (1 - p)}
            strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cx})`}
          />
        )}
        {knob && p > 0 && p < 1 && (
          <>
            <Circle cx={kx} cy={ky} r={strokeWidth * 0.95} fill="#fbbf24" opacity={0.25} />
            <Circle cx={kx} cy={ky} r={strokeWidth * 0.6} fill="#fde68a" />
          </>
        )}
      </Svg>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
        {children}
      </View>
    </View>
  );
}
