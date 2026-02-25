/**
 * Contact Support - Apple Guideline 1.2 (Developer contact)
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import NavBar from '../../components/NavBar';
import { useTheme } from '../../context/ThemeContext';

const SUPPORT_EMAIL = 'contact@taatom.com';

export default function ContactSupportScreen() {
  const { theme } = useTheme();
  const router = useRouter();

  const openEmail = () => {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => {});
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <NavBar title="Contact Support" showBack onBack={() => router.back()} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: theme.spacing.xxl }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Ionicons name="mail-outline" size={48} color={theme.colors.primary} />
          <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Email us at</Text>
          <TouchableOpacity onPress={openEmail} activeOpacity={0.7}>
            <Text style={[styles.email, { color: theme.colors.primary }]}>{SUPPORT_EMAIL}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  card: {
    paddingVertical: 28,
    paddingHorizontal: 24,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 15,
    marginTop: 14,
  },
  email: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 6,
  },
});
