import { setAuthTokenGetter } from '@/lib/api';
import { useAuth } from '@clerk/clerk-expo';
import { useEffect } from 'react';

interface AuthTokenProviderProps {
  children: React.ReactNode;
}

export function AuthTokenProvider({ children }: AuthTokenProviderProps) {
  const { getToken } = useAuth();

  useEffect(() => {
    // Set up the auth token getter for API requests
    setAuthTokenGetter(async () => {
      try {
        const token = await getToken();
        return token;
      } catch (error) {
        console.error('Failed to get auth token:', error);
        return null;
      }
    });
  }, [getToken]);

  return <>{children}</>;
}
