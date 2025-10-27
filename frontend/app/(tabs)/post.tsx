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
import * as ImageManipulator from "expo-image-manipulator";
import * as MediaLibrary from "expo-media-library";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "../../context/ThemeContext";
import  NavBar from "../../components/NavBar";
import { postSchema, shortSchema } from "../../utils/validation";
import { getCurrentLocation, getAddressFromCoords } from "../../utils/locationUtils";
import { createPost, createPostWithProgress, createShort, getPosts, getShorts } from "../../services/posts";
import { getUserFromStorage } from "../../services/auth";
import { UserType } from "../../types/user";
import ProgressAlert from "../../components/ProgressAlert";
import { optimizeImageForUpload, shouldOptimizeImage, getOptimalQuality } from "../../utils/imageOptimization";
import * as VideoThumbnails from "expo-video-thumbnails";
import { Video, ResizeMode } from "expo-av";


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
        console.log('📸 Selected assets data:', result.assets.map(asset => ({
          uri: asset.uri,
          fileName: asset.fileName,
          id: (asset as any).id,
          type: asset.type,
          width: asset.width,
          height: asset.height,
        })));
        
        // IMPORTANT: Clear location state explicitly before processing new images
        console.log('🔄 Clearing location state for new selection');
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
        console.log('⏳ Waiting for MediaLibrary to update...');
        await new Promise(resolve => setTimeout(resolve, 500));
        
        console.log('🔍 Starting location extraction for new photo');
        console.log('📅 Selection started at:', new Date(selectionStartTime));
        
        // Try to get location from photo EXIF data first
        const hasLocation = await getLocationFromPhotos(result.assets, selectionStartTime);
        console.log('📍 Location extraction result:', hasLocation ? 'Found' : 'Not found');
        
        if (!hasLocation) {
          // Fall back to current device location
          console.log('📱 Falling back to device location');
          await getLocation();
        }
      }
    } catch (error) {
      console.error('Error picking images:', error);
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
        clearUploadState();
        setSelectedVideo(result.assets[0].uri);
        setSelectedImages([]);
      setPostType('short');
      // Generate initial thumbnail
      try {
        const { uri } = await VideoThumbnails.getThumbnailAsync(result.assets[0].uri, { time: 1000 });
        setVideoThumbnail(uri);
      } catch (e) {
        console.warn('Thumbnail generation failed:', e);
        setVideoThumbnail(null);
      }
      
      // Add a small delay to ensure MediaLibrary is updated with the selected video
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Try to get location from video metadata
      const hasLocation = await getLocationFromPhotos(result.assets, selectionStartTime);
      if (!hasLocation) {
        // Fall back to current device location
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
        const hasLocation = await getLocationFromPhotos(result.assets, captureStartTime);
        if (!hasLocation) {
          // Fall back to current device location
          await getLocation();
        }
      }
    } catch (error) {
      console.error('Error taking photo:', error);
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
      setSelectedVideo(result.assets[0].uri);
        setSelectedImages([]);
      setPostType('short');
      try {
        const { uri } = await VideoThumbnails.getThumbnailAsync(result.assets[0].uri, { time: 1000 });
        setVideoThumbnail(uri);
      } catch (e) {
        console.warn('Thumbnail generation failed:', e);
        setVideoThumbnail(null);
      }
      
      // Add a small delay to ensure MediaLibrary is updated with the captured video
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Try to get location from video metadata
      const hasLocation = await getLocationFromPhotos(result.assets, captureStartTime);
      if (!hasLocation) {
        // Fall back to current device location
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
  
  // Get location from photo/video metadata (EXIF data)
  const getLocationFromPhotos = async (assets: any[], selectionStartTime?: number): Promise<boolean> => {
    try {
      // Request media library permissions
      const { status: mediaStatus } = await MediaLibrary.requestPermissionsAsync();
      if (mediaStatus === 'granted') {
        try {
          // Try to get location using the asset ID from ImagePicker
          for (const asset of assets) {
            const assetId = (asset as any).id;
            console.log('📸 Processing asset:', { 
              uri: asset.uri,
              id: assetId,
              hasId: !!assetId
            });
            
            // If asset has an ID, try to get info directly
            if (assetId) {
              try {
                const assetInfo = await MediaLibrary.getAssetInfoAsync(assetId);
                
                console.log('📱 Asset info from ID:', {
                  id: assetInfo.id,
                  hasLocation: !!assetInfo.location
                });
                
                if (assetInfo.location) {
                  console.log('📱 Raw location data:', assetInfo.location);
                  
                  const latValue: any = (assetInfo.location as any).latitude;
                  const lngValue: any = (assetInfo.location as any).longitude;
                  
                  console.log('📱 Extracted lat/lng values:', { latValue, lngValue });
                  
                  const lat = typeof latValue === 'number' ? latValue : parseFloat(latValue?.toString() || '0');
                  const lng = typeof lngValue === 'number' ? lngValue : parseFloat(lngValue?.toString() || '0');
                  
                  if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
                    const coords = { lat, lng };
                    setLocation(coords);
                    
                    const addressText = await getAddressFromCoords(coords.lat, coords.lng);
                    setAddress(addressText);
                    
                    console.log('✅ Got location from photo using ID:', addressText);
                    return true;
                  }
                }
              } catch (idError) {
                console.log('Error getting asset by ID:', idError);
              }
            }
          }
          
          // Fallback: Get recent photos sorted by modification time
          const recentAssets = await MediaLibrary.getAssetsAsync({
            first: 30,
            mediaType: MediaLibrary.MediaType.photo,
            sortBy: MediaLibrary.SortBy.modificationTime,
          });
          
          console.log('📱 Found recent assets:', recentAssets.assets.length);
          
          // Try to match the selected photo by filename from ImagePicker
          let assetsToCheck: any[] = [];
          let matchedAssetInfo: any = null;
          
          for (const selectedAsset of assets) {
            const selectedFileName = selectedAsset.fileName;
            console.log('🔍 Looking for photo with filename:', selectedFileName);
            
            if (selectedFileName) {
              console.log('🔍 Searching through recent photos for filename match...');
              
              // Check each recent photo to find the one with matching filename
              for (const mediaAsset of recentAssets.assets) {
                try {
                  const assetInfo = await MediaLibrary.getAssetInfoAsync(mediaAsset.id);
                  const assetFileName = assetInfo.localUri?.split('/').pop() || '';
                  
                  console.log('📋 Comparing:', assetFileName, 'with', selectedFileName);
                  
                  // Check if filename matches (case insensitive)
                  if (assetFileName.toLowerCase().includes(selectedFileName.toLowerCase()) ||
                      selectedFileName.toLowerCase().includes(assetFileName.toLowerCase())) {
                    console.log('✅ Found matching photo by filename!');
                    assetsToCheck = [mediaAsset];
                    matchedAssetInfo = assetInfo; // Cache the asset info to avoid duplicate calls
                    break;
                  }
                } catch (err) {
                  // Continue searching
                }
              }
              
              if (assetsToCheck.length > 0) break;
            }
          }
          
          // If no filename match found, fallback to most recent photo
          if (assetsToCheck.length === 0) {
            // Sort by modification time and get most recent
            const sortedAssets = recentAssets.assets.sort((a, b) => 
              (b.modificationTime || 0) - (a.modificationTime || 0)
            );
            assetsToCheck = sortedAssets.slice(0, 1);
            console.log('📱 No filename match, using most recent photo:', assetsToCheck[0]?.modificationTime);
          } else {
            console.log('📱 Using filename-matched photo');
          }
          
          for (const mediaAsset of assetsToCheck) {
            try {
              // Use cached asset info if available, otherwise fetch it
              const assetInfo = matchedAssetInfo || await MediaLibrary.getAssetInfoAsync(mediaAsset.id);
              
              console.log('📱 Checking asset:', {
                id: mediaAsset.id,
                modificationTime: mediaAsset.modificationTime,
                hasLocation: !!assetInfo.location
              });
              
              if (assetInfo.location) {
                console.log('📱 Raw location data:', assetInfo.location);
                
                const latValue: any = (assetInfo.location as any).latitude;
                const lngValue: any = (assetInfo.location as any).longitude;
                
                console.log('📱 Extracted lat/lng values:', { latValue, lngValue });
                
                const lat = typeof latValue === 'number' ? latValue : parseFloat(latValue?.toString() || '0');
                const lng = typeof lngValue === 'number' ? lngValue : parseFloat(lngValue?.toString() || '0');
                
                if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
                  const coords = { lat, lng };
                  
                  console.log('✅ Setting NEW location from photo:', coords);
                  
                  // Use functional setState to ensure we overwrite any previous location
                  setLocation(prevLoc => {
                    console.log('Previous location was:', prevLoc, 'setting to:', coords);
                    return coords;
                  });
                  
                  // Clear address first, then set new one
                  setAddress('');
                  
                  const addressText = await getAddressFromCoords(coords.lat, coords.lng);
                  setAddress(addressText);
                  
                  console.log('✅ Got location from photo:', addressText);
                  return true;
                }
              }
            } catch (infoError) {
              console.log('Error getting asset info:', infoError);
            }
          }
        } catch (libraryError) {
          console.log('MediaLibrary query failed:', libraryError);
        }
      }
      
      console.log('⚠️ No location found in photo metadata');
      return false;
    } catch (error) {
      console.error('Error getting location from photos:', error);
      return false;
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
    setUploadProgress(0);
    setUploadError(null);
    
    try {
      console.log('Creating post with images:', selectedImages);
      
      // Prepare images data
      const imagesData = selectedImages.map(img => ({
        uri: img.uri,
        type: img.type,
        name: img.name
      }));

      // Simulate progress updates since we can't track actual upload progress with fetch
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 10;
        });
      }, 200);

      const response = await createPostWithProgress({
        images: imagesData,
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
              setSelectedImages([]);
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
        image: videoThumbnail ? {
          uri: videoThumbnail,
          type: 'image/jpeg',
          name: 'thumbnail.jpg',
        } : undefined,
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

        {!selectedImages.length && !selectedVideo ? (
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
              <TouchableOpacity style={{ alignItems: "center", backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.lg, padding: theme.spacing.lg, width: "45%", ...theme.shadows.medium }} onPress={postType === 'photo' ? pickImages : pickVideo}>
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
            {selectedImages.length > 0 ? (
              <View>
                {/* Image carousel */}
                <ScrollView 
                  horizontal 
                  pagingEnabled 
                  showsHorizontalScrollIndicator={false}
                  style={{ borderRadius: theme.borderRadius.lg }}
                >
                  {selectedImages.map((image, index) => (
                    <View key={index} style={{ width: 350, height: 300 }}>
                      <Image 
                        source={{ uri: image.uri }} 
                        style={{ width: "100%", height: "100%", borderRadius: theme.borderRadius.lg, resizeMode: "cover" }} 
                      />
                    </View>
                  ))}
                </ScrollView>
                
                {/* Image counter */}
                {selectedImages.length > 1 && (
                  <View style={{ 
                    position: 'absolute', 
                    top: theme.spacing.sm, 
                    left: theme.spacing.sm, 
                    backgroundColor: 'rgba(0,0,0,0.6)', 
                    paddingHorizontal: theme.spacing.sm, 
                    paddingVertical: theme.spacing.xs, 
                    borderRadius: theme.borderRadius.md 
                  }}>
                    <Text style={{ color: 'white', fontSize: theme.typography.small.fontSize, fontWeight: '600' }}>
                      {selectedImages.length} photos
                    </Text>
                  </View>
                )}
                
                {/* Add more photos button */}
                {selectedImages.length < 10 && (
                  <TouchableOpacity
                    onPress={pickImages}
                    style={{ 
                      position: 'absolute', 
                      bottom: theme.spacing.sm, 
                      right: theme.spacing.sm, 
                      backgroundColor: theme.colors.primary, 
                      paddingHorizontal: theme.spacing.md, 
                      paddingVertical: theme.spacing.sm, 
                      borderRadius: theme.borderRadius.md 
                    }}
                  >
                    <Text style={{ color: theme.colors.text, fontWeight: '600' }}>+ Add More</Text>
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
            <TouchableOpacity style={{ position: "absolute", top: theme.spacing.sm, right: theme.spacing.sm, backgroundColor: theme.colors.background, borderRadius: 16 }} onPress={() => { 
              setSelectedImages([]); 
              setSelectedVideo(null);
              setVideoThumbnail(null);
              setLocation(null); 
              setAddress(""); 
            }}>
              <Ionicons name="close-circle" size={32} color={theme.colors.error} />
            </TouchableOpacity>
          </View>
        )}
        {(selectedImages.length > 0 || selectedVideo) && (
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
        message="Please wait while your media is being uploaded..."
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
