import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { localStorage } from './localStorage';

const REMINDER_CHANNEL_ID = 'habit-reminders';

const HABIT_LINES = [
  'Small step, big fire. You’ve got this.',
  'Two minutes is enough to keep it going.',
  'Sparky is ready when you are.',
  'Show up today. Future you will thank you.',
];

const EVENING_LINES = [
  'Check in before bed and keep your flame alive.',
  'Day’s almost done. Did you show up for your habits?',
  'One quick check-in keeps the streak going.',
];

const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Stable pick so the same reminder doesn't change text on every reschedule. */
const pickLine = (lines: string[], seed: string) => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return lines[Math.abs(h) % lines.length];
};
const PROMPTED_KEY = '@focusflow_notifications_prompted';

// Set up the default notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let debounceTimeout: ReturnType<typeof setTimeout> | null = null;
let scheduleChain: Promise<void> = Promise.resolve();

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
    name: 'Habit reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export const notificationsManager = {
  /** True if notifications are already allowed. Never shows a prompt. */
  async hasPermission(): Promise<boolean> {
    if (Platform.OS === 'web') return false;
    try {
      const { status } = await Notifications.getPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('[Notifications] Failed to read permission status:', error);
      return false;
    }
  },

  /**
   * Shows the system permission prompt if needed. Only call this in response to
   * a user action (e.g. turning reminders on), never on app start.
   */
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'web') return false;

    try {
      if (await this.hasPermission()) return true;

      // Android 8+ needs a channel before the prompt can be shown (Android 13+).
      await ensureAndroidChannel();
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.log('[Notifications] Permission not granted for local notifications.');
        return false;
      }
      return true;
    } catch (error) {
      console.error('[Notifications] Failed to request permissions:', error);
      return false;
    }
  },

  /**
   * Asks for permission once, at a moment where it makes sense (after the user
   * creates a habit), and only if reminders are enabled in settings.
   */
  async askOnceIfRemindersEnabled(): Promise<void> {
    if (Platform.OS === 'web') return;
    try {
      if (await AsyncStorage.getItem(PROMPTED_KEY)) return;
      const notifyVal = await AsyncStorage.getItem('@focusflow_settings_notifications');
      const dailyVal = await AsyncStorage.getItem('@focusflow_settings_daily_reminder');
      if (notifyVal === 'false' || dailyVal === 'false') return;

      await AsyncStorage.setItem(PROMPTED_KEY, 'true');
      if (await this.requestPermissions()) {
        await this.updateScheduledReminders('permission granted after first habit');
      }
    } catch (error) {
      console.error('[Notifications] Failed to ask for permission:', error);
    }
  },

  // Cancel all scheduled notifications
  async cancelAllReminders(): Promise<void> {
    if (Platform.OS === 'web') return;
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('[Notifications] Cancelled all scheduled notifications.');
    } catch (error) {
      console.error('[Notifications] Failed to cancel notifications:', error);
    }
  },

  /**
   * Smart reminders, rebuilt from on-device data each time something changes:
   * - per-habit reminders at the time the user picked (skipped today if already done)
   * - one evening nudge, only if something is still unchecked today
   * Scheduled a few days ahead so they still fire if the app isn't opened.
   */
  async scheduleOfflineReminders(askPermission = false, includeEvening = true): Promise<void> {
    if (Platform.OS === 'web') return;

    try {
      // Background refreshes only check; the prompt is shown only when asked for.
      const hasPermission = askPermission ? await this.requestPermissions() : await this.hasPermission();
      if (!hasPermission) return;

      await ensureAndroidChannel();
      await this.cancelAllReminders();

      const habits = (await localStorage.getLocalHabits()).filter((h) => h.active !== false);
      if (habits.length === 0) return;

      const reminders = await localStorage.getHabitReminders();
      const entries = await localStorage.getLocalEntries();
      const today = dateKey(new Date());
      const doneToday = new Set(
        entries.filter((e) => e.completed && e.entryDate.split('T')[0] === today).map((e) => e.habitId)
      );
      const leftToday = habits.filter((h) => !doneToday.has(h.id)).length;

      const withTime = habits.filter((h) => /^\d{2}:\d{2}$/.test(reminders[h.id] ?? ''));
      // iOS keeps at most 64 pending notifications: plan as many days as fit
      const perDay = withTime.length + (includeEvening ? 1 : 0);
      const days = Math.max(1, Math.min(7, Math.floor(60 / Math.max(1, perDay))));
      const now = new Date();

      const schedule = (date: Date, title: string, body: string) =>
        Notifications.scheduleNotificationAsync({
          content: { title, body, sound: true },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: REMINDER_CHANNEL_ID },
        });

      for (let d = 0; d < days; d++) {
        const day = new Date();
        day.setDate(now.getDate() + d);

        for (const habit of withTime) {
          if (d === 0 && doneToday.has(habit.id)) continue;
          const [hh, mm] = reminders[habit.id].split(':').map(Number);
          const at = new Date(day);
          at.setHours(hh, mm, 0, 0);
          if (at <= now) continue;
          await schedule(at, `Time for ${habit.title} 🔥`, pickLine(HABIT_LINES, habit.id + d));
        }

        if (includeEvening) {
          if (d === 0 && leftToday === 0) continue; // all done today: no nudge
          const at = new Date(day);
          at.setHours(20, 30, 0, 0);
          if (at <= now) continue;
          const body =
            d === 0
              ? `${leftToday} ${leftToday === 1 ? 'habit is' : 'habits are'} still waiting. A few minutes keeps your flame alive.`
              : pickLine(EVENING_LINES, String(d));
          await schedule(at, 'Your streak is waiting 🔥', body);
        }
      }
      console.log(`[Notifications] Scheduled smart reminders for ${days} day(s).`);
    } catch (error) {
      console.error('[Notifications] Error scheduling reminders:', error);
    }
  },

  // Initialize notifications state
  async initializeNotifications(isEnabled: boolean, askPermission = false, includeEvening = true): Promise<void> {
    if (isEnabled) {
      await this.scheduleOfflineReminders(askPermission, includeEvening);
    } else {
      await this.cancelAllReminders();
    }
  },

  /**
   * Loads settings and refreshes scheduled reminders.
   * Pass `askPermission: true` only from a user action; otherwise no prompt is shown.
   */
  async updateScheduledReminders(
    reason: string,
    debounceMs = 0,
    options: { askPermission?: boolean } = {}
  ): Promise<void> {
    if (Platform.OS === 'web') return;

    console.log(`[Notifications] updateScheduledReminders triggered. Reason: ${reason}`);

    const execute = async () => {
      try {
        console.log(`[Notifications] Executing update of scheduled reminders. Trigger reason: ${reason}`);
        const notifyVal = await AsyncStorage.getItem('@focusflow_settings_notifications');
        const dailyVal = await AsyncStorage.getItem('@focusflow_settings_daily_reminder');

        const notificationsEnabled = notifyVal !== null ? notifyVal === 'true' : true;
        const dailyReminderEnabled = dailyVal !== null ? dailyVal === 'true' : true;

        // "Notifications" is the master switch; "Daily reminder" controls the evening nudge
        await this.initializeNotifications(notificationsEnabled, options.askPermission ?? false, dailyReminderEnabled);
      } catch (error) {
        console.error('[Notifications] Failed to update scheduled reminders:', error);
      }
    };

    // Run one reschedule at a time so cancel/schedule passes never interleave (no duplicates)
    const serialized = () => (scheduleChain = scheduleChain.then(execute, execute));

    if (debounceMs > 0) {
      if (debounceTimeout) clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        serialized();
      }, debounceMs);
    } else {
      await serialized();
    }
  }
};
