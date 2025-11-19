import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { captureException } from '../services/crashReporting';
import { useTheme } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  showDetails?: boolean; // Show error details in development
  level?: 'component' | 'route' | 'global'; // Error boundary level
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    
    // Log error to crash reporting
    captureException(error, {
      componentStack: errorInfo.componentStack,
      context: `error_boundary_${this.props.level || 'component'}`,
      errorInfo: errorInfo.componentStack,
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  resetError = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error} resetError={this.resetError} />;
      }

      return <ErrorFallback 
        error={this.state.error} 
        errorInfo={this.state.errorInfo}
        resetError={this.resetError}
        showDetails={this.props.showDetails || process.env.NODE_ENV === 'development'}
        level={this.props.level || 'component'}
      />;
    }

    return this.props.children;
  }
}

// Enhanced error fallback component
function ErrorFallback({ 
  error, 
  errorInfo, 
  resetError, 
  showDetails = false,
  level = 'component'
}: { 
  error: Error; 
  errorInfo: React.ErrorInfo | null;
  resetError: () => void;
  showDetails?: boolean;
  level?: string;
}) {
  const { theme } = useTheme();

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.contentContainer}
    >
      <View style={styles.iconContainer}>
        <Ionicons name="alert-circle" size={64} color={theme.colors.error || '#ff5252'} />
      </View>
      
      <Text style={[styles.title, { color: theme.colors.text }]}>
        {level === 'route' ? 'Route Error' : level === 'global' ? 'Application Error' : 'Component Error'}
      </Text>
      
      <Text style={[styles.message, { color: theme.colors.textSecondary }]}>
        {error.message || 'Something went wrong. Please try again.'}
      </Text>

      {showDetails && errorInfo && (
        <View style={[styles.detailsContainer, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.detailsTitle, { color: theme.colors.text }]}>Error Details:</Text>
          <ScrollView style={styles.stackTrace}>
            <Text style={[styles.stackTraceText, { color: theme.colors.textSecondary }]}>
              {errorInfo.componentStack || error.stack}
            </Text>
          </ScrollView>
        </View>
      )}

      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[styles.button, { backgroundColor: theme.colors.primary }]} 
          onPress={resetError}
        >
          <Ionicons name="refresh" size={20} color="white" style={styles.buttonIcon} />
          <Text style={styles.buttonText}>Try Again</Text>
        </TouchableOpacity>

        {level === 'global' && (
          <TouchableOpacity 
            style={[styles.button, styles.secondaryButton, { borderColor: theme.colors.border }]} 
            onPress={() => {
              // Reload app
              if (typeof window !== 'undefined') {
                window.location.reload();
              }
            }}
          >
            <Text style={[styles.secondaryButtonText, { color: theme.colors.text }]}>Reload App</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  contentContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  iconContainer: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
    lineHeight: 22,
  },
  detailsContainer: {
    width: '100%',
    maxHeight: 200,
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  detailsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  stackTrace: {
    maxHeight: 150,
  },
  stackTraceText: {
    fontSize: 11,
    fontFamily: 'monospace',
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
    gap: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 200,
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 200,
  },
  secondaryButtonText: {
    fontWeight: '600',
    fontSize: 16,
  },
});

