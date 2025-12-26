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

export default function TermsOfService() {
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
            <Text style={[styles.headerTitle, { color: activeTheme.colors.text }]}>Terms of Service</Text>
          </View>
          <Ionicons name="document-text-outline" size={24} color={activeTheme.colors.primary} />
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
          'Agreement to Terms',
          <Text style={[styles.paragraph, { color: activeTheme.colors.textSecondary }]}>
            By accessing or using Taatom ("the App"), you agree to be bound by these Terms of Service ("Terms"). If you disagree with any part of these Terms, you may not access the App.
          </Text>
        )}

        {renderSection(
          'Description of Service',
          <View>
            <Text style={[styles.paragraph, { color: activeTheme.colors.textSecondary, marginBottom: 12 }]}>
              Taatom is a social media platform that allows users to:
            </Text>
            {renderBulletList([
              'Share photos and videos with location tags',
              'Connect with other users through follows, likes, and comments',
              'Discover travel destinations and experiences',
              'Create and manage collections of posts',
            ])}
          </View>
        )}

        {renderSection(
          'User Accounts',
          <View>
            <Text style={[styles.subsectionTitle, { color: activeTheme.colors.text }]}>Account Creation</Text>
            {renderBulletList([
              'You must be at least 12 years old to use the App',
              'You must provide accurate and complete information',
              'You are responsible for maintaining account security',
              'One account per person',
            ])}

            <Text style={[styles.subsectionTitle, { color: activeTheme.colors.text, marginTop: 20 }]}>
              Account Responsibilities
            </Text>
            {renderBulletList([
              'You are responsible for all activity under your account',
              'You must not share your account credentials',
              'You must notify us immediately of any unauthorized access',
              'We reserve the right to suspend or terminate accounts that violate these Terms',
            ])}
          </View>
        )}

        {renderSection(
          'User Content',
          <View>
            <Text style={[styles.subsectionTitle, { color: activeTheme.colors.text }]}>Content Ownership</Text>
            {renderBulletList([
              'You retain ownership of content you post',
              'By posting, you grant us a license to use, display, and distribute your content',
              'You represent that you have the right to post the content',
            ])}

            <Text style={[styles.subsectionTitle, { color: activeTheme.colors.text, marginTop: 20 }]}>
              Content Guidelines
            </Text>
            <Text style={[styles.paragraph, { color: activeTheme.colors.textSecondary, marginBottom: 12 }]}>
              You agree not to post content that:
            </Text>
            {renderBulletList([
              'Violates any law or regulation',
              'Infringes on intellectual property rights',
              'Contains hate speech, harassment, or threats',
              'Is pornographic, sexually explicit, or violent',
              'Promotes illegal activities',
              'Contains spam or misleading information',
              "Violates others' privacy",
            ])}

            <Text style={[styles.subsectionTitle, { color: activeTheme.colors.text, marginTop: 20 }]}>
              Content Moderation
            </Text>
            {renderBulletList([
              'We reserve the right to review, modify, or remove any content',
              'We may suspend or ban accounts that violate these guidelines',
              'Decisions regarding content are at our sole discretion',
            ])}
          </View>
        )}

        {renderSection(
          'Copyright and Intellectual Property',
          <View>
            <Text style={[styles.subsectionTitle, { color: activeTheme.colors.text }]}>Your Responsibility</Text>
            {renderBulletList([
              'You are solely responsible for ensuring you have rights to use any content you post',
              'You must not post copyrighted material without permission',
              'You agree to indemnify us against copyright claims related to your content',
            ])}

            <Text style={[styles.subsectionTitle, { color: activeTheme.colors.text, marginTop: 20 }]}>Our Rights</Text>
            {renderBulletList([
              'The App and its features are protected by copyright and trademark laws',
              'You may not copy, modify, or distribute our intellectual property without permission',
            ])}
          </View>
        )}

        {renderSection(
          'Prohibited Activities',
          <View>
            <Text style={[styles.paragraph, { color: activeTheme.colors.textSecondary, marginBottom: 12 }]}>
              You agree not to:
            </Text>
            {renderBulletList([
              'Use the App for any illegal purpose',
              "Attempt to gain unauthorized access to the App or other users' accounts",
              "Interfere with or disrupt the App's operation",
              'Use automated systems to access the App (bots, scrapers)',
              'Reverse engineer or attempt to extract source code',
              'Impersonate others or provide false information',
            ])}
          </View>
        )}

        {renderSection(
          'Termination',
          <View>
            <Text style={[styles.paragraph, { color: activeTheme.colors.textSecondary, marginBottom: 12 }]}>
              We may terminate or suspend your account immediately, without prior notice, for:
            </Text>
            {renderBulletList([
              'Violation of these Terms',
              'Illegal activity',
              'Fraud or abuse',
              'At our discretion for any reason',
            ])}

            <Text style={[styles.subsectionTitle, { color: activeTheme.colors.text, marginTop: 20 }]}>
              Upon termination:
            </Text>
            {renderBulletList([
              'Your right to use the App ceases immediately',
              'We may delete your account and content',
              'You remain liable for all obligations incurred before termination',
            ])}
          </View>
        )}

        {renderSection(
          'Disclaimers',
          <View>
            <Text style={[styles.subsectionTitle, { color: activeTheme.colors.text }]}>Service Availability</Text>
            {renderBulletList([
              'The App is provided "as is" and "as available"',
              'We do not guarantee uninterrupted or error-free service',
              'We may modify, suspend, or discontinue features at any time',
            ])}

            <Text style={[styles.subsectionTitle, { color: activeTheme.colors.text, marginTop: 20 }]}>Content Accuracy</Text>
            {renderBulletList([
              'We do not verify the accuracy of user-generated content',
              'We are not responsible for content posted by users',
              'You use the App at your own risk',
            ])}
          </View>
        )}

        {renderSection(
          'Limitation of Liability',
          <Text style={[styles.paragraph, { color: activeTheme.colors.textSecondary }]}>
            To the maximum extent permitted by law: We are not liable for any indirect, incidental, or consequential damages. Our total liability is limited to the amount you paid us (if any) in the past 12 months. Some jurisdictions do not allow limitation of liability, so this may not apply to you.
          </Text>
        )}

        {renderSection(
          'Indemnification',
          <Text style={[styles.paragraph, { color: activeTheme.colors.textSecondary }]}>
            You agree to indemnify and hold us harmless from any claims, damages, or expenses arising from your use of the App, your violation of these Terms, your violation of any law or third-party rights, or content you post.
          </Text>
        )}

        {renderSection(
          'Governing Law',
          <Text style={[styles.paragraph, { color: activeTheme.colors.textSecondary }]}>
            These Terms shall be governed by and construed in accordance with the laws of India.
          </Text>
        )}

        {renderSection(
          'Dispute Resolution',
          <View>
            <Text style={[styles.paragraph, { color: activeTheme.colors.textSecondary, marginBottom: 12 }]}>
              Any disputes arising from these Terms or the App will be resolved through:
            </Text>
            {renderBulletList([
              'Good faith negotiation',
              'Mediation (if negotiation fails)',
              'Binding arbitration or court proceedings (as applicable)',
            ])}
          </View>
        )}

        {renderSection(
          'Changes to Terms',
          <Text style={[styles.paragraph, { color: activeTheme.colors.textSecondary }]}>
            We reserve the right to modify these Terms at any time. We will notify users of material changes via in-app notification, email to registered users, and update to this page. Continued use of the App after changes constitutes acceptance of the new Terms.
          </Text>
        )}

        {renderSection(
          'Contact',
          <View>
            <Text style={[styles.paragraph, { color: activeTheme.colors.textSecondary, marginBottom: 12 }]}>
              For any legal communication:
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

