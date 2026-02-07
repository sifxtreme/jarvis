import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useColorScheme, ActivityIndicator, View } from 'react-native';
import { verifyAuthentication, useAuthStore } from '../src/lib/api';
import LoginScreen from '../src/components/LoginScreen';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      retryDelay: 1000,
      staleTime: 5 * 60 * 1000,
    },
  },
});

function AppContent() {
  const { isAuthenticated, setIsAuthenticated } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const colorScheme = useColorScheme();

  useEffect(() => {
    verifyAuthentication()
      .then((isValid) => {
        setIsAuthenticated(isValid);
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, [setIsAuthenticated]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colorScheme === 'dark' ? '#0f172a' : '#ffffff' }}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AppContent />
          <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
