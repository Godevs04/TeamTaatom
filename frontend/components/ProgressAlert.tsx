import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Animated,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

export interface ProgressAlertProps {
  visible: boolean;
  title?: string;
  message?: string;
  progress: number; // 0-100
  onClose?: () => void;
  type?: 'upload' | 'download' | 'processing';
  showCancel?: boolean;
  onCancel?: () => void;
}

const ProgressAlert: React.FC<ProgressAlertProps> = ({
  visible,
  title = 'Uploading...',
  message = 'Please wait while your content is being uploaded',
  progress,
  onClose,
  type = 'upload',
  showCancel = false,
  onCancel,
}) => {
  const { theme } = useTheme();
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, scaleAnim, opacityAnim]);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [progress, progressAnim]);

  const getIconAndColor = () => {
    switch (type) {
      case 'upload':
        return { icon: 'cloud-upload', color: theme.colors.primary };
      case 'download':
        return { icon: 'cloud-download', color: theme.colors.primary };
      case 'processing':
        return { icon: 'settings', color: theme.colors.primary };
      default:
        return { icon: 'cloud-upload', color: theme.colors.primary };
    }
  };

  const { icon, color } = getIconAndColor();

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
    if (onClose) {
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
    >
      <StatusBar backgroundColor="rgba(0,0,0,0.5)" barStyle="light-content" />
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.alertContainer,
            {
              backgroundColor: theme.colors.surface,
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim,
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
              <Ionicons name={icon as any} size={32} color={color} />
            </View>
            <Text style={[styles.title, { color: theme.colors.text }]}>
              {title}
            </Text>
          </View>

          {/* Message */}
          <Text style={[styles.message, { color: theme.colors.textSecondary }]}>
            {message}
          </Text>

          {/* Progress Section */}
          <View style={styles.progressSection}>
            <View style={styles.progressInfo}>
              <Text style={[styles.progressText, { color: theme.colors.text }]}>
                {Math.round(progress)}%
              </Text>
              <Text style={[styles.progressSubtext, { color: theme.colors.textSecondary }]}>
                {progress < 100 ? 'Uploading...' : 'Complete!'}
              </Text>
            </View>
            
            {/* Progress Bar */}
            <View style={[styles.progressBarContainer, { backgroundColor: theme.colors.border }]}>
              <Animated.View
                style={[
                  styles.progressBar,
                  {
                    backgroundColor: color,
                    width: progressAnim.interpolate({
                      inputRange: [0, 100],
                      outputRange: ['0%', '100%'],
                      extrapolate: 'clamp',
                    }),
                  },
                ]}
              />
            </View>
          </View>

          {/* Cancel Button */}
          {showCancel && progress < 100 && (
            <View style={styles.buttonContainer}>
              <Animated.View
                style={[
                  styles.cancelButton,
                  { backgroundColor: theme.colors.error + '20' },
                ]}
              >
                <Text
                  style={[styles.cancelButtonText, { color: theme.colors.error }]}
                  onPress={handleCancel}
                >
                  Cancel Upload
                </Text>
              </Animated.View>
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  alertContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  progressSection: {
    width: '100%',
    marginBottom: 20,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressText: {
    fontSize: 18,
    fontWeight: '600',
  },
  progressSubtext: {
    fontSize: 14,
  },
  progressBarContainer: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
});

export default ProgressAlert;
