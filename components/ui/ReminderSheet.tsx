import { useTheme } from '@/lib/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { GradientButton } from './GradientButton';
import { Sheet } from './Sheet';

const PRESETS = ['07:00', '12:30', '18:00', '21:00'];
const MINUTES = [0, 15, 30, 45];

/** "18:30" -> "6:30 PM" */
export function formatReminder(time: string) {
  const [h, m] = time.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

interface ReminderSheetProps {
  visible: boolean;
  habitTitle: string;
  current?: string;
  onClose: () => void;
  onSave: (time: string | null) => void;
}

export function ReminderSheet({ visible, habitTitle, current, onClose, onSave }: ReminderSheetProps) {
  const { colors } = useTheme();
  const [hour, setHour] = useState(19); // 0-23
  const [minute, setMinute] = useState(0);

  useEffect(() => {
    if (!visible) return;
    const [h, m] = (current ?? '19:00').split(':').map(Number);
    setHour(h);
    setMinute(m);
  }, [visible, current]);

  const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  const isPm = hour >= 12;
  const h12 = hour % 12 === 0 ? 12 : hour % 12;

  const stepHour = (delta: number) => setHour((h) => (h + delta + 24) % 24);
  const stepMinute = (delta: number) => {
    const i = MINUTES.indexOf(minute);
    const next = i === -1 ? 0 : (i + delta + MINUTES.length) % MINUTES.length;
    setMinute(MINUTES[next]);
  };

  const pill = (active: boolean) => ({
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 999,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: active ? colors.primarySoft : colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: active ? colors.primary : 'transparent',
  });

  const Stepper = ({ value, onUp, onDown, label }: { value: string; onUp: () => void; onDown: () => void; label: string }) => (
    <View style={{ alignItems: 'center' }}>
      <Pressable onPress={onUp} accessibilityRole="button" accessibilityLabel={`Increase ${label}`} hitSlop={8} style={{ padding: 6 }}>
        <Ionicons name="chevron-up" size={26} color={colors.textMuted} />
      </Pressable>
      <Text style={{ color: colors.text, fontSize: 44, fontWeight: '800', fontVariant: ['tabular-nums'], minWidth: 70, textAlign: 'center' }}>{value}</Text>
      <Pressable onPress={onDown} accessibilityRole="button" accessibilityLabel={`Decrease ${label}`} hitSlop={8} style={{ padding: 6 }}>
        <Ionicons name="chevron-down" size={26} color={colors.textMuted} />
      </Pressable>
    </View>
  );

  return (
    <Sheet visible={visible} onClose={onClose} title="Daily reminder" subtitle={`When should Sparky remind you about “${habitTitle}”?`}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        {PRESETS.map((p) => (
          <Pressable
            key={p}
            onPress={() => {
              const [h, m] = p.split(':').map(Number);
              setHour(h);
              setMinute(m);
            }}
            accessibilityRole="button"
            style={pill(p === time)}
          >
            <Text style={{ color: p === time ? colors.primary : colors.textSecondary, fontWeight: '700', fontSize: 13 }}>{formatReminder(p)}</Text>
          </Pressable>
        ))}
      </View>

      <View
        accessibilityLabel={`Reminder at ${formatReminder(time)}`}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.backgroundSecondary, borderRadius: 24, paddingVertical: 6, marginBottom: 18 }}
      >
        <Stepper value={String(h12)} label="hour" onUp={() => stepHour(1)} onDown={() => stepHour(-1)} />
        <Text style={{ color: colors.text, fontSize: 40, fontWeight: '800', marginHorizontal: 4 }}>:</Text>
        <Stepper value={String(minute).padStart(2, '0')} label="minutes" onUp={() => stepMinute(1)} onDown={() => stepMinute(-1)} />
        <View style={{ marginLeft: 14, gap: 8 }}>
          {(['AM', 'PM'] as const).map((s) => {
            const active = (s === 'PM') === isPm;
            return (
              <Pressable
                key={s}
                onPress={() => {
                  if (!active) setHour((h) => (h + 12) % 24);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={pill(active)}
              >
                <Text style={{ color: active ? colors.primary : colors.textMuted, fontWeight: '800' }}>{s}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <GradientButton label={`Remind me at ${formatReminder(time)}`} icon="alarm-outline" size="lg" onPress={() => onSave(time)} />
      {current && (
        <Pressable onPress={() => onSave(null)} accessibilityRole="button" style={{ alignItems: 'center', paddingVertical: 14 }}>
          <Text style={{ color: colors.error, fontWeight: '700' }}>Turn off reminder</Text>
        </Pressable>
      )}
    </Sheet>
  );
}
