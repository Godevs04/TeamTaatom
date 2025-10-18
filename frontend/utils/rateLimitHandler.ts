import { Alert } from 'react-native';

export interface RateLimitError extends Error {
  response?: {
    status: number;
    data?: {
      message?: string;
      retryAfter?: number;
    };
  };
}

export const isRateLimitError = (error: any): error is RateLimitError => {
  return error?.response?.status === 429;
};

export const handleRateLimitError = (error: RateLimitError, context?: string) => {
  const retryAfter = error.response?.data?.retryAfter;
  const message = error.response?.data?.message || 'Too many requests. Please try again later.';
  
  console.warn(`Rate limit error${context ? ` in ${context}` : ''}:`, message);
  
  if (retryAfter) {
    console.log(`Server suggests retrying after ${retryAfter} seconds`);
  }
  
  // You can customize this to show different UI based on context
  return {
    message,
    retryAfter,
    shouldRetry: true,
  };
};

export const createRateLimitAwareFunction = <T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  context?: string
) => {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      if (isRateLimitError(error)) {
        const rateLimitInfo = handleRateLimitError(error, context);
        
        // Show user-friendly message
        Alert.alert(
          'Rate Limited',
          rateLimitInfo.message,
          [
            {
              text: 'OK',
              style: 'default',
            },
          ]
        );
        
        throw new Error(rateLimitInfo.message);
      }
      throw error;
    }
  };
};

export const withRateLimitHandling = <T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  context?: string
) => {
  return createRateLimitAwareFunction(fn, context);
};
