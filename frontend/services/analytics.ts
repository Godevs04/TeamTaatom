import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import api from './api';
import { getUserFromStorage } from './auth';
import logger from '../utils/logger';

interface AnalyticsEvent {
  event: string;
  properties?: Record<string, any>;
  userId?: string;
  timestamp: Date;
  platform: string;
  sessionId: string;
}

class AnalyticsService {
  private sessionId: string = '';
  private sessionStartTime: Date = new Date();
  private eventQueue: AnalyticsEvent[] = [];
  private isInitialized = false;
  private flushInterval: NodeJS.Timeout | null = null;
  private userId: string | null = null;

  async initialize() {
    if (this.isInitialized) return;

    // Generate session ID
    this.sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.sessionStartTime = new Date();

    // Get user ID
    const user = await getUserFromStorage();
    this.userId = user?._id || null;

    // Load queued events from storage
    await this.loadQueuedEvents();

    // Start periodic flush
    this.flushInterval = setInterval(() => {
      this.flush();
    }, 30000); // Flush every 30 seconds

    this.isInitialized = true;
  }

  private async loadQueuedEvents() {
    try {
      const stored = await AsyncStorage.getItem('analytics_queue');
      if (stored) {
        this.eventQueue = JSON.parse(stored);
      }
    } catch (error) {
      logger.error('Error loading analytics queue:', error);
    }
  }

  private async saveQueuedEvents() {
    try {
      await AsyncStorage.setItem('analytics_queue', JSON.stringify(this.eventQueue));
    } catch (error) {
      logger.error('Error saving analytics queue:', error);
    }
  }

  async track(event: string, properties?: Record<string, any>) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const analyticsEvent: AnalyticsEvent = {
      event,
      properties: {
        ...properties,
        platform: Platform.OS,
        appVersion: Constants.expoConfig?.version || '1.0.0',
      },
      userId: this.userId || undefined,
      timestamp: new Date(),
      platform: Platform.OS,
      sessionId: this.sessionId,
    };

    this.eventQueue.push(analyticsEvent);
    await this.saveQueuedEvents();

    // Flush immediately for critical events
    if (this.isCriticalEvent(event)) {
      await this.flush();
    }
  }

  private isCriticalEvent(event: string): boolean {
    const criticalEvents = [
      'user_signup',
      'user_login',
      'user_logout',
      'post_created',
      'payment_completed',
      'error_occurred',
    ];
    return criticalEvents.includes(event);
  }

  async flush() {
    if (this.eventQueue.length === 0) return;

    const eventsToSend = [...this.eventQueue];
    this.eventQueue = [];

    try {
      await api.post('/api/v1/analytics/events', { events: eventsToSend });
      await AsyncStorage.removeItem('analytics_queue');
    } catch (error) {
      // Re-queue events on failure
      this.eventQueue = [...eventsToSend, ...this.eventQueue];
      await this.saveQueuedEvents();
      logger.error('Error flushing analytics events:', error);
    }
  }

  async setUser(userId: string) {
    this.userId = userId;
    await this.track('user_identified', { userId });
  }

  async trackScreenView(screenName: string, properties?: Record<string, any>) {
    await this.track('screen_view', {
      screen_name: screenName,
      ...properties,
    });
  }

  async trackPostView(postId: string, properties?: Record<string, any>) {
    await this.track('post_view', {
      post_id: postId,
      ...properties,
    });
  }

  async trackEngagement(action: string, targetType: string, targetId: string, properties?: Record<string, any>) {
    await this.track('engagement', {
      action,
      target_type: targetType,
      target_id: targetId,
      ...properties,
    });
  }

  async trackFeatureUsage(featureName: string, properties?: Record<string, any>) {
    await this.track('feature_usage', {
      feature_name: featureName,
      ...properties,
    });
  }

  async trackDropOff(step: string, properties?: Record<string, any>) {
    await this.track('drop_off', {
      step,
      ...properties,
    });
  }

  async trackError(error: Error, context?: Record<string, any>) {
    await this.track('error_occurred', {
      error_message: error.message,
      error_stack: error.stack,
      ...context,
    });
  }

  async trackRetention(event: string, properties?: Record<string, any>) {
    await this.track('retention', {
      retention_event: event,
      ...properties,
    });
  }

  destroy() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flush();
  }
}

export const analyticsService = new AnalyticsService();

// Convenience functions
export const track = (event: string, properties?: Record<string, any>) => {
  analyticsService.track(event, properties);
};

export const trackScreenView = (screenName: string, properties?: Record<string, any>) => {
  analyticsService.trackScreenView(screenName, properties);
};

export const trackPostView = (postId: string, properties?: Record<string, any>) => {
  analyticsService.trackPostView(postId, properties);
};

export const trackEngagement = (action: string, targetType: string, targetId: string, properties?: Record<string, any>) => {
  analyticsService.trackEngagement(action, targetType, targetId, properties);
};

export const trackFeatureUsage = (featureName: string, properties?: Record<string, any>) => {
  analyticsService.trackFeatureUsage(featureName, properties);
};

export const trackDropOff = (step: string, properties?: Record<string, any>) => {
  analyticsService.trackDropOff(step, properties);
};

export const trackError = (error: Error, context?: Record<string, any>) => {
  analyticsService.trackError(error, context);
};

