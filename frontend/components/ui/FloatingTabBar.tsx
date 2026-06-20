import React from 'react';
import { View, StyleSheet, Pressable, Animated } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { usePathname, useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { useJourney } from '../../context/JourneyContext';
import { shortsEvents } from '../../utils/shortsEvents';

export default function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { isDark } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const { isTracking, isPaused } = useJourney();
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;
    if (isTracking && !isPaused) {
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.4,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1.0,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
    } else {
      pulseAnim.setValue(1);
    }
    return () => {
      if (animation) {
        animation.stop();
      }
    };
  }, [isTracking, isPaused]);

  // Hide the tab bar on post screen
  const isPostScreen = pathname === '/post' || pathname === '/(tabs)/post' || pathname?.endsWith('/post');
  if (isPostScreen) {
    return null;
  }

  const activeIndex = state.index;
  const activeRoute = state.routes[activeIndex];

  const ALLOWED_TABS = ['home', 'shorts', 'post', 'locale', 'profile'];
  const routesWithIndex = state.routes.map((route, index) => ({ route, index }));

  const leftRoutes = routesWithIndex.slice(0, activeIndex).filter(item => ALLOWED_TABS.includes(item.route.name));
  const rightRoutes = routesWithIndex.slice(activeIndex + 1).filter(item => ALLOWED_TABS.includes(item.route.name));

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
      if (route.name === 'shorts') {
        shortsEvents.emitTabRefresh();
      }
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

  const showIndicator = isTracking;
  const indicatorColor = isPaused ? '#F59E0B' : '#EF4444';

  const handleIndicatorPress = () => {
    router.push('/navigate/tracking');
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
            {leftRoutes.map(({ route, index }) => renderInactiveTab(route, index))}
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
            {rightRoutes.map(({ route, index }) => renderInactiveTab(route, index))}
          </BlurView>
        </View>
      )}

      {showIndicator && (
        <Pressable
          onPress={handleIndicatorPress}
          style={[
            styles.trackingIndicator,
            {
              backgroundColor: isDark ? 'rgba(15, 22, 35, 0.9)' : 'rgba(250, 252, 255, 0.9)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.08)',
            },
          ]}
        >
          {isTracking && !isPaused ? (
            <>
              <Animated.View
                style={[
                  styles.pulseRing,
                  {
                    borderColor: indicatorColor,
                    transform: [{ scale: pulseAnim }],
                    opacity: pulseAnim.interpolate({
                      inputRange: [1, 1.4],
                      outputRange: [0.8, 0.2],
                    }),
                  },
                ]}
              />
              <View style={[styles.pulseDot, { backgroundColor: indicatorColor }]} />
            </>
          ) : (
            <View style={[styles.pulseDot, { backgroundColor: indicatorColor }]} />
          )}
        </Pressable>
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
    backgroundColor: 'rgba(10, 15, 25, 0.70)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  pillLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    borderColor: 'rgba(255, 255, 255, 0.45)',
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
  trackingIndicator: {
    position: 'absolute',
    right: 4,
    top: -32,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 5,
  },
  pulseRing: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
