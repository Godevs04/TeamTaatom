import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  StatusBar,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

const { width, height } = Dimensions.get('window');

export interface CustomOption {
  text: string;
  onPress: () => void;
  style?: 'default' | 'cancel' | 'destructive';
  icon?: string;
  disabled?: boolean;
}

interface CustomOptionsProps {
  visible: boolean;
  title?: string;
  message?: string;
  options: CustomOption[];
  onClose: () => void;
  showCancel?: boolean;
  cancelText?: string;
}

export default function CustomOptions({
  visible,
  title,
  message,
  options,
  onClose,
  showCancel = true,
  cancelText = 'Cancel',
}: CustomOptionsProps) {
  const { theme } = useTheme();
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, scaleAnim, opacityAnim]);

  const getOptionStyle = (style?: 'default' | 'cancel' | 'destructive') => {
    switch (style) {
      case 'destructive':
        return {
          backgroundColor: 'transparent',
          borderColor: theme.colors.error,
          borderWidth: 1,
        };
      case 'cancel':
        return {
          backgroundColor: 'transparent',
          borderColor: theme.colors.border,
          borderWidth: 1,
        };
      default:
        return {
          backgroundColor: theme.colors.primary,
          borderColor: 'transparent',
          borderWidth: 0,
        };
    }
  };

  const getTextColor = (style?: 'default' | 'cancel' | 'destructive') => {
    switch (style) {
      case 'destructive':
        return theme.colors.error;
      case 'cancel':
        return theme.colors.textSecondary;
      default:
        return theme.colors.buttonText;
    }
  };

  return (
    <Modal
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
      animationType="none"
    >
      <StatusBar backgroundColor="rgba(0,0,0,0.5)" barStyle="light-content" />
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.optionsContainer,
            {
              backgroundColor: theme.colors.surface,
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim,
            },
          ]}
        >
          {title && (
            <Text style={[styles.title, { color: theme.colors.text }]}>
              {title}
            </Text>
          )}
          
          {message && (
            <Text style={[styles.message, { color: theme.colors.textSecondary }]}>
              {message}
            </Text>
          )}

          <ScrollView style={styles.optionsList} showsVerticalScrollIndicator={false}>
            {options.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.optionItem,
                  {
                    backgroundColor: option.disabled 
                      ? theme.colors.disabled 
                      : 'transparent',
                    borderBottomColor: theme.colors.border,
                    borderBottomWidth: index < options.length - 1 ? 1 : 0,
                  },
                ]}
                onPress={() => {
                  if (!option.disabled) {
                    onClose();
                    option.onPress();
                  }
                }}
                disabled={option.disabled}
              >
                <View style={styles.optionContent}>
                  {option.icon && (
                    <Ionicons
                      name={option.icon as any}
                      size={20}
                      color={option.disabled ? theme.colors.textSecondary : theme.colors.text}
                      style={styles.optionIcon}
                    />
                  )}
                  <Text
                    style={[
                      styles.optionText,
                      {
                        color: option.disabled 
                          ? theme.colors.textSecondary 
                          : theme.colors.text,
                      },
                    ]}
                  >
                    {option.text}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={option.disabled ? theme.colors.textSecondary : theme.colors.textSecondary}
                />
              </TouchableOpacity>
            ))}
          </ScrollView>

          {showCancel && (
            <TouchableOpacity
              style={[
                styles.cancelButton,
                {
                  backgroundColor: 'transparent',
                  borderColor: theme.colors.border,
                  borderWidth: 1,
                },
              ]}
              onPress={onClose}
            >
              <Text style={[styles.cancelText, { color: theme.colors.textSecondary }]}>
                {cancelText}
              </Text>
            </TouchableOpacity>
          )}
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  optionsContainer: {
    width: width * 0.9,
    maxHeight: height * 0.75,
    borderRadius: 24,
    padding: 0,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.15,
    shadowRadius: 25,
    elevation: 15,
    overflow: 'hidden',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
    paddingHorizontal: 24,
    opacity: 0.8,
  },
  optionsList: {
    width: '100%',
    maxHeight: height * 0.45,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    paddingHorizontal: 24,
    minHeight: 60,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  optionIcon: {
    marginRight: 16,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionText: {
    fontSize: 17,
    fontWeight: '500',
    flex: 1,
    letterSpacing: 0.2,
  },
  cancelButton: {
    width: '100%',
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    borderTopWidth: 1,
  },
  cancelText: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
