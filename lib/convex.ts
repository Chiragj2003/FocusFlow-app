import { ConvexHttpClient } from 'convex/browser';

const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;

if (!convexUrl) {
  throw new Error('Missing EXPO_PUBLIC_CONVEX_URL in environment variables');
}

export const convexClient = new ConvexHttpClient(convexUrl);

// Store the getter so we can refresh the token before each request if needed
let _authTokenGetter: (() => Promise<string | null>) | null = null;

export const setConvexAuthTokenGetter = (getter: () => Promise<string | null>) => {
  _authTokenGetter = getter;
  // Set the token immediately for the current session
  getter()
    .then((token) => {
      if (token) {
        convexClient.setAuth(token);
      } else {
        convexClient.clearAuth();
      }
    })
    .catch((error) => {
      console.error('Failed to set Convex auth token:', error);
    });
};

// Helper to ensure auth is fresh before making a Convex call
export const refreshConvexAuth = async () => {
  if (_authTokenGetter) {
    try {
      const token = await _authTokenGetter();
      if (token) {
        convexClient.setAuth(token);
      } else {
        convexClient.clearAuth();
      }
    } catch (error) {
      console.error('Failed to refresh Convex auth:', error);
    }
  }
};
