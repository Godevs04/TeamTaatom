import React from 'react';
import { View, StyleSheet, Modal, TouchableWithoutFeedback, ViewProps, KeyboardAvoidingView, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../context/ThemeContext';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';

export interface GlassModalProps extends ViewProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export const GlassModal = ({ visible, onClose, children, style, ...props }: GlassModalProps) => {
  const { theme, isDark } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFillObject} />
        </View>
      </TouchableWithoutFeedback>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalContainer} 
        pointerEvents="box-none"
      >
        <Animated.View 
          entering={SlideInDown.springify().damping(16).stiffness(120)}
          exiting={SlideOutDown}
          style={[
            styles.modalContent,
            {
              backgroundColor: isDark ? theme.colors.frostTintStrong : theme.colors.glassBackground,
              borderColor: theme.glass.border.color,
              borderWidth: theme.glass.border.width,
              borderRadius: theme.borderRadius.lg,
              ...theme.shadows.medium,
            },
            style
          ]}
          {...props}
        >
          <BlurView intensity={0.9} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFillObject} />
          <View style={styles.indicator} />
          <View style={styles.innerContent}>
            {children}
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  modalContent: {
    overflow: 'hidden',
    paddingBottom: 40, // safe area 
  },
  indicator: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(150, 150, 150, 0.4)',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
    zIndex: 1,
  },
  innerContent: {
    padding: 24,
    zIndex: 1,
  }
});
