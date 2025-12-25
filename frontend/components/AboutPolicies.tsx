import React from 'react';
import { Pressable, Text, View, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useTheme } from '../context/ThemeContext';
import { theme } from '../constants/theme';
import { PRIVACY_URL, TERMS_URL, COPYRIGHT_URL } from '../constants/policies';

interface AboutPoliciesProps {
  onLinkPress?: (url: string) => void;
}

export default function AboutPolicies({ onLinkPress }: AboutPoliciesProps) {
  const { theme: themeContext } = useTheme();
  const activeTheme = themeContext || theme;

  const handleOpenLink = async (url: string) => {
    if (onLinkPress) {
      onLinkPress(url);
      return;
    }

    try {
      // Use WebBrowser for better in-app experience on iOS/Android
      // Falls back to system browser on web
      if (Platform.OS === 'web') {
        // For web, open in new tab
        if (typeof window !== 'undefined') {
          window.open(url, '_blank', 'noopener,noreferrer');
        }
      } else {
        // For iOS/Android, use WebBrowser for in-app Safari/Chrome sheet
        await WebBrowser.openBrowserAsync(url, {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.FORM_SHEET,
          controlsColor: activeTheme.colors.primary,
        });
      }
    } catch (error) {
      console.error('Error opening link:', error);
    }
  };

  const policyLinks = [
    {
      title: 'Privacy Policy',
      url: PRIVACY_URL,
      icon: 'shield-outline' as const,
    },
    {
      title: 'Terms of Service',
      url: TERMS_URL,
      icon: 'document-text-outline' as const,
    },
    {
      title: 'Copyright Consent',
      url: COPYRIGHT_URL,
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
          onPress={() => handleOpenLink(link.url)}
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

