import { AuthTokenProvider } from '@/components/AuthTokenProvider';
import { CelebrationHost } from '@/components/ui/CelebrationHost';
import { tokenCache } from '@/lib/auth';
import { ThemeProvider, useTheme } from '@/lib/ThemeContext';
import { ClerkLoaded, ClerkProvider } from '@clerk/clerk-expo';
// Removed unused Navigation imports
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { LogBox, View } from 'react-native';
import 'react-native-reanimated';
import '../global.css';

// Suppress third-party Reanimated v4 transition warnings
LogBox.ignoreLogs([
  'Reading from value during component render',
  'Writing to value during component render',
]);

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Show cached data immediately, refetch in background
      staleTime: 30 * 1000, // 30 seconds - show stale data immediately
      gcTime: 10 * 60 * 1000, // Keep cached for 10 minutes
      // Reduce retries for faster failure
      retry: 1,
      retryDelay: 1000, // 1 second retry delay
      // Refetch settings for mobile
      refetchOnWindowFocus: false, // Mobile doesn't have windows
      refetchOnReconnect: true,
      // Show cached data immediately while fetching
      refetchOnMount: 'always',
    },
    mutations: {
      // Don't retry mutations - we handle errors ourselves
      retry: 0,
    },
  },
});

// Get Clerk publishable key from environment
const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

if (!publishableKey) {
  throw new Error('Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in environment variables');
}


function RootLayoutNav() {
  const { isDark, colors } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* App background behind every screen, so no white shows through edges or transitions */}
      <Stack screenOptions={{ contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false, animation: 'fade' }} />
        {/* Full pages opened from Home: slim header with just a back button (each page has its own big title) */}
        {['badges', 'achievements'].map((name) => (
          <Stack.Screen
            key={name}
            name={name}
            options={{
              title: '',
              headerBackTitle: 'Back',
              headerShadowVisible: false,
              headerStyle: { backgroundColor: colors.background },
              headerTintColor: colors.primary,
            }}
          />
        ))}
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <CelebrationHost />
    </View>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <ClerkLoaded>
        <QueryClientProvider client={queryClient}>
          <AuthTokenProvider>
            <ThemeProvider>
              <RootLayoutNav />
            </ThemeProvider>
          </AuthTokenProvider>
        </QueryClientProvider>
      </ClerkLoaded>
    </ClerkProvider>
  );
}
