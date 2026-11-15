import { setAuthTokenGetter } from '@/lib/api';
import { useAuth } from '@clerk/clerk-expo';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { notificationsManager } from '@/lib/notifications';
import { localStorage } from '@/lib/localStorage';
import NetInfo from '@react-native-community/netinfo';

interface AuthTokenProviderProps {
  children: React.ReactNode;
}

export function AuthTokenProvider({ children }: AuthTokenProviderProps) {
  const { getToken, isSignedIn, userId } = useAuth();
  const queryClient = useQueryClient();

  // Initialize notifications on mount
  useEffect(() => {
    notificationsManager.updateScheduledReminders('app initialization');
  }, []);

  // Set up the auth token for the web API (before any sync runs)
  useEffect(() => {
    if (!isSignedIn) {
      // Clear auth token when user signs out
      setAuthTokenGetter(async () => null);
      return;
    }

    const getter = async (options?: { skipCache?: boolean }) => {
      try {
        const token = await getToken(options);
        return token;
      } catch (error) {
        console.error('Failed to get auth token:', error);
        return null;
      }
    };
    setAuthTokenGetter(getter);
  }, [getToken, isSignedIn, userId]);

  // Bind on-device data to the signed-in user, then keep the offline queue flushing.
  useEffect(() => {
    if (!isSignedIn || !userId) {
      // Pause syncing while nobody is signed in.
      localStorage.setCurrentUser(null);
      return;
    }

    let cancelled = false;
    let unsubscribeNet: (() => void) | undefined;

    // If a different account used this device before, its local data is wiped
    // here, before anything can be synced into the new account.
    localStorage
      .setCurrentUser(userId)
      .then((cleared) => {
        if (cancelled) return;
        if (cleared) queryClient.clear();

        localStorage.triggerSync();
        unsubscribeNet = NetInfo.addEventListener((state) => {
          if (state.isConnected && state.isInternetReachable !== false) {
            console.log('[AuthTokenProvider] Internet connected. Flushing mobile sync queue to web...');
            localStorage.triggerSync();
          }
        });
      })
      .catch((error) => console.error('[AuthTokenProvider] Failed to bind local data to user:', error));

    // After the queue pushes changes to the server, refetch server data so
    // temp IDs are replaced with real ones and insights stay accurate.
    const unsubscribeSync = localStorage.onSyncComplete(() => {
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      queryClient.invalidateQueries({ queryKey: ['insights'] });
      queryClient.invalidateQueries({ queryKey: ['streaks'] });
    });

    return () => {
      cancelled = true;
      unsubscribeNet?.();
      unsubscribeSync();
    };
  }, [isSignedIn, userId, queryClient]);

  return <>{children}</>;
}
