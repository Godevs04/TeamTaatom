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
import { BlurView } from 'expo-blur';

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
  const { theme, isDark } = useTheme();
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

  return (
    <Modal
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
      animationType="none"
    >
      <StatusBar backgroundColor="rgba(0,0,0,0.5)" barStyle="light-content" />
      <View style={styles.overlay}>
        <BlurView
          intensity={isDark ? 30 : 20}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFillObject}
        />
        
        <Animated.View
          style={[
            styles.optionsContainer,
            {
              backgroundColor: isDark ? 'rgba(30, 30, 30, 0.65)' : 'rgba(255, 255, 255, 0.65)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.35)',
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim,
            },
          ]}
        >
          <BlurView
            intensity={isDark ? 65 : 75}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFillObject}
          />
          
          <View style={styles.contentWrapper}>
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
              {options.map((option, index) => {
                const isDestructive = option.style === 'destructive';
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.optionItem,
                      {
                        backgroundColor: option.disabled 
                          ? 'rgba(0, 0, 0, 0.05)'
                          : 'transparent',
                        borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)',
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
                    activeOpacity={0.7}
                  >
                    <View style={styles.optionContent}>
                      {option.icon && (
                        <Ionicons
                          name={option.icon as any}
                          size={20}
                          color={
                            option.disabled 
                              ? theme.colors.textSecondary 
                              : isDestructive 
                                ? '#F44336' 
                                : theme.colors.text
                          }
                          style={styles.optionIcon}
                        />
                      )}
                      <Text
                        style={[
                          styles.optionText,
                          {
                            color: option.disabled 
                              ? theme.colors.textSecondary 
                              : isDestructive 
                                ? '#F44336' 
                                : theme.colors.text,
                            fontWeight: isDestructive ? '700' : '500',
                          },
                        ]}
                      >
                        {option.text}
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={isDestructive ? 'rgba(244, 67, 54, 0.5)' : theme.colors.textSecondary}
                    />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {showCancel && (
              <TouchableOpacity
                style={[
                  styles.cancelButton,
                  {
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.12)',
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.02)',
                  },
                ]}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Text style={[styles.cancelText, { color: theme.colors.text }]}>
                  {cancelText}
                </Text>
              </TouchableOpacity>
            )}
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
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  optionsContainer: {
    width: width * 0.9,
    maxWidth: 340,
    maxHeight: height * 0.75,
    borderRadius: 24,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 10,
    overflow: 'hidden',
  },
  contentWrapper: {
    width: '100%',
    zIndex: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    letterSpacing: 0.3,
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
    paddingHorizontal: 24,
  },
  optionsList: {
    width: '100%',
    maxHeight: height * 0.45,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 24,
    minHeight: 56,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  optionIcon: {
    marginRight: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionText: {
    fontSize: 15,
    flex: 1,
    letterSpacing: 0.2,
  },
  cancelButton: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
