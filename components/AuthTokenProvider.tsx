import { setAuthTokenGetter } from '@/lib/api';
import { useAuth } from '@clerk/clerk-expo';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { notificationsManager } from '@/lib/notifications';

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
    // Set up auth token for web API
    setAuthTokenGetter(getter);
  }, [getToken, isSignedIn, userId]);


  return <>{children}</>;
}
