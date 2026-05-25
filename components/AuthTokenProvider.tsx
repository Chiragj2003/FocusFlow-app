import { setAuthTokenGetter } from '@/lib/api';
import { useAuth } from '@clerk/clerk-expo';
import { useEffect } from 'react';

interface AuthTokenProviderProps {
  children: React.ReactNode;
}

export function AuthTokenProvider({ children }: AuthTokenProviderProps) {
  const { getToken, isSignedIn, userId } = useAuth();

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
  }, [getToken, isSignedIn, userId]);

  return <>{children}</>;
}

