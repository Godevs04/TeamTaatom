import React, { useState, useEffect, useRef } from 'react';
import { View, TouchableOpacity, Modal, StyleSheet, Text, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

export interface MenuItem {
  label: string;
  icon?: string;
  onPress: () => void;
  destructive?: boolean;
}

interface ThreeDotMenuProps {
  items: MenuItem[];
  iconColor?: string;
  iconSize?: number;
}

const ThreeDotMenu: React.FC<ThreeDotMenuProps> = ({ items, iconColor, iconSize }) => {
  const { theme } = useTheme();
  const [visible, setVisible] = useState(false);
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
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
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, scaleAnim, opacityAnim, overlayOpacity]);

  const handlePress = (item: MenuItem) => {
    setVisible(false);
    setTimeout(item.onPress, 150);
  };

  const handleClose = () => {
    setVisible(false);
  };

  return (
    <>
      <TouchableOpacity 
        onPress={() => setVisible(true)} 
        style={styles(theme).triggerButton}
        activeOpacity={0.7}
      >
        <Ionicons 
          name="ellipsis-vertical" 
          size={iconSize || 20} 
          color={iconColor || theme.colors.text} 
        />
      </TouchableOpacity>
      <Modal
        visible={visible}
        transparent
        animationType="none"
        onRequestClose={handleClose}
      >
        <Animated.View 
          style={[
            styles(theme).overlay,
            { opacity: overlayOpacity }
          ]}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={handleClose}
          />
          <Animated.View
            style={[
              styles(theme).menuContainer,
              {
                opacity: opacityAnim,
                transform: [
                  { scale: scaleAnim },
                  {
                    translateY: scaleAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-20, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            {items.map((item, index) => {
              const isLast = index === items.length - 1;
              const isDestructive = item.destructive;
              const showSeparator = isDestructive && index > 0;
              
              return (
                <React.Fragment key={item.label}>
                  {showSeparator && (
                    <View style={styles(theme).separator} />
                  )}
                  <TouchableOpacity
                    style={[
                      styles(theme).menuItem,
                      isLast && !isDestructive && styles(theme).lastMenuItem,
                    ]}
                    onPress={() => handlePress(item)}
                    activeOpacity={0.6}
                  >
                    {item.icon && (
                      <View style={[
                        styles(theme).iconContainer,
                        isDestructive && styles(theme).destructiveIconContainer
                      ]}>
                        <Ionicons
                          name={item.icon as any}
                          size={22}
                          color={isDestructive ? theme.colors.error : theme.colors.primary}
                        />
                      </View>
                    )}
                    <Text 
                      style={[
                        styles(theme).menuItemText, 
                        isDestructive && styles(theme).destructiveText
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                </React.Fragment>
              );
            })}
          </Animated.View>
        </Animated.View>
      </Modal>
    </>
  );
};

const styles = (theme: any) => StyleSheet.create({
  triggerButton: {
    padding: 8,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 48,
    paddingRight: 16,
  },
  menuContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    minWidth: 200,
    maxWidth: 280,
    paddingVertical: 8,
    ...theme.shadows.large,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
    minHeight: 56,
  },
  lastMenuItem: {
    borderBottomWidth: 0,
  },
  separator: {
    height: 8,
    backgroundColor: 'transparent',
    marginVertical: 4,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: `${theme.colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  destructiveIconContainer: {
    backgroundColor: `${theme.colors.error}15`,
  },
  menuItemText: {
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.text,
    fontWeight: '500',
    letterSpacing: 0.2,
    flex: 1,
  },
  destructiveText: {
    color: theme.colors.error,
    fontWeight: '600',
  },
});

export default ThreeDotMenu;
