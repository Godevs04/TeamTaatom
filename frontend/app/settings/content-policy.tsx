/**
 * Content Policy screen - Apple Guideline 1.2 UGC
 * Accessible from Settings
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import NavBar from '../../components/NavBar';
import { useTheme } from '../../context/ThemeContext';
import Constants from 'expo-constants';

const TERMS_URL = Constants.expoConfig?.extra?.TERMS_OF_SERVICE_URL || 'https://taatom.com/terms';
const PRIVACY_URL = Constants.expoConfig?.extra?.PRIVACY_POLICY_URL || 'https://taatom.com/privacy';

export default function ContentPolicyScreen() {
  const { theme } = useTheme();
  const router = useRouter();

  const openLink = (url: string) => {
    Linking.openURL(url).catch(() => {});
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <NavBar title="Community Guidelines" showBack onBack={() => router.back()} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: theme.spacing.xxl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.zeroTolerance, { color: theme.colors.text }]}>
            We have zero tolerance for objectionable, abusive, hateful, sexual, violent, or illegal content.
          </Text>
          <Text style={[styles.body, { color: theme.colors.textSecondary }]}>
            Taatom is a community for sharing travel experiences. To keep our community safe:
          </Text>
          <Text style={[styles.bullet, { color: theme.colors.textSecondary }]}>
            • No objectionable, abusive, or illegal content is tolerated.
          </Text>
          <Text style={[styles.bullet, { color: theme.colors.textSecondary }]}>
            • No spam, harassment, or fake accounts.
          </Text>
          <Text style={[styles.bullet, { color: theme.colors.textSecondary }]}>
            • No content that promotes violence, hate, or discrimination.
          </Text>
          <Text style={[styles.body, styles.bodyLast, { color: theme.colors.textSecondary }]}>
            Violations may result in content removal or account suspension. You can report users or content using the Report option on profiles and posts.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.linkRow, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
          onPress={() => openLink(TERMS_URL)}
          activeOpacity={0.7}
        >
          <Ionicons name="document-text-outline" size={22} color={theme.colors.primary} />
          <Text style={[styles.linkText, { color: theme.colors.primary }]}>Terms of Service</Text>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.linkRow, styles.linkRowLast, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
          onPress={() => openLink(PRIVACY_URL)}
          activeOpacity={0.7}
        >
          <Ionicons name="shield-outline" size={22} color={theme.colors.primary} />
          <Text style={[styles.linkText, { color: theme.colors.primary }]}>Privacy Policy</Text>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  section: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  zeroTolerance: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: 14,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 10,
  },
  bodyLast: {
    marginTop: 4,
    marginBottom: 0,
  },
  bullet: {
    fontSize: 15,
    lineHeight: 24,
    marginTop: 2,
    marginLeft: 2,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 10,
    borderRadius: 16,
    borderWidth: 1,
  },
  linkRowLast: {
    marginBottom: 0,
  },
  linkText: {
    flex: 1,
    fontSize: 16,
    marginLeft: 14,
    fontWeight: '500',
  },
});
