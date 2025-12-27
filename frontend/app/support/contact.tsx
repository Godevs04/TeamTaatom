import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Platform, Dimensions, TouchableOpacity, TextInput, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { theme } from '../../constants/theme';
import { getUserFromStorage } from '../../services/auth';
import logger from '../../utils/logger';

const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth >= 768;
const isWeb = Platform.OS === 'web';

const getFontFamily = (weight: '400' | '500' | '600' | '700' | '800' = '400') => {
  if (isWeb) return 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  if (Platform.OS === 'ios') return 'System';
  return 'Roboto';
};

export default function ContactSupport() {
  const router = useRouter();
  const { theme: themeContext } = useTheme();
  const activeTheme = themeContext || theme;
  const [user, setUser] = useState<any>(null);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const userData = await getUserFromStorage();
      setUser(userData);
      // Pre-fill subject
      setSubject('Taatom Support Request');
      // Pre-fill message with user info
      setMessage(
        `Hello Taatom Support Team,\n\n` +
        `User ID: ${userData?.username ? `@${userData.username}` : userData?._id || 'Unknown'}\n` +
        `Email: ${userData?.email || 'Unknown'}\n` +
        `Platform: ${Platform.OS}\n\n` +
        `Please describe your issue or question below:\n\n`
      );
    } catch (error) {
      logger.error('Error loading user:', error);
    }
  };

  const handleSendEmail = async () => {
    const supportEmail = 'contact@taatom.com';
    const encodedSubject = encodeURIComponent(subject || 'Taatom Support Request');
    const encodedBody = encodeURIComponent(message || '');
    const mailtoUrl = `mailto:${supportEmail}?subject=${encodedSubject}&body=${encodedBody}`;

    try {
      const canOpen = await Linking.canOpenURL(mailtoUrl);
      if (canOpen) {
        await Linking.openURL(mailtoUrl);
      } else {
        // Fallback: Copy email to clipboard
        await handleCopyEmail();
      }
    } catch (error) {
      logger.error('Error opening email:', error);
      // Fallback: Copy email to clipboard
      await handleCopyEmail();
    }
  };

  const handleCopyEmail = async () => {
    const supportEmail = 'contact@taatom.com';
    try {
      if (Platform.OS === 'web') {
        // Web: Use navigator.clipboard API
        if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(supportEmail);
          Alert.alert('Email Copied', `Support email (${supportEmail}) has been copied to your clipboard.`);
        } else {
          // Fallback for older browsers
          Alert.alert('Support Email', `Please send an email to: ${supportEmail}`);
        }
      } else {
        // Mobile: Try to use expo-clipboard if available, otherwise show alert
        try {
          const Clipboard = require('expo-clipboard').default;
          await Clipboard.setStringAsync(supportEmail);
          Alert.alert('Email Copied', `Support email (${supportEmail}) has been copied to your clipboard.`);
        } catch (expoClipboardError) {
          // Fallback: Show email in alert so user can manually copy
          Alert.alert('Support Email', `Please send an email to: ${supportEmail}\n\nTap and hold to copy.`);
        }
      }
    } catch (error) {
      Alert.alert('Support Email', `Please send an email to: ${supportEmail}`);
    }
  };

  const handleOpenWebsite = () => {
    Linking.openURL('https://taatom.com/support').catch(() => {
      Alert.alert('Error', 'Failed to open support website');
    });
  };

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
            <Text style={[styles.headerTitle, { color: activeTheme.colors.text }]}>Contact Support</Text>
          </View>
          <Ionicons name="help-circle-outline" size={24} color={activeTheme.colors.primary} />
        </View>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Info Section */}
        <View style={[styles.infoBox, { backgroundColor: activeTheme.colors.surface, borderColor: activeTheme.colors.border }]}>
          <Ionicons name="information-circle-outline" size={24} color={activeTheme.colors.primary} />
          <View style={styles.infoContent}>
            <Text style={[styles.infoTitle, { color: activeTheme.colors.text }]}>Get Help</Text>
            <Text style={[styles.infoText, { color: activeTheme.colors.textSecondary }]}>
              We're here to help! Contact us via email or visit our support website for assistance.
            </Text>
          </View>
        </View>

        {/* Email Form */}
        <View style={[styles.formSection, { backgroundColor: activeTheme.colors.surface, borderColor: activeTheme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: activeTheme.colors.text }]}>Send us an Email</Text>
          
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: activeTheme.colors.text }]}>Subject</Text>
            <TextInput
              style={[styles.input, { backgroundColor: activeTheme.colors.background, color: activeTheme.colors.text, borderColor: activeTheme.colors.border }]}
              value={subject}
              onChangeText={setSubject}
              placeholder="Enter subject"
              placeholderTextColor={activeTheme.colors.textSecondary}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: activeTheme.colors.text }]}>Message</Text>
            <TextInput
              style={[styles.textArea, { backgroundColor: activeTheme.colors.background, color: activeTheme.colors.text, borderColor: activeTheme.colors.border }]}
              value={message}
              onChangeText={setMessage}
              placeholder="Describe your issue or question..."
              placeholderTextColor={activeTheme.colors.textSecondary}
              multiline
              numberOfLines={8}
              textAlignVertical="top"
            />
          </View>

          <TouchableOpacity
            style={[styles.sendButton, { backgroundColor: activeTheme.colors.primary }]}
            onPress={handleSendEmail}
          >
            <Ionicons name="mail-outline" size={20} color="#FFFFFF" />
            <Text style={styles.sendButtonText}>Send Email</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Actions */}
        <View style={[styles.actionsSection, { backgroundColor: activeTheme.colors.surface, borderColor: activeTheme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: activeTheme.colors.text }]}>Quick Actions</Text>
          
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: activeTheme.colors.background, borderColor: activeTheme.colors.border }]}
            onPress={handleCopyEmail}
          >
            <Ionicons name="copy-outline" size={20} color={activeTheme.colors.primary} />
            <Text style={[styles.actionButtonText, { color: activeTheme.colors.primary }]}>Copy Email Address</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: activeTheme.colors.background, borderColor: activeTheme.colors.border }]}
            onPress={handleOpenWebsite}
          >
            <Ionicons name="globe-outline" size={20} color={activeTheme.colors.primary} />
            <Text style={[styles.actionButtonText, { color: activeTheme.colors.primary }]}>Visit Support Website</Text>
          </TouchableOpacity>
        </View>

        {/* Contact Info */}
        <View style={[styles.contactSection, { backgroundColor: activeTheme.colors.surface, borderColor: activeTheme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: activeTheme.colors.text }]}>Contact Information</Text>
          
          <View style={[styles.contactBox, { backgroundColor: activeTheme.colors.background, borderColor: activeTheme.colors.border }]}>
            <Ionicons name="mail-outline" size={20} color={activeTheme.colors.primary} />
            <Text style={[styles.contactText, { color: activeTheme.colors.text }]}>support@taatom.com</Text>
          </View>

          <Text style={[styles.contactNote, { color: activeTheme.colors.textSecondary }]}>
            We typically respond within 24-48 hours. For urgent matters, please include "URGENT" in your subject line.
          </Text>
        </View>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
  infoBox: {
    flexDirection: 'row',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    marginBottom: theme.spacing.lg,
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
  formSection: {
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: theme.spacing.md,
    fontFamily: getFontFamily('600'),
  },
  inputContainer: {
    marginBottom: theme.spacing.md,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: theme.spacing.xs,
    fontFamily: getFontFamily('500'),
  },
  input: {
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: 15,
    fontFamily: getFontFamily('400'),
  },
  textArea: {
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: 15,
    minHeight: 120,
    fontFamily: getFontFamily('400'),
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.sm,
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: theme.spacing.sm,
    fontFamily: getFontFamily('600'),
  },
  actionsSection: {
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    marginBottom: theme.spacing.lg,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    marginBottom: theme.spacing.sm,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '500',
    marginLeft: theme.spacing.sm,
    fontFamily: getFontFamily('500'),
  },
  contactSection: {
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
  },
  contactBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    marginBottom: theme.spacing.md,
  },
  contactText: {
    fontSize: 15,
    fontWeight: '500',
    marginLeft: theme.spacing.sm,
    fontFamily: getFontFamily('500'),
  },
  contactNote: {
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic',
    fontFamily: getFontFamily('400'),
  },
});

