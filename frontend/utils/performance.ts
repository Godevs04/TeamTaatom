import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import logger from './logger';

export interface PerformanceMetrics {
  apiCalls: number;
  imageLoads: number;
  renderTime: number;
  memoryUsage: number;
  networkLatency: number;
}

export interface ApiCallMetrics {
  endpoint: string;
  method: string;
  duration: number;
  success: boolean;
  timestamp: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    apiCalls: 0,
    imageLoads: 0,
    renderTime: 0,
    memoryUsage: 0,
    networkLatency: 0,
  };

  private apiCallHistory: ApiCallMetrics[] = [];
  private renderStartTime: number = 0;

  /**
   * Start monitoring render performance
   */
  startRenderTimer() {
    this.renderStartTime = performance.now();
  }

  /**
   * End render timer and record metrics
   */
  endRenderTimer(componentName: string) {
    const renderTime = performance.now() - this.renderStartTime;
    this.metrics.renderTime = renderTime;
    
    if (__DEV__) {
      logger.debug(`[Performance] ${componentName} render time: ${renderTime.toFixed(2)}ms`);
    }
  }

  /**
   * Record API call metrics
   */
  recordApiCall(endpoint: string, method: string, duration: number, success: boolean) {
    this.metrics.apiCalls++;
    
    const apiCall: ApiCallMetrics = {
      endpoint,
      method,
      duration,
      success,
      timestamp: Date.now(),
    };

    this.apiCallHistory.push(apiCall);
    
    // Keep only last 100 API calls
    if (this.apiCallHistory.length > 100) {
      this.apiCallHistory = this.apiCallHistory.slice(-100);
    }

    // Update average network latency
    const recentCalls = this.apiCallHistory.slice(-10);
    this.metrics.networkLatency = recentCalls.reduce((sum, call) => sum + call.duration, 0) / recentCalls.length;

    if (__DEV__) {
      logger.debug(`[Performance] API ${method} ${endpoint}: ${duration.toFixed(2)}ms (${success ? 'success' : 'failed'})`);
    }
  }

  /**
   * Record image load metrics
   */
  recordImageLoad(duration: number, success: boolean) {
    this.metrics.imageLoads++;
    
    if (__DEV__) {
      logger.debug(`[Performance] Image load: ${duration.toFixed(2)}ms (${success ? 'success' : 'failed'})`);
    }
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get API call statistics
   */
  getApiStats() {
    const totalCalls = this.apiCallHistory.length;
    const successfulCalls = this.apiCallHistory.filter(call => call.success).length;
    const averageDuration = this.apiCallHistory.reduce((sum, call) => sum + call.duration, 0) / totalCalls;
    
    return {
      totalCalls,
      successfulCalls,
      successRate: totalCalls > 0 ? (successfulCalls / totalCalls) * 100 : 0,
      averageDuration,
    };
  }

  /**
   * Clear all metrics
   */
  clearMetrics() {
    this.metrics = {
      apiCalls: 0,
      imageLoads: 0,
      renderTime: 0,
      memoryUsage: 0,
      networkLatency: 0,
    };
    this.apiCallHistory = [];
  }

  /**
   * Save metrics to storage
   */
  async saveMetrics() {
    try {
      const data = {
        metrics: this.metrics,
        apiStats: this.getApiStats(),
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem('performance_metrics', JSON.stringify(data));
    } catch (error) {
      logger.error('Failed to save performance metrics:', error);
    }
  }

  /**
   * Load metrics from storage
   */
  async loadMetrics() {
    try {
      const data = await AsyncStorage.getItem('performance_metrics');
      if (data) {
        const parsed = JSON.parse(data);
        // Only load if data is recent (within 24 hours)
        if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
          this.metrics = parsed.metrics;
        }
      }
    } catch (error) {
      logger.error('Failed to load performance metrics:', error);
    }
  }
}

// Create singleton instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * Higher-order component for performance monitoring
 */
export function withPerformanceMonitoring<P extends object>(
  Component: React.ComponentType<P>,
  componentName: string
) {
  return React.memo((props: P) => {
    React.useEffect(() => {
      performanceMonitor.startRenderTimer();
      
      return () => {
        performanceMonitor.endRenderTimer(componentName);
      };
    });

    return React.createElement(Component, props);
  });
}

/**
 * Hook for performance monitoring
 */
export function usePerformanceMonitoring(componentName: string) {
  React.useEffect(() => {
    performanceMonitor.startRenderTimer();
    
    return () => {
      performanceMonitor.endRenderTimer(componentName);
    };
  }, [componentName]);

  return {
    recordApiCall: performanceMonitor.recordApiCall.bind(performanceMonitor),
    recordImageLoad: performanceMonitor.recordImageLoad.bind(performanceMonitor),
    getMetrics: performanceMonitor.getMetrics.bind(performanceMonitor),
  };
}

/**
 * API interceptor for performance monitoring
 */
export function createPerformanceInterceptor() {
  return {
    request: (config: any) => {
      config.metadata = { startTime: performance.now() };
      return config;
    },
    response: (response: any) => {
      const duration = performance.now() - response.config.metadata.startTime;
      performanceMonitor.recordApiCall(
        response.config.url,
        response.config.method,
        duration,
        true
      );
      return response;
    },
    error: (error: any) => {
      if (error.config?.metadata) {
        const duration = performance.now() - error.config.metadata.startTime;
        performanceMonitor.recordApiCall(
          error.config.url,
          error.config.method,
          duration,
          false
        );
      }
      return Promise.reject(error);
    },
  };
}

/**
 * Debounce utility for API calls
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttle utility for API calls
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Request batching utility
 */
export class RequestBatcher {
  private batch: Array<{ key: string; request: () => Promise<any>; resolve: (value: any) => void; reject: (error: any) => void }> = [];
  private batchTimeout: NodeJS.Timeout | null = null;
  private batchDelay: number;

  constructor(batchDelay: number = 100) {
    this.batchDelay = batchDelay;
  }

  async add<T>(key: string, request: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.batch.push({ key, request, resolve, reject });
      
      if (this.batchTimeout) {
        clearTimeout(this.batchTimeout);
      }
      
      this.batchTimeout = setTimeout(() => {
        this.processBatch();
      }, this.batchDelay);
    });
  }

  private async processBatch() {
    const currentBatch = [...this.batch];
    this.batch = [];
    this.batchTimeout = null;

    // Group requests by key to avoid duplicates
    const groupedRequests = new Map<string, typeof currentBatch[0]>();
    currentBatch.forEach(item => {
      if (!groupedRequests.has(item.key)) {
        groupedRequests.set(item.key, item);
      }
    });

    // Execute unique requests
    const promises = Array.from(groupedRequests.values()).map(async (item) => {
      try {
        const result = await item.request();
        item.resolve(result);
      } catch (error) {
        item.reject(error);
      }
    });

    await Promise.allSettled(promises);
  }
}

// Create singleton request batcher
export const requestBatcher = new RequestBatcher(100);
