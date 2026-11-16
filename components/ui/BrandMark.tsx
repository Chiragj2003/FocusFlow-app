import React from 'react';
import { View } from 'react-native';
import { FlameMark } from './FlameMark';

/** The FocusFlow flame-check mark on a dark rounded tile with a warm glow (app-icon style). */
export function BrandMark({ size = 84 }: { size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        backgroundColor: '#131316',
        borderWidth: 1,
        borderColor: 'rgba(249,115,22,0.35)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        shadowColor: '#f97316',
        shadowOpacity: 0.45,
        shadowRadius: 22,
        shadowOffset: { width: 0, height: 0 },
        elevation: 10,
      }}
    >
      <FlameMark size={size * 0.7} onDark />
    </View>
  );
}
