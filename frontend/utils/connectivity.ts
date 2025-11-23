import { Alert } from 'react-native';
import { createLogger } from './logger';

const logger = createLogger('Connectivity');

export const testAPIConnectivity = async (): Promise<boolean> => {
  try {
    const response = await fetch('http://192.168.1.8:3000/api/health', {
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
  Alert.alert(
    'Connection Issue',
    'Unable to connect to the server. Please ensure:\n\n1. The backend server is running\n2. Your device is on the same network\n3. The server IP address is correct\n\nCurrent server: http://192.168.1.8:3000',
    [
      { text: 'OK', style: 'default' }
    ]
  );
};
