import { HabitGridMobile } from '@/components/HabitGridMobile';
import { GradientButton } from '@/components/ui/GradientButton';
import { Mascot } from '@/components/ui/Mascot';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { formatReminder, ReminderSheet } from '@/components/ui/ReminderSheet';
import { ActionSheet, ConfirmSheet, Sheet } from '@/components/ui/Sheet';
import { toast } from '@/lib/celebrate';
import { localStorage } from '@/lib/localStorage';
import { notificationsManager } from '@/lib/notifications';
import {
  getToday,
  useArchiveHabit,
  useCreateHabit,
  useDeleteHabit,
  useEntries,
  useHabits,
  useRestoreHabit,
  useToggleEntry,
} from '@/lib/hooks';
import { messages } from '@/lib/messages';
import { HABIT_TEMPLATES, getTemplateCategories } from '@/lib/templates';
import { useTheme } from '@/lib/ThemeContext';
import type { Habit, HabitEntry, HabitTemplate } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Habit colors matching the web app
const habitColors = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899',
];

const categories = ['Health', 'Learning', 'Mindfulness', 'Productivity', 'Fitness', 'Other'];

const normalizeTitle = (t: string) => t.trim().toLowerCase().replace(/\s+/g, ' ');

export default function HabitsScreen() {
  const router = useRouter();
  const { isDark, colors } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [selectedTemplateCategory, setSelectedTemplateCategory] = useState<string | null>(null);
  const [manageHabit, setManageHabit] = useState<Habit | null>(null);
  const [confirm, setConfirm] = useState<{ kind: 'archive' | 'delete'; habit: Habit } | null>(null);
  const [reminderHabit, setReminderHabit] = useState<Habit | null>(null);
  const [reminders, setReminders] = useState<Record<string, string>>({});

  useEffect(() => {
    localStorage.getHabitReminders().then(setReminders).catch(() => {});
  }, []);

  const saveReminder = async (habit: Habit, time: string | null) => {
    setReminderHabit(null);
    if (time) {
      const allowed = await notificationsManager.requestPermissions();
      if (!allowed) {
        toast({ tone: 'error', message: 'Notifications are off. Allow them in your phone settings to get reminders.' });
        return;
      }
    }
    await localStorage.setHabitReminder(habit.id, time);
    setReminders(await localStorage.getHabitReminders());
    await notificationsManager.updateScheduledReminders('habit reminder changed');
    toast(time ? `Reminder set for ${formatReminder(time)} daily.` : `Reminder for “${habit.title}” turned off.`);
  };

  // Form state
  const [newHabitTitle, setNewHabitTitle] = useState('');
  const [newHabitDescription, setNewHabitDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState(habitColors[1]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [goalType, setGoalType] = useState<'binary' | 'duration' | 'quantity'>('binary');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalUnit, setGoalUnit] = useState('');

  // Last 5 days (oldest first), local dates
  const today = getToday();
  const last5Days = useMemo(() => {
    const days: string[] = [];
    for (let i = 4; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    }
    return days;
  }, []);

  // Data
  const { data: activeHabits, isLoading: habitsLoading, refetch: refetchHabits } = useHabits(true);
  const { data: archivedHabits, refetch: refetchArchived } = useHabits(false);
  const { data: entries, refetch: refetchEntries } = useEntries(last5Days[0], last5Days[4]);

  // Mutations
  const createHabit = useCreateHabit();
  const archiveHabit = useArchiveHabit();
  const restoreHabit = useRestoreHabit();
  const deleteHabit = useDeleteHabit();
  const toggleEntry = useToggleEntry();

  const habits = showArchived ? archivedHabits : activeHabits;
  const activeCount = activeHabits?.length || 0;

  const completedToday = useMemo(() => {
    if (!entries || !activeHabits) return 0;
    const done = new Set(
      entries.filter((e: HabitEntry) => e.completed && e.entryDate.split('T')[0] === today).map((e: HabitEntry) => e.habitId)
    );
    return activeHabits.filter((h: Habit) => done.has(h.id)).length;
  }, [entries, activeHabits, today]);

  const progress = activeCount > 0 ? completedToday / activeCount : 0;

  const activeTitles = useMemo(
    () => new Set((activeHabits || []).map((h: Habit) => normalizeTitle(h.title))),
    [activeHabits]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchHabits(), refetchArchived(), refetchEntries()]);
    setRefreshing(false);
  }, [refetchHabits, refetchArchived, refetchEntries]);

  const handleGridToggle = useCallback(
    (habitId: string, date: string, completed: boolean) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      toggleEntry.mutate({ habitId, entryDate: date, completed });
    },
    [toggleEntry]
  );

  const resetForm = () => {
    setNewHabitTitle('');
    setNewHabitDescription('');
    setSelectedCategory('');
    setGoalType('binary');
    setGoalTarget('');
    setGoalUnit('');
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setShowTemplates(false);
  };

  const openNewHabit = () => {
    setShowTemplates(false);
    setIsModalOpen(true);
  };

  const openTemplates = () => {
    setShowTemplates(true);
    setIsModalOpen(true);
  };

  const handleAddHabit = useCallback(() => {
    const title = newHabitTitle.trim();
    if (!title) {
      toast({ tone: 'error', message: 'Give your habit a name first.' });
      return;
    }
    if (activeTitles.has(normalizeTitle(title))) {
      toast({ tone: 'error', message: `You already have a habit called “${title}”.` });
      return;
    }

    createHabit.mutate(
      {
        title,
        description: newHabitDescription.trim() || undefined,
        category: selectedCategory || undefined,
        color: selectedColor,
        goalType,
        goalTarget: goalTarget ? parseInt(goalTarget, 10) : undefined,
        unit: goalUnit || undefined,
      },
      {
        onSuccess: () => toast(activeCount === 0 ? messages.firstHabit() : messages.habitAdded(title)),
        onError: () => toast({ tone: 'error', message: 'Couldn’t save this habit. Please try again.' }),
      }
    );
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    resetForm();
    closeModal();
  }, [newHabitTitle, newHabitDescription, selectedCategory, selectedColor, goalType, goalTarget, goalUnit, createHabit, activeTitles, activeCount]);

  const handleAddTemplate = useCallback(
    (template: HabitTemplate) => {
      if (activeTitles.has(normalizeTitle(template.title))) {
        toast({ tone: 'info', message: `“${template.title}” is already in your habits.` });
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      createHabit.mutate(
        {
          title: template.title,
          description: template.description,
          category: template.category,
          color: template.color,
          goalType: template.goalType,
          goalTarget: template.goalTarget,
          unit: template.unit,
        },
        {
          onSuccess: () => toast(messages.habitAdded(template.title)),
          onError: () => toast({ tone: 'error', message: 'Couldn’t add this template. Please try again.' }),
        }
      );
    },
    [createHabit, activeTitles]
  );

  const runConfirm = () => {
    if (!confirm) return;
    const { kind, habit } = confirm;
    if (kind === 'archive') {
      archiveHabit.mutate(habit.id, { onSuccess: () => toast(`“${habit.title}” archived.`) });
    } else {
      deleteHabit.mutate(habit.id, { onSuccess: () => toast(`“${habit.title}” deleted.`) });
    }
  };

  const restore = (habit: Habit) => {
    restoreHabit.mutate(habit.id, { onSuccess: () => toast(`“${habit.title}” is back in your habits.`) });
  };

  // Only show the loading screen on the very first load with no cached data
  if (habitsLoading && !activeHabits && !refreshing) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.textMuted, marginTop: 12 }}>Loading your habits…</Text>
      </SafeAreaView>
    );
  }

  const card = { backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1, borderRadius: 24 } as const;
  const chip = (active: boolean) => ({
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: active ? colors.primarySoft : colors.card,
    borderColor: active ? 'rgba(249,115,22,0.45)' : colors.cardBorder,
  });

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, marginBottom: 18 }}>
          {showArchived && (
            <Pressable
              onPress={() => setShowArchived(false)}
              accessibilityRole="button"
              accessibilityLabel="Back to habits"
              style={{ ...card, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}
            >
              <Ionicons name="arrow-back" size={20} color={colors.text} />
            </Pressable>
          )}
          <View style={{ flex: 1 }}>
            <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.5 }}>
              {showArchived ? 'Archived' : 'Habits'}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 2 }}>
              {showArchived ? 'Restore a habit to start tracking it again' : 'Small steps, every day'}
            </Text>
          </View>
        </View>

        {!showArchived && (
          <>
            {/* Today's progress */}
            {activeCount > 0 && (
              <View style={{ ...card, padding: 18, flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '600' }}>Today</Text>
                  <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', marginTop: 2 }}>
                    {completedToday} of {activeCount} done
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>
                    {messages.greetingLine(completedToday, activeCount)}
                  </Text>
                </View>
                <ProgressRing size={72} strokeWidth={8} progress={progress} trackColor={colors.backgroundSecondary}>
                  <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>{Math.round(progress * 100)}%</Text>
                </ProgressRing>
              </View>
            )}

            {/* Primary actions */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
              <GradientButton label="New habit" icon="add" onPress={openNewHabit} style={{ flex: 1 }} />
              <GradientButton
                label="Templates"
                icon="sparkles-outline"
                variant="ghost"
                ghostColors={{ bg: colors.card, text: colors.text, border: colors.cardBorder }}
                onPress={openTemplates}
              />
            </View>

            {/* Secondary shortcuts */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 6 }} style={{ marginBottom: 18 }}>
              <Pressable onPress={() => setShowArchived(true)} accessibilityRole="button" style={chip(false)}>
                <Ionicons name="archive-outline" size={15} color={colors.textMuted} />
                <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 13, marginLeft: 6 }}>
                  Archived ({archivedHabits?.length || 0})
                </Text>
              </Pressable>
              <Pressable onPress={() => router.push('/focus')} accessibilityRole="button" style={chip(false)}>
                <Ionicons name="timer-outline" size={15} color={colors.textMuted} />
                <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 13, marginLeft: 6 }}>Focus timer</Text>
              </Pressable>
              <Pressable onPress={() => router.push('/achievements')} accessibilityRole="button" style={chip(false)}>
                <Ionicons name="trophy-outline" size={15} color={colors.textMuted} />
                <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 13, marginLeft: 6 }}>Challenges</Text>
              </Pressable>
            </ScrollView>
          </>
        )}

        {/* Section header */}
        {habits && habits.length > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>
              {showArchived ? 'Archived habits' : 'Your habits'}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>
              {habits.length} {habits.length === 1 ? 'habit' : 'habits'}
            </Text>
          </View>
        )}

        {/* Active habits grid */}
        {!showArchived && habits && habits.length > 0 && (
          <HabitGridMobile
            habits={habits}
            entries={entries ?? []}
            days={last5Days}
            onToggle={handleGridToggle}
            onManage={setManageHabit}
            colors={colors}
          />
        )}

        {/* Archived list */}
        {showArchived &&
          habits?.map((habit: Habit) => (
            <View key={habit.id} style={{ ...card, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: habit.color || colors.primary, marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }} numberOfLines={1}>{habit.title}</Text>
                {habit.category && <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{habit.category}</Text>}
              </View>
              <Pressable
                onPress={() => restore(habit)}
                accessibilityRole="button"
                accessibilityLabel={`Restore ${habit.title}`}
                style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft, marginRight: 8 }}
              >
                <Ionicons name="refresh" size={18} color={colors.primary} />
              </Pressable>
              <Pressable
                onPress={() => setConfirm({ kind: 'delete', habit })}
                accessibilityRole="button"
                accessibilityLabel={`Delete ${habit.title}`}
                style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(239,68,68,0.12)' }}
              >
                <Ionicons name="trash-outline" size={18} color={colors.error} />
              </Pressable>
            </View>
          ))}

        {/* Empty states */}
        {(!habits || habits.length === 0) && !showArchived && (
          <View style={{ ...card, alignItems: 'center', paddingVertical: 28, paddingHorizontal: 24 }}>
            <Mascot mood="sleeping" size={150} />
            <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800', marginTop: 4 }}>No habits yet</Text>
            <Text style={{ color: colors.textMuted, fontSize: 14, textAlign: 'center', marginTop: 6, marginBottom: 20, lineHeight: 20 }}>
              Start with one small habit. You can add more anytime.
            </Text>
            <GradientButton label="Add a habit" icon="add" onPress={openNewHabit} style={{ alignSelf: 'stretch' }} />
            <Pressable onPress={openTemplates} accessibilityRole="button" style={{ marginTop: 14, padding: 6 }}>
              <Text style={{ color: colors.primary, fontWeight: '700' }}>Browse templates</Text>
            </Pressable>
          </View>
        )}

        {(!habits || habits.length === 0) && showArchived && (
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <Ionicons name="archive-outline" size={44} color={colors.textMuted} />
            <Text style={{ color: colors.textMuted, marginTop: 10 }}>No archived habits</Text>
          </View>
        )}
      </ScrollView>

      {/* New habit / templates sheet */}
      <Sheet
        visible={isModalOpen}
        onClose={closeModal}
        title={showTemplates ? 'Templates' : 'New habit'}
        subtitle={showTemplates ? 'Tap + to add a habit. Add as many as you like.' : 'What do you want to do every day?'}
      >
        {showTemplates ? (
          <ScrollView style={{ flexGrow: 0 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 14 }}>
              {[null, ...getTemplateCategories()].map((cat) => {
                const active = selectedTemplateCategory === cat;
                return (
                  <Pressable key={cat ?? 'all'} onPress={() => setSelectedTemplateCategory(cat)} accessibilityRole="button" style={chip(active)}>
                    <Text style={{ color: active ? colors.primary : colors.textSecondary, fontWeight: '700', fontSize: 13 }}>{cat ?? 'All'}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {HABIT_TEMPLATES.filter((t) => !selectedTemplateCategory || t.category === selectedTemplateCategory).map((template) => {
              const added = activeTitles.has(normalizeTitle(template.title));
              return (
                <View
                  key={template.id}
                  style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 20, backgroundColor: colors.backgroundSecondary, marginBottom: 10 }}
                >
                  <View style={{ width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: `${template.color}22`, marginRight: 12 }}>
                    <Text style={{ fontSize: 22 }}>{template.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>{template.title}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                      {template.goalType !== 'binary' && template.goalTarget ? `${template.goalTarget} ${template.unit ?? ''} · ` : ''}
                      {template.category}
                    </Text>
                  </View>
                  {added ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, height: 34, borderRadius: 999, backgroundColor: 'rgba(34,197,94,0.14)' }}>
                      <Ionicons name="checkmark" size={16} color={colors.success} />
                      <Text style={{ color: colors.success, fontWeight: '700', fontSize: 12, marginLeft: 4 }}>Added</Text>
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => handleAddTemplate(template)}
                      accessibilityRole="button"
                      accessibilityLabel={`Add ${template.title}`}
                      hitSlop={6}
                      style={({ pressed }) => ({
                        width: 38,
                        height: 38,
                        borderRadius: 19,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: colors.primary,
                        transform: [{ scale: pressed ? 0.92 : 1 }],
                      })}
                    >
                      <Ionicons name="add" size={22} color="#ffffff" />
                    </Pressable>
                  )}
                </View>
              );
            })}

            <Pressable onPress={() => setShowTemplates(false)} accessibilityRole="button" style={{ alignItems: 'center', paddingVertical: 14 }}>
              <Text style={{ color: colors.primary, fontWeight: '700' }}>Create your own habit instead</Text>
            </Pressable>
          </ScrollView>
        ) : (
          <ScrollView style={{ flexGrow: 0 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <FieldLabel text="Name" colors={colors} />
            <TextInput
              style={inputStyle(colors)}
              placeholder="e.g. Morning walk"
              placeholderTextColor={colors.textMuted}
              value={newHabitTitle}
              onChangeText={setNewHabitTitle}
              accessibilityLabel="Habit name"
              returnKeyType="done"
            />

            <FieldLabel text="Description (optional)" colors={colors} />
            <TextInput
              style={[inputStyle(colors), { minHeight: 70, textAlignVertical: 'top' }]}
              placeholder="Why does this matter to you?"
              placeholderTextColor={colors.textMuted}
              value={newHabitDescription}
              onChangeText={setNewHabitDescription}
              accessibilityLabel="Habit description"
              multiline
            />

            <FieldLabel text="Goal" colors={colors} />
            <View style={{ flexDirection: 'row', backgroundColor: colors.backgroundSecondary, borderRadius: 999, padding: 4, marginBottom: 16 }}>
              {(['binary', 'duration', 'quantity'] as const).map((type) => {
                const active = goalType === type;
                return (
                  <Pressable
                    key={type}
                    onPress={() => setGoalType(type)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={{ flex: 1, height: 38, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? colors.card : 'transparent' }}
                  >
                    <Text style={{ color: active ? colors.text : colors.textMuted, fontWeight: '700', fontSize: 13 }}>
                      {type === 'binary' ? 'Yes / No' : type === 'duration' ? 'Duration' : 'Count'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {goalType !== 'binary' && (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <FieldLabel text="Target" colors={colors} />
                  <TextInput
                    style={inputStyle(colors)}
                    placeholder="e.g. 30"
                    placeholderTextColor={colors.textMuted}
                    value={goalTarget}
                    onChangeText={setGoalTarget}
                    keyboardType="numeric"
                    accessibilityLabel="Target"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <FieldLabel text="Unit" colors={colors} />
                  <TextInput
                    style={inputStyle(colors)}
                    placeholder={goalType === 'duration' ? 'minutes' : 'times'}
                    placeholderTextColor={colors.textMuted}
                    value={goalUnit}
                    onChangeText={setGoalUnit}
                    accessibilityLabel="Unit"
                  />
                </View>
              </View>
            )}

            <FieldLabel text="Category" colors={colors} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ marginBottom: 16 }}>
              {categories.map((cat) => {
                const active = selectedCategory === cat;
                return (
                  <Pressable key={cat} onPress={() => setSelectedCategory(active ? '' : cat)} accessibilityRole="button" accessibilityState={{ selected: active }} style={chip(active)}>
                    <Text style={{ color: active ? colors.primary : colors.textSecondary, fontWeight: '700', fontSize: 13 }}>{cat}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <FieldLabel text="Color" colors={colors} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 22 }}>
              {habitColors.map((color) => (
                <Pressable
                  key={color}
                  onPress={() => setSelectedColor(color)}
                  accessibilityRole="button"
                  accessibilityLabel={`Color ${color}`}
                  accessibilityState={{ selected: selectedColor === color }}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: color,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: selectedColor === color ? 3 : 0,
                    borderColor: colors.card,
                  }}
                >
                  {selectedColor === color && <Ionicons name="checkmark" size={18} color="#ffffff" />}
                </Pressable>
              ))}
            </View>

            <GradientButton label="Add habit" icon="checkmark" size="lg" onPress={handleAddHabit} disabled={!newHabitTitle.trim()} />
            <Pressable onPress={() => setShowTemplates(true)} accessibilityRole="button" style={{ alignItems: 'center', paddingVertical: 14 }}>
              <Text style={{ color: colors.primary, fontWeight: '700' }}>Or pick a template</Text>
            </Pressable>
          </ScrollView>
        )}
      </Sheet>

      {/* Manage a habit */}
      <ActionSheet
        visible={!!manageHabit}
        onClose={() => setManageHabit(null)}
        title={manageHabit?.title ?? ''}
        subtitle={
          manageHabit && reminders[manageHabit.id]
            ? `Reminder at ${formatReminder(reminders[manageHabit.id])}`
            : 'Manage this habit'
        }
        actions={
          manageHabit
            ? [
                {
                  label: reminders[manageHabit.id] ? 'Change reminder' : 'Set a reminder',
                  icon: 'alarm-outline',
                  onPress: () => setReminderHabit(manageHabit),
                },
                { label: 'Archive', icon: 'archive-outline', onPress: () => setConfirm({ kind: 'archive', habit: manageHabit }) },
                { label: 'Delete', icon: 'trash-outline', destructive: true, onPress: () => setConfirm({ kind: 'delete', habit: manageHabit }) },
              ]
            : []
        }
      />

      <ReminderSheet
        visible={!!reminderHabit}
        habitTitle={reminderHabit?.title ?? ''}
        current={reminderHabit ? reminders[reminderHabit.id] : undefined}
        onClose={() => setReminderHabit(null)}
        onSave={(time) => reminderHabit && saveReminder(reminderHabit, time)}
      />

      <ConfirmSheet
        visible={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm?.kind === 'delete' ? `Delete “${confirm?.habit.title}”?` : `Archive “${confirm?.habit.title}”?`}
        message={
          confirm?.kind === 'delete'
            ? 'This permanently removes the habit and its history. This can’t be undone.'
            : 'It moves to Archived. Your history is kept and you can restore it anytime.'
        }
        confirmLabel={confirm?.kind === 'delete' ? 'Delete' : 'Archive'}
        destructive={confirm?.kind === 'delete'}
        onConfirm={runConfirm}
      />
    </SafeAreaView>
  );
}

function FieldLabel({ text, colors }: { text: string; colors: any }) {
  return <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '700', marginBottom: 8 }}>{text}</Text>;
}

function inputStyle(colors: any) {
  return {
    backgroundColor: colors.backgroundSecondary,
    color: colors.text,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 16,
  } as const;
}
