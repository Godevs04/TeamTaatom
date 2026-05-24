import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { createLogger } from './logger';
import { getApiUrl } from './config';
import { showGlobalAlert } from './globalAlertHandler';

const logger = createLogger('Connectivity');

export let isHighLatency = false;

// Listen to network state changes to dynamically flag high-latency/metered connection
NetInfo.addEventListener((state: NetInfoState) => {
  const isMetered = !!state.isMetered;
  const isCellular = state.type === 'cellular';
  const cellGen = state.details && 'cellularGeneration' in state.details 
    ? state.details.cellularGeneration 
    : null;
  
  // High latency if:
  // 1. Connection is metered, OR
  // 2. Cellular is 2G or 3G, OR
  // 3. No connection or internet is unreachable
  const slowCellular = cellGen === '2g' || cellGen === '3g';
  const noInternet = !state.isConnected || state.isInternetReachable === false;
  
  isHighLatency = isMetered || slowCellular || noInternet;
  logger.debug(
    `[Connectivity] type=${state.type}, isMetered=${isMetered}, cellularGen=${cellGen}, isHighLatency=${isHighLatency}`
  );
});

export const testAPIConnectivity = async (): Promise<boolean> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    // Backend exposes health at /health (root) and /api/v1/health; use root /health
    const healthCheckUrl = getApiUrl('/health');
    
    // Use AbortController for timeout (fetch doesn't support timeout directly)
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(healthCheckUrl, {
      method: 'GET',
      signal: controller.signal,
    });

    if (timeoutId) clearTimeout(timeoutId);

    if (response.ok) {
      logger.debug('API connectivity test: SUCCESS');
      return true;
    } else {
      logger.warn(`API connectivity test: FAILED - Status: ${response.status}`);
      return false;
    }
  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId);
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
