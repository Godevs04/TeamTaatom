import { Alert } from 'react-native';
import { createLogger } from './logger';
import { getApiUrl } from './config';

const logger = createLogger('Connectivity');

export const testAPIConnectivity = async (): Promise<boolean> => {
  try {
    // PRODUCTION-GRADE: Use config utility instead of hardcoded URL
    const healthCheckUrl = getApiUrl('/api/health');
    const response = await fetch(healthCheckUrl, {
      method: 'GET',
      timeout: 5000,
    });
    
    if (response.ok) {
      logger.debug('API connectivity test: SUCCESS');
      return true;
    } else {
      logger.warn('API connectivity test: FAILED - Status:', response.status);
      return false;
    }
  } catch (error) {
    logger.error('API connectivity test: FAILED', error);
    return false;
  }
};

export const showConnectivityAlert = () => {
  // PRODUCTION-GRADE: Get API URL from config instead of hardcoded
  const apiUrl = getApiUrl('/api');
  Alert.alert(
    'Connection Issue',
    `Unable to connect to the server. Please ensure:\n\n1. The backend server is running\n2. Your device is on the same network\n3. The server address is correct\n\nCurrent server: ${apiUrl}`,
    [
      { text: 'OK', style: 'default' }
    ]
  );
};
