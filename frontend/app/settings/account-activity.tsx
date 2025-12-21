import React, { useEffect, useState, useCallback, useRef } from 'react';
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
import { getAccountActivity, getActiveSessions, logoutFromSession, AccountActivity, ActiveSession } from '../../services/userManagement';
import { useAlert } from '../../context/AlertContext';
import { createLogger } from '../../utils/logger';
import { theme } from '../../constants/theme';

const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth >= 768;
const isWeb = Platform.OS === 'web';

const getFontFamily = (weight: '400' | '500' | '600' | '700' = '400') => {
  if (isWeb) return 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  return 'System';
};

const logger = createLogger('AccountActivity');

export default function AccountActivityScreen() {
  const [activeTab, setActiveTab] = useState<'activity' | 'sessions'>('activity');
  const [activities, setActivities] = useState<AccountActivity[]>([]);
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loggingOut, setLoggingOut] = useState<string | null>(null);
  
  const loadingRef = useRef(false);
  const hasLoadedRef = useRef(false);

  const router = useRouter();
  const { theme } = useTheme();
  const { showError, showSuccess, showConfirm } = useAlert();

  const loadData = useCallback(async () => {
    // Prevent multiple simultaneous loads using ref
    if (loadingRef.current) {
      return;
    }

    try {
      loadingRef.current = true;
      setLoading(true);
      const [activityData, sessionsData] = await Promise.all([
        getAccountActivity(),
        getActiveSessions()
      ]);
      
      // Validate data structure before setting
      if (activityData && typeof activityData === 'object') {
        setActivities(Array.isArray(activityData.activities) ? activityData.activities : []);
      } else {
        setActivities([]);
      }
      
      if (sessionsData && typeof sessionsData === 'object') {
        setSessions(Array.isArray(sessionsData.sessions) ? sessionsData.sessions : []);
      } else {
        setSessions([]);
      }
      
      hasLoadedRef.current = true;
    } catch (error: any) {
      logger.error('Error loading account activity', error);
      // Only show error on first load failure
      if (!hasLoadedRef.current) {
        showError(error.message || 'Failed to load account activity');
      }
      // Set empty arrays on error to prevent undefined access
      setActivities([]);
      setSessions([]);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    if (!hasLoadedRef.current) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [activityData, sessionsData] = await Promise.all([
        getAccountActivity(),
        getActiveSessions()
      ]);
      setActivities(activityData.activities || []);
      setSessions(sessionsData.sessions || []);
    } catch (error: any) {
      logger.error('Error refreshing account activity', error);
      showError(error.message || 'Failed to refresh account activity');
    } finally {
      setRefreshing(false);
    }
  }, [showError]);

  const handleLogoutSession = useCallback((sessionId: string) => {
    if (sessionId === 'current') {
      showError('Cannot logout from current session. Please use the logout button in settings.');
      return;
    }

    showConfirm(
      'Are you sure you want to logout from this device?',
      async () => {
        setLoggingOut(sessionId);
        try {
          await logoutFromSession(sessionId);
          showSuccess('Logged out from device successfully');
          // Refresh sessions data
          try {
            const sessionsData = await getActiveSessions();
            setSessions(sessionsData.sessions || []);
          } catch (refreshError) {
            logger.error('Error refreshing sessions after logout', refreshError);
          }
        } catch (error: any) {
          showError(error.message || 'Failed to logout from device');
        } finally {
          setLoggingOut(null);
        }
      },
      'Logout from Device',
      'Logout',
      'Cancel'
    );
  }, [showConfirm, showError, showSuccess]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <NavBar
        title="Account Activity"
        showBack={true}
        onBack={() => router.back()}
      />

      {/* Tabs */}
      <View style={[styles.tabContainer, { backgroundColor: theme.colors.surface }]}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'activity' && { backgroundColor: theme.colors.primary + '20' },
          ]}
          onPress={() => setActiveTab('activity')}
        >
          <Ionicons
            name="time-outline"
            size={20}
            color={activeTab === 'activity' ? theme.colors.primary : theme.colors.textSecondary}
          />
          <Text
            style={[
              styles.tabText,
              {
                color: activeTab === 'activity' ? theme.colors.primary : theme.colors.textSecondary,
              },
            ]}
          >
            Activity
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'sessions' && { backgroundColor: theme.colors.primary + '20' },
          ]}
          onPress={() => setActiveTab('sessions')}
        >
          <Ionicons
            name="phone-portrait-outline"
            size={20}
            color={activeTab === 'sessions' ? theme.colors.primary : theme.colors.textSecondary}
          />
          <Text
            style={[
              styles.tabText,
              {
                color: activeTab === 'sessions' ? theme.colors.primary : theme.colors.textSecondary,
              },
            ]}
          >
            Sessions
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[theme.colors.primary]}
              tintColor={theme.colors.primary}
            />
          }
        >
          {activeTab === 'activity' ? (
            <View style={styles.contentContainer}>
              {activities.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="time-outline" size={64} color={theme.colors.textSecondary} />
                  <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                    No activity found
                  </Text>
                </View>
              ) : (
                activities.map((activity, index) => (
                  <View
                    key={index}
                    style={[styles.activityItem, { backgroundColor: theme.colors.surface }]}
                  >
                    <View style={styles.activityContent}>
                      <Ionicons
                        name={
                          activity.type === 'login'
                            ? 'log-in-outline'
                            : activity.type === 'account_created'
                            ? 'person-add-outline'
                            : 'checkmark-circle-outline'
                        }
                        size={24}
                        color={theme.colors.primary}
                      />
                      <View style={styles.activityText}>
                        <Text 
                          style={[styles.activityTitle, { color: theme.colors.text }]}
                          numberOfLines={2}
                          ellipsizeMode="tail"
                        >
                          {activity.description}
                        </Text>
                        <Text style={[styles.activityTime, { color: theme.colors.textSecondary }]}>
                          {formatDate(activity.timestamp)}
                        </Text>
                        {activity.device && (
                          <Text 
                            style={[styles.activityDetail, { color: theme.colors.textSecondary }]}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {activity.device}
                          </Text>
                        )}
                        {activity.location && (
                          <Text 
                            style={[styles.activityDetail, { color: theme.colors.textSecondary }]}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {activity.location}
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>
          ) : (
            <View style={styles.contentContainer}>
              {sessions.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="phone-portrait-outline" size={64} color={theme.colors.textSecondary} />
                  <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                    No active sessions
                  </Text>
                </View>
              ) : (
                sessions.map((session) => (
                  <View
                    key={session.sessionId}
                    style={[styles.sessionItem, { backgroundColor: theme.colors.surface }]}
                  >
                    <View style={styles.sessionContent}>
                      <Ionicons
                        name={session.isCurrent ? 'phone-portrait' : 'phone-portrait-outline'}
                        size={24}
                        color={session.isCurrent ? theme.colors.primary : theme.colors.textSecondary}
                      />
                      <View style={styles.sessionText}>
                        <View style={styles.sessionHeader}>
                          <Text 
                            style={[styles.sessionTitle, { color: theme.colors.text }]}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {session.device}
                          </Text>
                          {session.isCurrent && (
                            <View style={[styles.currentBadge, { backgroundColor: theme.colors.primary + '20' }]}>
                              <Text style={[styles.currentBadgeText, { color: theme.colors.primary }]}>
                                Curr
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text 
                          style={[styles.sessionDetail, { color: theme.colors.textSecondary }]}
                          numberOfLines={1}
                        >
                          {formatDate(session.lastActive)}
                        </Text>
                        {session.location && (
                          <Text 
                            style={[styles.sessionDetail, { color: theme.colors.textSecondary }]}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {session.location}
                          </Text>
                        )}
                        <Text 
                          style={[styles.sessionDetail, { color: theme.colors.textSecondary }]}
                          numberOfLines={1}
                        >
                          IP: {session.ipAddress}
                        </Text>
                      </View>
                    </View>
                    {!session.isCurrent && (
                      <TouchableOpacity
                        style={[styles.logoutButton, { backgroundColor: theme.colors.error + '20' }]}
                        onPress={() => handleLogoutSession(session.sessionId)}
                        disabled={loggingOut === session.sessionId}
                      >
                        {loggingOut === session.sessionId ? (
                          <ActivityIndicator size="small" color={theme.colors.error} />
                        ) : (
                          <Text style={[styles.logoutButtonText, { color: theme.colors.error }]}>
                            Logout
                          </Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                ))
              )}
            </View>
          )}
        </ScrollView>
      )}
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
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: isTablet ? theme.spacing.xl : theme.spacing.lg,
    paddingVertical: isTablet ? theme.spacing.md : 12,
    gap: isTablet ? theme.spacing.sm : 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: isTablet ? theme.spacing.md : 12,
    paddingHorizontal: isTablet ? theme.spacing.lg : 16,
    borderRadius: theme.borderRadius.md,
    gap: isTablet ? theme.spacing.sm : 8,
  },
  tabText: {
    fontSize: isTablet ? theme.typography.body.fontSize + 1 : 15,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: isTablet ? theme.spacing.xl : theme.spacing.lg,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: isTablet ? theme.spacing.xl : theme.spacing.lg,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: isTablet ? 100 : 80,
  },
  emptyText: {
    fontSize: isTablet ? theme.typography.h3.fontSize : 18,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    marginTop: isTablet ? theme.spacing.lg : 16,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  activityItem: {
    flexDirection: 'row',
    padding: isTablet ? theme.spacing.lg : theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: isTablet ? theme.spacing.md : 12,
  },
  activityContent: {
    flexDirection: 'row',
    flex: 1,
    alignItems: 'flex-start',
  },
  activityText: {
    marginLeft: isTablet ? theme.spacing.md : 12,
    flex: 1,
    minWidth: 0, // Allows text to shrink properly
  },
  activityTitle: {
    fontSize: isTablet ? theme.typography.body.fontSize + 1 : 16,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    marginBottom: 4,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  activityTime: {
    fontSize: isTablet ? theme.typography.body.fontSize : 14,
    fontFamily: getFontFamily('400'),
    marginBottom: 2,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  activityDetail: {
    fontSize: isTablet ? theme.typography.body.fontSize - 1 : 12,
    fontFamily: getFontFamily('400'),
    marginTop: 2,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  sessionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: isTablet ? theme.spacing.lg : theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: isTablet ? theme.spacing.md : 12,
  },
  sessionContent: {
    flexDirection: 'row',
    flex: 1,
    alignItems: 'flex-start',
  },
  sessionText: {
    marginLeft: isTablet ? theme.spacing.md : 12,
    flex: 1,
    minWidth: 0, // Allows text to shrink properly
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    gap: 8,
  },
  sessionTitle: {
    flex: 1,
    fontSize: isTablet ? theme.typography.body.fontSize + 1 : 16,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    marginRight: 8,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  currentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  currentBadgeText: {
    fontSize: 11,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  sessionDetail: {
    fontSize: isTablet ? theme.typography.body.fontSize - 1 : 12,
    fontFamily: getFontFamily('400'),
    marginTop: 2,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  logoutButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  logoutButtonText: {
    fontSize: 12,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
});

