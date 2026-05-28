import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

interface CustomAlertProps {
  visible: boolean;
  title: string;
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  showCancel?: boolean;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  onClose?: () => void;
}

export default function CustomAlert({
  visible,
  title,
  message,
  type = 'info',
  showCancel = true,
  confirmText = 'OK',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  onClose,
}: CustomAlertProps) {
  const { theme, isDark } = useTheme();
  const [scaleValue] = React.useState(new Animated.Value(0));

  React.useEffect(() => {
    if (visible) {
      Animated.spring(scaleValue, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    } else {
      scaleValue.setValue(0);
    }
  }, [visible, scaleValue]);

  const getIconName = () => {
    switch (type) {
      case 'success':
        return 'checkmark-circle';
      case 'error':
        return 'close-circle';
      case 'warning':
        return 'warning';
      default:
        return 'information-circle';
    }
  };

  const getIconColor = () => {
    switch (type) {
      case 'success':
        return '#4CAF50';
      case 'error':
        return '#F44336';
      case 'warning':
        return '#FF9800';
      default:
        return theme.colors.primary;
    }
  };

  const getIconBgColor = () => {
    switch (type) {
      case 'success':
        return 'rgba(76, 175, 80, 0.12)';
      case 'error':
        return 'rgba(244, 67, 54, 0.12)';
      case 'warning':
        return 'rgba(255, 152, 0, 0.12)';
      default:
        return isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)';
    }
  };

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
    if (onClose) {
      onClose();
    }
  };

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
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <BlurView
          intensity={isDark ? 55 : 45}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFillObject}
        />
        
        <Animated.View
          style={[
            styles.alertContainer,
            {
              backgroundColor: isDark ? 'rgba(24, 24, 28, 0.90)' : 'rgba(255, 255, 255, 0.92)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.45)',
              transform: [{ scale: scaleValue }],
            },
          ]}
        >
          <BlurView
            intensity={isDark ? 80 : 90}
            tint={isDark ? 'dark' : 'light'}
            style={[StyleSheet.absoluteFillObject, { borderRadius: 24 }]}
          />
          
          <View style={styles.contentWrapper}>
            <View style={styles.iconContainer}>
              <View style={[styles.iconBadge, { backgroundColor: getIconBgColor() }]}>
                <Ionicons
                  name={getIconName()}
                  size={32}
                  color={getIconColor()}
                />
              </View>
            </View>
            
            <Text style={[styles.title, { color: theme.colors.text }]}>
              {title}
            </Text>
            
            <Text style={[styles.message, { color: theme.colors.textSecondary }]}>
              {message}
            </Text>
            
            <View style={styles.buttonContainer}>
              {showCancel && (
                <TouchableOpacity
                  style={[
                    styles.cancelButton,
                    { 
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.12)',
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.02)'
                    },
                  ]}
                  onPress={handleCancel}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.buttonText, { color: theme.colors.text }]}>
                    {cancelText}
                  </Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity
                style={styles.confirmButtonWrapper}
                onPress={handleConfirm}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#50C878', '#1C73B4']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.confirmButtonGradient}
                >
                  <Text style={styles.confirmButtonText}>
                    {confirmText}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  alertContainer: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 24,
    borderWidth: 1.5,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
  },
  contentWrapper: {
    padding: 24,
    zIndex: 2,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  iconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  confirmButtonWrapper: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    overflow: 'hidden',
  },
  confirmButtonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});