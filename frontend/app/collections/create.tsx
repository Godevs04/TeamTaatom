import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
  Platform,
  Dimensions,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { useAlert } from '../../context/AlertContext';
import { createCollection, updateCollection, getCollection } from '../../services/collections';
import { getUserFromStorage } from '../../services/auth';
import { theme } from '../../constants/theme';

// Responsive dimensions
const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth >= 768;
const isWeb = Platform.OS === 'web';
const isIOS = Platform.OS === 'ios';
const isAndroid = Platform.OS === 'android';

// Elegant font families
const getFontFamily = (weight: '400' | '500' | '600' | '700' | '800' = '400') => {
  if (isWeb) return 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  if (isIOS) return 'System';
  return 'Roboto';
};

export default function CreateCollectionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const { id } = params;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const { theme } = useTheme();
  const { showError, showSuccess } = useAlert();

  React.useEffect(() => {
    if (id) {
      setIsEditing(true);
      loadCollection();
    }
  }, [id]);

  const loadCollection = async () => {
    try {
      setLoading(true);
      const response = await getCollection(id!);
      const collection = response.collection;
      setName(collection.name);
      setDescription(collection.description || '');
      setIsPublic(collection.isPublic);
    } catch (error: any) {
      showError('Failed to load collection');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      showError('Collection name is required');
      return;
    }

    try {
      setLoading(true);
      if (isEditing && id) {
        await updateCollection(id, { name, description, isPublic });
        showSuccess('Collection updated');
      } else {
        await createCollection({ name, description, isPublic });
        showSuccess('Collection created');
      }
      router.back();
    } catch (error: any) {
      showError(error.message || 'Failed to save collection');
    } finally {
      setLoading(false);
    }
  };

  if (loading && isEditing) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : isWeb ? undefined : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity 
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
          style={styles.closeButton}
        >
          <Ionicons name="close" size={isTablet ? 28 : 24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          {isEditing ? 'Edit Collection' : 'New Collection'}
        </Text>
        <TouchableOpacity 
          onPress={handleSubmit} 
          disabled={loading || !name.trim()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
          style={styles.saveButtonContainer}
        >
          <Text style={[
            styles.saveButton,
            { color: loading || !name.trim() ? theme.colors.textSecondary : theme.colors.primary }
          ]}>
            Save
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.colors.text }]}>Name *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.text, borderColor: theme.colors.border }]}
            placeholder="Collection name"
            placeholderTextColor={theme.colors.textSecondary}
            value={name}
            onChangeText={setName}
            maxLength={50}
          />
          <Text style={[styles.hint, { color: theme.colors.textSecondary }]}>
            {name.length}/50 characters
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.colors.text }]}>Description</Text>
          <TextInput
            style={[styles.textArea, { backgroundColor: theme.colors.surface, color: theme.colors.text, borderColor: theme.colors.border }]}
            placeholder="Add a description (optional)"
            placeholderTextColor={theme.colors.textSecondary}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            maxLength={200}
          />
          <Text style={[styles.hint, { color: theme.colors.textSecondary }]}>
            {description.length}/200 characters
          </Text>
        </View>

        <View style={[styles.section, styles.switchSection]}>
          <View style={styles.switchLabel}>
            <Ionicons name={isPublic ? 'globe-outline' : 'lock-closed-outline'} size={20} color={theme.colors.text} />
            <View style={styles.switchText}>
              <Text style={[styles.label, { color: theme.colors.text }]}>Public Collection</Text>
              <Text style={[styles.hint, { color: theme.colors.textSecondary }]}>
                {isPublic ? 'Anyone can view this collection' : 'Only you can view this collection'}
              </Text>
            </View>
          </View>
          <Switch
            value={isPublic}
            onValueChange={setIsPublic}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
            thumbColor={isPublic ? 'white' : theme.colors.textSecondary}
          />
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...(isWeb && {
      maxWidth: isTablet ? 1000 : 800,
      alignSelf: 'center',
      width: '100%',
    } as any),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: isTablet ? theme.spacing.xl : theme.spacing.lg,
    paddingVertical: Platform.OS === 'ios' ? (isTablet ? theme.spacing.md : 12) : (isTablet ? theme.spacing.lg : 16),
    paddingTop: Platform.OS === 'ios' ? (isTablet ? theme.spacing.md : 12) : (isTablet ? theme.spacing.xl : 20),
    borderBottomWidth: 1,
    minHeight: isTablet ? 64 : 56,
  },
  closeButton: {
    // Minimum touch target: 44x44 for iOS, 48x48 for Android
    minWidth: isAndroid ? 48 : 44,
    minHeight: isAndroid ? 48 : 44,
    justifyContent: 'center',
    alignItems: 'center',
    padding: isTablet ? theme.spacing.sm : (isAndroid ? 10 : 8),
    marginLeft: isTablet ? -theme.spacing.sm : -8,
    ...(isWeb && {
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    } as any),
  },
  headerTitle: {
    fontSize: isTablet ? 22 : 18,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    letterSpacing: isIOS ? 0.3 : 0.2,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  saveButtonContainer: {
    // Minimum touch target: 44x44 for iOS, 48x48 for Android
    minWidth: isAndroid ? 48 : 44,
    minHeight: isAndroid ? 48 : 44,
    justifyContent: 'center',
    alignItems: 'center',
    padding: isTablet ? theme.spacing.sm : (isAndroid ? 10 : 8),
    marginRight: isTablet ? -theme.spacing.sm : -8,
    ...(isWeb && {
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    } as any),
  },
  saveButton: {
    fontSize: isTablet ? theme.typography.body.fontSize + 2 : 16,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      cursor: 'pointer',
    } as any),
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: isTablet ? theme.spacing.xl : theme.spacing.lg,
  },
  section: {
    marginBottom: isTablet ? theme.spacing.xl : 24,
  },
  label: {
    fontSize: isTablet ? theme.typography.body.fontSize : 14,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    marginBottom: isTablet ? theme.spacing.sm : 8,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  input: {
    borderWidth: 1,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: isTablet ? theme.spacing.md : 12,
    paddingVertical: isTablet ? theme.spacing.md : 12,
    fontSize: isTablet ? theme.typography.body.fontSize + 1 : 16,
    fontFamily: getFontFamily('400'),
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      outlineStyle: 'none',
    } as any),
  },
  textArea: {
    borderWidth: 1,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: isTablet ? theme.spacing.md : 12,
    paddingVertical: isTablet ? theme.spacing.md : 12,
    fontSize: isTablet ? theme.typography.body.fontSize + 1 : 16,
    fontFamily: getFontFamily('400'),
    minHeight: isTablet ? 120 : 100,
    textAlignVertical: 'top',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      outlineStyle: 'none',
    } as any),
  },
  hint: {
    fontSize: isTablet ? theme.typography.small.fontSize + 1 : 12,
    fontFamily: getFontFamily('400'),
    marginTop: 4,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  switchSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: isTablet ? theme.spacing.md : 12,
  },
  switchText: {
    marginLeft: isTablet ? theme.spacing.md : 12,
    flex: 1,
    fontSize: isTablet ? theme.typography.body.fontSize : 14,
    fontFamily: getFontFamily('500'),
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
});

