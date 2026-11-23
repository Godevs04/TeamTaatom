import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Link, Stack, useRouter } from 'expo-router';
import { useTheme } from '../context/ThemeContext';
import { createLogger } from '../utils/logger';

const logger = createLogger('NotFound');

/**
 * Safe fallback for unmatched deep links (e.g. empty taatom:///).
 * Never leave the user on a crash / blank unmatched screen in production.
 */
export default function NotFoundScreen() {
  const { theme } = useTheme();
  const router = useRouter();

  useEffect(() => {
    logger.warn('Unmatched route hit — showing recovery UI');
  }, []);

  return (
    <>
      <Stack.Screen options={{ title: 'Not found', headerShown: false }} />
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Page not found</Text>
        <Text style={[styles.body, { color: theme.colors.textSecondary }]}>
          This link could not be opened. You can go back home and try again.
        </Text>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.colors.primary }]}
          onPress={() => router.replace('/(tabs)' as any)}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>Go home</Text>
        </TouchableOpacity>
        <Link href="/(tabs)" style={[styles.link, { color: theme.colors.primary }]}>
          Or tap here
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  button: {
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  link: {
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
