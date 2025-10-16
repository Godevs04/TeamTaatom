import React, { useState } from 'react';
import { View, TouchableOpacity, Modal, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

export interface KebabMenuItem {
  label: string;
  icon?: string;
  onPress: () => void;
  destructive?: boolean;
}

interface KebabMenuProps {
  items: KebabMenuItem[];
  iconColor?: string;
  iconSize?: number;
}

const KebabMenu: React.FC<KebabMenuProps> = ({ items, iconColor, iconSize }) => {
  const { theme } = useTheme();
  const [visible, setVisible] = useState(false);

  const handlePress = (item: KebabMenuItem) => {
    setVisible(false);
    setTimeout(item.onPress, 150);
  };

  return (
    <>
      <TouchableOpacity onPress={() => setVisible(true)} style={{ padding: 6 }}>
        <Ionicons name="ellipsis-vertical" size={iconSize || 20} color={iconColor || theme.colors.text} />
      </TouchableOpacity>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <TouchableOpacity
          style={styles(theme).overlay}
          activeOpacity={1}
          onPress={() => setVisible(false)}
        >
          <View style={styles(theme).menuContainer}>
            {items.map((item, idx) => (
              <TouchableOpacity
                key={item.label}
                style={styles(theme).menuItem}
                onPress={() => handlePress(item)}
              >
                {item.icon && (
                  <Ionicons
                    name={item.icon as any}
                    size={20}
                    color={item.destructive ? '#FF3040' : theme.colors.text}
                    style={{ marginRight: 12 }}
                  />
                )}
                <Text style={[styles(theme).menuItemText, item.destructive && styles(theme).destructiveText]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = (theme: any) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
  },
  menuContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    marginTop: 48,
    marginRight: 16,
    minWidth: 180,
    paddingVertical: 4,
    ...theme.shadows.medium,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  menuItemText: {
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.text,
    fontWeight: '500',
  },
  destructiveText: {
    color: '#FF3040',
  },
});

export default KebabMenu;
