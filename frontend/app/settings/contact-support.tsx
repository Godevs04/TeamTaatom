/**
 * Contact Support - Apple Guideline 1.2 (Developer contact)
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
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
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]}>Contact Support</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={[styles.content, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Ionicons name="mail-outline" size={48} color={theme.colors.primary} />
        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Email us at</Text>
        <TouchableOpacity onPress={openEmail} activeOpacity={0.7}>
          <Text style={[styles.email, { color: theme.colors.primary }]}>{SUPPORT_EMAIL}</Text>
        </TouchableOpacity>
      </View>
      <NavBar title="Contact Support" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  content: {
    margin: 16,
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  label: { fontSize: 14, marginTop: 12 },
  email: { fontSize: 18, fontWeight: '600', marginTop: 4 },
});
