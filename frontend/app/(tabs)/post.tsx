import React, { useState, useEffect, useRef } from "react";
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
  Modal,
} from "react-native";
import { Formik } from "formik";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as MediaLibrary from "expo-media-library";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "../../context/ThemeContext";
import  NavBar from "../../components/NavBar";
import { postSchema, shortSchema } from "../../utils/validation";
import { getCurrentLocation, getAddressFromCoords } from "../../utils/locationUtils";
import { LocationExtractionService } from "../../services/locationExtraction";
import { createPost, createPostWithProgress, createShort, getPosts, getShorts } from "../../services/posts";
import { getUserFromStorage } from "../../services/auth";
import { UserType } from "../../types/user";
import ProgressAlert from "../../components/ProgressAlert";
import { optimizeImageForUpload, shouldOptimizeImage, getOptimalQuality } from "../../utils/imageOptimization";
import * as VideoThumbnails from "expo-video-thumbnails";
import { Video, ResizeMode, AVPlaybackStatus } from "expo-av";
import HashtagSuggest from "../../components/HashtagSuggest";
import MentionSuggest from "../../components/MentionSuggest";
import { useScrollToHideNav } from '../../hooks/useScrollToHideNav';
import { createLogger } from '../../utils/logger';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { SongSelector } from '../../components/SongSelector';
import { Song } from '../../services/songs';

