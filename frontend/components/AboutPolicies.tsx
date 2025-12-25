import React, { useMemo } from 'react';
import { Linking, Pressable, Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { theme } from '../constants/theme';
import { WEB_SHARE_URL } from '../utils/config';

interface AboutPoliciesProps {
  onLinkPress?: (url: string) => void;
}

// Helper function to get base domain from WEB_SHARE_URL
const getBaseDomain = (): string => {
  try {
    const shareUrl = WEB_SHARE_URL || '';
    if (!shareUrl) {
      // Fallback to default domain if WEB_SHARE_URL is not set
      return 'https://taatom.com';
    }
    
    // Extract domain from URL (handle both http and https)
    const url = shareUrl.trim();
    const urlObj = new URL(url);
    return `${urlObj.protocol}//${urlObj.host}`;
  } catch (error) {
    // If URL parsing fails, try to extract domain manually
    const shareUrl = WEB_SHARE_URL || '';
    if (shareUrl.startsWith('http://') || shareUrl.startsWith('https://')) {
      const match = shareUrl.match(/^https?:\/\/([^\/]+)/);
      if (match) {
        return shareUrl.startsWith('https') ? `https://${match[1]}` : `http://${match[1]}`;
      }
    }
    // Final fallback
    return 'https://taatom.com';
  }
};

export default function AboutPolicies({ onLinkPress }: AboutPoliciesProps) {
  const { theme: themeContext } = useTheme();
  const activeTheme = themeContext || theme;

  // Get base domain from environment variable
  const baseDomain = useMemo(() => getBaseDomain(), []);

  const handleOpenLink = async (url: string) => {
    if (onLinkPress) {
      onLinkPress(url);
      return;
    }

    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      }
    } catch (error) {
      console.error('Error opening link:', error);
    }
  };

  const policyLinks = useMemo(() => [
    {
      title: 'Privacy Policy',
      url: `${baseDomain}/privacy`,
      icon: 'shield-outline' as const,
    },
    {
      title: 'Terms of Service',
      url: `${baseDomain}/terms`,
      icon: 'document-text-outline' as const,
    },
    {
      title: 'Copyright Consent',
      url: `${baseDomain}/copyright`,
      icon: 'lock-closed-outline' as const,
    },
  ], [baseDomain]);

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

