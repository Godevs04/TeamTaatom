import React, { useState, useEffect } from "react";
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
  Platform,
} from "react-native";
import { Formik } from "formik";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "../../context/ThemeContext";
import  NavBar from "../../components/NavBar";
import { postSchema, shortSchema } from "../../utils/validation";
import { getCurrentLocation, getAddressFromCoords } from "../../utils/geo";
import { createPost, createPostWithProgress, createShort, getPosts, getShorts } from "../../services/posts";
import { getUserFromStorage } from "../../services/auth";
import { UserType } from "../../types/user";
import ProgressAlert from "../../components/ProgressAlert";
import { optimizeImageForUpload, shouldOptimizeImage, getOptimalQuality } from "../../utils/imageOptimization";


interface PostFormValues {
  comment: string;
  placeName: string;
  tags: string;
}

interface ShortFormValues {
  caption: string;
  tags: string;
  placeName: string;
}

export default function PostScreen() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [postType, setPostType] = useState<'photo' | 'short'>('photo');
  const [user, setUser] = useState<UserType | null>(null);
  const [hasExistingPosts, setHasExistingPosts] = useState<boolean | null>(null);
  const [hasExistingShorts, setHasExistingShorts] = useState<boolean | null>(null);
  const router = useRouter();
  const { theme } = useTheme();

  // Check for existing posts and shorts
  const checkExistingContent = async () => {
    try {
      // Check for existing posts
      const postsResponse = await getPosts(1, 1);
      setHasExistingPosts(postsResponse.posts && postsResponse.posts.length > 0);
      
      // Check for existing shorts
      const shortsResponse = await getShorts(1, 1);
      setHasExistingShorts(shortsResponse.shorts && shortsResponse.shorts.length > 0);
    } catch (error) {
      console.error('Error checking existing content:', error);
      // Set to false if there's an error
      setHasExistingPosts(false);
      setHasExistingShorts(false);
    }
  };

  // Get user from storage and check existing content
  useEffect(() => {
    const loadUser = async () => {
      const userData = await getUserFromStorage();
      setUser(userData);
      console.log('PostScreen: User loaded:', userData);
      
      // Check for existing content
      await checkExistingContent();
    };
    loadUser();
  }, []);

  const clearUploadState = () => {
    setUploadError(null);
    setUploadProgress(0);
    setIsUploading(false);
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== ImagePicker.PermissionStatus.GRANTED) {
      Alert.alert('Permission needed', 'Please grant photo library permissions.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8, // Increased for better quality
    });
    if (!result.canceled && result.assets?.[0]) {
      clearUploadState();
      
      // Optimize image before setting
      try {
        const needsOptimization = await shouldOptimizeImage(result.assets[0].uri);
        if (needsOptimization) {
          const optimizedImage = await optimizeImageForUpload(result.assets[0].uri, {
            maxWidth: 1200, // Increased for better quality
            maxHeight: 1200, // Increased for better quality
            quality: 0.9, // High quality
            format: 'jpeg'
          });
          setSelectedImage(optimizedImage.uri);
        } else {
          setSelectedImage(result.assets[0].uri);
        }
      } catch (error) {
        console.error('Image optimization error:', error);
        setSelectedImage(result.assets[0].uri); // Fallback to original
      }
      
      setSelectedVideo(null);
      setPostType('photo');
      await getLocation();
    }
  };

  const pickVideo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== ImagePicker.PermissionStatus.GRANTED) {
      Alert.alert('Permission needed', 'Please grant photo library permissions.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      aspect: [9, 16], // Vertical aspect ratio for shorts
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) {
      clearUploadState();
      setSelectedVideo(result.assets[0].uri);
      setSelectedImage(null);
      setPostType('short');
      await getLocation();
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== ImagePicker.PermissionStatus.GRANTED) {
      Alert.alert('Permission needed', 'Please grant camera permissions to take photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8, // Increased for better quality
    });
    if (!result.canceled && result.assets?.[0]) {
      clearUploadState();
      
      // Optimize image before setting
      try {
        const needsOptimization = await shouldOptimizeImage(result.assets[0].uri);
        if (needsOptimization) {
          const optimizedImage = await optimizeImageForUpload(result.assets[0].uri, {
            maxWidth: 1200, // Increased for better quality
            maxHeight: 1200, // Increased for better quality
            quality: 0.9, // High quality
            format: 'jpeg'
          });
          setSelectedImage(optimizedImage.uri);
        } else {
          setSelectedImage(result.assets[0].uri);
        }
      } catch (error) {
        console.error('Image optimization error:', error);
        setSelectedImage(result.assets[0].uri); // Fallback to original
      }
      
      setSelectedVideo(null);
      setPostType('photo');
      await getLocation();
    }
  };

  const takeVideo = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== ImagePicker.PermissionStatus.GRANTED) {
      Alert.alert('Permission needed', 'Please grant camera permissions to take videos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      aspect: [9, 16], // Vertical aspect ratio for shorts
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) {
      setSelectedVideo(result.assets[0].uri);
      setSelectedImage(null);
      setPostType('short');
      await getLocation();
    }
  };

  // Throttle geocoding to avoid rate limit
  let lastCoords: { lat: number | null; lng: number | null } = {
    lat: null,
    lng: null,
  };
  let lastAddress = "";
  let lastGeocodeTime = 0;
  const getLocation = async () => {
    try {
      const currentLocation = await getCurrentLocation();
      if (currentLocation) {
        const coords = {
          lat: currentLocation.coords.latitude,
          lng: currentLocation.coords.longitude,
        };
        setLocation(coords);
        // Only geocode if location changed or 30 seconds passed
        const now = Date.now();
        if (
          !lastCoords.lat ||
          !lastCoords.lng ||
          lastCoords.lat !== coords.lat ||
          lastCoords.lng !== coords.lng ||
          now - lastGeocodeTime > 30000
        ) {
          const addressText = await getAddressFromCoords(
            coords.lat,
            coords.lng
          );
          setAddress(addressText);
          lastCoords = coords;
          lastAddress = addressText;
          lastGeocodeTime = now;
        } else {
          setAddress(lastAddress);
        }
      }
    } catch (error) {
      console.error("Error getting location:", error);
    }
  };

  const handlePost = async (values: PostFormValues) => {
    if (!selectedImage) {
      Alert.alert("Error", "Please select an image first.");
      return;
    }
    if (!user) {
      Alert.alert("Error", "You must be signed in to post.");
      return;
    }
    
    setIsLoading(true);
    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);
    
    try {
      console.log('Creating post with image:', selectedImage);
      
      // Extract filename from URI
      const filename = selectedImage.split('/').pop() || 'post_image.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      // Simulate progress updates since we can't track actual upload progress with fetch
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 10;
        });
      }, 200);

      const response = await createPostWithProgress({
        image: {
          uri: selectedImage,
          type: type,
          name: filename,
        },
        caption: values.comment,
        address: values.placeName || address,
        latitude: location?.lat,
        longitude: location?.lng,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      console.log('Post created successfully:', response);
      
      // Wait a moment to show 100% progress
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
        Alert.alert('Success!', 'Your post has been shared.', [
          {
            text: 'OK',
            onPress: () => {
              setSelectedImage(null);
              setLocation(null);
              setAddress('');
              // Update existing posts state
              setHasExistingPosts(true);
              router.replace('/(tabs)/home');
            },
          },
        ]);
      }, 500);
      
    } catch (error: any) {
      console.error('Post creation failed:', error);
      setUploadError(error?.message || 'Upload failed. Please try again.');
      setIsUploading(false);
      setUploadProgress(0);
      Alert.alert('Upload failed', error?.message || 'Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleShort = async (values: ShortFormValues) => {
    console.log('handleShort called with values:', values);
    console.log('selectedVideo:', selectedVideo);
    console.log('user:', user);
    
    if (!selectedVideo) {
      Alert.alert("Error", "Please select a video first.");
      return;
    }
    if (!user) {
      Alert.alert("Error", "You must be signed in to post.");
      return;
    }
    
    setIsLoading(true);
    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);
    
    try {
      console.log('Creating short with video:', selectedVideo);
      
      // Extract filename from URI
      const filename = selectedVideo.split('/').pop() || 'short_video.mp4';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `video/${match[1]}` : 'video/mp4';

      console.log('Sending data to createShort:', {
        video: {
          uri: selectedVideo,
          type: type,
          name: filename,
        },
        caption: values.caption,
        tags: values.tags.split(',').map(tag => tag.trim()).filter(tag => tag),
        address: values.placeName || address,
        latitude: location?.lat,
        longitude: location?.lng,
      });

      const response = await createShort({
        video: {
          uri: selectedVideo,
          type: type,
          name: filename,
        },
        caption: values.caption,
        tags: values.tags.split(',').map(tag => tag.trim()).filter(tag => tag),
        address: values.placeName || address,
        latitude: location?.lat,
        longitude: location?.lng,
      });

      console.log('Short created successfully:', response);
      
      Alert.alert('Success!', 'Your short has been uploaded.', [
        {
          text: 'OK',
          onPress: () => {
            setSelectedVideo(null);
            setLocation(null);
            // Update existing shorts state
            setHasExistingShorts(true);
            setAddress('');
            setIsUploading(false);
            setUploadProgress(0);
            router.replace('/(tabs)/home');
          },
        },
      ]);
    } catch (error: any) {
      console.error('Short creation failed:', error);
      setUploadError(error?.message || 'Upload failed. Please try again.');
      Alert.alert('Upload failed', error?.message || 'Please try again later.');
    } finally {
      setIsLoading(false);
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <NavBar title="New Post" />
      <ScrollView style={{ flex: 1, padding: theme.spacing.md }} showsVerticalScrollIndicator={false}>
        {/* User Profile Section */}
        {user && (
          <View style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            backgroundColor: theme.colors.surface, 
            borderRadius: theme.borderRadius.lg, 
            padding: theme.spacing.md, 
            marginBottom: theme.spacing.md,
            ...theme.shadows.small
          }}>
            <Image
              source={user.profilePic ? { uri: user.profilePic } : require('../../assets/avatars/male_avatar.png')}
              style={{ 
                width: 40, 
                height: 40, 
                borderRadius: 20, 
                marginRight: theme.spacing.sm,
                borderWidth: 2,
                borderColor: theme.colors.border
              }}
            />
            <Text style={{ 
              fontSize: theme.typography.body.fontSize, 
              fontWeight: '600', 
              color: theme.colors.text 
            }}>
              {user.fullName}
            </Text>
          </View>
        )}
        {/* Post Type Selector */}
        <View style={{ flexDirection: 'row', backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.lg, padding: 4, marginBottom: theme.spacing.md }}>
          <TouchableOpacity 
            style={[
              { flex: 1, paddingVertical: theme.spacing.sm, alignItems: 'center', borderRadius: theme.borderRadius.md },
              postType === 'photo' && { backgroundColor: theme.colors.primary }
            ]}
            onPress={() => setPostType('photo')}
          >
            <Text style={[
              { fontSize: theme.typography.body.fontSize, fontWeight: '600' },
              postType === 'photo' ? { color: 'white' } : { color: theme.colors.textSecondary }
            ]}>
              Photo
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[
              { flex: 1, paddingVertical: theme.spacing.sm, alignItems: 'center', borderRadius: theme.borderRadius.md },
              postType === 'short' && { backgroundColor: theme.colors.primary }
            ]}
            onPress={() => setPostType('short')}
          >
            <Text style={[
              { fontSize: theme.typography.body.fontSize, fontWeight: '600' },
              postType === 'short' ? { color: 'white' } : { color: theme.colors.textSecondary }
            ]}>
              Short
            </Text>
          </TouchableOpacity>
        </View>

        {!selectedImage && !selectedVideo ? (
          <>
            <View style={{ alignItems: 'center', marginTop: theme.spacing.xl, marginBottom: theme.spacing.xl }}>
              <Ionicons 
                name={postType === 'photo' ? "image-outline" : "videocam-outline"} 
                size={80} 
                color={theme.colors.textSecondary} 
                style={{ marginBottom: theme.spacing.md }} 
              />
              <Ionicons name="cloud-upload-outline" size={60} color={theme.colors.primary} style={{ marginBottom: theme.spacing.md }} />
              <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.h2.fontSize, fontWeight: '700', marginBottom: theme.spacing.sm, textAlign: 'center' }}>
                {(() => {
                  if (postType === 'photo' && hasExistingPosts === false) {
                    return 'No Photos Yet';
                  } else if (postType === 'short' && hasExistingShorts === false) {
                    return 'No Shorts Yet';
                  } else {
                    return `Create New ${postType === 'photo' ? 'Photo' : 'Short'}`;
                  }
                })()}
              </Text>
              <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.body.fontSize, textAlign: 'center', marginBottom: theme.spacing.lg }}>
                {(() => {
                  if (postType === 'photo' && hasExistingPosts === false) {
                    return 'Share your first moment by uploading a photo or taking one now!';
                  } else if (postType === 'short' && hasExistingShorts === false) {
                    return 'Share your first short by uploading a video or taking one now!';
                  } else {
                    return `Upload a ${postType === 'photo' ? 'photo' : 'video'} or take one now to share with your followers!`;
                  }
                })()}
              </Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-around", marginVertical: theme.spacing.xl }}>
              <TouchableOpacity style={{ alignItems: "center", backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.lg, padding: theme.spacing.lg, width: "45%", ...theme.shadows.medium }} onPress={postType === 'photo' ? pickImage : pickVideo}>
                <Ionicons name={postType === 'photo' ? "images" : "film"} size={48} color={theme.colors.primary} />
                <Text style={{ color: theme.colors.text, fontSize: theme.typography.body.fontSize, marginTop: theme.spacing.sm, textAlign: "center" }}>
                  Choose from Library
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ alignItems: "center", backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.lg, padding: theme.spacing.lg, width: "45%", ...theme.shadows.medium }} onPress={postType === 'photo' ? takePhoto : takeVideo}>
                <Ionicons name={postType === 'photo' ? "camera" : "videocam"} size={48} color={theme.colors.primary} />
                <Text style={{ color: theme.colors.text, fontSize: theme.typography.body.fontSize, marginTop: theme.spacing.sm, textAlign: "center" }}>
                  Take {postType === 'photo' ? 'Photo' : 'Video'}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={{ position: "relative", marginVertical: theme.spacing.md }}>
            {selectedImage ? (
              <Image source={{ uri: selectedImage }} style={{ width: "100%", height: 300, borderRadius: theme.borderRadius.lg, resizeMode: "cover" }} />
            ) : selectedVideo ? (
              <View style={{ width: "100%", height: 300, borderRadius: theme.borderRadius.lg, backgroundColor: theme.colors.surface, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="play-circle" size={80} color={theme.colors.primary} />
                <Text style={{ color: theme.colors.text, marginTop: theme.spacing.sm }}>Video Selected</Text>
              </View>
            ) : null}
            <TouchableOpacity style={{ position: "absolute", top: theme.spacing.sm, right: theme.spacing.sm, backgroundColor: theme.colors.background, borderRadius: 16 }} onPress={() => { 
              setSelectedImage(null); 
              setSelectedVideo(null);
              setLocation(null); 
              setAddress(""); 
            }}>
              <Ionicons name="close-circle" size={32} color={theme.colors.error} />
            </TouchableOpacity>
          </View>
        )}
        {(selectedImage || selectedVideo) && (
          <View style={{ backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.lg, padding: theme.spacing.lg, marginTop: theme.spacing.md, ...theme.shadows.medium }}>
            {postType === 'photo' ? (
              <Formik
                initialValues={{ comment: "", placeName: "", tags: "" }}
                validationSchema={postSchema}
                onSubmit={handlePost}
              >
                {({ handleChange, handleBlur, handleSubmit, values, errors, touched }) => (
                  <View>
                    <View style={{ marginBottom: theme.spacing.md }}>
                      <Text style={{ fontSize: theme.typography.body.fontSize, fontWeight: "600", color: theme.colors.text, marginBottom: theme.spacing.xs }}>Comment</Text>
                      <TextInput
                        style={{ backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.borderRadius.md, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.md, fontSize: theme.typography.body.fontSize, color: theme.colors.text, borderWidth: 1, borderColor: theme.colors.border }}
                        placeholder="What's happening?"
                        placeholderTextColor={theme.colors.textSecondary}
                        value={values.comment}
                        onChangeText={handleChange("comment")}
                        onBlur={handleBlur("comment")}
                        multiline
                        numberOfLines={4}
                      />
                      {errors.comment && touched.comment && (
                        <Text style={{ color: theme.colors.error, fontSize: theme.typography.small.fontSize, marginTop: theme.spacing.xs }}>{errors.comment}</Text>
                      )}
                    </View>
                    <View style={{ marginBottom: theme.spacing.md }}>
                      <Text style={{ fontSize: theme.typography.body.fontSize, fontWeight: "600", color: theme.colors.text, marginBottom: theme.spacing.xs }}>Place Name (Optional)</Text>
                      <TextInput
                        style={{ backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.borderRadius.md, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.md, fontSize: theme.typography.body.fontSize, color: theme.colors.text, borderWidth: 1, borderColor: theme.colors.border }}
                        placeholder="Add a place name"
                        placeholderTextColor={theme.colors.textSecondary}
                        value={values.placeName}
                        onChangeText={handleChange("placeName")}
                        onBlur={handleBlur("placeName")}
                      />
                      {errors.placeName && touched.placeName && (
                        <Text style={{ color: theme.colors.error, fontSize: theme.typography.small.fontSize, marginTop: theme.spacing.xs }}>{errors.placeName}</Text>
                      )}
                    </View>
                    {address && (
                      <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, marginBottom: theme.spacing.md }}>
                        <Ionicons name="location" size={16} color={theme.colors.textSecondary} />
                        <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.body.fontSize, marginLeft: theme.spacing.xs, flex: 1 }}>{address}</Text>
                      </View>
                    )}
                    {uploadError && (
                      <View style={{ marginBottom: theme.spacing.md, padding: theme.spacing.md, backgroundColor: '#ffebee', borderRadius: theme.borderRadius.md }}>
                        <Text style={{ color: '#c62828', fontSize: theme.typography.body.fontSize }}>{uploadError}</Text>
                      </View>
                    )}
                    <TouchableOpacity
                      style={[
                        { backgroundColor: theme.colors.primary, borderRadius: theme.borderRadius.md, paddingVertical: theme.spacing.md, alignItems: "center", marginTop: theme.spacing.lg, ...theme.shadows.medium },
                        isLoading && { opacity: 0.6 },
                      ]}
                      onPress={() => handleSubmit()}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <ActivityIndicator color={theme.colors.text} />
                      ) : (
                        <Text style={{ color: theme.colors.text, fontSize: theme.typography.body.fontSize, fontWeight: "600" }}>Share Post</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </Formik>
            ) : (
              <Formik
                initialValues={{ caption: "", tags: "", placeName: "" }}
                validationSchema={shortSchema}
                onSubmit={handleShort}
              >
                {({ handleChange, handleBlur, handleSubmit, values, errors, touched }) => (
                  <View>
                    <View style={{ marginBottom: theme.spacing.md }}>
                      <Text style={{ fontSize: theme.typography.body.fontSize, fontWeight: "600", color: theme.colors.text, marginBottom: theme.spacing.xs }}>Caption</Text>
                      <TextInput
                        style={{ backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.borderRadius.md, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.md, fontSize: theme.typography.body.fontSize, color: theme.colors.text, borderWidth: 1, borderColor: theme.colors.border }}
                        placeholder="Add a caption for your short..."
                        placeholderTextColor={theme.colors.textSecondary}
                        value={values.caption}
                        onChangeText={handleChange("caption")}
                        onBlur={handleBlur("caption")}
                        multiline
                        numberOfLines={3}
                      />
                      {errors.caption && touched.caption && (
                        <Text style={{ color: theme.colors.error, fontSize: theme.typography.small.fontSize, marginTop: theme.spacing.xs }}>{errors.caption}</Text>
                      )}
                    </View>
                    <View style={{ marginBottom: theme.spacing.md }}>
                      <Text style={{ fontSize: theme.typography.body.fontSize, fontWeight: "600", color: theme.colors.text, marginBottom: theme.spacing.xs }}>Tags (Optional)</Text>
                      <TextInput
                        style={{ backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.borderRadius.md, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.md, fontSize: theme.typography.body.fontSize, color: theme.colors.text, borderWidth: 1, borderColor: theme.colors.border }}
                        placeholder="funny, travel, music (comma separated)"
                        placeholderTextColor={theme.colors.textSecondary}
                        value={values.tags}
                        onChangeText={handleChange("tags")}
                        onBlur={handleBlur("tags")}
                      />
                      {errors.tags && touched.tags && (
                        <Text style={{ color: theme.colors.error, fontSize: theme.typography.small.fontSize, marginTop: theme.spacing.xs }}>{errors.tags}</Text>
                      )}
                    </View>
                    <View style={{ marginBottom: theme.spacing.md }}>
                      <Text style={{ fontSize: theme.typography.body.fontSize, fontWeight: "600", color: theme.colors.text, marginBottom: theme.spacing.xs }}>Location (Optional)</Text>
                      <TextInput
                        style={{ backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.borderRadius.md, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.md, fontSize: theme.typography.body.fontSize, color: theme.colors.text, borderWidth: 1, borderColor: theme.colors.border }}
                        placeholder="Add a location"
                        placeholderTextColor={theme.colors.textSecondary}
                        value={values.placeName}
                        onChangeText={handleChange("placeName")}
                        onBlur={handleBlur("placeName")}
                      />
                      {errors.placeName && touched.placeName && (
                        <Text style={{ color: theme.colors.error, fontSize: theme.typography.small.fontSize, marginTop: theme.spacing.xs }}>{errors.placeName}</Text>
                      )}
                    </View>
                    {address && (
                      <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, marginBottom: theme.spacing.md }}>
                        <Ionicons name="location" size={16} color={theme.colors.textSecondary} />
                        <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.body.fontSize, marginLeft: theme.spacing.xs, flex: 1 }}>{address}</Text>
                      </View>
                    )}
                    {uploadError && (
                      <View style={{ marginBottom: theme.spacing.md, padding: theme.spacing.md, backgroundColor: '#ffebee', borderRadius: theme.borderRadius.md }}>
                        <Text style={{ color: '#c62828', fontSize: theme.typography.body.fontSize }}>{uploadError}</Text>
                      </View>
                    )}
                    <TouchableOpacity
                      style={[
                        { backgroundColor: theme.colors.primary, borderRadius: theme.borderRadius.md, paddingVertical: theme.spacing.md, alignItems: "center", marginTop: theme.spacing.lg, ...theme.shadows.medium },
                        isLoading && { opacity: 0.6 },
                      ]}
                      onPress={() => {
                        console.log('Upload Short button pressed');
                        console.log('Form values:', values);
                        console.log('Form errors:', errors);
                        console.log('Form touched:', touched);
                        handleSubmit();
                      }}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <ActivityIndicator color={theme.colors.text} />
                      ) : (
                        <Text style={{ color: theme.colors.text, fontSize: theme.typography.body.fontSize, fontWeight: "600" }}>Upload Short</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </Formik>
            )}
          </View>
        )}
      </ScrollView>
      
      {/* Progress Alert */}
      <ProgressAlert
        visible={isUploading}
        title="Uploading Post"
        message="Please wait while your image is being uploaded..."
        progress={uploadProgress}
        type="upload"
        showCancel={true}
        onCancel={() => {
          setIsUploading(false);
          setUploadProgress(0);
          setIsLoading(false);
        }}
      />
    </View>
  );
}

/* (Removed duplicate implementation of PostScreen and related duplicate code) */

// styles removed, now handled inline with theme context
