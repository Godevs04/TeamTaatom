import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import NavBar from '../../components/NavBar';
import { getFollowRequests, approveFollowRequest, rejectFollowRequest } from '../../services/profile';
import CustomAlert from '../../components/CustomAlert';
import { FollowRequest } from '../../types/user';

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
      console.error('Error loading follow requests:', error);
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
      console.error('Error approving follow request:', error);
      showError('Failed to approve follow request');
    }
  };

  const handleReject = async (requestId: string, userName: string) => {
    try {
      await rejectFollowRequest(requestId);
      setFollowRequests(prev => prev.filter(req => req._id !== requestId));
      showSuccess(`Follow request from ${userName} has been declined`);
    } catch (error) {
      console.error('Error rejecting follow request:', error);
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
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  requestsContainer: {
    padding: 16,
  },
  requestItem: {
    borderRadius: 12,
    marginBottom: 12,
    padding: 16,
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
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 14,
    marginBottom: 2,
  },
  requestDate: {
    fontSize: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectButton: {
    backgroundColor: '#FF3B30',
  },
  approveButton: {
    backgroundColor: '#34C759',
  },
});
