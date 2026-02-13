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
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.colors.text }]}>Community Guidelines</Text>
          <View style={styles.backBtn} />
        </View>

        <View style={[styles.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Community Guidelines</Text>
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
          <Text style={[styles.body, { color: theme.colors.textSecondary, marginTop: 12 }]}>
            Violations may result in content removal or account suspension. You can report users or content using the Report option on profiles and posts.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.linkRow, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
          onPress={() => openLink(TERMS_URL)}
        >
          <Ionicons name="document-text-outline" size={22} color={theme.colors.primary} />
          <Text style={[styles.linkText, { color: theme.colors.primary }]}>Terms of Service</Text>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.linkRow, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
          onPress={() => openLink(PRIVACY_URL)}
        >
          <Ionicons name="shield-outline" size={22} color={theme.colors.primary} />
          <Text style={[styles.linkText, { color: theme.colors.primary }]}>Privacy Policy</Text>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
        </TouchableOpacity>
      </ScrollView>
      <NavBar title="Community Guidelines" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 100 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  title: { fontSize: 18, fontWeight: '600' },
  section: {
    margin: 16,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
  },
  sectionTitle: { fontSize: 17, fontWeight: '600', marginBottom: 12 },
  zeroTolerance: { fontSize: 16, fontWeight: '700', marginBottom: 12, lineHeight: 22 },
  body: { fontSize: 15, lineHeight: 22 },
  bullet: { fontSize: 15, lineHeight: 24, marginTop: 4 },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  linkText: { flex: 1, fontSize: 16, marginLeft: 12, fontWeight: '500' },
});
