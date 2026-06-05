import { setAuthTokenGetter } from '@/lib/api';
import { syncLocalStorageWithBackend } from '@/lib/localStorage';
import { useAuth } from '@clerk/clerk-expo';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { notificationsManager } from '@/lib/notifications';
import { useRef } from 'react';

interface AuthTokenProviderProps {
  children: React.ReactNode;
}

export function AuthTokenProvider({ children }: AuthTokenProviderProps) {
  const { getToken, isSignedIn, userId } = useAuth();
  const queryClient = useQueryClient();
  const hasSyncedOnMount = useRef(false);
  const wasOffline = useRef(false);

  // Initialize notifications on mount
  useEffect(() => {
    notificationsManager.updateScheduledReminders();
  }, []);

  useEffect(() => {
    if (!isSignedIn) {
      // Clear auth token when user signs out
      setAuthTokenGetter(async () => null);
      return;
    }

    const getter = async () => {
      try {
        const token = await getToken();
        return token;
      } catch (error) {
        console.error('Failed to get auth token:', error);
        return null;
      }
    };
    // Set up auth token for web API
    setAuthTokenGetter(getter);

    // Trigger offline data sync in background after token is set
    const triggerSync = async () => {
      if (!hasSyncedOnMount.current) {
        hasSyncedOnMount.current = true;
        setTimeout(async () => {
          console.log('[Sync] Triggering background sync for local offline data...');
          await syncLocalStorageWithBackend();
          await queryClient.invalidateQueries();
        }, 1000);
      }
    };
    triggerSync();
  }, [getToken, isSignedIn, queryClient, userId]);

  // Sync data automatically on network reconnection
  useEffect(() => {
    if (!isSignedIn) return;

    const unsubscribe = NetInfo.addEventListener(state => {
      const isConnected = state.isConnected && state.isInternetReachable !== false;
      if (isConnected) {
        if (wasOffline.current) {
          console.log('[Sync] Internet connection detected! Synchronizing offline data...');
          syncLocalStorageWithBackend().then(() => {
            queryClient.invalidateQueries();
          }).catch(err => {
            console.error('[Sync] Sync on reconnect failed:', err);
          });
          wasOffline.current = false;
        }
      } else {
        wasOffline.current = true;
      }
    });

    return () => unsubscribe();
  }, [isSignedIn, queryClient]);

  return <>{children}</>;
}
