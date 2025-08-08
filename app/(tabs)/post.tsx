import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  TextInput,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Formik } from 'formik';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { theme } from '../../constants/theme';
import { NavBar } from '../../components/NavBar';
import { postSchema } from '../../utils/validation';
import { getCurrentLocation, getAddressFromCoords } from '../../utils/geo';
import { uploadPostImage } from '../../services/storage';
import { createPost } from '../../services/firestore';
import { getCurrentUser } from '../../services/auth';

interface PostFormValues {
  comment: string;
  placeName: string;
}

export default function PostScreen() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant camera roll permissions to upload photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
      await getLocation();
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant camera permissions to take photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
      await getLocation();
    }
  };

  const getLocation = async () => {
    try {
      const currentLocation = await getCurrentLocation();
      if (currentLocation) {
        const coords = {
          lat: currentLocation.coords.latitude,
          lng: currentLocation.coords.longitude,
        };
        setLocation(coords);
        
        const addressText = await getAddressFromCoords(coords.lat, coords.lng);
        setAddress(addressText);
      }
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  const handlePost = async (values: PostFormValues) => {
    if (!selectedImage) {
      Alert.alert('Error', 'Please select an image first.');
      return;
    }

    if (!location) {
      Alert.alert('Error', 'Location is required. Please try again.');
      return;
    }

    const currentUser = getCurrentUser();
    if (!currentUser) {
      Alert.alert('Error', 'You must be signed in to post.');
      return;
    }

    setIsLoading(true);
    try {
      // Upload image to Firebase Storage
      const photoUrl = await uploadPostImage(selectedImage, Date.now().toString());
      
      // Create post in Firestore
      await createPost({
        uid: currentUser.uid,
        photoUrl,
        comment: values.comment,
        location,
        placeName: values.placeName || address,
        likes: [],
      });

      Alert.alert('Success!', 'Your post has been shared.', [
        {
          text: 'OK',
          onPress: () => {
            setSelectedImage(null);
            setLocation(null);
            setAddress('');
            router.push('/(tabs)/home');
          },
        },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <NavBar title="New Post" />
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {!selectedImage ? (
          <View style={styles.uploadContainer}>
            <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
              <Ionicons name="images" size={48} color={theme.colors.primary} />
              <Text style={styles.uploadText}>Choose from Library</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.uploadButton} onPress={takePhoto}>
              <Ionicons name="camera" size={48} color={theme.colors.primary} />
              <Text style={styles.uploadText}>Take Photo</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.imageContainer}>
            <Image source={{ uri: selectedImage }} style={styles.selectedImage} />
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => {
                setSelectedImage(null);
                setLocation(null);
                setAddress('');
              }}
            >
              <Ionicons name="close-circle" size={32} color={theme.colors.error} />
            </TouchableOpacity>
          </View>
        )}

        {selectedImage && (
          <View style={styles.formContainer}>
            <Formik
              initialValues={{
                comment: '',
                placeName: '',
              }}
              validationSchema={postSchema}
              onSubmit={handlePost}
            >
              {({ handleChange, handleBlur, handleSubmit, values, errors, touched }) => (
                <View>
                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>Comment</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="What's happening?"
                      placeholderTextColor={theme.colors.textSecondary}
                      value={values.comment}
                      onChangeText={handleChange('comment')}
                      onBlur={handleBlur('comment')}
                      multiline
                      numberOfLines={4}
                    />
                    {errors.comment && touched.comment && (
                      <Text style={styles.errorText}>{errors.comment}</Text>
                    )}
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>Place Name (Optional)</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Add a place name"
                      placeholderTextColor={theme.colors.textSecondary}
                      value={values.placeName}
                      onChangeText={handleChange('placeName')}
                      onBlur={handleBlur('placeName')}
                    />
                    {errors.placeName && touched.placeName && (
                      <Text style={styles.errorText}>{errors.placeName}</Text>
                    )}
                  </View>

                  {address && (
                    <View style={styles.locationContainer}>
                      <Ionicons name="location" size={16} color={theme.colors.textSecondary} />
                      <Text style={styles.locationText}>{address}</Text>
                    </View>
                  )}

                  <TouchableOpacity
                    style={[styles.postButton, isLoading && styles.postButtonDisabled]}
                    onPress={() => handleSubmit()}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator color={theme.colors.text} />
                    ) : (
                      <Text style={styles.postButtonText}>Share Post</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </Formik>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    padding: theme.spacing.md,
  },
  uploadContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: theme.spacing.xl,
  },
  uploadButton: {
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    width: '45%',
    ...theme.shadows.medium,
  },
  uploadText: {
    color: theme.colors.text,
    fontSize: theme.typography.body.fontSize,
    marginTop: theme.spacing.sm,
    textAlign: 'center',
  },
  imageContainer: {
    position: 'relative',
    marginVertical: theme.spacing.md,
  },
  selectedImage: {
    width: '100%',
    height: 300,
    borderRadius: theme.borderRadius.lg,
    resizeMode: 'cover',
  },
  removeButton: {
    position: 'absolute',
    top: theme.spacing.sm,
    right: theme.spacing.sm,
    backgroundColor: theme.colors.background,
    borderRadius: 16,
  },
  formContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginTop: theme.spacing.md,
    ...theme.shadows.medium,
  },
  inputContainer: {
    marginBottom: theme.spacing.md,
  },
  label: {
    fontSize: theme.typography.body.fontSize,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  textInput: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: theme.typography.small.fontSize,
    marginTop: theme.spacing.xs,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  locationText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body.fontSize,
    marginLeft: theme.spacing.xs,
    flex: 1,
  },
  postButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    marginTop: theme.spacing.lg,
    ...theme.shadows.medium,
  },
  postButtonDisabled: {
    opacity: 0.6,
  },
  postButtonText: {
    color: theme.colors.text,
    fontSize: theme.typography.body.fontSize,
    fontWeight: '600',
  },
});
