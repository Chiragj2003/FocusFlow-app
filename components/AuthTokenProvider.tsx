import { setAuthTokenGetter } from '@/lib/api';
import { setConvexAuthTokenGetter } from '@/lib/convex';
import { useAuth } from '@clerk/clerk-expo';
import { useEffect } from 'react';

interface AuthTokenProviderProps {
  children: React.ReactNode;
}

export function AuthTokenProvider({ children }: AuthTokenProviderProps) {
  const { getToken, isSignedIn, userId } = useAuth();

  useEffect(() => {
    if (!isSignedIn) {
      // Clear auth tokens when user signs out
      setAuthTokenGetter(async () => null);
      setConvexAuthTokenGetter(async () => null);
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
    // Set up auth token for both web API and Convex client
    // so data syncs between mobile and web apps
    setAuthTokenGetter(getter);
    setConvexAuthTokenGetter(getter);
  }, [getToken, isSignedIn, userId]);

  return <>{children}</>;
}
