import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

interface SettingItemProps {
  icon: string;
  label: string;
  description?: string;
  value?: string;
  onPress?: () => void;
  rightComponent?: React.ReactNode;
  destructive?: boolean;
}

export const SettingItem: React.FC<SettingItemProps> = ({
  icon,
  label,
  description,
  value,
  onPress,
  rightComponent,
  destructive = false,
}) => {
  const { theme } = useTheme();

  return (
    <TouchableOpacity
      style={styles.settingItem}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.settingContent}>
        <Ionicons 
          name={icon as any} 
          size={20} 
          color={destructive ? theme.colors.error : theme.colors.text} 
        />
        <View style={styles.settingText}>
          <Text style={[
            styles.settingLabel, 
            { color: destructive ? theme.colors.error : theme.colors.text }
          ]}>
            {label}
          </Text>
          {description && (
            <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
              {description}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.settingRight}>
        {value && (
          <Text style={[styles.settingValue, { color: theme.colors.textSecondary }]}>
            {value}
          </Text>
        )}
        {rightComponent || (onPress && (
          <Ionicons 
            name="chevron-forward" 
            size={20} 
            color={theme.colors.textSecondary} 
          />
        ))}
      </View>
    </TouchableOpacity>
  );
};

interface SwitchSettingItemProps {
  icon: string;
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}

export const SwitchSettingItem: React.FC<SwitchSettingItemProps> = ({
  icon,
  label,
  description,
  value,
  onValueChange,
  disabled = false,
}) => {
  const { theme } = useTheme();

  return (
    <View style={styles.settingItem}>
      <View style={styles.settingContent}>
        <Ionicons name={icon as any} size={20} color={theme.colors.text} />
        <View style={styles.settingText}>
          <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
            {label}
          </Text>
          {description && (
            <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
              {description}
            </Text>
          )}
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: theme.colors.border, true: theme.colors.primary + '40' }}
        thumbColor={value ? theme.colors.primary : theme.colors.textSecondary}
      />
    </View>
  );
};

interface SettingsSectionProps {
  title: string;
  children: React.ReactNode;
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({ title, children }) => {
  const { theme } = useTheme();

  return (
    <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
        {title}
      </Text>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  settingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingText: {
    marginLeft: 12,
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  settingDescription: {
    fontSize: 14,
    marginTop: 2,
  },
  settingValue: {
    fontSize: 14,
    marginRight: 8,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
