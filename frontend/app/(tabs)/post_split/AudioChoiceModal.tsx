import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { theme } from '../../../constants/theme';

const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth >= 768;
const isWeb = Platform.OS === 'web';
const isIOS = Platform.OS === 'ios';

const getFontFamily = (weight: '400' | '500' | '600' | '700' | '800' = '400') => {
  if (isWeb) {
    return 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  }
  if (isIOS) {
    return 'System';
  }
  return 'Roboto';
};

interface AudioChoiceModalProps {
  visible: boolean;
  onClose: () => void;
  mode: 'light' | 'dark' | 'auto';
  onSelectBackgroundMusic: () => void;
  onSelectOriginalAudio: () => void;
}

export const AudioChoiceModal = ({
  visible,
  onClose,
  mode,
  onSelectBackgroundMusic,
  onSelectOriginalAudio,
}: AudioChoiceModalProps) => {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}>
        <View style={[
          styles.modalContent, 
          { 
            borderRadius: 24,
            borderWidth: 1,
            borderColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.45)',
            overflow: 'hidden',
            backgroundColor: mode === 'dark' ? 'rgba(10, 18, 32, 0.75)' : 'rgba(255, 255, 255, 0.65)',
            ...theme.shadows.large
          }
        ]}>
          <BlurView
            intensity={80}
            tint={mode === 'dark' ? 'dark' : 'light'}
            style={StyleSheet.absoluteFillObject}
          />
          <LinearGradient
            colors={
              mode === 'dark'
                ? ['rgba(255, 255, 255, 0.15)', 'rgba(255, 255, 255, 0.02)']
                : ['rgba(255, 255, 255, 0.6)', 'rgba(255, 255, 255, 0.1)']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 0.4, y: 0.4 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          <View style={{ zIndex: 1 }}>
            <View style={{ alignItems: 'center', marginBottom: theme.spacing.lg }}>
              <View style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: theme.colors.secondary + '15',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: theme.spacing.md
              }}>
                <Ionicons name="musical-notes" size={32} color={theme.colors.secondary} />
              </View>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                Choose Audio for Your Short
              </Text>
              <Text style={[styles.modalDescription, { color: theme.colors.textSecondary }]}>
                Select how you want to handle audio for this video
              </Text>
            </View>
            
            <TouchableOpacity
              style={{
                borderRadius: 16,
                overflow: 'hidden',
                marginBottom: 16,
                shadowColor: '#14B8A6',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.25,
                shadowRadius: 8,
                elevation: 3,
              }}
              onPress={onSelectBackgroundMusic}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#38BDF8', '#14B8A6', '#34D399']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: isTablet ? theme.spacing.xl : 20,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.35)',
                }}
              >
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.25)', 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 0.4 }}
                  style={StyleSheet.absoluteFillObject}
                  pointerEvents="none"
                />
                <View style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: theme.spacing.md,
                  zIndex: 1,
                }}>
                  <Ionicons name="musical-notes" size={24} color="white" />
                </View>
                <View style={[styles.audioChoiceTextContainer, { zIndex: 1 }]}>
                  <Text style={styles.audioChoiceTitle}>Background Music</Text>
                  <Text style={styles.audioChoiceSubtitle}>Add a song from our library</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="white" style={{ zIndex: 1 }} />
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.audioChoiceButton, 
                { 
                  backgroundColor: mode === 'dark' ? '#1E1E1E' : '#FFFFFF',
                  borderWidth: 2,
                  borderColor: theme.colors.border
                }
              ]}
              onPress={onSelectOriginalAudio}
              activeOpacity={0.8}
            >
              <View style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: theme.colors.border + '40',
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: theme.spacing.md
              }}>
                <Ionicons name="volume-high" size={24} color={theme.colors.text} />
              </View>
              <View style={styles.audioChoiceTextContainer}>
                <Text style={[styles.audioChoiceTitle, { color: theme.colors.text }]}>
                  Original Video Audio
                </Text>
                <Text style={[styles.audioChoiceSubtitle, { color: theme.colors.textSecondary }]}>
                  Keep the original sound from your video
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modalCancelButton, 
                { 
                  borderColor: theme.colors.border,
                  marginTop: theme.spacing.md
                }
              ]}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={[styles.modalCancelText, { color: theme.colors.textSecondary }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: isTablet ? theme.spacing.xl : 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: isTablet ? 500 : 400,
    borderRadius: isTablet ? theme.borderRadius.xl : 24,
    padding: isTablet ? theme.spacing.xxl : 28,
    ...(isWeb && {
      maxWidth: isTablet ? 600 : 500,
    } as any),
  },
  modalTitle: {
    fontSize: isTablet ? theme.typography.h1.fontSize : 24,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    marginBottom: isTablet ? theme.spacing.sm : 8,
    textAlign: 'center',
    letterSpacing: isIOS ? -0.5 : 0,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  modalDescription: {
    fontSize: isTablet ? theme.typography.body.fontSize + 1 : 15,
    fontFamily: getFontFamily('400'),
    marginBottom: isTablet ? theme.spacing.sm : 8,
    textAlign: 'center',
    lineHeight: isTablet ? 26 : 22,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  audioChoiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: isTablet ? theme.spacing.xl : 20,
    borderRadius: isTablet ? theme.borderRadius.lg : 16,
    marginBottom: isTablet ? theme.spacing.lg : 16,
    ...(isWeb && {
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    } as any),
  },
  audioChoiceTextContainer: {
    flex: 1,
  },
  audioChoiceTitle: {
    fontSize: isTablet ? theme.typography.body.fontSize + 3 : 17,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    color: 'white',
    marginBottom: isTablet ? 8 : 6,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  audioChoiceSubtitle: {
    fontSize: isTablet ? theme.typography.body.fontSize : 13,
    fontFamily: getFontFamily('400'),
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: isTablet ? 22 : 18,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  modalCancelButton: {
    padding: isTablet ? theme.spacing.lg : 16,
    borderRadius: isTablet ? theme.borderRadius.lg : 16,
    borderWidth: 1.5,
    alignItems: 'center',
    ...(isWeb && {
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    } as any),
  },
  modalCancelText: {
    fontSize: isTablet ? theme.typography.body.fontSize + 2 : 16,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
});
