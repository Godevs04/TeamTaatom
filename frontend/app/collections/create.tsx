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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { useAlert } from '../../context/AlertContext';
import { createCollection, updateCollection, getCollection } from '../../services/collections';
import { getUserFromStorage } from '../../services/auth';

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
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          {isEditing ? 'Edit Collection' : 'New Collection'}
        </Text>
        <TouchableOpacity onPress={handleSubmit} disabled={loading || !name.trim()}>
          <Text style={[
            styles.saveButton,
            { color: loading || !name.trim() ? theme.colors.textSecondary : theme.colors.primary }
          ]}>
            Save
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 12 : 16,
    paddingTop: Platform.OS === 'ios' ? 12 : 20,
    borderBottomWidth: 1,
    minHeight: 56,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  saveButton: {
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  hint: {
    fontSize: 12,
    marginTop: 4,
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
    marginRight: 12,
  },
  switchText: {
    marginLeft: 12,
    flex: 1,
  },
});