const logger = createLogger('PostScreen');

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
  const [selectedImages, setSelectedImages] = useState<Array<{ uri: string; type: string; name: string }>>([]);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [videoThumbnail, setVideoThumbnail] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
    percentage: number;
  }>({ current: 0, total: 0, percentage: 0 });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [postType, setPostType] = useState<'photo' | 'short'>('photo');
  const [user, setUser] = useState<UserType | null>(null);
  const [hasExistingPosts, setHasExistingPosts] = useState<boolean | null>(null);
  const [hasExistingShorts, setHasExistingShorts] = useState<boolean | null>(null);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [songStartTime, setSongStartTime] = useState(0);
  const [songEndTime, setSongEndTime] = useState(60);
  const [showSongSelector, setShowSongSelector] = useState(false);
  const [audioChoice, setAudioChoice] = useState<'background' | 'original' | null>(null);
  const [showAudioChoiceModal, setShowAudioChoiceModal] = useState(false);
  const router = useRouter();
  const { theme } = useTheme();
  const { handleScroll } = useScrollToHideNav();
  
  // Draft saving
  const DRAFT_KEY = 'postDraft';
  const DRAFT_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

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
      logger.error('Error checking existing content', error);
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
      logger.debug('User loaded:', userData);
      
      // Check for existing content
      await checkExistingContent();
      
      // Load draft if available
      await loadDraft();
    };
    loadUser();
  }, []);

  // Auto-save draft
  useEffect(() => {
    const saveDraft = async () => {
      if (selectedImages.length === 0 && !selectedVideo) return;
      
      const draft = {
        selectedImages,
        selectedVideo,
        location,
        address,
        postType,
        timestamp: Date.now()
      };
      
      try {
        await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        logger.debug('Draft auto-saved');
      } catch (error) {
        logger.error('Failed to save draft', error);
      }
    };
    
    const timeoutId = setTimeout(saveDraft, 2000); // Debounce by 2 seconds
    return () => clearTimeout(timeoutId);
  }, [selectedImages, selectedVideo, location, address, postType]);

  // Load draft on mount
  const loadDraft = async () => {
    try {
      const draftJson = await AsyncStorage.getItem(DRAFT_KEY);
      if (!draftJson) return;
      
      const draft = JSON.parse(draftJson);
      
      // Check if draft is still valid (less than 24 hours old)
      if (Date.now() - draft.timestamp > DRAFT_EXPIRY) {
        await AsyncStorage.removeItem(DRAFT_KEY);
        return;
      }
      
      // Show restore option
      Alert.alert(
        'Draft Found',
        'Would you like to restore your previous draft?',
        [
          {
            text: 'Discard',
            style: 'destructive',
            onPress: async () => {
              await AsyncStorage.removeItem(DRAFT_KEY);
            }
          },
          {
            text: 'Restore',
            onPress: () => {
              if (draft.selectedImages) setSelectedImages(draft.selectedImages);
              if (draft.selectedVideo) setSelectedVideo(draft.selectedVideo);
              if (draft.location) setLocation(draft.location);
              if (draft.address) setAddress(draft.address);
              if (draft.postType) setPostType(draft.postType);
            }
          }
        ]
      );
    } catch (error) {
      logger.error('Failed to load draft', error);
    }
  };

  // Clear draft after successful post
  const clearDraft = async () => {
    try {
      await AsyncStorage.removeItem(DRAFT_KEY);
    } catch (error) {
      logger.error('Failed to clear draft', error);
    }
  };

  const clearUploadState = () => {
    setUploadError(null);
    setUploadProgress({ current: 0, total: 0, percentage: 0 });
    setIsUploading(false);
  };

  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== ImagePicker.PermissionStatus.GRANTED) {
      Alert.alert('Permission needed', 'Please grant photo library permissions.');
      return;
    }

    try {
      // Reset location before picking new images
      setLocation(null);
      setAddress('');
      
      // Record the timestamp before opening the picker
      const selectionStartTime = Date.now();
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: 10,
        quality: 0.8,
        allowsEditing: false,
        exif: true, // Preserve EXIF data including location
      });

      if (!result.canceled && result.assets) {
        logger.debug('Selected assets data:', result.assets.map(asset => ({
          uri: asset.uri,
          fileName: asset.fileName,
          id: (asset as any).id,
          type: asset.type,
          width: asset.width,
          height: asset.height,
        })));
        
        // IMPORTANT: Clear location state explicitly before processing new images
        logger.debug('Clearing location state for new selection');
        setLocation(null);
        setAddress('');
        
        const newImages = result.assets.map(asset => {
          // Determine proper MIME type based on file extension or default to jpeg
          let mimeType = 'image/jpeg';
          if (asset.fileName) {
            const extension = asset.fileName.split('.').pop()?.toLowerCase();
            switch (extension) {
              case 'png':
                mimeType = 'image/png';
                break;
              case 'gif':
                mimeType = 'image/gif';
                break;
              case 'webp':
                mimeType = 'image/webp';
                break;
              default:
                mimeType = 'image/jpeg';
            }
          }
          
          return {
            uri: asset.uri,
            type: mimeType,
            name: asset.fileName || `image_${Date.now()}.jpg`,
            id: (asset as any).id, // Pass through asset ID if available
            originalAsset: asset, // Keep reference to original asset
          };
        });
        
        setSelectedImages(prev => {
          const combined = [...prev, ...newImages];
          if (combined.length > 10) {
            Alert.alert('Too many images', 'Maximum 10 images are allowed');
            return prev;
          }
          return combined;
        });
        
        setSelectedVideo(null);
        setPostType('photo');
        
        // Add a small delay to ensure MediaLibrary is updated with the selected photo
        logger.debug('Waiting for MediaLibrary to update...');
        await new Promise(resolve => setTimeout(resolve, 500));
        
        logger.debug('Starting location extraction for new photo');
        logger.debug('Selection started at:', new Date(selectionStartTime));
        
        // Try to get location from photo EXIF data first
        const locationResult = await LocationExtractionService.extractFromPhotos(
          result.assets,
          selectionStartTime
        );
        
        if (locationResult) {
          setLocation({ lat: locationResult.lat, lng: locationResult.lng });
          if (locationResult.address) {
            setAddress(locationResult.address);
          }
          logger.debug('Location extraction result: Found');
        } else {
          logger.debug('Location extraction result: Not found, falling back to device location');
          await getLocation();
        }
      }
    } catch (error) {
      logger.error('Error picking images', error);
      Alert.alert('Error', 'Failed to pick images');
    }
  };

  const pickVideo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== ImagePicker.PermissionStatus.GRANTED) {
      Alert.alert('Permission needed', 'Please grant photo library permissions.');
      return;
    }
    
    // Reset location before picking new video
    setLocation(null);
    setAddress('');
    
    // Record the timestamp before opening the picker
    const selectionStartTime = Date.now();
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      aspect: [9, 16], // Vertical aspect ratio for shorts
      quality: 0.8,
      exif: true, // Preserve EXIF data including location
    });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        
        // Check video duration (max 60 minutes = 3600 seconds)
        const MAX_VIDEO_DURATION = 60 * 60; // 60 minutes in seconds
        if (asset.duration && asset.duration > MAX_VIDEO_DURATION) {
          Alert.alert(
            'Video Too Long',
            `Video duration exceeds the maximum limit of 60 minutes. Your video is ${Math.round(asset.duration / 60)} minutes. Please select a shorter video.`,
            [{ text: 'OK' }]
          );
          return;
        }
        
        clearUploadState();
        setSelectedVideo(asset.uri);
        setSelectedImages([]);
      setPostType('short');
        // Reset audio choice and show modal to ask user
        setAudioChoice(null);
        setSelectedSong(null);
        setShowAudioChoiceModal(true);
      // Generate initial thumbnail
      try {
          const { uri } = await VideoThumbnails.getThumbnailAsync(asset.uri, { time: 1000 });
        setVideoThumbnail(uri);
      } catch (e) {
        logger.warn('Thumbnail generation failed', e);
        setVideoThumbnail(null);
      }
      
      // Add a small delay to ensure MediaLibrary is updated with the selected video
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Try to get location from video metadata
      const locationResult = await LocationExtractionService.extractFromPhotos(
        result.assets,
        selectionStartTime
      );
      
      if (locationResult) {
        setLocation({ lat: locationResult.lat, lng: locationResult.lng });
        if (locationResult.address) {
          setAddress(locationResult.address);
        }
      } else {
        await getLocation();
      }
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== ImagePicker.PermissionStatus.GRANTED) {
      Alert.alert('Permission needed', 'Please grant camera permissions to take photos.');
      return;
    }
    
    // Reset location before taking new photo
    setLocation(null);
    setAddress('');
    
    // Record timestamp before capturing
    const captureStartTime = Date.now();
    
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        exif: true, // Preserve EXIF data including location
      });
      
      if (!result.canceled && result.assets?.[0]) {
        clearUploadState();
        
        const newImage = {
          uri: result.assets[0].uri,
          type: 'image/jpeg', // Camera photos are always JPEG
          name: result.assets[0].fileName || `photo_${Date.now()}.jpg`
        };
        
        setSelectedImages(prev => {
          const combined = [...prev, newImage];
          if (combined.length > 10) {
            Alert.alert('Too many images', 'Maximum 10 images are allowed');
            return prev;
          }
          return combined;
        });
        
        setSelectedVideo(null);
        setPostType('photo');
        
        // Add a small delay to ensure MediaLibrary is updated with the captured photo
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Try to get location from photo EXIF data first
        const locationResult = await LocationExtractionService.extractFromPhotos(
          result.assets,
          captureStartTime
        );
        
        if (locationResult) {
          setLocation({ lat: locationResult.lat, lng: locationResult.lng });
          if (locationResult.address) {
            setAddress(locationResult.address);
          }
        } else {
          await getLocation();
        }
      }
    } catch (error) {
      logger.error('Error taking photo', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const takeVideo = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== ImagePicker.PermissionStatus.GRANTED) {
      Alert.alert('Permission needed', 'Please grant camera permissions to take videos.');
      return;
    }
    
    // Reset location before taking new video
    setLocation(null);
    setAddress('');
    
    // Record timestamp before capturing
    const captureStartTime = Date.now();
    
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      aspect: [9, 16], // Vertical aspect ratio for shorts
      quality: 0.8,
      exif: true, // Preserve EXIF data including location
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      
      // Check video duration (max 60 minutes = 3600 seconds)
      const MAX_VIDEO_DURATION = 60 * 60; // 60 minutes in seconds
      if (asset.duration && asset.duration > MAX_VIDEO_DURATION) {
        Alert.alert(
          'Video Too Long',
          `Video duration exceeds the maximum limit of 60 minutes. Your video is ${Math.round(asset.duration / 60)} minutes. Please record a shorter video.`,
          [{ text: 'OK' }]
        );
        return;
      }
      
      setSelectedVideo(asset.uri);
        setSelectedImages([]);
      setPostType('short');
      try {
        const { uri } = await VideoThumbnails.getThumbnailAsync(asset.uri, { time: 1000 });
        setVideoThumbnail(uri);
      } catch (e) {
        logger.warn('Thumbnail generation failed', e);
        setVideoThumbnail(null);
      }
      
      // Add a small delay to ensure MediaLibrary is updated with the captured video
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Try to get location from video metadata
      const locationResult = await LocationExtractionService.extractFromPhotos(
        result.assets,
        captureStartTime
      );
      
      if (locationResult) {
        setLocation({ lat: locationResult.lat, lng: locationResult.lng });
        if (locationResult.address) {
          setAddress(locationResult.address);
        }
      } else {
        await getLocation();
      }
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
      logger.error("Error getting location", error);
    }
  };

  const handlePost = async (values: PostFormValues) => {
    if (selectedImages.length === 0) {
      Alert.alert("Error", "Please select at least one image first.");
      return;
    }
    if (!user) {
      Alert.alert("Error", "You must be signed in to post.");
      return;
    }
    
    setIsLoading(true);
    setIsUploading(true);
    setUploadProgress({ current: 0, total: selectedImages.length, percentage: 0 });
    setUploadError(null);
    
    try {
      logger.debug('Creating post with images:', selectedImages);
      
      // Optimize images before upload for better performance and quality
      setIsUploading(true);
      setUploadProgress({ current: 0, total: selectedImages.length, percentage: 0 });
      
      const imagesData = await Promise.all(
        selectedImages.map(async (img, index) => {
          try {
            // Check if image needs optimization
            const needsOptimization = await shouldOptimizeImage(img.uri);
            if (needsOptimization) {
              // Optimize image
              const fileInfo = await FileSystem.getInfoAsync(img.uri);
              const fileSize = (fileInfo.exists && (fileInfo as any).size) || 0;
              const optimized = await optimizeImageForUpload(img.uri, {
                maxWidth: 1200,
                maxHeight: 1200,
                quality: getOptimalQuality(fileSize),
                format: 'jpeg'
              });
              
              // Update progress
              setUploadProgress({
                current: index + 1,
                total: selectedImages.length,
                percentage: ((index + 1) / selectedImages.length) * 50 // First 50% is optimization
              });
              
              return {
                uri: optimized.uri,
                type: 'image/jpeg',
                name: img.name || 'image.jpg'
              };
            }
            
            // Update progress even if no optimization needed
            setUploadProgress({
              current: index + 1,
              total: selectedImages.length,
              percentage: ((index + 1) / selectedImages.length) * 50
            });
            
            return {
              uri: img.uri,
              type: img.type,
              name: img.name
            };
          } catch (error) {
            logger.error('Error optimizing image', error);
            // Fallback to original image if optimization fails
            return {
              uri: img.uri,
              type: img.type,
              name: img.name
            };
          }
        })
      );

      // Upload with progress tracking for multiple images
      // Progress is now 50% optimization + 50% upload
      const totalImages = imagesData.length;
      let uploadedCount = 0;

      const response = await createPostWithProgress({
        images: imagesData,
        caption: values.comment,
        address: values.placeName || address,
        latitude: location?.lat,
        longitude: location?.lng,
        songId: selectedSong?._id,
        songStartTime: songStartTime,
        songEndTime: songEndTime,
        songVolume: 0.5,
      }, (progress) => {
        // Calculate overall progress: 50% optimization (already done) + 50% upload
        const uploadProgressPercent = progress / 100; // 0 to 1
        const overallProgress = 50 + (uploadProgressPercent * 50); // 50% to 100%
        setUploadProgress({
          current: uploadedCount + 1,
          total: totalImages,
          percentage: Math.min(overallProgress, 100)
        });
        
        // If this image is complete, move to next
        if (progress >= 100) {
          uploadedCount++;
        }
      });

      logger.debug('Post created successfully:', response);
      
      // Set final progress
      setUploadProgress({
        current: totalImages,
        total: totalImages,
        percentage: 100
      });
      
      // Wait a moment to show 100% progress
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress({ current: 0, total: 0, percentage: 0 });
        Alert.alert('Success!', 'Your post has been shared.', [
          {
            text: 'OK',
            onPress: () => {
              setSelectedImages([]);
              setLocation(null);
              setAddress('');
              setSelectedSong(null);
              // Update existing posts state
              setHasExistingPosts(true);
              router.replace('/(tabs)/home');
            },
          },
        ]);
      }, 500);
      
    } catch (error: any) {
      logger.error('Post creation failed', error);
      setUploadError(error?.message || 'Upload failed. Please try again.');
      setIsUploading(false);
      setUploadProgress({ current: 0, total: 0, percentage: 0 });
      Alert.alert('Upload failed', error?.message || 'Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleShort = async (values: ShortFormValues) => {
    logger.debug('handleShort called with values:', values);
    logger.debug('selectedVideo:', selectedVideo);
    logger.debug('user:', user);
    
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
    setUploadProgress({ current: 0, total: 0, percentage: 0 });
    setUploadError(null);
    
    try {
      logger.debug('Creating short with video:', selectedVideo);
      
      // Extract filename from URI
      const filename = selectedVideo.split('/').pop() || 'short_video.mp4';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `video/${match[1]}` : 'video/mp4';

      logger.debug('Sending data to createShort:', {
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
        image: videoThumbnail ? {
          uri: videoThumbnail,
          type: 'image/jpeg',
          name: 'thumbnail.jpg',
        } : undefined,
        caption: values.caption,
        // Only send song data if user chose background music
        songId: audioChoice === 'background' && selectedSong ? selectedSong._id : undefined,
        songStartTime: audioChoice === 'background' && selectedSong ? songStartTime : undefined,
        songEndTime: audioChoice === 'background' && selectedSong ? songEndTime : undefined,
        songVolume: audioChoice === 'background' && selectedSong ? 0.5 : undefined,
        tags: values.tags.split(',').map(tag => tag.trim()).filter(tag => tag),
        address: values.placeName || address,
        latitude: location?.lat,
        longitude: location?.lng,
      });

      logger.debug('Short created successfully:', response);
      
      Alert.alert('Success!', 'Your short has been uploaded.', [
        {
          text: 'OK',
          onPress: () => {
            setSelectedVideo(null);
            setLocation(null);
            setSelectedSong(null);
            setAudioChoice(null);
            // Update existing shorts state
            setHasExistingShorts(true);
            setAddress('');
            setIsUploading(false);
            setUploadProgress({ current: 0, total: 0, percentage: 0 });
            router.replace('/(tabs)/home');
          },
        },
      ]);
    } catch (error: any) {
      logger.error('Short creation failed', error);
      setUploadError(error?.message || 'Upload failed. Please try again.');
      Alert.alert('Upload failed', error?.message || 'Please try again later.');
    } finally {
      setIsLoading(false);
      setIsUploading(false);
      setUploadProgress({ current: 0, total: 0, percentage: 0 });
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <NavBar title="New Post" />
      <ScrollView 
        style={{ flex: 1, padding: theme.spacing.md }} 
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        nestedScrollEnabled={true}
      >
        {/* User Profile Section */}
        {user && (
          <View style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            backgroundColor: theme.colors.surface, 
            borderRadius: theme.borderRadius.xl, 
            padding: theme.spacing.md, 
            marginBottom: theme.spacing.md,
            ...theme.shadows.medium,
            borderWidth: 1,
            borderColor: theme.colors.border + '40'
          }}>
            <View style={{
              width: 48, 
              height: 48, 
              borderRadius: 24, 
              marginRight: theme.spacing.md,
              borderWidth: 2.5,
              borderColor: theme.colors.primary + '30',
              padding: 2,
              backgroundColor: theme.colors.background
          }}>
            <Image
              source={user.profilePic ? { uri: user.profilePic } : require('../../assets/avatars/male_avatar.png')}
              style={{ 
                  width: '100%', 
                  height: '100%', 
                borderRadius: 20, 
              }}
            />
            </View>
            <View style={{ flex: 1 }}>
            <Text style={{ 
                fontSize: theme.typography.h3.fontSize, 
                fontWeight: '700', 
                color: theme.colors.text,
                marginBottom: 2
            }}>
              {user.fullName}
            </Text>
              <Text style={{ 
                fontSize: theme.typography.small.fontSize, 
                color: theme.colors.textSecondary 
              }}>
                Creating new {postType === 'photo' ? 'photo' : 'short'}
              </Text>
            </View>
          </View>
        )}
        {/* Post Type Selector */}
        <View style={{ 
          flexDirection: 'row', 
          backgroundColor: theme.colors.surface, 
          borderRadius: theme.borderRadius.xl, 
          padding: 6, 
          marginBottom: theme.spacing.md,
          ...theme.shadows.small,
          borderWidth: 1,
          borderColor: theme.colors.border + '40'
        }}>
          <TouchableOpacity 
            style={[
              { 
                flex: 1, 
                paddingVertical: theme.spacing.md, 
                alignItems: 'center', 
                justifyContent: 'center',
                borderRadius: theme.borderRadius.lg,
                flexDirection: 'row',
                gap: 8
              },
              postType === 'photo' && { 
                backgroundColor: theme.colors.primary,
                ...theme.shadows.small
              }
            ]}
            onPress={() => setPostType('photo')}
            activeOpacity={0.7}
          >
            <Ionicons 
              name={postType === 'photo' ? "image" : "image-outline"} 
              size={20} 
              color={postType === 'photo' ? 'white' : theme.colors.textSecondary} 
            />
            <Text style={[
              { fontSize: theme.typography.body.fontSize, fontWeight: '700' },
              postType === 'photo' ? { color: 'white' } : { color: theme.colors.textSecondary }
            ]}>
              Photo
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[
              { 
                flex: 1, 
                paddingVertical: theme.spacing.md, 
                alignItems: 'center', 
                justifyContent: 'center',
                borderRadius: theme.borderRadius.lg,
                flexDirection: 'row',
                gap: 8
              },
              postType === 'short' && { 
                backgroundColor: theme.colors.primary,
                ...theme.shadows.small
              }
            ]}
            onPress={() => setPostType('short')}
            activeOpacity={0.7}
          >
            <Ionicons 
              name={postType === 'short' ? "videocam" : "videocam-outline"} 
              size={20} 
              color={postType === 'short' ? 'white' : theme.colors.textSecondary} 
            />
            <Text style={[
              { fontSize: theme.typography.body.fontSize, fontWeight: '700' },
              postType === 'short' ? { color: 'white' } : { color: theme.colors.textSecondary }
            ]}>
              Short
            </Text>
          </TouchableOpacity>
        </View>

        {!selectedImages.length && !selectedVideo ? (
          <>
            <View style={{ 
              alignItems: 'center', 
              marginTop: theme.spacing.xl, 
              marginBottom: theme.spacing.xl,
              paddingVertical: theme.spacing.xl
            }}>
              <View style={{
                width: 120,
                height: 120,
                borderRadius: 60,
                backgroundColor: theme.colors.primary + '15',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: theme.spacing.lg
              }}>
              <Ionicons 
                  name={postType === 'photo' ? "image" : "videocam"} 
                  size={64} 
                  color={theme.colors.primary} 
              />
              </View>
              <Text style={{ 
                color: theme.colors.text, 
                fontSize: theme.typography.h2.fontSize, 
                fontWeight: '800', 
                marginBottom: theme.spacing.sm, 
                textAlign: 'center' 
              }}>
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
              <Text style={{ 
                color: theme.colors.textSecondary, 
                fontSize: theme.typography.body.fontSize, 
                textAlign: 'center', 
                marginBottom: theme.spacing.xl,
                paddingHorizontal: theme.spacing.lg,
                lineHeight: 22
              }}>
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
            <View style={{ 
              flexDirection: "row", 
              justifyContent: "space-between", 
              marginVertical: theme.spacing.lg,
              gap: theme.spacing.md
            }}>
              <TouchableOpacity 
                style={{ 
                  flex: 1,
                  alignItems: "center", 
                  justifyContent: "center",
                  backgroundColor: theme.colors.surface, 
                  borderRadius: theme.borderRadius.xl, 
                  padding: theme.spacing.xl, 
                  ...theme.shadows.medium,
                  borderWidth: 1,
                  borderColor: theme.colors.border + '40'
                }} 
                onPress={postType === 'photo' ? pickImages : pickVideo}
                activeOpacity={0.8}
              >
                <View style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: theme.colors.primary + '15',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: theme.spacing.md
                }}>
                  <Ionicons name={postType === 'photo' ? "images" : "film"} size={32} color={theme.colors.primary} />
                </View>
                <Text style={{ 
                  color: theme.colors.text, 
                  fontSize: theme.typography.body.fontSize, 
                  fontWeight: '700',
                  textAlign: "center" 
                }}>
                  Choose from Library
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={{ 
                  flex: 1,
                  alignItems: "center", 
                  justifyContent: "center",
                  backgroundColor: theme.colors.surface, 
                  borderRadius: theme.borderRadius.xl, 
                  padding: theme.spacing.xl, 
                  ...theme.shadows.medium,
                  borderWidth: 1,
                  borderColor: theme.colors.border + '40'
                }} 
                onPress={postType === 'photo' ? takePhoto : takeVideo}
                activeOpacity={0.8}
              >
                <View style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: theme.colors.primary + '15',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: theme.spacing.md
                }}>
                  <Ionicons name={postType === 'photo' ? "camera" : "videocam"} size={32} color={theme.colors.primary} />
                </View>
                <Text style={{ 
                  color: theme.colors.text, 
                  fontSize: theme.typography.body.fontSize, 
                  fontWeight: '700',
                  textAlign: "center" 
                }}>
                  Take {postType === 'photo' ? 'Photo' : 'Video'}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={{ 
            position: "relative", 
            marginVertical: theme.spacing.md,
            borderRadius: theme.borderRadius.xl,
            overflow: 'hidden',
            ...theme.shadows.large
          }}>
            {selectedImages.length > 0 ? (
              <View>
                {/* Image carousel */}
                <ScrollView 
                  horizontal 
                  pagingEnabled 
                  showsHorizontalScrollIndicator={false}
                  style={{ borderRadius: theme.borderRadius.xl }}
                >
                  {selectedImages.map((image, index) => (
                    <View key={index} style={{ width: 350, height: 350 }}>
                      <Image 
                        source={{ uri: image.uri }} 
                        style={{ width: "100%", height: "100%", resizeMode: "cover" }} 
                      />
                    </View>
                  ))}
                </ScrollView>
                
                {/* Image counter */}
                {selectedImages.length > 1 && (
                  <View style={{ 
                    position: 'absolute', 
                    top: theme.spacing.md, 
                    left: theme.spacing.md, 
                    backgroundColor: 'rgba(0,0,0,0.75)', 
                    paddingHorizontal: theme.spacing.md, 
                    paddingVertical: theme.spacing.sm, 
                    borderRadius: theme.borderRadius.full,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6
                  }}>
                    <Ionicons name="images" size={16} color="white" />
                    <Text style={{ color: 'white', fontSize: theme.typography.body.fontSize, fontWeight: '700' }}>
                      {selectedImages.length} photos
                    </Text>
                  </View>
                )}
                
                {/* Add more photos button */}
                {selectedImages.length < 10 && (
                  <TouchableOpacity
                    onPress={pickImages}
                    activeOpacity={0.8}
                    style={{ 
                      position: 'absolute', 
                      bottom: theme.spacing.md, 
                      right: theme.spacing.md, 
                      backgroundColor: theme.colors.primary, 
                      paddingHorizontal: theme.spacing.lg, 
                      paddingVertical: theme.spacing.md, 
                      borderRadius: theme.borderRadius.full,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      ...theme.shadows.medium
                    }}
                  >
                    <Ionicons name="add" size={20} color="white" />
                    <Text style={{ color: 'white', fontWeight: '700', fontSize: theme.typography.body.fontSize }}>Add More</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : selectedVideo ? (
              <View>
                {/* Video preview */}
                <View style={{ width: "100%", height: 300, borderRadius: theme.borderRadius.lg, overflow: 'hidden', backgroundColor: theme.colors.surface }}>
                  <Video
                    source={{ uri: selectedVideo }}
                    style={{ width: '100%', height: '100%' }}
                    useNativeControls
                    resizeMode={ResizeMode.CONTAIN}
                  />
                </View>
                {/* Thumbnail preview below */}
                <View style={{ marginTop: theme.spacing.sm }}>
                  {videoThumbnail ? (
                    <Image source={{ uri: videoThumbnail }} style={{ width: "100%", height: 160, borderRadius: theme.borderRadius.lg, resizeMode: "cover" }} />
                  ) : (
                    <View style={{ width: "100%", height: 160, borderRadius: theme.borderRadius.lg, backgroundColor: theme.colors.surface, justifyContent: 'center', alignItems: 'center' }}>
                      <Ionicons name="image-outline" size={48} color={theme.colors.primary} />
                      <Text style={{ color: theme.colors.text, marginTop: theme.spacing.xs }}>Generating thumbnail...</Text>
                    </View>
                  )}
                  {/* Change/Regenerate thumbnail button */}
                  <TouchableOpacity
                    onPress={async () => {
                      const libPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
                      if (libPerm.status !== ImagePicker.PermissionStatus.GRANTED) {
                        Alert.alert('Permission needed', 'Please grant photo library permissions.');
                        return;
                      }
                      const pick = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [9, 16], quality: 0.9 });
                      if (!pick.canceled && pick.assets?.[0]) {
                        setVideoThumbnail(pick.assets[0].uri);
                      }
                    }}
                    style={{ position: 'absolute', right: theme.spacing.sm, bottom: theme.spacing.sm, backgroundColor: theme.colors.background, paddingHorizontal: theme.spacing.md, paddingVertical: 8, borderRadius: theme.borderRadius.md, opacity: 0.9 }}
                  >
                    <Text style={{ color: theme.colors.text, fontWeight: '600' }}>Change Thumbnail</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}
            <TouchableOpacity 
              style={{ 
                position: "absolute", 
                top: theme.spacing.md, 
                right: theme.spacing.md, 
                backgroundColor: 'rgba(0,0,0,0.6)', 
                borderRadius: 20,
                width: 40,
                height: 40,
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 10
              }} 
              onPress={() => { 
              setSelectedImages([]); 
              setSelectedVideo(null);
              setVideoThumbnail(null);
              setLocation(null); 
              setAddress(""); 
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
          </View>
        )}
        {(selectedImages.length > 0 || selectedVideo) && (
          <View style={{ 
            backgroundColor: theme.colors.surface, 
            borderRadius: theme.borderRadius.xl, 
            padding: theme.spacing.lg, 
            marginTop: theme.spacing.md, 
            ...theme.shadows.medium,
            borderWidth: 1,
            borderColor: theme.colors.border + '40'
          }}>
            {postType === 'photo' ? (
              <Formik
                initialValues={{ comment: "", placeName: "", tags: "" }}
                validationSchema={postSchema}
                onSubmit={handlePost}
              >
                {({ handleChange, handleBlur, handleSubmit, values, errors, touched, setFieldValue, setFieldTouched }) => {
                  const [commentCursorPosition, setCommentCursorPosition] = useState<number | undefined>();
                  const commentInputRef = useRef<TextInput>(null);

                  const handleHashtagSelect = (hashtag: string) => {
                    const currentText = values.comment;
                    const cursorPos = commentCursorPosition || currentText.length;
                    const textBeforeCursor = currentText.substring(0, cursorPos);
                    const lastHashIndex = textBeforeCursor.lastIndexOf('#');
                    
                    if (lastHashIndex !== -1) {
                      // Find where the hashtag text ends (space, newline, or cursor position)
                      const textAfterHash = textBeforeCursor.substring(lastHashIndex + 1);
                      const match = textAfterHash.match(/^([\w\u{1F300}-\u{1F9FF}]*)/u);
                      const hashtagTextLength = match ? match[1].length : 0;
                      
                      // Calculate the end position of the hashtag being replaced
                      const hashtagEndPos = lastHashIndex + 1 + hashtagTextLength;
                      
                      // Replace the hashtag being typed with the selected one
                      const beforeHashtag = currentText.substring(0, lastHashIndex + 1);
                      const afterHashtag = currentText.substring(hashtagEndPos);
                      const newText = `${beforeHashtag}${hashtag} ${afterHashtag}`;
                      
                      setFieldValue('comment', newText);
                      // Set cursor position after the inserted hashtag
                      setTimeout(() => {
                        const newCursorPos = lastHashIndex + 1 + hashtag.length + 1;
                        setCommentCursorPosition(newCursorPos);
                        commentInputRef.current?.setNativeProps({ selection: { start: newCursorPos, end: newCursorPos } });
                      }, 50);
                    }
                  };

                  const handleMentionSelect = (username: string) => {
                    const currentText = values.comment;
                    const cursorPos = commentCursorPosition || currentText.length;
                    const textBeforeCursor = currentText.substring(0, cursorPos);
                    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
                    
                    if (lastAtIndex !== -1) {
                      // Find where the mention text ends (space, newline, or cursor position)
                      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
                      const match = textAfterAt.match(/^([\w]*)/);
                      const mentionTextLength = match ? match[1].length : 0;
                      
                      // Calculate the end position of the mention being replaced
                      const mentionEndPos = lastAtIndex + 1 + mentionTextLength;
                      
                      // Replace the mention being typed with the selected one
                      const beforeMention = currentText.substring(0, lastAtIndex + 1);
                      const afterMention = currentText.substring(mentionEndPos);
                      const newText = `${beforeMention}${username} ${afterMention}`;
                      
                      setFieldValue('comment', newText);
                      // Set cursor position after the inserted mention
                      setTimeout(() => {
                        const newCursorPos = lastAtIndex + 1 + username.length + 1;
                        setCommentCursorPosition(newCursorPos);
                        commentInputRef.current?.setNativeProps({ selection: { start: newCursorPos, end: newCursorPos } });
                      }, 50);
                    }
                  };

                  return (
                    <View>
                      <View style={{ marginBottom: theme.spacing.lg }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.sm }}>
                          <Ionicons name="chatbubble-outline" size={18} color={theme.colors.primary} style={{ marginRight: theme.spacing.xs }} />
                          <Text style={{ fontSize: theme.typography.h3.fontSize, fontWeight: "700", color: theme.colors.text }}>Comment</Text>
                        </View>
                        <View style={{ position: 'relative' }}>
                          <TextInput
                            ref={commentInputRef}
                            style={{ 
                              backgroundColor: theme.colors.surfaceSecondary, 
                              borderRadius: theme.borderRadius.lg, 
                              paddingHorizontal: theme.spacing.md, 
                              paddingVertical: theme.spacing.md, 
                              fontSize: theme.typography.body.fontSize, 
                              color: theme.colors.text, 
                              borderWidth: 1.5, 
                              borderColor: errors.comment && touched.comment ? theme.colors.error : theme.colors.border,
                              minHeight: 100,
                              textAlignVertical: 'top'
                            }}
                            placeholder="What's happening? Use @ to mention someone or # for hashtags"
                            placeholderTextColor={theme.colors.textSecondary}
                            value={values.comment}
                            onChangeText={(text) => {
                              handleChange("comment")(text);
                              // Clear error when user starts typing
                              if (errors.comment && touched.comment) {
                                setFieldTouched("comment", false);
                              }
                            }}
                            onSelectionChange={(e) => {
                              setCommentCursorPosition(e.nativeEvent.selection.start);
                            }}
                            onBlur={handleBlur("comment")}
                            multiline
                            numberOfLines={4}
                          />
                          <View style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000, marginTop: 4 }}>
                            <HashtagSuggest
                              text={values.comment}
                              cursorPosition={commentCursorPosition}
                              onSelectHashtag={handleHashtagSelect}
                              visible={true}
                            />
                            <MentionSuggest
                              text={values.comment}
                              cursorPosition={commentCursorPosition}
                              onSelectMention={handleMentionSelect}
                              visible={true}
                            />
                          </View>
                        </View>
                        {errors.comment && touched.comment && (
                          <View style={{ 
                            flexDirection: 'row', 
                            alignItems: 'center', 
                            marginTop: theme.spacing.xs,
                            paddingHorizontal: theme.spacing.xs
                          }}>
                            <Ionicons 
                              name="alert-circle" 
                              size={16} 
                              color={theme.colors.error} 
                              style={{ marginRight: theme.spacing.xs }}
                            />
                            <Text style={{ 
                              color: theme.colors.error, 
                              fontSize: theme.typography.small.fontSize,
                              flex: 1
                            }}>
                              {errors.comment === 'required' 
                                ? 'Caption is required' 
                                : errors.comment}
                            </Text>
                          </View>
                        )}
                      </View>
                    <View style={{ marginBottom: theme.spacing.lg }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.sm }}>
                        <Ionicons name="location-outline" size={18} color={theme.colors.primary} style={{ marginRight: theme.spacing.xs }} />
                        <Text style={{ fontSize: theme.typography.h3.fontSize, fontWeight: "700", color: theme.colors.text }}>Place Name</Text>
                        <Text style={{ fontSize: theme.typography.small.fontSize, color: theme.colors.textSecondary, marginLeft: theme.spacing.xs }}>(Optional)</Text>
                      </View>
                      <TextInput
                        style={{ 
                          backgroundColor: theme.colors.surfaceSecondary, 
                          borderRadius: theme.borderRadius.lg, 
                          paddingHorizontal: theme.spacing.md, 
                          paddingVertical: theme.spacing.md, 
                          fontSize: theme.typography.body.fontSize, 
                          color: theme.colors.text, 
                          borderWidth: 1.5, 
                          borderColor: theme.colors.border
                        }}
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
                      <View style={{ 
                        marginBottom: theme.spacing.lg, 
                        padding: theme.spacing.md, 
                        backgroundColor: theme.colors.error + '15', 
                        borderRadius: theme.borderRadius.lg,
                        borderWidth: 1,
                        borderColor: theme.colors.error + '30',
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: theme.spacing.sm
                      }}>
                        <Ionicons name="alert-circle" size={20} color={theme.colors.error} />
                        <Text style={{ color: theme.colors.error, fontSize: theme.typography.body.fontSize, flex: 1, fontWeight: '500' }}>{uploadError}</Text>
                      </View>
                    )}
                    <TouchableOpacity
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: theme.colors.surfaceSecondary,
                        borderRadius: theme.borderRadius.md,
                        paddingVertical: theme.spacing.md,
                        paddingHorizontal: theme.spacing.md,
                        marginTop: theme.spacing.md,
                        borderWidth: 1,
                        borderColor: selectedSong ? theme.colors.primary : theme.colors.border,
                      }}
                      onPress={() => setShowSongSelector(true)}
                    >
                      <Ionicons 
                        name={selectedSong ? "musical-notes" : "musical-notes-outline"} 
                        size={20} 
                        color={selectedSong ? theme.colors.primary : theme.colors.textSecondary} 
                        style={{ marginRight: theme.spacing.xs }}
                      />
                      <Text style={{ 
                        color: selectedSong ? theme.colors.primary : theme.colors.textSecondary, 
                        fontSize: theme.typography.body.fontSize,
                        fontWeight: selectedSong ? '600' : '400'
                      }}>
                        {selectedSong ? `${selectedSong.title} - ${selectedSong.artist}` : 'Add Music'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        { 
                          backgroundColor: theme.colors.primary, 
                          borderRadius: theme.borderRadius.lg, 
                          paddingVertical: theme.spacing.lg, 
                          alignItems: "center", 
                          justifyContent: 'center',
                          marginTop: theme.spacing.md,
                          flexDirection: 'row',
                          gap: theme.spacing.sm,
                          ...theme.shadows.large
                        },
                        isLoading && { opacity: 0.7 },
                      ]}
                      onPress={() => handleSubmit()}
                      disabled={isLoading}
                      activeOpacity={0.8}
                    >
                      {isLoading ? (
                        <>
                          <ActivityIndicator color="white" size="small" />
                          <Text style={{ color: 'white', fontSize: theme.typography.body.fontSize, fontWeight: "700", marginLeft: theme.spacing.sm }}>Sharing...</Text>
                        </>
                      ) : (
                        <>
                          <Ionicons name="send" size={20} color="white" />
                          <Text style={{ color: 'white', fontSize: theme.typography.body.fontSize, fontWeight: "700" }}>Share Post</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                  );
                }}
              </Formik>
            ) : (
              <Formik
                initialValues={{ caption: "", tags: "", placeName: "" }}
                validationSchema={shortSchema}
                onSubmit={handleShort}
              >
                {({ handleChange, handleBlur, handleSubmit, values, errors, touched, setFieldValue, setFieldTouched }) => {
                  const [captionCursorPosition, setCaptionCursorPosition] = useState<number | undefined>();
                  const captionInputRef = useRef<TextInput>(null);

                  const handleHashtagSelect = (hashtag: string) => {
                    const currentText = values.caption;
                    const cursorPos = captionCursorPosition || currentText.length;
                    const textBeforeCursor = currentText.substring(0, cursorPos);
                    const lastHashIndex = textBeforeCursor.lastIndexOf('#');
                    
                    if (lastHashIndex !== -1) {
                      // Find where the hashtag text ends (space, newline, or cursor position)
                      const textAfterHash = textBeforeCursor.substring(lastHashIndex + 1);
                      const match = textAfterHash.match(/^([\w\u{1F300}-\u{1F9FF}]*)/u);
                      const hashtagTextLength = match ? match[1].length : 0;
                      
                      // Calculate the end position of the hashtag being replaced
                      const hashtagEndPos = lastHashIndex + 1 + hashtagTextLength;
                      
                      // Replace the hashtag being typed with the selected one
                      const beforeHashtag = currentText.substring(0, lastHashIndex + 1);
                      const afterHashtag = currentText.substring(hashtagEndPos);
                      const newText = `${beforeHashtag}${hashtag} ${afterHashtag}`;
                      
                      setFieldValue('caption', newText);
                      // Set cursor position after the inserted hashtag
                      setTimeout(() => {
                        const newCursorPos = lastHashIndex + 1 + hashtag.length + 1;
                        setCaptionCursorPosition(newCursorPos);
                        captionInputRef.current?.setNativeProps({ selection: { start: newCursorPos, end: newCursorPos } });
                      }, 50);
                    }
                  };

                  const handleMentionSelect = (username: string) => {
                    const currentText = values.caption;
                    const cursorPos = captionCursorPosition || currentText.length;
                    const textBeforeCursor = currentText.substring(0, cursorPos);
                    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
                    
                    if (lastAtIndex !== -1) {
                      // Find where the mention text ends (space, newline, or cursor position)
                      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
                      const match = textAfterAt.match(/^([\w]*)/);
                      const mentionTextLength = match ? match[1].length : 0;
                      
                      // Calculate the end position of the mention being replaced
                      const mentionEndPos = lastAtIndex + 1 + mentionTextLength;
                      
                      // Replace the mention being typed with the selected one
                      const beforeMention = currentText.substring(0, lastAtIndex + 1);
                      const afterMention = currentText.substring(mentionEndPos);
                      const newText = `${beforeMention}${username} ${afterMention}`;
                      
                      setFieldValue('caption', newText);
                      // Set cursor position after the inserted mention
                      setTimeout(() => {
                        const newCursorPos = lastAtIndex + 1 + username.length + 1;
                        setCaptionCursorPosition(newCursorPos);
                        captionInputRef.current?.setNativeProps({ selection: { start: newCursorPos, end: newCursorPos } });
                      }, 50);
                    }
                  };

                  return (
                    <View>
                      <View style={{ marginBottom: theme.spacing.lg }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.sm }}>
                          <Ionicons name="chatbubble-outline" size={18} color={theme.colors.primary} style={{ marginRight: theme.spacing.xs }} />
                          <Text style={{ fontSize: theme.typography.h3.fontSize, fontWeight: "700", color: theme.colors.text }}>Caption</Text>
                        </View>
                        <View style={{ position: 'relative' }}>
                          <TextInput
                            ref={captionInputRef}
                            style={[
                              { 
                                backgroundColor: theme.colors.surfaceSecondary, 
                                borderRadius: theme.borderRadius.lg, 
                                paddingHorizontal: theme.spacing.md, 
                                paddingVertical: theme.spacing.md, 
                                fontSize: theme.typography.body.fontSize, 
                                color: theme.colors.text, 
                                borderWidth: 1.5, 
                                borderColor: errors.caption && touched.caption 
                                  ? theme.colors.error 
                                  : theme.colors.border,
                                minHeight: 100,
                                textAlignVertical: 'top'
                              }
                            ]}
                            placeholder="Add a caption... Use @ to mention someone or # for hashtags"
                            placeholderTextColor={theme.colors.textSecondary}
                            value={values.caption}
                            onChangeText={(text) => {
                              handleChange("caption")(text);
                              // Clear error when user starts typing
                              if (errors.caption && touched.caption) {
                                setFieldTouched("caption", false);
                              }
                            }}
                            onSelectionChange={(e) => {
                              setCaptionCursorPosition(e.nativeEvent.selection.start);
                            }}
                            onBlur={handleBlur("caption")}
                            multiline
                            numberOfLines={3}
                          />
                          <View style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000, marginTop: 4 }}>
                            <HashtagSuggest
                              text={values.caption}
                              cursorPosition={captionCursorPosition}
                              onSelectHashtag={handleHashtagSelect}
                              visible={true}
                            />
                            <MentionSuggest
                              text={values.caption}
                              cursorPosition={captionCursorPosition}
                              onSelectMention={handleMentionSelect}
                              visible={true}
                            />
                          </View>
                        </View>
                        {errors.caption && touched.caption && (
                          <View style={{ 
                            flexDirection: 'row', 
                            alignItems: 'center', 
                            marginTop: theme.spacing.xs,
                            paddingHorizontal: theme.spacing.xs
                          }}>
                            <Ionicons 
                              name="alert-circle" 
                              size={16} 
                              color={theme.colors.error} 
                              style={{ marginRight: theme.spacing.xs }}
                            />
                            <Text style={{ 
                              color: theme.colors.error, 
                              fontSize: theme.typography.small.fontSize,
                              flex: 1
                            }}>
                              {errors.caption === 'required' 
                                ? 'Caption is required' 
                                : errors.caption}
                            </Text>
                          </View>
                        )}
                      </View>
                    <View style={{ marginBottom: theme.spacing.lg }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.sm }}>
                        <Ionicons name="pricetag-outline" size={18} color={theme.colors.primary} style={{ marginRight: theme.spacing.xs }} />
                        <Text style={{ fontSize: theme.typography.h3.fontSize, fontWeight: "700", color: theme.colors.text }}>Tags</Text>
                        <Text style={{ fontSize: theme.typography.small.fontSize, color: theme.colors.textSecondary, marginLeft: theme.spacing.xs }}>(Optional)</Text>
                      </View>
                      <TextInput
                        style={{ 
                          backgroundColor: theme.colors.surfaceSecondary, 
                          borderRadius: theme.borderRadius.lg, 
                          paddingHorizontal: theme.spacing.md, 
                          paddingVertical: theme.spacing.md, 
                          fontSize: theme.typography.body.fontSize, 
                          color: theme.colors.text, 
                          borderWidth: 1.5, 
                          borderColor: theme.colors.border
                        }}
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
                    <View style={{ marginBottom: theme.spacing.lg }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.sm }}>
                        <Ionicons name="location-outline" size={18} color={theme.colors.primary} style={{ marginRight: theme.spacing.xs }} />
                        <Text style={{ fontSize: theme.typography.h3.fontSize, fontWeight: "700", color: theme.colors.text }}>Location</Text>
                        <Text style={{ fontSize: theme.typography.small.fontSize, color: theme.colors.textSecondary, marginLeft: theme.spacing.xs }}>(Optional)</Text>
                      </View>
                      <TextInput
                        style={{ 
                          backgroundColor: theme.colors.surfaceSecondary, 
                          borderRadius: theme.borderRadius.lg, 
                          paddingHorizontal: theme.spacing.md, 
                          paddingVertical: theme.spacing.md, 
                          fontSize: theme.typography.body.fontSize, 
                          color: theme.colors.text, 
                          borderWidth: 1.5, 
                          borderColor: theme.colors.border
                        }}
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
                      <View style={{ 
                        flexDirection: "row", 
                        alignItems: "center", 
                        backgroundColor: theme.colors.primary + '10', 
                        borderRadius: theme.borderRadius.lg, 
                        padding: theme.spacing.md, 
                        marginBottom: theme.spacing.lg,
                        borderWidth: 1,
                        borderColor: theme.colors.primary + '30'
                      }}>
                        <View style={{
                          width: 32,
                          height: 32,
                          borderRadius: 16,
                          backgroundColor: theme.colors.primary + '20',
                          justifyContent: 'center',
                          alignItems: 'center',
                          marginRight: theme.spacing.sm
                        }}>
                          <Ionicons name="location" size={18} color={theme.colors.primary} />
                        </View>
                        <Text style={{ color: theme.colors.text, fontSize: theme.typography.body.fontSize, flex: 1, fontWeight: '500' }}>{address}</Text>
                      </View>
                    )}
                    {uploadError && (
                      <View style={{ 
                        marginBottom: theme.spacing.lg, 
                        padding: theme.spacing.md, 
                        backgroundColor: theme.colors.error + '15', 
                        borderRadius: theme.borderRadius.lg,
                        borderWidth: 1,
                        borderColor: theme.colors.error + '30',
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: theme.spacing.sm
                      }}>
                        <Ionicons name="alert-circle" size={20} color={theme.colors.error} />
                        <Text style={{ color: theme.colors.error, fontSize: theme.typography.body.fontSize, flex: 1, fontWeight: '500' }}>{uploadError}</Text>
                      </View>
                    )}
                    <TouchableOpacity
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: audioChoice === 'background' && selectedSong ? theme.colors.primary + '15' : theme.colors.surfaceSecondary,
                        borderRadius: theme.borderRadius.lg,
                        paddingVertical: theme.spacing.md,
                        paddingHorizontal: theme.spacing.md,
                        marginTop: theme.spacing.md,
                        marginBottom: theme.spacing.md,
                        borderWidth: 2,
                        borderColor: audioChoice === 'background' && selectedSong ? theme.colors.primary : theme.colors.border,
                      }}
                      onPress={() => setShowSongSelector(true)}
                      activeOpacity={0.7}
                    >
                      <View style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: audioChoice === 'background' && selectedSong ? theme.colors.primary : theme.colors.border + '40',
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginRight: theme.spacing.sm
                      }}>
                        <Ionicons 
                          name={audioChoice === 'background' && selectedSong ? "musical-notes" : "musical-notes-outline"} 
                          size={20} 
                          color={audioChoice === 'background' && selectedSong ? 'white' : theme.colors.textSecondary} 
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ 
                          color: audioChoice === 'background' && selectedSong ? theme.colors.primary : theme.colors.textSecondary, 
                          fontSize: theme.typography.body.fontSize,
                          fontWeight: audioChoice === 'background' && selectedSong ? '700' : '500'
                        }}>
                          {audioChoice === 'background' && selectedSong ? 'Background Music Selected' : audioChoice === 'original' ? 'Using Original Audio' : 'Add Background Music'}
                        </Text>
                        {audioChoice === 'background' && selectedSong && (
                          <Text style={{ 
                            color: theme.colors.textSecondary, 
                            fontSize: theme.typography.small.fontSize,
                            marginTop: 2
                          }}>
                            {selectedSong.title} - {selectedSong.artist}
                          </Text>
                        )}
                      </View>
                      <Ionicons 
                        name="chevron-forward" 
                        size={20} 
                        color={audioChoice === 'background' && selectedSong ? theme.colors.primary : theme.colors.textSecondary} 
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        { 
                          backgroundColor: theme.colors.primary, 
                          borderRadius: theme.borderRadius.lg, 
                          paddingVertical: theme.spacing.lg, 
                          alignItems: "center", 
                          justifyContent: 'center',
                          marginTop: theme.spacing.md,
                          flexDirection: 'row',
                          gap: theme.spacing.sm,
                          ...theme.shadows.large
                        },
                        isLoading && { opacity: 0.7 },
                      ]}
                      onPress={() => {
                        logger.debug('Upload Short button pressed');
                        logger.debug('Form values:', values);
                        logger.debug('Form errors:', errors);
                        logger.debug('Form touched:', touched);
                        handleSubmit();
                      }}
                      disabled={isLoading}
                      activeOpacity={0.8}
                    >
                      {isLoading ? (
                        <>
                          <ActivityIndicator color="white" size="small" />
                          <Text style={{ color: 'white', fontSize: theme.typography.body.fontSize, fontWeight: "700", marginLeft: theme.spacing.sm }}>Uploading...</Text>
                        </>
                      ) : (
                        <>
                          <Ionicons name="cloud-upload" size={20} color="white" />
                          <Text style={{ color: 'white', fontSize: theme.typography.body.fontSize, fontWeight: "700" }}>Upload Short</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                  );
                }}
              </Formik>
            )}
          </View>
        )}
      </ScrollView>
      
      {/* Progress Alert */}
      <ProgressAlert
        visible={isUploading}
        title={`Uploading Post (${uploadProgress.current}/${uploadProgress.total})`}
        message={uploadProgress.total > 1 
          ? `Uploading image ${uploadProgress.current} of ${uploadProgress.total}...`
          : "Please wait while your media is being uploaded..."}
        progress={uploadProgress.percentage || 0}
        type="upload"
        showCancel={true}
        onCancel={() => {
          setIsUploading(false);
          setUploadProgress({ current: 0, total: 0, percentage: 0 });
          setIsLoading(false);
        }}
      />

      {/* Song Selector Modal */}
      {/* Audio Choice Modal for Shorts */}
      <Modal
        visible={showAudioChoiceModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAudioChoiceModal(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0, 0, 0, 0.75)' }]}>
          <View style={[
            styles.modalContent, 
            { 
              backgroundColor: theme.colors.surface,
              ...theme.shadows.large
            }
          ]}>
            <View style={{ alignItems: 'center', marginBottom: theme.spacing.lg }}>
              <View style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: theme.colors.primary + '15',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: theme.spacing.md
              }}>
                <Ionicons name="musical-notes" size={32} color={theme.colors.primary} />
              </View>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                Choose Audio for Your Short
              </Text>
              <Text style={[styles.modalDescription, { color: theme.colors.textSecondary }]}>
                Select how you want to handle audio for this video
              </Text>
            </View>
            
            <TouchableOpacity
              style={[
                styles.audioChoiceButton, 
                { 
                  backgroundColor: theme.colors.primary,
                  ...theme.shadows.medium
                }
              ]}
              onPress={() => {
                setAudioChoice('background');
                setShowAudioChoiceModal(false);
                setShowSongSelector(true);
              }}
              activeOpacity={0.8}
            >
              <View style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: theme.spacing.md
              }}>
                <Ionicons name="musical-notes" size={24} color="white" />
              </View>
              <View style={styles.audioChoiceTextContainer}>
                <Text style={styles.audioChoiceTitle}>Background Music</Text>
                <Text style={styles.audioChoiceSubtitle}>Add a song from our library</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="white" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.audioChoiceButton, 
                { 
                  backgroundColor: theme.colors.surfaceSecondary,
                  borderWidth: 2,
                  borderColor: theme.colors.border
                }
              ]}
              onPress={() => {
                setAudioChoice('original');
                setSelectedSong(null);
                setShowAudioChoiceModal(false);
              }}
              activeOpacity={0.8}
            >
              <View style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: theme.colors.border + '40',
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: theme.spacing.md
              }}>
                <Ionicons name="volume-high" size={24} color={theme.colors.text} />
              </View>
              <View style={styles.audioChoiceTextContainer}>
                <Text style={[styles.audioChoiceTitle, { color: theme.colors.text }]}>
                  Original Video Audio
                </Text>
                <Text style={[styles.audioChoiceSubtitle, { color: theme.colors.textSecondary }]}>
                  Keep the original sound from your video
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modalCancelButton, 
                { 
                  borderColor: theme.colors.border,
                  marginTop: theme.spacing.md
                }
              ]}
              onPress={() => {
                setShowAudioChoiceModal(false);
                setSelectedVideo(null);
                setPostType('photo');
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.modalCancelText, { color: theme.colors.textSecondary }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <SongSelector
        visible={showSongSelector}
        onClose={() => {
          setShowSongSelector(false);
          // If user closes without selecting, reset audio choice
          if (!selectedSong) {
            setAudioChoice(null);
          }
        }}
        onSelect={(song, startTime, endTime) => {
          setSelectedSong(song);
          if (song && startTime !== undefined && endTime !== undefined) {
            setSongStartTime(startTime);
            setSongEndTime(endTime);
          } else if (!song) {
            setSongStartTime(0);
            setSongEndTime(60);
            setAudioChoice(null);
          }
          setShowSongSelector(false);
        }}
        selectedSong={selectedSong}
        selectedStartTime={songStartTime}
        selectedEndTime={songEndTime}
      />
    </View>
  );
}

/* (Removed duplicate implementation of PostScreen and related duplicate code) */

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    padding: 28,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalDescription: {
    fontSize: 15,
    marginBottom: 8,
    textAlign: 'center',
    lineHeight: 22,
  },
  audioChoiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
  },
  audioChoiceTextContainer: {
    flex: 1,
  },
  audioChoiceTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: 'white',
    marginBottom: 6,
  },
  audioChoiceSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: 18,
  },
  modalCancelButton: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
