import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface CopyrightConfirmationModalProps {
  visible: boolean;
  onCancel: () => void;
  onAgree: () => void;
}

export default function CopyrightConfirmationModal({
  visible,
  onCancel,
  onAgree,
}: CopyrightConfirmationModalProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [agreed, setAgreed] = useState(false);

  const handleAgree = () => {
    if (agreed) {
      onAgree();
      setAgreed(false); // Reset for next time
    }
  };

  const handleCancel = () => {
    setAgreed(false);
    onCancel();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <View style={styles.overlay}>
        <View style={[styles.modalContainer, { backgroundColor: theme.colors.surface }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.iconContainer, { backgroundColor: theme.colors.primary + '15' }]}>
              <Ionicons name="warning" size={24} color={theme.colors.primary} />
            </View>
            <Text style={[styles.title, { color: theme.colors.text }]}>
              Copyright Confirmation
            </Text>
          </View>

          {/* Content */}
          <ScrollView 
            style={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <Text style={[styles.message, { color: theme.colors.text }]}>
              I confirm that the audio used in this video is either my original creation
              or I have the legal rights/permission to use it.
            </Text>

            <View style={[styles.bulletList, { backgroundColor: theme.colors.surfaceSecondary }]}>
              <View style={styles.bulletItem}>
                <Ionicons name="checkmark-circle" size={16} color={theme.colors.primary} style={styles.bulletIcon} />
                <Text style={[styles.bulletText, { color: theme.colors.text }]}>
                  Taatom does not provide copyrighted music
                </Text>
              </View>
              <View style={styles.bulletItem}>
                <Ionicons name="checkmark-circle" size={16} color={theme.colors.primary} style={styles.bulletIcon} />
                <Text style={[styles.bulletText, { color: theme.colors.text }]}>
                  I am solely responsible for copyright violations
                </Text>
              </View>
              <View style={styles.bulletItem}>
                <Ionicons name="checkmark-circle" size={16} color={theme.colors.primary} style={styles.bulletIcon} />
                <Text style={[styles.bulletText, { color: theme.colors.text }]}>
                  My content may be removed if a valid copyright complaint is received
                </Text>
              </View>
            </View>

            {/* Checkbox */}
            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => setAgreed(!agreed)}
              activeOpacity={0.7}
            >
              <View style={[
                styles.checkbox,
                {
                  borderColor: agreed ? theme.colors.primary : theme.colors.border,
                  backgroundColor: agreed ? theme.colors.primary : 'transparent',
                }
              ]}>
                {agreed && (
                  <Ionicons name="checkmark" size={18} color="white" />
                )}
              </View>
              <Text style={[styles.checkboxLabel, { color: theme.colors.text }]}>
                I agree and take responsibility for the audio used
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Footer Buttons */}
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <TouchableOpacity
              style={[styles.cancelButton, { borderColor: theme.colors.border }]}
              onPress={handleCancel}
              activeOpacity={0.7}
            >
              <Text style={[styles.cancelButtonText, { color: theme.colors.text }]}>
                Cancel Upload
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.agreeButton,
                {
                  backgroundColor: agreed ? theme.colors.primary : theme.colors.border,
                  opacity: agreed ? 1 : 0.5,
                }
              ]}
              onPress={handleAgree}
              disabled={!agreed}
              activeOpacity={0.8}
            >
              <Text style={styles.agreeButtonText}>
                Agree & Upload
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 500,
    borderRadius: 20,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
  },
  content: {
    padding: 20,
    maxHeight: 400,
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 20,
  },
  bulletList: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  bulletIcon: {
    marginRight: 10,
    marginTop: 2,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 16,
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  agreeButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  agreeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
});

