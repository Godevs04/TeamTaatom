import React from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
}

const Skeleton: React.FC<SkeletonProps> = ({ 
  width = '100%', 
  height = 20, 
  borderRadius = 4,
  style 
}) => {
  const { theme } = useTheme();
  const animatedValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: theme.colors.border,
          opacity,
        },
        style,
      ]}
    />
  );
};

export const PostSkeleton: React.FC = () => {
  const { theme } = useTheme();

  return (
    <View style={[styles.postContainer, { backgroundColor: theme.colors.card }]}>
      {/* Header */}
      <View style={styles.postHeader}>
        <Skeleton width={40} height={40} borderRadius={20} />
        <View style={styles.headerText}>
          <Skeleton width={120} height={16} borderRadius={4} />
          <Skeleton width={80} height={12} borderRadius={4} style={{ marginTop: 4 }} />
        </View>
      </View>

      {/* Image */}
      <Skeleton width="100%" height={400} borderRadius={0} style={{ marginTop: 12 }} />

      {/* Actions */}
      <View style={styles.actions}>
        <Skeleton width={24} height={24} borderRadius={4} />
        <Skeleton width={24} height={24} borderRadius={4} />
        <Skeleton width={24} height={24} borderRadius={4} />
      </View>

      {/* Caption */}
      <View style={styles.caption}>
        <Skeleton width="100%" height={14} borderRadius={4} />
        <Skeleton width="60%" height={14} borderRadius={4} style={{ marginTop: 4 }} />
      </View>
    </View>
  );
};

export const UserSkeleton: React.FC = () => {
  const { theme } = useTheme();

  return (
    <View style={[styles.userContainer, { backgroundColor: theme.colors.card }]}>
      <Skeleton width={60} height={60} borderRadius={30} />
      <View style={styles.userInfo}>
        <Skeleton width={150} height={18} borderRadius={4} />
        <Skeleton width={100} height={14} borderRadius={4} style={{ marginTop: 6 }} />
      </View>
    </View>
  );
};

export const CommentSkeleton: React.FC = () => {
  const { theme } = useTheme();

  return (
    <View style={[styles.commentContainer, { backgroundColor: theme.colors.card }]}>
      <Skeleton width={32} height={32} borderRadius={16} />
      <View style={styles.commentContent}>
        <Skeleton width="100%" height={14} borderRadius={4} />
        <Skeleton width="70%" height={14} borderRadius={4} style={{ marginTop: 4 }} />
      </View>
    </View>
  );
};

export const NotificationSkeleton: React.FC = () => {
  const { theme } = useTheme();

  return (
    <View style={[styles.notificationContainer, { backgroundColor: theme.colors.card }]}>
      <Skeleton width={48} height={48} borderRadius={24} />
      <View style={styles.notificationContent}>
        <Skeleton width="80%" height={16} borderRadius={4} />
        <Skeleton width="50%" height={12} borderRadius={4} style={{ marginTop: 6 }} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  postContainer: {
    padding: 12,
    marginBottom: 12,
    borderRadius: 8,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerText: {
    marginLeft: 12,
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 16,
  },
  caption: {
    marginTop: 8,
  },
  userContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  userInfo: {
    marginLeft: 12,
    flex: 1,
  },
  commentContainer: {
    flexDirection: 'row',
    padding: 8,
    marginBottom: 8,
  },
  commentContent: {
    marginLeft: 8,
    flex: 1,
  },
  notificationContainer: {
    flexDirection: 'row',
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
  },
  notificationContent: {
    marginLeft: 12,
    flex: 1,
  },
});

export default Skeleton;

