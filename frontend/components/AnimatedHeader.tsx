import React, { useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../context/ThemeContext';

interface AnimatedHeaderProps {
  showSearch?: boolean;
  showChat?: boolean;
  rightComponent?: React.ReactNode;
  adjustRightComponent?: boolean;
  unseenMessageCount?: number;
  onRefresh?: () => void;
}

export default function AnimatedHeader({ 
  showSearch = true, 
  showChat = true, 
  rightComponent,
  adjustRightComponent = false,
  unseenMessageCount = 0,
  onRefresh
}: AnimatedHeaderProps) {
  const router = useRouter();
  const { theme, mode } = useTheme();
  
  // Animation refs
  const titleAnim = useRef(new Animated.Value(0)).current;
  const searchIconAnim = useRef(new Animated.Value(1)).current;
  const chatIconAnim = useRef(new Animated.Value(1)).current;
  const logoAnim = useRef(new Animated.Value(1)).current;
  
  // Determine if dark mode
  const isDark = mode === 'dark' || (mode === 'auto' && theme.colors.background === '#000000' || theme.colors.background === '#111114');
  
  // Taatom app logo
  const taatomLogo = 'https://res.cloudinary.com/dcvdqhqzc/image/upload/v1766525159/aefbv7kr261jzp4sptel.png';
  
  const handleLogoPress = useCallback(() => {
    // Animate logo rotation/scale for refresh feedback
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoAnim, {
          toValue: 0.8,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(titleAnim, {
          toValue: -5,
          duration: 100,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(logoAnim, {
          toValue: 1.1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(titleAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(logoAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
    
    // Trigger refresh if callback provided
    if (onRefresh) {
      onRefresh();
    }
  }, [logoAnim, titleAnim, onRefresh]);

  const handleSearch = useCallback(() => {
    // Animate title to the left and search icon scale
    Animated.parallel([
      Animated.timing(titleAnim, {
        toValue: -40,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(searchIconAnim, {
          toValue: 1.15,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(searchIconAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      // Navigate to search page after animation
      router.push('/search');
      
      // Reset animation after navigation
      setTimeout(() => {
        titleAnim.setValue(0);
        searchIconAnim.setValue(1);
      }, 100);
    });
  }, [titleAnim, searchIconAnim, router]);

  const handleChat = useCallback(() => {
    // Add subtle animation for chat icon
    Animated.sequence([
      Animated.timing(chatIconAnim, {
        toValue: 1.1,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(chatIconAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
    
    router.push('/chat');
  }, [chatIconAnim, router]);

  const styles = getStyles(theme);

  return (
    <View style={[styles.header, { backgroundColor: 'transparent' }]}>
      {(showSearch || showChat) && (
        <TouchableOpacity 
          onPress={handleLogoPress}
          activeOpacity={0.7}
        >
          <Animated.View
            style={[
              styles.logoImageContainer,
              {
                transform: [
                  { translateX: titleAnim },
                  { scale: logoAnim }
                ],
              }
            ]}
          >
            <Image 
              source={{ uri: taatomLogo }}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </Animated.View>
        </TouchableOpacity>
      )}
      
      <View style={[(showSearch || showChat) ? styles.headerIcons : styles.headerIconsRight, adjustRightComponent && styles.headerIconsAdjusted]}>
        {showSearch && (
          <TouchableOpacity onPress={handleSearch} style={styles.iconButton}>
            <Animated.View style={{ transform: [{ scale: searchIconAnim }] }}>
              <Ionicons name="search" size={20} color={theme.colors.text} />
            </Animated.View>
          </TouchableOpacity>
        )}
        
        {showChat && (
          <TouchableOpacity onPress={handleChat} style={styles.iconButton}>
            <Animated.View style={{ transform: [{ scale: chatIconAnim }] }}>
              <View style={styles.chatIconContainer}>
                <Ionicons name="chatbubble-ellipses-outline" size={22} color={theme.colors.text} />
                {unseenMessageCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {unseenMessageCount > 99 ? '99+' : unseenMessageCount}
                    </Text>
                  </View>
                )}
              </View>
            </Animated.View>
          </TouchableOpacity>
        )}
        
        {rightComponent}
      </View>
    </View>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 2,
    paddingTop: 0,
    minHeight: 36,
    borderBottomWidth: 0,
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  logoImageContainer: {
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  logoImage: {
    width: 56,
    height: 56,
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 'auto',
  },
  headerIconsAdjusted: {
    marginTop: 24,
  },
  iconButton: {
    padding: 4,
    borderRadius: 16,
    backgroundColor: 'transparent',
    minWidth: 32,
    minHeight: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatIconContainer: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#0A84FF',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.surface || theme.colors.background,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
});
