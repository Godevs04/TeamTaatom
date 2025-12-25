import React, { useMemo } from 'react';
import { Linking, Pressable, Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { theme } from '../constants/theme';
import { WEB_SHARE_URL, getApiBaseUrl } from '../utils/config';

interface AboutPoliciesProps {
  onLinkPress?: (url: string) => void;
}

// Helper function to get base domain from environment variables
// Priority: WEB_SHARE_URL > API_BASE_URL (derived) > fallback
const getBaseDomain = (): string => {
  try {
    // Priority 1: Use WEB_SHARE_URL if available
    const shareUrl = WEB_SHARE_URL || '';
    if (shareUrl) {
      const url = shareUrl.trim();
      const urlObj = new URL(url);
      return `${urlObj.protocol}//${urlObj.host}`;
    }
    
    // Priority 2: Derive from API_BASE_URL
    const apiUrl = getApiBaseUrl();
    if (apiUrl) {
      try {
        const apiUrlObj = new URL(apiUrl);
        // Convert to HTTPS for web share domain (production)
        return `https://${apiUrlObj.host.replace(/:\d+$/, '')}`;
      } catch {
        // If API URL parsing fails, try manual extraction
        const match = apiUrl.match(/^https?:\/\/([^\/:]+)/);
        if (match) {
          return `https://${match[1]}`;
        }
      }
    }
    
    // Priority 3: Try to extract from API URL manually
    if (apiUrl.startsWith('http://') || apiUrl.startsWith('https://')) {
      const match = apiUrl.match(/^https?:\/\/([^\/:]+)/);
      if (match) {
        return `https://${match[1]}`;
      }
    }
  } catch (error) {
    console.error('Error extracting base domain:', error);
  }
  
  // Final fallback: This should not happen in production if env vars are set
  // In production, this will cause an error if env vars are missing
  const isProduction = process.env.EXPO_PUBLIC_ENV === 'production' || process.env.NODE_ENV === 'production';
  if (isProduction) {
    console.error('PRODUCTION ERROR: WEB_SHARE_URL or API_BASE_URL must be set in environment variables');
  }
  
  // Development fallback only
  return 'https://taatom.com';
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

