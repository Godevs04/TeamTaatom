import React from 'react';
import { View, Text, ScrollView, StyleSheet, Platform, Dimensions, TouchableOpacity, Linking, Alert } from 'react-native';
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

export default function HelpCenter() {
  const router = useRouter();
  const { theme: themeContext } = useTheme();
  const activeTheme = themeContext || theme;

  const helpTopics = [
    {
      title: 'Getting Started',
      icon: 'rocket-outline' as const,
      items: [
        'How to create an account',
        'Setting up your profile',
        'Posting your first photo',
        'Finding and following users',
      ],
    },
    {
      title: 'Account & Settings',
      icon: 'settings-outline' as const,
      items: [
        'Managing your account',
        'Privacy settings',
        'Notification preferences',
        'Changing your password',
      ],
    },
    {
      title: 'Posts & Content',
      icon: 'image-outline' as const,
      items: [
        'Uploading photos and videos',
        'Adding location tags',
        'Creating collections',
        'Editing and deleting posts',
      ],
    },
    {
      title: 'Social Features',
      icon: 'people-outline' as const,
      items: [
        'Following and followers',
        'Likes and comments',
        'Sharing posts',
        'Messaging other users',
      ],
    },
    {
      title: 'Troubleshooting',
      icon: 'construct-outline' as const,
      items: [
        'App not loading',
        'Upload issues',
        'Login problems',
        'Notification issues',
      ],
    },
  ];

  const handleOpenWebsite = () => {
    Linking.openURL('https://taatom.com/contact').catch(() => {
      Alert.alert('Error', 'Failed to open help website');
    });
  };

  const handleContactSupport = () => {
    router.push('/support/contact');
  };

  const renderHelpSection = (topic: typeof helpTopics[0], index: number) => (
    <View key={index} style={[styles.topicCard, { backgroundColor: activeTheme.colors.surface, borderColor: activeTheme.colors.border }]}>
      <View style={styles.topicHeader}>
        <Ionicons name={topic.icon} size={24} color={activeTheme.colors.primary} />
        <Text style={[styles.topicTitle, { color: activeTheme.colors.text }]}>{topic.title}</Text>
      </View>
      <View style={styles.topicItems}>
        {topic.items.map((item, itemIndex) => (
          <View key={itemIndex} style={styles.topicItem}>
            <Text style={[styles.topicBullet, { color: activeTheme.colors.primary }]}>•</Text>
            <Text style={[styles.topicItemText, { color: activeTheme.colors.textSecondary }]}>{item}</Text>
          </View>
        ))}
      </View>
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
            <Text style={[styles.headerTitle, { color: activeTheme.colors.text }]}>Help Center</Text>
          </View>
          <Ionicons name="book-outline" size={24} color={activeTheme.colors.primary} />
        </View>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Welcome Section */}
        <View style={[styles.welcomeBox, { backgroundColor: activeTheme.colors.surface, borderColor: activeTheme.colors.border }]}>
          <Ionicons name="help-circle" size={48} color={activeTheme.colors.primary} />
          <Text style={[styles.welcomeTitle, { color: activeTheme.colors.text }]}>How can we help you?</Text>
          <Text style={[styles.welcomeText, { color: activeTheme.colors.textSecondary }]}>
            Find answers to common questions and learn how to get the most out of Taatom.
          </Text>
        </View>

        {/* Help Topics */}
        <View style={styles.topicsContainer}>
          {helpTopics.map(renderHelpSection)}
        </View>

        {/* Quick Actions */}
        <View style={[styles.actionsSection, { backgroundColor: activeTheme.colors.surface, borderColor: activeTheme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: activeTheme.colors.text }]}>Still need help?</Text>
          
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: activeTheme.colors.primary }]}
            onPress={handleContactSupport}
          >
            <Ionicons name="mail-outline" size={20} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Contact Support</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButtonSecondary, { backgroundColor: activeTheme.colors.background, borderColor: activeTheme.colors.border }]}
            onPress={handleOpenWebsite}
          >
            <Ionicons name="globe-outline" size={20} color={activeTheme.colors.primary} />
            <Text style={[styles.actionButtonTextSecondary, { color: activeTheme.colors.primary }]}>Visit Help Website</Text>
          </TouchableOpacity>
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
  welcomeBox: {
    alignItems: 'center',
    padding: theme.spacing.xl,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    marginBottom: theme.spacing.xl,
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
    fontFamily: getFontFamily('700'),
  },
  welcomeText: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    fontFamily: getFontFamily('400'),
  },
  topicsContainer: {
    marginBottom: theme.spacing.xl,
  },
  topicCard: {
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    marginBottom: theme.spacing.md,
  },
  topicHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  topicTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: theme.spacing.sm,
    fontFamily: getFontFamily('600'),
  },
  topicItems: {
    marginLeft: theme.spacing.xl,
  },
  topicItem: {
    flexDirection: 'row',
    marginBottom: theme.spacing.sm,
  },
  topicBullet: {
    fontSize: 16,
    marginRight: theme.spacing.sm,
    fontWeight: '600',
  },
  topicItemText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: getFontFamily('400'),
  },
  actionsSection: {
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: theme.spacing.md,
    textAlign: 'center',
    fontFamily: getFontFamily('600'),
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    width: '100%',
    marginBottom: theme.spacing.sm,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: theme.spacing.sm,
    fontFamily: getFontFamily('600'),
  },
  actionButtonSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    width: '100%',
  },
  actionButtonTextSecondary: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: theme.spacing.sm,
    fontFamily: getFontFamily('600'),
  },
});

