import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, useColorScheme, KeyboardAvoidingView, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { storeToken, useAuthStore } from '../lib/api';

const AUTH_URL = 'https://sifxtre.me/api/auth/google_oauth2?origin=mobile';
const REDIRECT_SCHEME = 'jarvis';

export default function LoginScreen() {
  const [manualToken, setManualToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { setIsAuthenticated, setShowAuthModal } = useAuthStore();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      const result = await WebBrowser.openAuthSessionAsync(AUTH_URL, `${REDIRECT_SCHEME}://`);

      if (result.type === 'success' && result.url) {
        const url = new URL(result.url);
        const token = url.searchParams.get('token');
        if (token) {
          await storeToken(token);
          setIsAuthenticated(true);
          setShowAuthModal(false);
          return;
        }
      }

      if (result.type === 'cancel') return;
      Alert.alert('Error', 'Sign-in did not complete. Try the manual token method below.');
    } catch {
      Alert.alert('Error', 'Google Sign-In failed. Use manual token entry instead.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualToken = async () => {
    if (!manualToken.trim()) {
      Alert.alert('Error', 'Please enter a token');
      return;
    }
    setIsLoading(true);
    try {
      await storeToken(manualToken.trim());
      setIsAuthenticated(true);
      setShowAuthModal(false);
    } catch {
      Alert.alert('Error', 'Failed to save token');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: isDark ? '#0f172a' : '#ffffff' }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Text style={[styles.title, { color: isDark ? '#f8fafc' : '#0f172a' }]}>Jarvis</Text>
        <Text style={[styles.subtitle, { color: isDark ? '#94a3b8' : '#64748b' }]}>
          Sign in to manage your finances
        </Text>

        <TouchableOpacity
          style={[styles.googleButton, isLoading && styles.buttonDisabled]}
          onPress={handleGoogleSignIn}
          disabled={isLoading}
        >
          <Text style={styles.googleButtonText}>
            {isLoading ? 'Signing in...' : 'Sign in with Google'}
          </Text>
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={[styles.dividerLine, { backgroundColor: isDark ? '#1e293b' : '#e2e8f0' }]} />
          <Text style={[styles.dividerText, { color: isDark ? '#64748b' : '#94a3b8' }]}>or</Text>
          <View style={[styles.dividerLine, { backgroundColor: isDark ? '#1e293b' : '#e2e8f0' }]} />
        </View>

        <Text style={[styles.label, { color: isDark ? '#94a3b8' : '#64748b' }]}>
          Paste auth token from web app
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
              color: isDark ? '#f8fafc' : '#0f172a',
              borderColor: isDark ? '#334155' : '#e2e8f0',
            },
          ]}
          placeholder="Bearer token..."
          placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
          value={manualToken}
          onChangeText={setManualToken}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity
          style={[styles.tokenButton, { borderColor: isDark ? '#334155' : '#e2e8f0' }]}
          onPress={handleManualToken}
          disabled={isLoading}
        >
          <Text style={[styles.tokenButtonText, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
            Use Token
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: '100%',
    maxWidth: 340,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 32,
  },
  googleButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  googleButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 13,
  },
  label: {
    fontSize: 13,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: 12,
  },
  tokenButton: {
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: 'center',
  },
  tokenButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
