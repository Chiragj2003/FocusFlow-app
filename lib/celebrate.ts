/**
 * Tiny app-wide event bus for celebrations and toasts.
 * Call `celebrate()` / `toast()` from anywhere (hooks, screens, sync code);
 * <CelebrationHost /> in the root layout renders them.
 */
import type { MascotMood } from '@/components/ui/Mascot';
import type { ImageSourcePropType } from 'react-native';

export interface WeekDay {
  label: string; // "M", "T", ...
  done: boolean;
  today: boolean;
}

export interface CelebrationEvent {
  title: string;
  message: string;
  mood?: MascotMood;
  /** Big image instead of the mascot pose (streak flame, milestone scene) */
  image?: ImageSourcePropType;
  /** Duolingo-style week strip under the title */
  week?: WeekDay[];
  /** Short label shown in the pill, e.g. "7 Days" */
  highlight?: string;
  highlightIcon?: 'flame' | 'trophy' | 'time' | 'checkmark-circle' | 'sparkles' | 'star';
  cta?: string;
}

export type ToastTone = 'success' | 'info' | 'error';

export interface ToastEvent {
  message: string;
  tone?: ToastTone;
}

type Listener<T> = (event: T) => void;

const celebrationListeners = new Set<Listener<CelebrationEvent>>();
const toastListeners = new Set<Listener<ToastEvent>>();

export function celebrate(event: CelebrationEvent) {
  celebrationListeners.forEach((l) => l(event));
}

export function toast(event: ToastEvent | string) {
  const e = typeof event === 'string' ? { message: event } : event;
  toastListeners.forEach((l) => l(e));
}

export function onCelebrate(listener: Listener<CelebrationEvent>) {
  celebrationListeners.add(listener);
  return () => {
    celebrationListeners.delete(listener);
  };
}

export function onToast(listener: Listener<ToastEvent>) {
  toastListeners.add(listener);
  return () => {
    toastListeners.delete(listener);
  };
}
