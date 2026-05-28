import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { usePathname } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';

export default function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { isDark } = useTheme();
  const pathname = usePathname();

  // Hide the tab bar on post screen
  const isPostScreen = pathname === '/post' || pathname === '/(tabs)/post' || pathname?.endsWith('/post');
  if (isPostScreen) {
    return null;
  }

  const activeIndex = state.index;
  const activeRoute = state.routes[activeIndex];

  const leftRoutes = state.routes.slice(0, activeIndex);
  const rightRoutes = state.routes.slice(activeIndex + 1);

  const renderInactiveTab = (route: any, indexInState: number) => {
    const { options } = descriptors[route.key];

    const onPress = () => {
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });

      if (state.index !== indexInState && !event.defaultPrevented) {
        navigation.navigate(route.name, route.params);
      }
    };

    const onLongPress = () => {
      navigation.emit({
        type: 'tabLongPress',
        target: route.key,
      });
    };

    let iconName: keyof typeof Ionicons.glyphMap = 'help-outline';
    switch (route.name) {
      case 'home':
        iconName = 'home-outline';
        break;
      case 'shorts':
        iconName = 'play-circle-outline';
        break;
      case 'post':
        iconName = 'add';
        break;
      case 'locale':
        iconName = 'location-outline';
        break;
      case 'profile':
        iconName = 'person-outline';
        break;
    }

    const inactiveColor = isDark ? '#7AB3D6' : '#1C73B4';

    return (
      <Pressable
        key={route.key}
        accessibilityRole="button"
        accessibilityLabel={options.tabBarAccessibilityLabel}
        onPress={onPress}
        onLongPress={onLongPress}
        style={styles.tabItem}
      >
        <Ionicons name={iconName} size={20} color={inactiveColor} />
      </Pressable>
    );
  };

  const renderActiveTab = (route: any, indexInState: number) => {
    const { options } = descriptors[route.key];

    const onPress = () => {
      navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });
    };

    let iconName: keyof typeof Ionicons.glyphMap = 'help-outline';
    switch (route.name) {
      case 'home':
        iconName = 'home';
        break;
      case 'shorts':
        iconName = 'play-circle';
        break;
      case 'post':
        iconName = 'add';
        break;
      case 'locale':
        iconName = 'location';
        break;
      case 'profile':
        iconName = 'person';
        break;
    }

    return (
      <View key={route.key} style={styles.activeContainer}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: true }}
          accessibilityLabel={options.tabBarAccessibilityLabel}
          onPress={onPress}
          style={styles.activeCircle}
        >
          <LinearGradient
            colors={['#1C73B4', '#50C878']}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <Ionicons name={iconName} size={22} color="#FFFFFF" />
        </Pressable>
      </View>
    );
  };

  const tabShadowStyle = {
    shadowColor: isDark ? '#38BDF8' : '#1C73B4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: isDark ? 0.05 : 0.08,
    shadowRadius: 12,
    elevation: 2,
  };

  return (
    <View style={styles.outerContainer}>
      {leftRoutes.length > 0 && (
        <View style={[styles.shadowWrapper, tabShadowStyle, { width: leftRoutes.length * 42, marginRight: 6 }]}>
          <BlurView
            intensity={95}
            tint={isDark ? 'dark' : 'light'}
            style={[
              styles.inactivePill,
              { width: '100%' },
              isDark ? styles.pillDark : styles.pillLight,
            ]}
          >
            {leftRoutes.map((route, idx) => renderInactiveTab(route, idx))}
          </BlurView>
        </View>
      )}

      {renderActiveTab(activeRoute, activeIndex)}

      {rightRoutes.length > 0 && (
        <View style={[styles.shadowWrapper, tabShadowStyle, { width: rightRoutes.length * 42, marginLeft: 6 }]}>
          <BlurView
            intensity={95}
            tint={isDark ? 'dark' : 'light'}
            style={[
              styles.inactivePill,
              { width: '100%' },
              isDark ? styles.pillDark : styles.pillLight,
            ]}
          >
            {rightRoutes.map((route, idx) => renderInactiveTab(route, leftRoutes.length + 1 + idx))}
          </BlurView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    position: 'absolute',
    bottom: 25,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    backgroundColor: 'transparent',
  },
  shadowWrapper: {
    height: 44,
    borderRadius: 22,
  },
  inactivePill: {
    height: 44,
    borderRadius: 22,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderWidth: 1,
    overflow: 'hidden',
  },
  pillDark: {
    backgroundColor: 'rgba(15, 22, 35, 0.82)', // Solid frosted glass
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  pillLight: {
    backgroundColor: 'rgba(250, 252, 255, 0.85)', // Solid frosted glass
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  activeContainer: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  activeCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
