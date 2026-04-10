import { createLogger } from './logger';
import { getApiUrl } from './config';
import { showGlobalAlert } from './globalAlertHandler';

const logger = createLogger('Connectivity');

export const testAPIConnectivity = async (): Promise<boolean> => {
  try {
    // Backend exposes health at /health (root) and /api/v1/health; use root /health
    const healthCheckUrl = getApiUrl('/health');
    
    // Use AbortController for timeout (fetch doesn't support timeout directly)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(healthCheckUrl, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      logger.debug('API connectivity test: SUCCESS');
      return true;
    } else {
      logger.warn(`API connectivity test: FAILED - Status: ${response.status}`);
      return false;
    }
  } catch (error) {
    clearTimeout(timeoutId);
    logger.warn('API connectivity test: FAILED');
    return false;
  }
};

export const showConnectivityAlert = () => {
  const apiUrl = getApiUrl('/api');
  showGlobalAlert({
    title: 'Connection Issue',
    message: `Unable to connect to the server. Please ensure:\n\n1. The backend server is running\n2. Your device is on the same network\n3. The server address is correct\n\nCurrent server: ${apiUrl}`,
    type: 'warning',
    showCancel: false,
    confirmText: 'OK',
  });
};
