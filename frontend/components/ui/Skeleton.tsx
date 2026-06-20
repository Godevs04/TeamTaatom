import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle, DimensionValue } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../../context/ThemeContext';

interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: ViewStyle;
}

export default function Skeleton({
  width = '100%',
  height = 20,
  borderRadius = 4,
  style,
}: SkeletonProps) {
  const { mode } = useTheme();
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 850 }),
        withTiming(0.3, { duration: 850 })
      ),
      -1,
      true
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const baseColor = mode === 'dark' 
    ? 'rgba(255, 255, 255, 0.12)' 
    : 'rgba(0, 0, 0, 0.08)';

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: baseColor,
        },
        style,
        animatedStyle,
      ]}
    />
  );
}

export function PostCardSkeleton() {
  const { theme, mode } = useTheme();
  
  const cardBg = mode === 'dark' 
    ? 'rgba(18, 34, 54, 0.72)' 
    : 'rgba(255, 255, 255, 0.72)';
  
  return (
    <View style={[styles.card, { backgroundColor: cardBg, borderColor: theme.colors.border }]}>
      {/* Header */}
      <View style={styles.header}>
        <Skeleton width={40} height={40} borderRadius={20} />
        <View style={styles.headerText}>
          <Skeleton width={120} height={16} borderRadius={4} />
          <View style={{ height: 6 }} />
          <Skeleton width={80} height={12} borderRadius={4} />
        </View>
      </View>
      
      {/* Media Image area */}
      <Skeleton width="100%" height={300} borderRadius={12} style={{ marginVertical: 12 }} />
      
      {/* Action Row */}
      <View style={styles.actionRow}>
        <Skeleton width={28} height={28} borderRadius={14} style={{ marginRight: 16 }} />
        <Skeleton width={28} height={28} borderRadius={14} style={{ marginRight: 16 }} />
        <Skeleton width={28} height={28} borderRadius={14} />
        <View style={{ flex: 1 }} />
        <Skeleton width={28} height={28} borderRadius={14} />
      </View>
      
      {/* Likes */}
      <Skeleton width={100} height={16} borderRadius={4} style={{ marginVertical: 8 }} />
      
      {/* Caption lines */}
      <Skeleton width="90%" height={14} borderRadius={4} style={{ marginBottom: 6 }} />
      <Skeleton width="60%" height={14} borderRadius={4} />
    </View>
  );
}

export function LocaleCardSkeleton({ width, height }: { width: DimensionValue; height: DimensionValue }) {
  const { theme, mode } = useTheme();
  
  const cardBg = mode === 'dark' 
    ? 'rgba(18, 34, 54, 0.72)' 
    : 'rgba(255, 255, 255, 0.72)';
  
  return (
    <View style={[
      { 
        backgroundColor: cardBg, 
        borderColor: theme.colors.border, 
        width, 
        height, 
        borderRadius: 24, 
        overflow: 'hidden',
        borderWidth: 1,
        alignSelf: 'center',
      }
    ]}>
      {/* Media Image Area */}
      <Skeleton width="100%" height="70%" borderRadius={0} />
      
      {/* Bottom Panel */}
      <View style={{ height: '30%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 }}>
        <View style={{ flex: 1, marginRight: 12 }}>
          <Skeleton width="60%" height={16} borderRadius={4} />
          <View style={{ height: 6 }} />
          <Skeleton width="40%" height={12} borderRadius={4} />
        </View>
        <Skeleton width={70} height={20} borderRadius={10} />
      </View>
    </View>
  );
}


const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 20,
    marginBottom: 14,
    marginHorizontal: 12,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerText: {
    marginLeft: 12,
    flex: 1,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
});
