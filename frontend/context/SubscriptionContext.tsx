import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { getSubscriptionStatus as fetchSubscriptionStatusApi, SubscriptionStatus } from '../services/connect';
import logger from '../utils/logger';
import { registerResetCallback } from '../services/auth';

interface SubscriptionContextType {
  subscriptionStatuses: Record<string, SubscriptionStatus>;
  loadingStatuses: Record<string, boolean>;
  refreshSubscriptionStatus: (pageId: string) => Promise<SubscriptionStatus | null>;
  updateSubscriptionStatus: (pageId: string, status: SubscriptionStatus) => void;
  clearSubscriptionCache: () => void;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [subscriptionStatuses, setSubscriptionStatuses] = useState<Record<string, SubscriptionStatus>>({});
  const [loadingStatuses, setLoadingStatuses] = useState<Record<string, boolean>>({});
  const inFlightRequests = useRef<Set<string>>(new Set());

  const refreshSubscriptionStatus = useCallback(async (pageId: string) => {
    if (!pageId) return null;
    
    // Prevent duplicate concurrent requests for the same pageId
    if (inFlightRequests.current.has(pageId)) {
      logger.debug(`Subscription refresh already in progress for page ${pageId}, skipping`);
      return subscriptionStatuses[pageId] || null;
    }

    inFlightRequests.current.add(pageId);
    setLoadingStatuses(prev => ({ ...prev, [pageId]: true }));
    try {
      const status = await fetchSubscriptionStatusApi(pageId);
      setSubscriptionStatuses(prev => ({ ...prev, [pageId]: status }));
      return status;
    } catch (err) {
      logger.warn(`Error refreshing subscription status for page ${pageId}:`, err);
      return null;
    } finally {
      inFlightRequests.current.delete(pageId);
      setLoadingStatuses(prev => ({ ...prev, [pageId]: false }));
    }
  }, [subscriptionStatuses]);

  const updateSubscriptionStatus = useCallback((pageId: string, status: SubscriptionStatus) => {
    setSubscriptionStatuses(prev => ({ ...prev, [pageId]: status }));
  }, []);

  const clearSubscriptionCache = useCallback(() => {
    setSubscriptionStatuses({});
    setLoadingStatuses({});
    inFlightRequests.current.clear();
  }, []);

  useEffect(() => {
    const unregister = registerResetCallback(() => {
      clearSubscriptionCache();
    });
    return () => unregister();
  }, [clearSubscriptionCache]);

  return (
    <SubscriptionContext.Provider value={{
      subscriptionStatuses,
      loadingStatuses,
      refreshSubscriptionStatus,
      updateSubscriptionStatus,
      clearSubscriptionCache
    }}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};
