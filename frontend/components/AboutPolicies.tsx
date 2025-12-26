import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../context/ThemeContext';
import { theme } from '../constants/theme';
import logger from '../utils/logger';

interface AboutPoliciesProps {
  onLinkPress?: (path: string) => void;
}

export default function AboutPolicies({ onLinkPress }: AboutPoliciesProps) {
  const { theme: themeContext } = useTheme();
  const activeTheme = themeContext || theme;
  const router = useRouter();

  const handlePress = (pathname: string) => {
    if (onLinkPress) {
      onLinkPress(pathname);
      return;
    }

    try {
      // Navigate to the policy page using Expo Router
      // Use pathname directly as string (Expo Router handles route resolution)
      router.push(pathname);
    } catch (error) {
      logger.error('Error navigating to policy page:', error);
    }
  };

  const policyLinks = [
    {
      title: 'Privacy Policy',
      pathname: '/policies/privacy',
      icon: 'shield-outline' as const,
    },
    {
      title: 'Terms of Service',
      pathname: '/policies/terms',
      icon: 'document-text-outline' as const,
    },
    {
      title: 'Copyright Consent',
      pathname: '/policies/copyright',
      icon: 'lock-closed-outline' as const,
    },
  ];

  return (
    <View style={styles.container}>
      {policyLinks.map((link, index) => (
        <Pressable
          key={index}
          style={({ pressed }) => [
            styles.linkItem,
            {
              backgroundColor: activeTheme.colors.surface,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
          onPress={() => handlePress(link.pathname)}
        >
          <View style={styles.linkContent}>
            <Ionicons
              name={link.icon}
              size={20}
              color={activeTheme.colors.primary}
            />
            <Text
              style={[
                styles.linkText,
                { color: activeTheme.colors.primary },
              ]}
            >
              {link.title}
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={activeTheme.colors.textSecondary}
          />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: theme.spacing.md,
    marginVertical: 4,
    borderRadius: theme.borderRadius.md,
  },
  linkContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  linkText: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: theme.spacing.md,
  },
});
