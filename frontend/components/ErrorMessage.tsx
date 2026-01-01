import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import logger from '../utils/logger';

interface ErrorMessageProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  helpLink?: string;
  helpLabel?: string;
  icon?: string;
  type?: 'error' | 'warning' | 'info';
}

export default function ErrorMessage({
  title,
  message,
  onRetry,
  retryLabel = 'Try Again',
  helpLink,
  helpLabel = 'Get Help',
  icon,
  type = 'error',
}: ErrorMessageProps) {
  const { theme } = useTheme();

  const getIcon = () => {
    if (icon) return icon;
    switch (type) {
      case 'error':
        return 'alert-circle';
      case 'warning':
        return 'warning';
      case 'info':
        return 'information-circle';
      default:
        return 'alert-circle';
    }
  };

  const getColor = () => {
    switch (type) {
      case 'error':
        return '#FF3B30';
      case 'warning':
        return '#FF9500';
      case 'info':
        return theme.colors.primary;
      default:
        return '#FF3B30';
    }
  };

  const handleHelpPress = () => {
    if (helpLink) {
      Linking.openURL(helpLink).catch(err => {
        logger.error('Failed to open help link:', err);
      });
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.card }]}>
      <View style={[styles.iconContainer, { backgroundColor: getColor() + '20' }]}>
        <Ionicons name={getIcon() as any} size={32} color={getColor()} />
      </View>
      
      {title && (
        <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
      )}
      
      <Text style={[styles.message, { color: theme.colors.textSecondary }]}>
        {message}
      </Text>

      <View style={styles.actions}>
        {onRetry && (
          <TouchableOpacity
            onPress={onRetry}
            style={[styles.retryButton, { backgroundColor: getColor() }]}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh" size={18} color="#FFFFFF" style={styles.buttonIcon} />
            <Text style={styles.retryButtonText}>{retryLabel}</Text>
          </TouchableOpacity>
        )}

        {helpLink && (
          <TouchableOpacity
            onPress={handleHelpPress}
            style={[styles.helpButton, { borderColor: theme.colors.border }]}
            activeOpacity={0.8}
          >
            <Ionicons name="help-circle-outline" size={18} color={theme.colors.text} style={styles.buttonIcon} />
            <Text style={[styles.helpButtonText, { color: theme.colors.text }]}>
              {helpLabel}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    margin: 16,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  helpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
  },
  helpButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  buttonIcon: {
    marginRight: 6,
  },
});

