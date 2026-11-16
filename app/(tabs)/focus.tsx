import { FlameMark } from '@/components/ui/FlameMark';
import { GradientButton } from '@/components/ui/GradientButton';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { Sheet } from '@/components/ui/Sheet';
import { Tap } from '@/components/ui/Tap';
import { Habit } from '@/lib/api';
import { celebrate, toast } from '@/lib/celebrate';
import { getToday, useCreateFocusSession, useFocusStats, useHabits, useToggleEntry } from '@/lib/hooks';
import { localStorage } from '@/lib/localStorage';
import { messages } from '@/lib/messages';
import { useTheme } from '@/lib/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Mode = 'focus' | 'short' | 'long';
type TimerState = 'idle' | 'running' | 'paused';
type IconName = keyof typeof Ionicons.glyphMap;

const MODES: { id: Mode; label: string; icon: IconName; minutes?: number }[] = [
  { id: 'focus', label: 'Focus', icon: 'flame-outline' },
  { id: 'short', label: 'Short break', icon: 'cafe-outline', minutes: 5 },
  { id: 'long', label: 'Long break', icon: 'leaf-outline', minutes: 15 },
];

const FOCUS_PRESETS = [15, 25, 45, 60];

const SOUNDS: { id: string; label: string; icon: IconName; source: number | null }[] = [
  { id: 'none', label: 'Silence', icon: 'volume-mute-outline', source: null },
  { id: 'rain', label: 'Rain', icon: 'rainy-outline', source: require('@/assets/audio/rain.m4a') },
  { id: 'ocean', label: 'Ocean waves', icon: 'water-outline', source: require('@/assets/audio/ocean.m4a') },
  { id: 'forest', label: 'Forest', icon: 'leaf-outline', source: require('@/assets/audio/forest.m4a') },
  { id: 'cafe', label: 'Café', icon: 'cafe-outline', source: require('@/assets/audio/cafe.m4a') },
  { id: 'brown_noise', label: 'Brown noise', icon: 'pulse-outline', source: require('@/assets/audio/brown_noise.m4a') },
  { id: 'lofi_chill', label: 'Lo-fi chill', icon: 'musical-notes-outline', source: require('@/assets/audio/lofi_chill.m4a') },
  { id: 'lofi_rain', label: 'Lo-fi rainy night', icon: 'headset-outline', source: require('@/assets/audio/lofi_rain.m4a') },
];

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export default function FocusTimerScreen() {
  const { isDark, colors } = useTheme();
  const { width } = useWindowDimensions();

  const [mode, setMode] = useState<Mode>('focus');
  const [focusMinutes, setFocusMinutes] = useState(25);
  const [timerState, setTimerState] = useState<TimerState>('idle');
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);
  const [selectedSound, setSelectedSound] = useState(SOUNDS[0]);
  const [sheet, setSheet] = useState<'sound' | 'habit' | 'length' | null>(null);
  const [customInput, setCustomInput] = useState('');

  // Timer is driven by a wall-clock end time, so it keeps correct time when
  // the app goes to the background or the JS thread is busy.
  const endAtRef = useRef<number | null>(null);
  const finishingRef = useRef(false);

  const { data: habits } = useHabits(true);
  const { data: stats, refetch: refetchStats } = useFocusStats();
  const createSession = useCreateFocusSession();
  const toggleEntry = useToggleEntry();

  const player = useAudioPlayer(selectedSound.source);

  const durationSec = (mode === 'focus' ? focusMinutes : MODES.find((m) => m.id === mode)!.minutes!) * 60;
  const progress = timerState === 'idle' ? 0 : 1 - timeLeft / durationSec;
  const ringSize = Math.min(width * 0.72, 300);
  const selectedHabit = habits?.find((h: Habit) => h.id === selectedHabitId);

  // Keep the display in sync with the chosen length while idle
  useEffect(() => {
    if (timerState === 'idle') setTimeLeft(durationSec);
  }, [durationSec, timerState]);

  // Ambient sound follows the timer state (also when the sound is changed mid-session)
  useEffect(() => {
    try {
      player.loop = true;
      if (timerState === 'running' && selectedSound.source) player.play();
      else player.pause();
    } catch (e) {
      console.warn('[Focus] Sound control failed:', e);
    }
  }, [player, timerState, selectedSound]);

  const finishSession = useCallback(async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    endAtRef.current = null;
    setTimerState('idle');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    try {
      if (mode !== 'focus') {
        celebrate({ title: 'Break’s over', message: messages.breakDone(), mood: 'happy', cta: 'Let’s focus' });
        setMode('focus');
        return;
      }

      const seconds = durationSec;
      const minutes = Math.round(seconds / 60);

      // Auto-log a "Deep Work" habit for sessions of 25+ minutes
      if (seconds >= 25 * 60) {
        const deepWork = habits?.find((h: Habit) => h.title.toLowerCase() === 'deep work');
        if (deepWork) toggleEntry.mutate({ habitId: deepWork.id, entryDate: getToday(), completed: true });
      }

      const session = { habitId: selectedHabitId || undefined, duration: seconds };
      try {
        await createSession.mutateAsync(session);
        refetchStats();
      } catch (error) {
        // Offline or server error: keep the session and send it later
        console.warn('[Focus] Saving session failed, queued for sync:', error);
        await localStorage.enqueueAction('CREATE_FOCUS', { ...session, completedAt: new Date().toISOString() });
        toast({ tone: 'info', message: 'Session saved on your phone. It will sync when you’re online.' });
      }

      celebrate({
        title: 'Session complete!',
        message: messages.focusDone(minutes),
        mood: 'focus',
        highlight: `${minutes} min focused`,
        highlightIcon: 'time',
        cta: 'Nice',
      });
    } finally {
      finishingRef.current = false;
    }
  }, [mode, durationSec, habits, selectedHabitId, createSession, refetchStats, toggleEntry]);

  // Tick
  useEffect(() => {
    if (timerState !== 'running') return;
    const tick = () => {
      if (!endAtRef.current) return;
      const left = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
      setTimeLeft(left);
      if (left === 0) finishSession();
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [timerState, finishSession]);

  const start = () => {
    const remaining = timerState === 'paused' ? timeLeft : durationSec;
    endAtRef.current = Date.now() + remaining * 1000;
    setTimerState('running');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  };

  const pause = () => {
    endAtRef.current = null;
    setTimerState('paused');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const reset = () => {
    endAtRef.current = null;
    setTimerState('idle');
    setTimeLeft(durationSec);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const skip = () => {
    // Skipping a break goes back to focus; skipping focus ends without saving
    endAtRef.current = null;
    setTimerState('idle');
    if (mode !== 'focus') setMode('focus');
  };

  const switchMode = (m: Mode) => {
    if (timerState !== 'idle') return;
    setMode(m);
    Haptics.selectionAsync().catch(() => {});
  };

  const applyCustom = () => {
    const val = parseInt(customInput, 10);
    if (!isNaN(val) && val > 0 && val <= 240) {
      setFocusMinutes(val);
      setSheet(null);
      setCustomInput('');
    } else {
      toast({ tone: 'error', message: 'Enter a length between 1 and 240 minutes.' });
    }
  };

  const running = timerState === 'running';
  const card = { backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1 } as const;
  const roundBtn = (size: number) => ({
    ...card,
    width: size,
    height: size,
    borderRadius: size / 2,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  });
  const statusLabel = running ? (mode === 'focus' ? 'Focusing' : 'On a break') : timerState === 'paused' ? 'Paused' : 'Ready';

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{ marginTop: 8, marginBottom: 16 }}>
          <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.5 }}>Focus</Text>
          <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 2 }}>One task. Full attention.</Text>
        </View>

        {/* Mode switch */}
        <View style={{ ...card, flexDirection: 'row', borderRadius: 999, padding: 4, marginBottom: 24, opacity: timerState === 'idle' ? 1 : 0.6 }}>
          {MODES.map((m) => {
            const active = mode === m.id;
            return (
              <Pressable
                key={m.id}
                onPress={() => switchMode(m.id)}
                disabled={timerState !== 'idle'}
                accessibilityRole="tab"
                accessibilityState={{ selected: active, disabled: timerState !== 'idle' }}
                accessibilityLabel={m.label}
                style={{
                  flex: 1,
                  height: 40,
                  borderRadius: 999,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: active ? colors.primary : 'transparent',
                }}
              >
                <Ionicons name={m.icon} size={16} color={active ? '#ffffff' : colors.textMuted} />
                <Text style={{ color: active ? '#ffffff' : colors.textMuted, fontWeight: '700', fontSize: 13, marginLeft: 5 }} numberOfLines={1}>
                  {m.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Ring */}
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <View
            style={{
              borderRadius: ringSize,
              shadowColor: '#f97316',
              shadowOpacity: isDark ? (running ? 0.45 : 0.2) : 0.15,
              shadowRadius: 40,
              shadowOffset: { width: 0, height: 0 },
            }}
          >
            <ProgressRing size={ringSize} strokeWidth={14} progress={progress} trackColor={isDark ? '#26262b' : '#ececef'} knob>
              <FlameMark size={ringSize * 0.22} />
              <Text
                accessibilityRole="timer"
                accessibilityLabel={`${Math.floor(timeLeft / 60)} minutes ${timeLeft % 60} seconds left`}
                style={{ color: colors.text, fontSize: ringSize * 0.2, fontWeight: '800', fontVariant: ['tabular-nums'], marginTop: 6, letterSpacing: -1 }}
              >
                {formatTime(timeLeft)}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primarySoft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, marginTop: 6 }}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: running ? colors.success : timerState === 'paused' ? colors.warning : colors.primary, marginRight: 6 }} />
                <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12, letterSpacing: 0.5 }}>{statusLabel}</Text>
              </View>
            </ProgressRing>
          </View>
        </View>

        {/* Quick length (focus mode, before starting) */}
        {mode === 'focus' && timerState === 'idle' && (
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 22 }}>
            {FOCUS_PRESETS.map((m) => {
              const active = focusMinutes === m;
              return (
                <Pressable
                  key={m}
                  onPress={() => {
                    setFocusMinutes(m);
                    Haptics.selectionAsync().catch(() => {});
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${m} minutes`}
                  accessibilityState={{ selected: active }}
                  style={{
                    flex: 1,
                    height: 40,
                    borderRadius: 999,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: active ? colors.primarySoft : colors.card,
                    borderWidth: 1,
                    borderColor: active ? colors.primary : colors.cardBorder,
                  }}
                >
                  <Text style={{ color: active ? colors.primary : colors.textSecondary, fontWeight: '800', fontSize: 14 }}>{m}m</Text>
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => setSheet('length')}
              accessibilityRole="button"
              accessibilityLabel="Custom length"
              style={{
                flex: 1.2,
                height: 40,
                borderRadius: 999,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: FOCUS_PRESETS.includes(focusMinutes) ? colors.card : colors.primarySoft,
                borderWidth: 1,
                borderColor: FOCUS_PRESETS.includes(focusMinutes) ? colors.cardBorder : colors.primary,
              }}
            >
              <Text style={{ color: FOCUS_PRESETS.includes(focusMinutes) ? colors.textSecondary : colors.primary, fontWeight: '800', fontSize: 14 }}>
                {FOCUS_PRESETS.includes(focusMinutes) ? 'Custom' : `${focusMinutes}m`}
              </Text>
            </Pressable>
          </View>
        )}

        {/* Controls */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 22, marginBottom: 24 }}>
          <Pressable onPress={reset} disabled={timerState === 'idle'} accessibilityRole="button" accessibilityLabel="Reset timer" style={[roundBtn(58), { opacity: timerState === 'idle' ? 0.4 : 1 }]}>
            <Ionicons name="refresh" size={24} color={colors.text} />
          </Pressable>

          <Tap
            onPress={running ? pause : start}
            accessibilityRole="button"
            accessibilityLabel={running ? 'Pause' : timerState === 'paused' ? 'Resume' : 'Start'}
            pressedStyle={{ transform: [{ scale: 0.95 }] }}
            style={{
              width: 88,
              height: 88,
              borderRadius: 44,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.primary,
              shadowColor: '#f97316',
              shadowOpacity: 0.5,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 6 },
              elevation: 8,
            }}
          >
            <Ionicons name={running ? 'pause' : 'play'} size={38} color="#ffffff" style={{ marginLeft: running ? 0 : 4 }} />
          </Tap>

          <Pressable onPress={skip} disabled={timerState === 'idle'} accessibilityRole="button" accessibilityLabel={mode === 'focus' ? 'End session without saving' : 'Skip break'} style={[roundBtn(58), { opacity: timerState === 'idle' ? 0.4 : 1 }]}>
            <Ionicons name={mode === 'focus' ? 'stop' : 'play-skip-forward'} size={22} color={colors.text} />
          </Pressable>
        </View>

        {/* Session settings */}
        <View style={{ ...card, flexDirection: 'row', borderRadius: 24, marginBottom: 20 }}>
          {[
            { key: 'sound' as const, icon: selectedSound.icon, label: 'Sound', value: selectedSound.label },
            { key: 'habit' as const, icon: 'link-outline' as IconName, label: 'Habit', value: selectedHabit?.title ?? 'None' },
            { key: 'length' as const, icon: 'hourglass-outline' as IconName, label: 'Length', value: mode === 'focus' ? `${focusMinutes} min` : `${durationSec / 60} min` },
          ].map((item, i) => (
            <Tap
              key={item.key}
              onPress={() => setSheet(item.key)}
              disabled={item.key === 'length' && (mode !== 'focus' || timerState !== 'idle')}
              accessibilityRole="button"
              accessibilityLabel={`${item.label}: ${item.value}`}
              pressedStyle={{ opacity: 0.7 }}
              style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: 14,
                paddingHorizontal: 6,
                borderLeftWidth: i > 0 ? 1 : 0,
                borderLeftColor: colors.cardBorder,
              }}
            >
              <Ionicons name={item.icon} size={20} color={colors.primary} />
              <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '600', marginTop: 6 }}>{item.label}</Text>
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700', marginTop: 2, textAlign: 'center' }} numberOfLines={1}>
                {item.value}
              </Text>
            </Tap>
          ))}
        </View>

        {/* Stats */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {[
            { icon: 'today-outline' as IconName, value: `${stats?.todayMinutes ?? 0}`, unit: 'min', label: 'Today' },
            { icon: 'calendar-outline' as IconName, value: `${stats?.weekMinutes ?? 0}`, unit: 'min', label: 'This week' },
            { icon: 'checkmark-done-outline' as IconName, value: `${stats?.totalSessions ?? 0}`, unit: '', label: 'Sessions' },
          ].map((s) => (
            <View key={s.label} style={{ ...card, flex: 1, borderRadius: 20, padding: 14 }}>
              <Ionicons name={s.icon} size={18} color={colors.primary} />
              <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 8 }}>
                <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>{s.value}</Text>
                {!!s.unit && <Text style={{ color: colors.textMuted, fontSize: 12, marginLeft: 3 }}>{s.unit}</Text>}
              </View>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{s.label}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Sound picker */}
      <Sheet visible={sheet === 'sound'} onClose={() => setSheet(null)} title="Ambient sound" subtitle="Plays while the timer runs.">
        <ScrollView style={{ flexGrow: 0 }} showsVerticalScrollIndicator={false}>
          {SOUNDS.map((s) => (
            <OptionRow
              key={s.id}
              icon={s.icon}
              label={s.label}
              selected={selectedSound.id === s.id}
              colors={colors}
              onPress={() => {
                setSelectedSound(s);
                setSheet(null);
              }}
            />
          ))}
        </ScrollView>
      </Sheet>

      {/* Habit picker */}
      <Sheet visible={sheet === 'habit'} onClose={() => setSheet(null)} title="Link a habit" subtitle="The session counts toward this habit.">
        <ScrollView style={{ flexGrow: 0 }} showsVerticalScrollIndicator={false}>
          <OptionRow icon="close-circle-outline" label="No habit" selected={!selectedHabitId} colors={colors} onPress={() => { setSelectedHabitId(null); setSheet(null); }} />
          {habits?.map((h: Habit) => (
            <OptionRow
              key={h.id}
              dotColor={h.color}
              label={h.title}
              selected={selectedHabitId === h.id}
              colors={colors}
              onPress={() => {
                setSelectedHabitId(h.id);
                setSheet(null);
              }}
            />
          ))}
          {(!habits || habits.length === 0) && (
            <Text style={{ color: colors.textMuted, textAlign: 'center', paddingVertical: 16 }}>Add a habit first to link it here.</Text>
          )}
        </ScrollView>
      </Sheet>

      {/* Length picker */}
      <Sheet visible={sheet === 'length'} onClose={() => setSheet(null)} title="Session length" subtitle="How long do you want to focus?">
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          {FOCUS_PRESETS.map((m) => {
            const active = focusMinutes === m;
            return (
              <Pressable
                key={m}
                onPress={() => {
                  setFocusMinutes(m);
                  setSheet(null);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={{
                  flex: 1,
                  height: 56,
                  borderRadius: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: active ? colors.primarySoft : colors.backgroundSecondary,
                  borderWidth: 1,
                  borderColor: active ? colors.primary : 'transparent',
                }}
              >
                <Text style={{ color: active ? colors.primary : colors.text, fontSize: 18, fontWeight: '800' }}>{m}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 11 }}>min</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '700', marginBottom: 8 }}>Custom</Text>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <TextInput
            value={customInput}
            onChangeText={setCustomInput}
            keyboardType="number-pad"
            placeholder="Minutes"
            placeholderTextColor={colors.textMuted}
            maxLength={3}
            accessibilityLabel="Custom length in minutes"
            style={{ flex: 1, backgroundColor: colors.backgroundSecondary, color: colors.text, borderRadius: 16, paddingHorizontal: 16, height: 50, fontSize: 16, fontWeight: '700' }}
          />
          <GradientButton label="Set" onPress={applyCustom} />
        </View>
      </Sheet>
    </SafeAreaView>
  );
}

function OptionRow({ icon, dotColor, label, selected, colors, onPress }: {
  icon?: IconName;
  dotColor?: string;
  label: string;
  selected: boolean;
  colors: any;
  onPress: () => void;
}) {
  return (
    <Tap
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      pressedStyle={selected ? undefined : { backgroundColor: colors.backgroundTertiary }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 16,
        marginBottom: 8,
        backgroundColor: selected ? colors.primarySoft : colors.backgroundSecondary,
        borderWidth: 1,
        borderColor: selected ? 'rgba(249,115,22,0.45)' : 'transparent',
      }}
    >
      <View style={{ width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card, marginRight: 12 }}>
        {dotColor ? (
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: dotColor }} />
        ) : (
          <Ionicons name={icon ?? 'ellipse-outline'} size={18} color={selected ? colors.primary : colors.textMuted} />
        )}
      </View>
      <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600', flex: 1 }} numberOfLines={1}>{label}</Text>
      {selected && <Ionicons name="checkmark-circle" size={22} color={colors.primary} />}
    </Tap>
  );
}
