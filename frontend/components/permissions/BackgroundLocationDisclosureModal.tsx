import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { GlassButton } from '../ui/GlassButton';
import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra ?? {};
const PRIVACY_URL =
  (extra.PRIVACY_POLICY_URL as string | undefined) || 'https://taatom.com/privacy';

type BackgroundLocationDisclosureModalProps = {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
};

/**
 * Google Play "Prominent Disclosure" for BACKGROUND_LOCATION.
 * Must appear in-app, before the OS permission dialog, with clear data use and affirmative consent.
 */
export function BackgroundLocationDisclosureModal({
  visible,
  onAccept,
  onDecline,
}: BackgroundLocationDisclosureModalProps) {
  const { theme } = useTheme();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      presentationStyle="overFullScreen"
      onRequestClose={() => {}}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <View style={[styles.iconWrap, { backgroundColor: theme.colors.primary + '18' }]}>
            <Ionicons name="navigate" size={28} color={theme.colors.primary} />
          </View>

          <Text style={[styles.title, { color: theme.colors.text }]}>
            Background location for journey tracking
          </Text>

          <ScrollView style={styles.bodyScroll} showsVerticalScrollIndicator={false}>
            <Text style={[styles.body, { color: theme.colors.textSecondary }]}>
              Taatom collects location data to enable journey tracking and trip recording even when the app is closed or not in use. This allows the app to record your journey path without interruption when you lock your phone or switch apps.
            </Text>
            <Text style={[styles.body, { color: theme.colors.textSecondary, marginTop: 12 }]}>
              This data is used only to save and display your journey. It is not sold to third parties or used for advertising. You can decline and still use journeys while the app stays open; background recording will be limited.
            </Text>
            <TouchableOpacity
              onPress={() => Linking.openURL(PRIVACY_URL)}
              accessibilityRole="link"
              style={styles.privacyLink}
            >
              <Text style={[styles.privacyText, { color: theme.colors.primary }]}>
                View Privacy Policy
              </Text>
            </TouchableOpacity>
          </ScrollView>

          <GlassButton
            variant="primary"
            title="Agree and continue"
            onPress={onAccept}
            style={{ width: '100%', marginBottom: 8 }}
          />

          <GlassButton
            variant="ghost"
            title="Not now — track only while app is open"
            onPress={onDecline}
            style={{ width: '100%', height: 44 }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    padding: 16,
  },
  card: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
    maxHeight: '88%',
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  bodyScroll: {
    maxHeight: 220,
    marginBottom: 16,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
  },
  strong: {
    fontWeight: '700',
  },
  privacyLink: {
    marginTop: 14,
    alignSelf: 'flex-start',
  },
  privacyText: {
    fontSize: 14,
    fontWeight: '600',
  },
  primaryBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
