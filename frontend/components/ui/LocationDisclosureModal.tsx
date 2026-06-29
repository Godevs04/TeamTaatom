import React from 'react';
import { View, StyleSheet, Modal, Text, Platform, ViewStyle, StyleProp } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../context/ThemeContext';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { getFontFamily } from '../../constants/typography';
import { GlassButton } from './GlassButton';
import { Ionicons } from '@expo/vector-icons';

export interface LocationDisclosureModalProps {
  visible: boolean;
  variant: 'foreground' | 'journey';
  onContinue: () => void;
  onCancel: () => void;
}

export const LocationDisclosureModal = ({
  visible,
  variant,
  onContinue,
  onCancel,
}: LocationDisclosureModalProps) => {
  const { theme, isDark } = useTheme();

  // Prevent back button dismiss by providing an empty callback to onRequestClose
  const handleRequestClose = () => {
    // No-op to prevent Android back button from dismissing
  };

  const renderContent = () => {
    if (variant === 'journey') {
      return (
        <>
          <View style={styles.iconContainer}>
            <View style={[styles.iconPulse, { backgroundColor: '#50C87820' }]}>
              <Ionicons name="navigate-circle" size={48} color="#50C878" />
            </View>
          </View>
          <Text style={[styles.title, { fontFamily: getFontFamily('bold'), color: theme.colors.text }]}>
            Location Permission & Journey Tracking
          </Text>
          <Text style={[styles.description, { fontFamily: getFontFamily('regular'), color: theme.colors.textSecondary }]}>
            TAATOM collects location data to:
          </Text>
          <View style={styles.bulletList}>
            <View style={styles.bulletItem}>
              <Ionicons name="checkmark-circle" size={18} color="#50C878" style={styles.bulletIcon} />
              <Text style={[styles.bulletText, { fontFamily: getFontFamily('medium'), color: theme.colors.text }]}>
                Record your travel journey and map coordinates in real time.
              </Text>
            </View>
            <View style={styles.bulletItem}>
              <Ionicons name="checkmark-circle" size={18} color="#50C878" style={styles.bulletIcon} />
              <Text style={[styles.bulletText, { fontFamily: getFontFamily('medium'), color: theme.colors.text }]}>
                Continue tracking your route while the app is in the background or screen is locked.
              </Text>
            </View>
            <View style={styles.bulletItem}>
              <Ionicons name="checkmark-circle" size={18} color="#50C878" style={styles.bulletIcon} />
              <Text style={[styles.bulletText, { fontFamily: getFontFamily('medium'), color: theme.colors.text }]}>
                Calculate your travel metrics and total TripScore.
              </Text>
            </View>
          </View>
          <Text style={[styles.note, { fontFamily: getFontFamily('regular'), color: theme.colors.textMuted }]}>
            Location data is only accessed during an active journey and is never used for advertising.
          </Text>
        </>
      );
    }

    // Foreground variant
    return (
      <>
        <View style={styles.iconContainer}>
          <View style={[styles.iconPulse, { backgroundColor: '#38BDF820' }]}>
            <Ionicons name="location" size={48} color="#38BDF8" />
          </View>
        </View>
        <Text style={[styles.title, { fontFamily: getFontFamily('bold'), color: theme.colors.text }]}>
          Use Location Services
        </Text>
        <Text style={[styles.description, { fontFamily: getFontFamily('regular'), color: theme.colors.textSecondary }]}>
          TAATOM uses your device's location to:
        </Text>
        <View style={styles.bulletList}>
          <View style={styles.bulletItem}>
            <Ionicons name="checkmark-circle" size={18} color="#38BDF8" style={styles.bulletIcon} />
            <Text style={[styles.bulletText, { fontFamily: getFontFamily('medium'), color: theme.colors.text }]}>
              Show your current position on the map.
            </Text>
          </View>
          <View style={styles.bulletItem}>
            <Ionicons name="checkmark-circle" size={18} color="#38BDF8" style={styles.bulletIcon} />
            <Text style={[styles.bulletText, { fontFamily: getFontFamily('medium'), color: theme.colors.text }]}>
              Calculate distances to locations and landmarks.
            </Text>
          </View>
          <View style={styles.bulletItem}>
            <Ionicons name="checkmark-circle" size={18} color="#38BDF8" style={styles.bulletIcon} />
            <Text style={[styles.bulletText, { fontFamily: getFontFamily('medium'), color: theme.colors.text }]}>
              Help you search for other nearby travelers and connect.
            </Text>
          </View>
        </View>
        <Text style={[styles.note, { fontFamily: getFontFamily('regular'), color: theme.colors.textMuted }]}>
          This data is only accessed while the app is in the foreground and active.
        </Text>
      </>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleRequestClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFillObject} />
        
        <Animated.View
          entering={SlideInDown.duration(400).springify().damping(15)}
          exiting={SlideOutDown.duration(200)}
          style={[
            styles.card,
            {
              backgroundColor: isDark ? theme.colors.frostTintStrong : theme.colors.glassBackground,
              borderColor: theme.glass.border.color,
              borderWidth: theme.glass.border.width,
              borderRadius: theme.borderRadius.xl,
            },
          ]}
        >
          <BlurView intensity={35} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFillObject} />
          
          <View style={styles.cardContent}>
            {renderContent()}

            <View style={styles.buttonContainer}>
              <GlassButton
                variant="primary"
                title="Continue"
                onPress={onContinue}
                style={styles.button}
              />
              <GlassButton
                variant="ghost"
                title="Cancel"
                onPress={onCancel}
                style={styles.cancelButton}
              />
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  cardContent: {
    padding: 24,
    alignItems: 'center',
    zIndex: 2,
  },
  iconContainer: {
    marginBottom: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconPulse: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  bulletList: {
    alignSelf: 'stretch',
    marginBottom: 20,
    gap: 12,
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  bulletIcon: {
    marginTop: 2,
    marginRight: 10,
  },
  bulletText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  note: {
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 15,
  },
  buttonContainer: {
    alignSelf: 'stretch',
    gap: 8,
  },
  button: {
    width: '100%',
  },
  cancelButton: {
    width: '100%',
    height: 44,
  },
});

export default LocationDisclosureModal;
