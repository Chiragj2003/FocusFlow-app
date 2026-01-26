import { useOAuth, useSignUp } from '@clerk/clerk-expo';
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

export default function SignUpScreen() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'google' | 'github' | null>(null);
  const [error, setError] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');

  // OAuth hooks
  const { startOAuthFlow: startGoogleOAuth } = useOAuth({ strategy: 'oauth_google' });
  const { startOAuthFlow: startGithubOAuth } = useOAuth({ strategy: 'oauth_github' });

  // Handle Google Sign Up
  const handleGoogleSignUp = useCallback(async () => {
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
      setError(err.errors?.[0]?.message || 'Google sign up failed. Please try again.');
    } finally {
      setOauthLoading(null);
    }
  }, [startGoogleOAuth, router]);

  // Handle GitHub Sign Up
  const handleGithubSignUp = useCallback(async () => {
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
      setError(err.errors?.[0]?.message || 'GitHub sign up failed. Please try again.');
    } finally {
      setOauthLoading(null);
    }
  }, [startGithubOAuth, router]);

  const handleSignUp = async () => {
    if (!isLoaded) return;

    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await signUp.create({
        emailAddress: email.trim(),
        password: password,
      });

      // Send email verification code
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setPendingVerification(true);
    } catch (err: any) {
      console.error('Sign up error:', err);
      setError(err.errors?.[0]?.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  const handleVerification = async () => {
    if (!isLoaded) return;

    setLoading(true);
    setError('');

    try {
      const completeSignUp = await signUp.attemptEmailAddressVerification({
        code: verificationCode,
      });

      if (completeSignUp.status === 'complete') {
        await setActive({ session: completeSignUp.createdSessionId });
        router.replace('/(tabs)');
      } else {
        console.log('Verification status:', completeSignUp.status);
        setError('Verification failed. Please try again.');
      }
    } catch (err: any) {
      console.error('Verification error:', err);
      setError(err.errors?.[0]?.message || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  // Verification Code Screen
  if (pendingVerification) {
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
            {/* Back Button */}
            <Pressable
              onPress={() => setPendingVerification(false)}
              className="flex-row items-center mb-8"
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
              <Text className="text-white ml-2">Back</Text>
            </Pressable>

            {/* Header */}
            <View className="items-center mb-8">
              <View className="w-20 h-20 rounded-2xl bg-zinc-800 items-center justify-center mb-4">
                <Ionicons name="mail" size={40} color="#22c55e" />
              </View>
              <Text className="text-2xl font-bold text-white">Check Your Email</Text>
              <Text className="text-zinc-400 mt-2 text-center">
                We sent a verification code to{'\n'}
                <Text className="text-white">{email}</Text>
              </Text>
            </View>

            {/* Error Message */}
            {error ? (
              <View className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-4">
                <Text className="text-red-400 text-center">{error}</Text>
              </View>
            ) : null}

            {/* Verification Code Input */}
            <View className="mb-6">
              <Text className="text-sm font-medium text-zinc-400 mb-2">
                Verification Code
              </Text>
              <TextInput
                className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-white text-base text-center tracking-widest"
                placeholder="Enter 6-digit code"
                placeholderTextColor="#71717a"
                value={verificationCode}
                onChangeText={setVerificationCode}
                keyboardType="number-pad"
                maxLength={6}
              />
            </View>

            {/* Verify Button */}
            <Pressable
              onPress={handleVerification}
              disabled={loading || verificationCode.length < 6}
              className={`rounded-xl py-4 items-center ${
                loading || verificationCode.length < 6 ? 'bg-zinc-700' : 'bg-white'
              }`}
            >
              {loading ? (
                <ActivityIndicator color="#18181b" />
              ) : (
                <Text className="text-zinc-900 font-bold text-base">Verify Email</Text>
              )}
            </Pressable>

            {/* Resend Code */}
            <Pressable
              onPress={handleSignUp}
              className="mt-4 py-2"
              disabled={loading}
            >
              <Text className="text-zinc-400 text-center">
                Didn't receive the code?{' '}
                <Text className="text-white font-semibold">Resend</Text>
              </Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // Sign Up Form
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
            <Text className="text-3xl font-bold text-white">Create Account</Text>
            <Text className="text-zinc-400 mt-2 text-center">
              Start your habit tracking journey
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
          <View className="mb-4">
            <Text className="text-sm font-medium text-zinc-400 mb-2">Password</Text>
            <View className="flex-row items-center bg-zinc-900 border border-zinc-800 rounded-xl px-4">
              <Ionicons name="lock-closed-outline" size={20} color="#71717a" />
              <TextInput
                className="flex-1 py-4 px-3 text-white text-base"
                placeholder="Create a password"
                placeholderTextColor="#71717a"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoComplete="new-password"
              />
              <Pressable onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#71717a"
                />
              </Pressable>
            </View>
            <Text className="text-zinc-500 text-xs mt-1">
              Must be at least 8 characters
            </Text>
          </View>

          {/* Confirm Password Input */}
          <View className="mb-6">
            <Text className="text-sm font-medium text-zinc-400 mb-2">
              Confirm Password
            </Text>
            <View className="flex-row items-center bg-zinc-900 border border-zinc-800 rounded-xl px-4">
              <Ionicons name="lock-closed-outline" size={20} color="#71717a" />
              <TextInput
                className="flex-1 py-4 px-3 text-white text-base"
                placeholder="Confirm your password"
                placeholderTextColor="#71717a"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
                autoComplete="new-password"
              />
            </View>
          </View>

          {/* Sign Up Button */}
          <Pressable
            onPress={handleSignUp}
            disabled={loading}
            className={`rounded-xl py-4 items-center ${loading ? 'bg-zinc-700' : 'bg-white'}`}
          >
            {loading ? (
              <ActivityIndicator color="#18181b" />
            ) : (
              <Text className="text-zinc-900 font-bold text-base">Create Account</Text>
            )}
          </Pressable>

          {/* Sign In Link */}
          <View className="flex-row justify-center mt-6">
            <Text className="text-zinc-400">Already have an account? </Text>
            <Link href="/(auth)/sign-in" asChild>
              <Pressable>
                <Text className="text-white font-semibold">Sign In</Text>
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
          <View className="gap-3">
            {/* Google Sign Up */}
            <Pressable
              onPress={handleGoogleSignUp}
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

            {/* GitHub Sign Up */}
            <Pressable
              onPress={handleGithubSignUp}
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
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
