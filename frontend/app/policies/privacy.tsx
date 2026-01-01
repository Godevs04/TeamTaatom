import React from 'react';
import { View, Text, ScrollView, StyleSheet, Platform, Dimensions, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { theme } from '../../constants/theme';

const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth >= 768;
const isWeb = Platform.OS === 'web';

const getFontFamily = (weight: '400' | '500' | '600' | '700' | '800' = '400') => {
  if (isWeb) return 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  if (Platform.OS === 'ios') return 'System';
  return 'Roboto';
};

export default function PrivacyPolicy() {
  const router = useRouter();
  const { theme: themeContext } = useTheme();
  const activeTheme = themeContext || theme;

  const renderSection = (title: string, content: React.ReactNode) => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: activeTheme.colors.text }]}>{title}</Text>
      <View style={styles.sectionContent}>{content}</View>
    </View>
  );

  const renderBulletList = (items: string[]) => (
    <View style={styles.bulletList}>
      {items.map((item, index) => (
        <View key={index} style={styles.bulletItem}>
          <Text style={[styles.bullet, { color: activeTheme.colors.primary }]}>•</Text>
          <Text style={[styles.bulletText, { color: activeTheme.colors.textSecondary }]}>{item}</Text>
        </View>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: activeTheme.colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: activeTheme.colors.surface, borderBottomColor: activeTheme.colors.border }]}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons
                name="arrow-back"
                size={24}
                color={activeTheme.colors.text}
              />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: activeTheme.colors.text }]}>Privacy Policy</Text>
          </View>
          <Ionicons name="shield-outline" size={24} color={activeTheme.colors.primary} />
        </View>
        <Text style={[styles.lastUpdated, { color: activeTheme.colors.textSecondary }]}>
          Last Updated: December 25, 2025
        </Text>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {renderSection(
          'Introduction',
          <Text style={[styles.paragraph, { color: activeTheme.colors.textSecondary }]}>
            Taatom ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application and services.
          </Text>
        )}

        {renderSection(
          'Information We Collect',
          <View>
            <Text style={[styles.subsectionTitle, { color: activeTheme.colors.text }]}>Personal Information</Text>
            {renderBulletList([
              'Account Information: Username, email address, full name, profile picture',
              'Content: Photos, videos, captions, location data, and other content you post',
              'Device Information: Device type, operating system, unique device identifiers',
              'Location Data: GPS coordinates when you tag posts with location (optional)',
            ])}

            <Text style={[styles.subsectionTitle, { color: activeTheme.colors.text, marginTop: 20 }]}>
              Automatically Collected Information
            </Text>
            {renderBulletList([
              'Usage Data: How you interact with the app, features used, time spent',
              'Log Data: IP address, access times, app crashes, performance data',
              'Cookies and Tracking: Analytics data to improve app performance',
            ])}

            <Text style={[styles.subsectionTitle, { color: activeTheme.colors.text, marginTop: 20 }]}>
              App Tracking Transparency (iOS)
            </Text>
            <Text style={[styles.paragraph, { color: activeTheme.colors.textSecondary }]}>
              We do not track users across third-party apps or external websites without explicit user consent, in compliance with Apple App Tracking Transparency (ATT).
            </Text>
          </View>
        )}

        {renderSection(
          'How We Use Your Information',
          <View>
            <Text style={[styles.paragraph, { color: activeTheme.colors.textSecondary, marginBottom: 12 }]}>
              We use the information we collect to:
            </Text>
            {renderBulletList([
              'Provide, maintain, and improve our services',
              'Process and display your posts and content',
              'Enable social features (likes, comments, follows)',
              'Send notifications about activity on your account',
              'Respond to your support requests',
              'Detect and prevent fraud or abuse',
              'Comply with legal obligations',
            ])}
          </View>
        )}

        {renderSection(
          'Information Sharing',
          <View>
            <Text style={[styles.paragraph, { color: activeTheme.colors.textSecondary, marginBottom: 12 }]}>
              We do not sell your personal information. We may share your information:
            </Text>
            {renderBulletList([
              'With Other Users: Your public profile and posts are visible to other users',
              'Service Providers: Third-party services that help us operate (hosting, analytics)',
              'Legal Requirements: When required by law or to protect our rights',
              'Business Transfers: In connection with a merger, acquisition, or sale',
            ])}
          </View>
        )}

        {renderSection(
          'Data Security',
          <View>
            <Text style={[styles.paragraph, { color: activeTheme.colors.textSecondary, marginBottom: 12 }]}>
              We implement appropriate technical and organizational measures to protect your data:
            </Text>
            {renderBulletList([
              'Encryption of data in transit (HTTPS)',
              'Secure authentication and authorization',
              'Regular security audits and updates',
              'Access controls and employee training',
            ])}
          </View>
        )}

        {renderSection(
          'Your Rights',
          <View>
            <Text style={[styles.paragraph, { color: activeTheme.colors.textSecondary, marginBottom: 12 }]}>
              You have the right to:
            </Text>
            {renderBulletList([
              'Access your personal data',
              'Correct inaccurate data',
              'Delete your account and data',
              'Export your data',
              'Opt-out of certain data processing',
              'Withdraw consent where applicable',
            ])}
          </View>
        )}

        {renderSection(
          "Children's Privacy",
          <Text style={[styles.paragraph, { color: activeTheme.colors.textSecondary }]}>
            Our app is not intended for users under 12 years of age. We do not knowingly collect personal information from children under 12. If you believe we have collected information from a child, please contact us immediately.
          </Text>
        )}

        {renderSection(
          'International Data Transfers',
          <Text style={[styles.paragraph, { color: activeTheme.colors.textSecondary }]}>
            Your information may be transferred to and processed in countries other than your country of residence. We ensure appropriate safeguards are in place for such transfers.
          </Text>
        )}

        {renderSection(
          'Changes to This Policy',
          <Text style={[styles.paragraph, { color: activeTheme.colors.textSecondary }]}>
            We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the "Last Updated" date.
          </Text>
        )}

        {renderSection(
          'Contact Us',
          <View>
            <Text style={[styles.paragraph, { color: activeTheme.colors.textSecondary, marginBottom: 12 }]}>
              If you have questions about this Privacy Policy, please contact us at:
            </Text>
            <View style={[styles.contactBox, { backgroundColor: activeTheme.colors.surface, borderColor: activeTheme.colors.border }]}>
              <Ionicons name="mail-outline" size={20} color={activeTheme.colors.primary} />
              <Text style={[styles.contactText, { color: activeTheme.colors.primary }]}>contact@taatom.com</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...(isWeb && {
      maxWidth: isTablet ? 900 : 700,
      alignSelf: 'center',
      width: '100%',
    } as any),
  },
  header: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xs,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    marginRight: theme.spacing.md,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: getFontFamily('700'),
  },
  lastUpdated: {
    fontSize: 12,
    marginTop: theme.spacing.xs,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: theme.spacing.md,
    fontFamily: getFontFamily('700'),
  },
  sectionContent: {
    marginTop: theme.spacing.sm,
  },
  subsectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.md,
    fontFamily: getFontFamily('600'),
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 24,
    marginBottom: theme.spacing.md,
    fontFamily: getFontFamily('400'),
  },
  bulletList: {
    marginTop: theme.spacing.sm,
  },
  bulletItem: {
    flexDirection: 'row',
    marginBottom: theme.spacing.sm,
    paddingLeft: theme.spacing.xs,
  },
  bullet: {
    fontSize: 18,
    marginRight: theme.spacing.sm,
    fontWeight: '600',
  },
  bulletText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: getFontFamily('400'),
  },
  contactBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    marginTop: theme.spacing.sm,
  },
  contactText: {
    fontSize: 15,
    fontWeight: '500',
    marginLeft: theme.spacing.sm,
    fontFamily: getFontFamily('500'),
  },
});

