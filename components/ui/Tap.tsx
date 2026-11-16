import React, { useState } from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';

type TapProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  /** Extra style while the finger is down. Defaults to a subtle fade. */
  pressedStyle?: StyleProp<ViewStyle>;
};

/**
 * Pressable with a pressed-state style.
 *
 * Don't use `style={({ pressed }) => ...}` on Pressable in this app: NativeWind's
 * css-interop drops function styles entirely, so the element loses its layout.
 * This tracks the pressed state itself and passes a plain style array instead.
 */
export function Tap({ style, pressedStyle = { opacity: 0.85 }, onPressIn, onPressOut, ...rest }: TapProps) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      {...rest}
      onPressIn={(e) => {
        setPressed(true);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setPressed(false);
        onPressOut?.(e);
      }}
      style={[style, pressed && pressedStyle]}
    />
  );
}
