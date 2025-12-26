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

export default function CopyrightConsent() {
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

  const renderNumberedList = (items: string[]) => (
    <View style={styles.numberedList}>
      {items.map((item, index) => (
        <View key={index} style={styles.numberedItem}>
          <View style={[styles.numberBadge, { backgroundColor: activeTheme.colors.primary }]}>
            <Text style={styles.numberText}>{index + 1}</Text>
          </View>
          <Text style={[styles.numberedText, { color: activeTheme.colors.textSecondary }]}>{item}</Text>
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
            <Text style={[styles.headerTitle, { color: activeTheme.colors.text }]}>Copyright Consent</Text>
          </View>
          <Ionicons name="lock-closed-outline" size={24} color={activeTheme.colors.primary} />
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
          'Overview',
          <Text style={[styles.paragraph, { color: activeTheme.colors.textSecondary }]}>
            Taatom is a platform for sharing user-generated content. This document explains your responsibilities regarding copyright and intellectual property when using our service.
          </Text>
        )}

        {renderSection(
          'Your Copyright Responsibilities',
          <View>
            <Text style={[styles.subsectionTitle, { color: activeTheme.colors.text }]}>When Posting Content</Text>
            <Text style={[styles.paragraph, { color: activeTheme.colors.textSecondary, marginBottom: 12 }]}>
              By uploading content to Taatom, you confirm that:
            </Text>
            {renderNumberedList([
              'The content is your original creation, OR you have obtained all necessary rights and permissions to use the content',
              'Any music, audio, or media in your posts is either your original creation, licensed for your use, in the public domain, or used with explicit permission from the copyright holder',
              'You will not post copyrighted material without authorization and understand that posting copyrighted content without permission violates copyright law',
            ])}
          </View>
        )}

        {renderSection(
          "Taatom's Position",
          <View>
            <Text style={[styles.subsectionTitle, { color: activeTheme.colors.text }]}>We Do Not Provide Copyrighted Music</Text>
            {renderBulletList([
              'Taatom does not provide or license copyrighted music for use in your posts',
              'Taatom currently does not provide a licensed music library',
              'You are responsible for ensuring you have rights to use any audio',
            ])}

            <Text style={[styles.subsectionTitle, { color: activeTheme.colors.text, marginTop: 20 }]}>We Are Not Responsible</Text>
            {renderBulletList([
              'Taatom is not responsible for copyright violations in user-uploaded content',
              'We act as a platform and do not review content for copyright compliance',
              'You are solely liable for any copyright infringement',
            ])}
          </View>
        )}

        {renderSection(
          'What Happens If You Violate Copyright',
          <View>
            <Text style={[styles.subsectionTitle, { color: activeTheme.colors.text }]}>Content Removal</Text>
            <Text style={[styles.paragraph, { color: activeTheme.colors.textSecondary, marginBottom: 12 }]}>
              If we receive a valid copyright complaint (DMCA takedown notice), we will:
            </Text>
            {renderBulletList([
              'Remove the infringing content immediately',
              'Notify you of the removal',
              'May suspend or terminate your account for repeated violations',
            ])}

            <Text style={[styles.subsectionTitle, { color: activeTheme.colors.text, marginTop: 20 }]}>Legal Consequences</Text>
            {renderBulletList([
              'Copyright holders may pursue legal action against you',
              'You may be liable for damages, legal fees, and other costs',
              'Taatom will cooperate with valid legal requests',
            ])}
          </View>
        )}

        {renderSection(
          'How to Report Copyright Infringement',
          <View>
            <Text style={[styles.paragraph, { color: activeTheme.colors.textSecondary, marginBottom: 12 }]}>
              If you believe your copyright has been infringed:
            </Text>
            {renderNumberedList([
              'Contact Us: Email contact@taatom.com. Include: Description of copyrighted work, location of infringing content, your contact information',
              'DMCA Takedown Notice: We comply with the Digital Millennium Copyright Act (DMCA). Submit a formal DMCA notice with required information. We will process valid notices promptly',
            ])}
          </View>
        )}

        {renderSection(
          'Best Practices',
          <View>
            <Text style={[styles.subsectionTitle, { color: activeTheme.colors.text }]}>To Avoid Copyright Issues</Text>
            {renderNumberedList([
              'Use Original Content: Create your own photos, videos, and audio. This is the safest way to avoid copyright issues',
              'Use Licensed Content: Use content from royalty-free or Creative Commons sources. Verify the license allows commercial use if applicable. Attribute content as required by the license',
              'Get Permission: Contact copyright holders for explicit permission. Keep records of permissions granted. Understand the scope of permission granted',
              'Taatom Music Library: Taatom currently does not provide a licensed music library. Users may upload content only if they own or have rights to the audio used.',
            ])}
          </View>
        )}

        {renderSection(
          'User Agreement',
          <View>
            <Text style={[styles.paragraph, { color: activeTheme.colors.textSecondary, marginBottom: 12 }]}>
              By using Taatom, you agree that:
            </Text>
            {renderBulletList([
              'You understand your copyright responsibilities',
              'You will not post copyrighted content without permission',
              'You accept full liability for copyright violations',
              'You will indemnify Taatom against copyright claims related to your content',
              'You understand that Taatom may remove content and suspend accounts for violations',
            ])}
          </View>
        )}

        {renderSection(
          'Copyright Confirmation Modal',
          <View>
            <View style={[styles.infoBox, { backgroundColor: activeTheme.colors.surface, borderColor: activeTheme.colors.border }]}>
              <Ionicons name="information-circle-outline" size={24} color={activeTheme.colors.primary} />
              <View style={styles.infoContent}>
                <Text style={[styles.infoTitle, { color: activeTheme.colors.text }]}>Important Notice</Text>
                <Text style={[styles.infoText, { color: activeTheme.colors.textSecondary }]}>
                  When uploading content with audio, you will see a copyright confirmation modal that requires you to read and understand your responsibilities, confirm you have rights to use the audio, and agree to take full responsibility for copyright compliance.
                </Text>
                <Text style={[styles.infoBold, { color: activeTheme.colors.text, marginTop: 8 }]}>
                  You cannot proceed with uploads until you confirm your understanding and agreement.
                </Text>
              </View>
            </View>
          </View>
        )}

        {renderSection(
          'Contact',
          <View>
            <Text style={[styles.paragraph, { color: activeTheme.colors.textSecondary, marginBottom: 12 }]}>
              For copyright communication:
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
  numberedList: {
    marginTop: theme.spacing.sm,
  },
  numberedItem: {
    flexDirection: 'row',
    marginBottom: theme.spacing.md,
    alignItems: 'flex-start',
  },
  numberBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.sm,
    marginTop: 2,
  },
  numberText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: getFontFamily('700'),
  },
  numberedText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: getFontFamily('400'),
    paddingTop: 4,
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
  infoBox: {
    flexDirection: 'row',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    marginTop: theme.spacing.sm,
  },
  infoContent: {
    flex: 1,
    marginLeft: theme.spacing.md,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: theme.spacing.xs,
    fontFamily: getFontFamily('600'),
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: getFontFamily('400'),
  },
  infoBold: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    fontFamily: getFontFamily('600'),
  },
});

