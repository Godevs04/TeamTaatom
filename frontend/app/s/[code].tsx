import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import LoadingGlobe from '../../components/LoadingGlobe';
import { useTheme } from '../../context/ThemeContext';
import { resolveShortCode } from '../../services/shortUrl';
import { createLogger } from '../../utils/logger';

const logger = createLogger('ShortLink');

/**
 * Universal Link landing for https://taatom.com/s/:code
 * Resolves the short code via API and replaces to the real in-app route.
 * Prevents Expo Router "Unmatched Route" / crash when AASA opens /s/* in-app.
 */
export default function ShortLinkResolver() {
  const { code } = useLocalSearchParams<{ code?: string | string[] }>();
  const router = useRouter();
  const { theme } = useTheme();
  const [error, setError] = useState<string | null>(null);

  const shortCode = Array.isArray(code) ? code[0] : code;

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!shortCode) {
        setError('Invalid link');
        return;
      }
      try {
        const resolved = await resolveShortCode(shortCode);
        if (cancelled) return;
        const path = resolved.path.startsWith('/') ? resolved.path : `/${resolved.path}`;
        logger.info('Resolved short link', { shortCode, path });
        router.replace(path as any);
      } catch (e: any) {
        logger.error('Failed to resolve short link', e);
        if (!cancelled) {
          setError(e?.message || 'This link is invalid or expired.');
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [shortCode, router]);

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Link not found</Text>
        <Text style={[styles.body, { color: theme.colors.textSecondary }]}>{error}</Text>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.colors.primary }]}
          onPress={() => router.replace('/(tabs)' as any)}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>Go home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <LoadingGlobe size="large" color={theme.colors.primary} />
      <Text style={[styles.body, { color: theme.colors.textSecondary, marginTop: 16 }]}>
        Opening…
      </Text>
    </View>
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
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
});
