import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator,
  RefreshControl,
  Platform,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import NavBar from '../../components/NavBar';
import { getFollowRequests, approveFollowRequest, rejectFollowRequest } from '../../services/profile';
import CustomAlert from '../../components/CustomAlert';
import { FollowRequest } from '../../types/user';
import { createLogger } from '../../utils/logger';
import { theme } from '../../constants/theme';

// Responsive dimensions
const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth >= 768;
const isWeb = Platform.OS === 'web';
const isIOS = Platform.OS === 'ios';
const isAndroid = Platform.OS === 'android';

// Elegant font families
const getFontFamily = (weight: '400' | '500' | '600' | '700' | '800' = '400') => {
  if (isWeb) return 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  if (isIOS) return 'System';
  return 'Roboto';
};

const logger = createLogger('FollowRequestsScreen');

export default function FollowRequestsScreen() {
  const [followRequests, setFollowRequests] = useState<FollowRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    type: 'info' as 'info' | 'success' | 'warning' | 'error',
  });
  const router = useRouter();
  const { theme } = useTheme();

  const showAlert = (message: string, title?: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    setAlertConfig({ title: title || '', message, type });
    setAlertVisible(true);
  };

  const showError = (message: string, title?: string) => {
    showAlert(message, title || 'Error', 'error');
  };

  const showSuccess = (message: string, title?: string) => {
    showAlert(message, title || 'Success', 'success');
  };

  useEffect(() => {
    loadFollowRequests();
  }, []);

  const loadFollowRequests = async () => {
    try {
      const response = await getFollowRequests();
      setFollowRequests(response.followRequests);
    } catch (error) {
      logger.error('Error loading follow requests', error);
      showError('Failed to load follow requests');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadFollowRequests();
    setRefreshing(false);
  };

  const handleApprove = async (requestId: string, userName: string) => {
    try {
      await approveFollowRequest(requestId);
      setFollowRequests(prev => prev.filter(req => req._id !== requestId));
      showSuccess(`${userName} is now following you!`);
    } catch (error) {
      logger.error('Error approving follow request', error);
      showError('Failed to approve follow request');
    }
  };

  const handleReject = async (requestId: string, userName: string) => {
    try {
      await rejectFollowRequest(requestId);
      setFollowRequests(prev => prev.filter(req => req._id !== requestId));
      showSuccess(`Follow request from ${userName} has been declined`);
    } catch (error) {
      logger.error('Error rejecting follow request', error);
      showError('Failed to reject follow request');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays}d ago`;
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <NavBar title="Follow Requests" showBack={true} onBack={() => router.back()} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <NavBar 
        title="Follow Requests" 
        showBack={true}
        onBack={() => router.back()}
      />
      
      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      >
        {followRequests.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="person-add-outline" size={64} color={theme.colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
              No pending requests
            </Text>
            <Text style={[styles.emptyMessage, { color: theme.colors.textSecondary }]}>
              When someone wants to follow you, their request will appear here
            </Text>
          </View>
        ) : (
          <View style={styles.requestsContainer}>
            {followRequests.map((request) => (
              <View key={request._id} style={[styles.requestItem, { backgroundColor: theme.colors.surface }]}>
                <View style={styles.requestContent}>
                  <View style={styles.userInfo}>
                    <View style={styles.avatarContainer}>
                      <Ionicons name="person" size={24} color={theme.colors.textSecondary} />
                    </View>
                    <View style={styles.userDetails}>
                      <Text style={[styles.userName, { color: theme.colors.text }]}>
                        {request.user.fullName}
                      </Text>
                      <Text style={[styles.userEmail, { color: theme.colors.textSecondary }]}>
                        {request.user.email}
                      </Text>
                      <Text style={[styles.requestDate, { color: theme.colors.textSecondary }]}>
                        {formatDate(request.requestedAt)}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.rejectButton]}
                      onPress={() => handleReject(request._id, request.user.fullName)}
                    >
                      <Ionicons name="close" size={16} color="white" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.approveButton]}
                      onPress={() => handleApprove(request._id, request.user.fullName)}
                    >
                      <Ionicons name="checkmark" size={16} color="white" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <CustomAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...(isWeb && {
      maxWidth: isTablet ? 1000 : 800,
      alignSelf: 'center',
      width: '100%',
    } as any),
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: isTablet ? theme.spacing.xl : theme.spacing.lg,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: isTablet ? theme.spacing.xxl : 32,
    paddingVertical: isTablet ? 80 : 64,
  },
  emptyTitle: {
    fontSize: isTablet ? theme.typography.h3.fontSize : 20,
    fontFamily: getFontFamily('700'),
    fontWeight: '700',
    marginTop: isTablet ? theme.spacing.lg : 16,
    marginBottom: isTablet ? theme.spacing.sm : 8,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  emptyMessage: {
    fontSize: isTablet ? theme.typography.body.fontSize + 2 : 16,
    fontFamily: getFontFamily('400'),
    textAlign: 'center',
    lineHeight: isTablet ? 26 : 22,
    maxWidth: isTablet ? 500 : 300,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  requestsContainer: {
    padding: isTablet ? theme.spacing.xl : theme.spacing.lg,
  },
  requestItem: {
    borderRadius: theme.borderRadius.md,
    marginBottom: isTablet ? theme.spacing.md : 12,
    padding: isTablet ? theme.spacing.lg : theme.spacing.lg,
  },
  requestContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    width: isTablet ? 60 : 48,
    height: isTablet ? 60 : 48,
    borderRadius: isTablet ? 30 : 24,
    backgroundColor: 'rgba(0,0,0,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: isTablet ? theme.spacing.md : 12,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: isTablet ? theme.typography.body.fontSize + 2 : 16,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    marginBottom: 2,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  userEmail: {
    fontSize: isTablet ? theme.typography.body.fontSize : 14,
    fontFamily: getFontFamily('400'),
    marginBottom: 2,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  requestDate: {
    fontSize: isTablet ? theme.typography.small.fontSize + 1 : 12,
    fontFamily: getFontFamily('400'),
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  actionButtons: {
    flexDirection: 'row',
    gap: isTablet ? theme.spacing.sm : 8,
  },
  actionButton: {
    width: isTablet ? 44 : 36,
    height: isTablet ? 44 : 36,
    borderRadius: isTablet ? 22 : 18,
    justifyContent: 'center',
    alignItems: 'center',
    ...(isWeb && {
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    } as any),
  },
  rejectButton: {
    backgroundColor: '#FF3B30',
  },
  approveButton: {
    backgroundColor: '#34C759',
  },
});
