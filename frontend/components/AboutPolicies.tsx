import React from 'react';
import { Linking, Pressable, Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { theme } from '../constants/theme';

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
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      }
    } catch (error) {
      console.error('Error opening link:', error);
    }
  };

  const policyLinks = [
    {
      title: 'Privacy Policy',
      url: 'https://taatom.com/privacy',
      icon: 'shield-outline' as const,
    },
    {
      title: 'Terms of Service',
      url: 'https://taatom.com/terms',
      icon: 'document-text-outline' as const,
    },
    {
      title: 'Copyright Consent',
      url: 'https://taatom.com/copyright',
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

