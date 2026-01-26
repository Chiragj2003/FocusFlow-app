import { useOAuth, useSignIn } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { Link, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Required for OAuth to work properly
WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'google' | 'github' | null>(null);
  const [error, setError] = useState('');

  // OAuth hooks
  const { startOAuthFlow: startGoogleOAuth } = useOAuth({ strategy: 'oauth_google' });
  const { startOAuthFlow: startGithubOAuth } = useOAuth({ strategy: 'oauth_github' });

  // Handle Google Sign In
  const handleGoogleSignIn = useCallback(async () => {
    try {
      setOauthLoading('google');
      setError('');
      
      const { createdSessionId, setActive: setOAuthActive } = await startGoogleOAuth({
        redirectUrl: Linking.createURL('/(tabs)', { scheme: 'focusflow' }),
      });

      if (createdSessionId && setOAuthActive) {
        await setOAuthActive({ session: createdSessionId });
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      console.error('Google OAuth error:', err);
      setError(err.errors?.[0]?.message || 'Google sign in failed. Please try again.');
    } finally {
      setOauthLoading(null);
    }
  }, [startGoogleOAuth, router]);

  // Handle GitHub Sign In
  const handleGithubSignIn = useCallback(async () => {
    try {
      setOauthLoading('github');
      setError('');
      
      const { createdSessionId, setActive: setOAuthActive } = await startGithubOAuth({
        redirectUrl: Linking.createURL('/(tabs)', { scheme: 'focusflow' }),
      });

      if (createdSessionId && setOAuthActive) {
        await setOAuthActive({ session: createdSessionId });
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      console.error('GitHub OAuth error:', err);
      setError(err.errors?.[0]?.message || 'GitHub sign in failed. Please try again.');
    } finally {
      setOauthLoading(null);
    }
  }, [startGithubOAuth, router]);

  const handleSignIn = async () => {
    if (!isLoaded) return;

    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const signInAttempt = await signIn.create({
        identifier: email.trim(),
        password: password,
      });

      if (signInAttempt.status === 'complete') {
        await setActive({ session: signInAttempt.createdSessionId });
        router.replace('/(tabs)');
      } else {
        // Handle other statuses (e.g., needs_first_factor, needs_second_factor)
        console.log('Sign in status:', signInAttempt.status);
        setError('Additional verification required. Please try again.');
      }
    } catch (err: any) {
      console.error('Sign in error:', err);
      const errorMessage = err.errors?.[0]?.message || err.message || 'Sign in failed';
      // Make error messages more user-friendly
      if (errorMessage.includes("Couldn't find your account") || errorMessage.includes('not found')) {
        setError("Account not found. Please sign up first or check your email.");
      } else if (errorMessage.includes('password') || errorMessage.includes('incorrect')) {
        setError('Incorrect password. Please try again.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#09090b]">
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          className="flex-1 px-6"
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo/Brand */}
          <View className="items-center mb-8">
            <View className="w-20 h-20 rounded-2xl bg-white items-center justify-center mb-4">
              <Ionicons name="flame" size={40} color="#f97316" />
            </View>
            <Text className="text-3xl font-bold text-white">FocusFlow</Text>
            <Text className="text-zinc-400 mt-2 text-center">
              Welcome back! Sign in to continue
            </Text>
          </View>

          {/* Error Message */}
          {error ? (
            <View className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-4">
              <Text className="text-red-400 text-center">{error}</Text>
            </View>
          ) : null}

          {/* Email Input */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-zinc-400 mb-2">Email</Text>
            <View className="flex-row items-center bg-zinc-900 border border-zinc-800 rounded-xl px-4">
              <Ionicons name="mail-outline" size={20} color="#71717a" />
              <TextInput
                className="flex-1 py-4 px-3 text-white text-base"
                placeholder="Enter your email"
                placeholderTextColor="#71717a"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
            </View>
          </View>

          {/* Password Input */}
          <View className="mb-6">
            <Text className="text-sm font-medium text-zinc-400 mb-2">Password</Text>
            <View className="flex-row items-center bg-zinc-900 border border-zinc-800 rounded-xl px-4">
              <Ionicons name="lock-closed-outline" size={20} color="#71717a" />
              <TextInput
                className="flex-1 py-4 px-3 text-white text-base"
                placeholder="Enter your password"
                placeholderTextColor="#71717a"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoComplete="password"
              />
              <Pressable onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#71717a"
                />
              </Pressable>
            </View>
          </View>

          {/* Sign In Button */}
          <Pressable
            onPress={handleSignIn}
            disabled={loading}
            className={`rounded-xl py-4 items-center ${loading ? 'bg-zinc-700' : 'bg-white'}`}
          >
            {loading ? (
              <ActivityIndicator color="#18181b" />
            ) : (
              <Text className="text-zinc-900 font-bold text-base">Sign In</Text>
            )}
          </Pressable>

          {/* Sign Up Link */}
          <View className="flex-row justify-center mt-6">
            <Text className="text-zinc-400">Don't have an account? </Text>
            <Link href="/(auth)/sign-up" asChild>
              <Pressable>
                <Text className="text-white font-semibold">Sign Up</Text>
              </Pressable>
            </Link>
          </View>

          {/* Divider */}
          <View className="flex-row items-center my-6">
            <View className="flex-1 h-px bg-zinc-800" />
            <Text className="text-zinc-500 mx-4">or continue with</Text>
            <View className="flex-1 h-px bg-zinc-800" />
          </View>

          {/* OAuth Buttons */}
          <View className="gap-3 mb-6">
            {/* Google Sign In */}
            <Pressable
              onPress={handleGoogleSignIn}
              disabled={oauthLoading !== null}
              className={`flex-row items-center justify-center rounded-xl py-4 border ${
                oauthLoading === 'google' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-white'
              }`}
            >
              {oauthLoading === 'google' ? (
                <ActivityIndicator color="#18181b" />
              ) : (
                <>
                  <Ionicons name="logo-google" size={20} color="#18181b" />
                  <Text className="text-zinc-900 font-semibold text-base ml-3">
                    Continue with Google
                  </Text>
                </>
              )}
            </Pressable>

            {/* GitHub Sign In */}
            <Pressable
              onPress={handleGithubSignIn}
              disabled={oauthLoading !== null}
              className={`flex-row items-center justify-center rounded-xl py-4 border ${
                oauthLoading === 'github' ? 'bg-zinc-700 border-zinc-600' : 'bg-zinc-800 border-zinc-700'
              }`}
            >
              {oauthLoading === 'github' ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="logo-github" size={20} color="#ffffff" />
                  <Text className="text-white font-semibold text-base ml-3">
                    Continue with GitHub
                  </Text>
                </>
              )}
            </Pressable>
          </View>

          {/* Continue Without Account (Demo Mode) */}
          <Pressable
            onPress={() => router.replace('/(tabs)')}
            className="border border-zinc-700 rounded-xl py-4 items-center"
          >
            <Text className="text-zinc-400 font-medium">Continue as Guest</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
