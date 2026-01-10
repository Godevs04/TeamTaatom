import React, { useState, useEffect, useRef, useCallback } from "react";
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
  AppState,
  BackHandler,
  Dimensions,
  KeyboardAvoidingView,
} from "react-native";
import { Formik } from "formik";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as MediaLibrary from "expo-media-library";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext";
import  NavBar from "../../components/NavBar";
import { postSchema, shortSchema } from "../../utils/validation";
import { getCurrentLocation, getAddressFromCoords } from "../../utils/locationUtils";
import { LocationExtractionService } from "../../services/locationExtraction";
import { createPost, createPostWithProgress, createShort, createShortWithProgress, getPosts, getShorts } from "../../services/posts";
import { getUserFromStorage, getCurrentUser } from "../../services/auth";
import { getProfile } from "../../services/profile";
import { UserType } from "../../types/user";
import ProgressAlert from "../../components/ProgressAlert";
import { optimizeImageForUpload, shouldOptimizeImage, getOptimalQuality } from "../../utils/imageOptimization";
import * as VideoThumbnails from "expo-video-thumbnails";
import { Video, Audio, ResizeMode, AVPlaybackStatus } from "expo-av";
import HashtagSuggest from "../../components/HashtagSuggest";
import MentionSuggest from "../../components/MentionSuggest";
import { useScrollToHideNav } from '../../hooks/useScrollToHideNav';
import { createLogger } from '../../utils/logger';
import { sanitizeErrorForDisplay } from '../../utils/errorSanitizer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { SongSelector } from '../../components/SongSelector';
import { Song } from '../../services/songs';
import { useFocusEffect } from '@react-navigation/native';
import { theme } from '../../constants/theme';
import { validateAndSanitizeCaption } from '../../utils/sanitize';
import CopyrightConfirmationModal from '../../components/CopyrightConfirmationModal';

const logger = createLogger('PostScreen');

// Responsive dimensions
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const isTablet = screenWidth >= 768;
const isWeb = Platform.OS === 'web';
const isIOS = Platform.OS === 'ios';
const isAndroid = Platform.OS === 'android';

// Elegant font families
const getFontFamily = (weight: '400' | '500' | '600' | '700' | '800' = '400') => {
  if (isWeb) {
    return 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  }
  if (isIOS) {
    return 'System';
  }
  return 'Roboto';
};

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
  const [locationMetadata, setLocationMetadata] = useState<{
    hasExifGps?: boolean;
    takenAt?: Date | null;
    rawSource?: 'exif' | 'asset' | 'manual' | 'none';
  } | null>(null);
  const [isFromCameraFlow, setIsFromCameraFlow] = useState(false);
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
  const [videoDuration, setVideoDuration] = useState<number | null>(null); // Video duration in seconds
  const [showSongSelector, setShowSongSelector] = useState(false);
  const [audioChoice, setAudioChoice] = useState<'background' | 'original' | null>(null);
  const [showAudioChoiceModal, setShowAudioChoiceModal] = useState(false);
  // Ref to track if a song was just selected to prevent race condition with onClose
  const songJustSelectedRef = useRef(false);
  const [spotType, setSpotType] = useState<string>('');
  const [travelInfo, setTravelInfo] = useState<string>('');
  const [showSpotTypePicker, setShowSpotTypePicker] = useState(false);
  const [showTravelInfoPicker, setShowTravelInfoPicker] = useState(false);
  const [showCopyrightModal, setShowCopyrightModal] = useState(false);
  const [copyrightAccepted, setCopyrightAccepted] = useState(false);
  const [pendingShortData, setPendingShortData] = useState<any>(null);
  const router = useRouter();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { handleScroll } = useScrollToHideNav();
  
  // Draft saving
  const DRAFT_KEY = 'postDraft';
  const DRAFT_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

  // Upload lifecycle safety: track active upload session
  const uploadSessionRef = useRef<{
    isActive: boolean;
    abortController?: AbortController;
    progressWatchdog?: NodeJS.Timeout;
    lastProgressTime?: number;
  }>({ isActive: false });

  // Duplicate submission prevention
  const isSubmittingRef = useRef(false);

  // Progress watchdog: detect stalled uploads
  // Increased thresholds for large file uploads (400MB+)
  const PROGRESS_WATCHDOG_INTERVAL = 10000; // 10 seconds (increased from 5)
  const PROGRESS_STALL_THRESHOLD = 60000; // 60 seconds without progress update (increased from 10 for large files)

  // Media memory safety: track media references for cleanup
  const mediaRefsRef = useRef<{
    images: Array<{ uri: string }>;
    video: string | null;
  }>({ images: [], video: null });

  // Auto-match song selection duration with video duration when video is selected
  useEffect(() => {
    if (selectedVideo && videoDuration && videoDuration > 0) {
      const MAX_SHORT_DURATION = 60; // Max 60 seconds for shorts
      const matchedDuration = Math.min(videoDuration, MAX_SHORT_DURATION);
      
      // Only update if the current song selection doesn't match video duration
      if (songEndTime - songStartTime !== matchedDuration) {
        setSongStartTime(0);
        setSongEndTime(matchedDuration);
        logger.debug('Auto-matched song selection with video duration:', {
          videoDuration,
          matchedDuration,
          songStartTime: 0,
          songEndTime: matchedDuration
        });
      }
    } else if (!selectedVideo && videoDuration) {
      // Clear video duration when video is removed
      setVideoDuration(null);
    }
  }, [selectedVideo, videoDuration]); // Only watch selectedVideo and videoDuration, not songEndTime to avoid loops

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
      // Try to get fresh user data with signed profile picture URL
      try {
        const currentUser = await getCurrentUser();
        if (currentUser && currentUser !== 'network-error') {
          // Fetch profile to get signed profile picture URL
          try {
            const profileResponse = await getProfile(currentUser._id);
            if (profileResponse && profileResponse.profile && profileResponse.profile.profilePic) {
              setUser({ ...currentUser, profilePic: profileResponse.profile.profilePic });
              logger.debug('User loaded with profile picture:', { ...currentUser, profilePic: profileResponse.profile.profilePic });
            } else {
              setUser(currentUser);
              logger.debug('User loaded from API:', currentUser);
            }
          } catch (profileError) {
            // If profile fetch fails, use currentUser as is
            setUser(currentUser);
            logger.debug('User loaded from API (profile fetch failed):', currentUser);
          }
        } else {
          // Fallback to stored user if API call fails
          const userData = await getUserFromStorage();
          if (userData && userData._id) {
            // Try to fetch profile for stored user too
            try {
              const profileResponse = await getProfile(userData._id);
              if (profileResponse && profileResponse.profile && profileResponse.profile.profilePic) {
                setUser({ ...userData, profilePic: profileResponse.profile.profilePic });
                logger.debug('User loaded from storage with profile:', { ...userData, profilePic: profileResponse.profile.profilePic });
              } else {
                setUser(userData);
                logger.debug('User loaded from storage:', userData);
              }
            } catch (profileError) {
              setUser(userData);
              logger.debug('User loaded from storage (profile fetch failed):', userData);
            }
          } else {
            setUser(userData);
            logger.debug('User loaded from storage:', userData);
          }
        }
      } catch (error) {
        // Fallback to stored user on error
        const userData = await getUserFromStorage();
        setUser(userData);
        logger.debug('User loaded from storage (fallback):', userData);
      }
      
      // Check for existing content
      await checkExistingContent();
      
      // Load draft if available
      await loadDraft();
    };
    loadUser();
  }, []);

  // Enhanced draft persistence: save on every meaningful change
  // Includes caption, media metadata, location, and music selection
  useEffect(() => {
    const saveDraft = async () => {
      // Only save if there's media selected
      if (selectedImages.length === 0 && !selectedVideo) return;
      
      const draft = {
        selectedImages,
        selectedVideo,
        videoThumbnail,
        location,
        address,
        locationMetadata,
        postType,
        selectedSong: selectedSong ? {
          _id: selectedSong._id,
          title: selectedSong.title,
          artist: selectedSong.artist,
          s3Url: selectedSong.s3Url,
          duration: selectedSong.duration
        } : null,
        songStartTime,
        songEndTime,
        audioChoice,
        timestamp: Date.now()
      };
      
      try {
        await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        logger.debug('Draft auto-saved with full metadata');
      } catch (error) {
        logger.error('Failed to save draft', error);
      }
    };
    
    const timeoutId = setTimeout(saveDraft, 2000); // Debounce by 2 seconds
    return () => clearTimeout(timeoutId);
  }, [selectedImages, selectedVideo, videoThumbnail, location, address, locationMetadata, postType, selectedSong, songStartTime, songEndTime, audioChoice]);

  // Enhanced draft recovery: restore all metadata including music selection
  const loadDraft = async () => {
    try {
      const draftJson = await AsyncStorage.getItem(DRAFT_KEY);
      if (!draftJson) return;
      
      let draft;
      try {
        draft = JSON.parse(draftJson);
      } catch (parseError) {
        logger.error('Failed to parse draft JSON', parseError);
        // Clear corrupted draft
        await AsyncStorage.removeItem(DRAFT_KEY);
        return;
      }
      
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
              // Restore media
              if (draft.selectedImages) setSelectedImages(draft.selectedImages);
              if (draft.selectedVideo && draft.selectedVideo.trim()) {
                setSelectedVideo(draft.selectedVideo);
              } else {
                setSelectedVideo(null);
                setVideoDuration(null); // Clear video duration when video is removed
              }
              if (draft.videoThumbnail && draft.videoThumbnail.trim()) {
                setVideoThumbnail(draft.videoThumbnail);
              }
              
              // Restore location
              if (draft.location) setLocation(draft.location);
              if (draft.address) setAddress(draft.address);
              if (draft.locationMetadata) setLocationMetadata(draft.locationMetadata);
              
              // Restore post type
              if (draft.postType) setPostType(draft.postType);
              
              // Restore music selection
              if (draft.selectedSong) {
                setSelectedSong(draft.selectedSong as Song);
                if (draft.songStartTime !== undefined) setSongStartTime(draft.songStartTime);
                if (draft.songEndTime !== undefined) setSongEndTime(draft.songEndTime);
                if (draft.audioChoice) setAudioChoice(draft.audioChoice);
              }
            }
          }
        ]
      );
    } catch (error) {
      logger.error('Failed to load draft', error);
      // Clear corrupted draft on error
      try {
        await AsyncStorage.removeItem(DRAFT_KEY);
      } catch (clearError) {
        logger.error('Failed to clear corrupted draft', clearError);
      }
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
    isSubmittingRef.current = false;
    
    // Cleanup upload session
    if (uploadSessionRef.current.abortController) {
      uploadSessionRef.current.abortController.abort();
    }
    if (uploadSessionRef.current.progressWatchdog) {
      clearInterval(uploadSessionRef.current.progressWatchdog);
    }
    uploadSessionRef.current = { isActive: false };
  };

  // Upload cancellation: cleanup on back/tab switch/app background
  const cancelUpload = useCallback(async () => {
    if (!uploadSessionRef.current.isActive) return;
    
    logger.debug('Cancelling active upload');
    
    // Abort ongoing request if possible
    if (uploadSessionRef.current.abortController) {
      uploadSessionRef.current.abortController.abort();
    }
    
    // Clear progress watchdog
    if (uploadSessionRef.current.progressWatchdog) {
      clearInterval(uploadSessionRef.current.progressWatchdog);
    }
    
    // Persist current draft state before clearing
    try {
      const draft = {
        selectedImages,
        selectedVideo,
        videoThumbnail,
        location,
        address,
        locationMetadata,
        postType,
        selectedSong: selectedSong ? {
          _id: selectedSong._id,
          title: selectedSong.title,
          artist: selectedSong.artist,
          s3Url: selectedSong.s3Url,
          duration: selectedSong.duration
        } : null,
        songStartTime,
        songEndTime,
        audioChoice,
        timestamp: Date.now()
      };
      await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      logger.debug('Draft saved before upload cancellation');
    } catch (error) {
      logger.error('Failed to save draft on cancellation', error);
    }
    
    clearUploadState();
  }, [selectedImages, selectedVideo, videoThumbnail, location, address, locationMetadata, postType, selectedSong, songStartTime, songEndTime, audioChoice]);

  // Media memory safety: release references when no longer needed
  const releaseMediaReferences = useCallback(() => {
    mediaRefsRef.current = { images: [], video: null };
    logger.debug('Media references released');
  }, []);

  // Upload lifecycle safety: handle back press, tab switch, app background
  useEffect(() => {
    // Handle Android back button
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (uploadSessionRef.current.isActive) {
        Alert.alert(
          'Upload in Progress',
          'Upload is in progress. Do you want to cancel and save as draft?',
          [
            { text: 'Continue Upload', style: 'cancel' },
            {
              text: 'Cancel & Save Draft',
              style: 'destructive',
              onPress: cancelUpload
            }
          ]
        );
        return true; // Prevent default back behavior
      }
      return false; // Allow default back behavior
    });

    // Handle app backgrounding
    const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        if (uploadSessionRef.current.isActive) {
          logger.debug('App backgrounded during upload, cancelling');
          cancelUpload();
        }
      }
    });

    return () => {
      backHandler.remove();
      appStateSubscription.remove();
    };
  }, [cancelUpload]);

  // Navigation lifecycle safety: cancel upload on screen blur
  useFocusEffect(
    useCallback(() => {
      // On screen blur, cancel upload if active
      return () => {
        if (uploadSessionRef.current.isActive) {
          logger.debug('Screen blurred during upload, cancelling');
          cancelUpload();
        }
      };
    }, [cancelUpload])
  );

  const pickImages = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== ImagePicker.PermissionStatus.GRANTED) {
        Alert.alert('Permission needed', 'Please grant photo library permissions.');
        return;
      }
    } catch (permissionError: any) {
      // Handle permission request errors gracefully
      logger.debug('Permission request error:', permissionError);
      Alert.alert('Error', 'Failed to request permissions. Please try again.');
      return;
    }

    try {
      // Reset location before picking new images
      setLocation(null);
      setAddress('');
      
      // Record the timestamp before opening the picker
      const selectionStartTime = Date.now();
      
      let result;
      try {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsMultipleSelection: true,
          selectionLimit: 10,
          quality: 0.8,
          allowsEditing: false,
          exif: true, // Preserve EXIF data including location
        });
      } catch (pickerError: any) {
        // Handle ImagePicker errors (including CodedError) gracefully
        logger.debug('ImagePicker error:', pickerError);
        // Check if user canceled
        if (pickerError?.code === 'E_PICKER_CANCELLED' || pickerError?.message?.includes('cancel')) {
          return; // User canceled, no need to show error
        }
        // For other errors, show user-friendly message
        const errorMessage = pickerError?.message || pickerError?.code || 'Failed to open image picker';
        Alert.alert('Error', errorMessage);
        return;
      }

      if (result && !result.canceled && result.assets) {
        logger.debug('Selected assets data:', result.assets.map(asset => ({
          uri: asset.uri,
          fileName: asset.fileName,
          id: (asset as any).id,
          type: asset.type,
          width: asset.width,
          height: asset.height,
        })));
        
        // IMPORTANT: Clear ALL location-related state before processing new images
        // This ensures we don't use cached/previous location data
        logger.debug('Clearing location state for new selection');
        setLocation(null);
        setAddress('');
        setLocationMetadata({
          hasExifGps: false,
          takenAt: null,
          rawSource: 'none'
        });
        
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
        setVideoDuration(null); // Clear video duration when switching to photo
        setPostType('photo');
        
        // Add a small delay to ensure MediaLibrary is updated with the selected photo
        logger.debug('Waiting for MediaLibrary to update...');
        await new Promise(resolve => setTimeout(resolve, 500));
        
        logger.debug('Starting location extraction for NEWLY selected photos only');
        logger.debug('Selection started at:', new Date(selectionStartTime));
        logger.debug('Number of newly selected assets:', result.assets.length);
        
        // CRITICAL: Extract location ONLY from the newly selected assets
        // Pass only the new assets to ensure we don't get location from previous uploads
        const locationResult = await LocationExtractionService.extractFromPhotos(
          result.assets, // Only newly selected assets
          selectionStartTime
        );
        
        if (locationResult) {
          setLocation({ lat: locationResult.lat, lng: locationResult.lng });
          if (locationResult.address) {
            setAddress(locationResult.address);
          }
          // Store metadata for TripScore v2
          setLocationMetadata({
            hasExifGps: locationResult.hasExifGps,
            takenAt: locationResult.takenAt || null,
            rawSource: locationResult.rawSource
          });
          setIsFromCameraFlow(false); // Gallery selection
          logger.debug('Location extraction result: Found', {
            hasExifGps: locationResult.hasExifGps,
            rawSource: locationResult.rawSource,
            takenAt: locationResult.takenAt
          });
        } else {
          logger.debug('Location extraction result: Not found');
          setLocationMetadata({
            hasExifGps: false,
            takenAt: null,
            rawSource: 'none'
          });
          setIsFromCameraFlow(false);
          
          // Show warning - user can manually enter location
          Alert.alert(
            'Location Not Detected',
            'Unable to fetch location from photo. You can manually type the location, but Trip Score will not be calculated.',
            [{ text: 'OK', style: 'default' }]
          );
        }
      }
    } catch (error) {
      logger.error('Error picking images', error);
      Alert.alert('Error', 'Failed to pick images');
    }
  };

  const pickVideo = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== ImagePicker.PermissionStatus.GRANTED) {
        Alert.alert('Permission needed', 'Please grant photo library permissions.');
        return;
      }
    } catch (permissionError: any) {
      logger.debug('Permission request error:', permissionError);
      Alert.alert('Error', 'Failed to request permissions. Please try again.');
      return;
    }
    
    // Reset ALL location-related state before picking new video
    setLocation(null);
    setAddress('');
    setLocationMetadata({
      hasExifGps: false,
      takenAt: null,
      rawSource: 'none'
    });
    
    // Record the timestamp before opening the picker
    const selectionStartTime = Date.now();
    
    try {
      let result;
      try {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['videos'],
          allowsEditing: true,
          aspect: [9, 16], // Vertical aspect ratio for shorts
          quality: 0.8,
          exif: true, // Preserve EXIF data including location
        });
      } catch (pickerError: any) {
        logger.debug('Video ImagePicker error:', pickerError);
        if (pickerError?.code === 'E_PICKER_CANCELLED' || pickerError?.message?.includes('cancel')) {
          return;
        }
        const errorMessage = pickerError?.message || pickerError?.code || 'Failed to open video picker';
        Alert.alert('Error', errorMessage);
        return;
      }
      
      if (result && !result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        
        // Check video duration (max 60 minutes = 3600 seconds for upload, but max 60 seconds for shorts)
        // Note: asset.duration from ImagePicker is typically in seconds, but can be in milliseconds on some platforms
        let durationInSeconds: number | null = null;
        if (asset.duration) {
          const MAX_VIDEO_DURATION = 60 * 60; // 60 minutes in seconds (for upload validation)
          // Detect if duration is in milliseconds (if > 100 seconds, it's likely milliseconds for a normal video)
          // For example: 9 seconds = 9000ms, which is > 100, so we convert
          durationInSeconds = asset.duration > 100 ? asset.duration / 1000 : asset.duration;
          
          // Log for debugging
          logger.debug('Video duration check:', {
            rawDuration: asset.duration,
            durationInSeconds: durationInSeconds,
            isMilliseconds: asset.duration > 100
          });
          
          if (durationInSeconds > MAX_VIDEO_DURATION) {
            const minutes = Math.floor(durationInSeconds / 60);
            const seconds = Math.floor(durationInSeconds % 60);
            Alert.alert(
              'Video Too Long',
              `Video duration exceeds the maximum limit of 60 minutes. Your video is ${minutes}:${seconds.toString().padStart(2, '0')} (${minutes} minutes ${seconds} seconds). Please select a shorter video.`,
              [{ text: 'OK' }]
            );
            return;
          }
        }
        
        clearUploadState();
        // Ensure URI is not empty before setting
        if (asset.uri && asset.uri.trim()) {
          setSelectedVideo(asset.uri);
          setSelectedImages([]);
          setPostType('short');
          
          // Get accurate video duration using Audio component
          let actualDuration: number | null = durationInSeconds;
          try {
            const { sound } = await Audio.Sound.createAsync(
              { uri: asset.uri },
              { shouldPlay: false }
            );
            const status = await sound.getStatusAsync();
            if (status.isLoaded && status.durationMillis) {
              actualDuration = status.durationMillis / 1000; // Convert milliseconds to seconds
              logger.debug('Video duration from Audio.Sound.createAsync:', {
                durationMillis: status.durationMillis,
                durationSeconds: actualDuration
              });
            }
            await sound.unloadAsync();
          } catch (videoError) {
            logger.warn('Failed to get video duration from Audio.Sound.createAsync, using asset.duration:', videoError);
            // Fallback to asset.duration if Audio.Sound.createAsync fails
            actualDuration = durationInSeconds;
          }
          
          // Store video duration and auto-match song selection duration (max 60 seconds for shorts)
          // The useEffect will automatically sync song selection duration with video duration
          const MAX_SHORT_DURATION = 60; // Max 60 seconds for shorts
          const shortDuration = actualDuration ? Math.min(actualDuration, MAX_SHORT_DURATION) : MAX_SHORT_DURATION;
          setVideoDuration(shortDuration);
          logger.info('Video selected, duration captured:', {
            videoDuration: actualDuration,
            shortDuration: shortDuration
          });
          
          // Reset audio choice and show modal to ask user
          setAudioChoice(null);
          setSelectedSong(null);
          setShowAudioChoiceModal(true);
          // Generate initial thumbnail
          try {
            const { uri } = await VideoThumbnails.getThumbnailAsync(asset.uri, { time: 1000 });
            if (uri && uri.trim()) {
              setVideoThumbnail(uri);
            } else {
              setVideoThumbnail(null);
            }
          } catch (e) {
            logger.warn('Thumbnail generation failed', e);
            setVideoThumbnail(null);
          }
          
          // Add a small delay to ensure MediaLibrary is updated with the selected video
          await new Promise(resolve => setTimeout(resolve, 500));
          
          logger.debug('Starting location extraction for newly selected video');
          logger.debug('Selection started at:', new Date(selectionStartTime).toISOString());
          
          // Try to get location from video metadata
          // Pass only the newly selected asset to ensure we get its location, not a previous one
          const locationResult = await LocationExtractionService.extractFromPhotos(
            result.assets, // Only the newly selected video asset
            selectionStartTime
          );
          
          if (locationResult) {
            setLocation({ lat: locationResult.lat, lng: locationResult.lng });
            if (locationResult.address) {
              setAddress(locationResult.address);
            }
            // Store location metadata for TripScore v2
            setLocationMetadata({
              hasExifGps: locationResult.hasExifGps,
              takenAt: locationResult.takenAt || null,
              rawSource: locationResult.rawSource
            });
            setIsFromCameraFlow(false); // Gallery selection
            logger.debug('Location extraction result for video: Found', {
              hasExifGps: locationResult.hasExifGps,
              rawSource: locationResult.rawSource,
              takenAt: locationResult.takenAt
            });
          } else {
            logger.debug('Location extraction result for video: Not found');
            setLocationMetadata({
              hasExifGps: false,
              takenAt: null,
              rawSource: 'none'
            });
            setIsFromCameraFlow(false);
            
            // Show warning - user can manually enter location
            Alert.alert(
              'Location Not Detected',
              'Unable to fetch location from video. You can manually type the location, but Trip Score will not be calculated.',
              [{ text: 'OK', style: 'default' }]
            );
          }
        } else {
          Alert.alert('Error', 'Invalid video file selected. Please try again.');
        }
      }
    } catch (error) {
      logger.error('Error picking video', error);
      Alert.alert('Error', 'Failed to pick video. Please try again.');
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== ImagePicker.PermissionStatus.GRANTED) {
      Alert.alert('Permission needed', 'Please grant camera permissions to take photos.');
      return;
    }
    
    // Reset ALL location-related state before taking new photo
    setLocation(null);
    setAddress('');
    setLocationMetadata({
      hasExifGps: false,
      takenAt: null,
      rawSource: 'none'
    });
    
    // Record timestamp before capturing
    const captureStartTime = Date.now();
    
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        exif: true, // Preserve EXIF data including location
      });
      
      if (result && !result.canceled && result.assets?.[0]) {
        clearUploadState();
        
        const newImage = {
          uri: result.assets[0].uri,
          type: 'image/jpeg', // Camera photos are always JPEG
          name: result.assets[0].fileName || `photo_${Date.now()}.jpg`,
          id: (result.assets[0] as any).id, // Pass through asset ID if available
          originalAsset: result.assets[0], // Keep reference to original asset
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
        setVideoDuration(null); // Clear video duration when switching to photo
        setPostType('photo');
        
        // Add a small delay to ensure MediaLibrary is updated with the captured photo
        await new Promise(resolve => setTimeout(resolve, 500));
        
        logger.debug('Starting location extraction for newly captured photo');
        logger.debug('Capture started at:', new Date(captureStartTime).toISOString());
        
        // Try to get location from photo EXIF data first
        // Pass only the newly captured asset to ensure we get its location, not a previous one
        const locationResult = await LocationExtractionService.extractFromPhotos(
          result.assets, // Only the newly captured asset
          captureStartTime
        );
        
        if (locationResult) {
          setLocation({ lat: locationResult.lat, lng: locationResult.lng });
          if (locationResult.address) {
            setAddress(locationResult.address);
          }
          // Store location metadata for TripScore v2
          setLocationMetadata({
            hasExifGps: locationResult.hasExifGps,
            takenAt: locationResult.takenAt || null,
            rawSource: locationResult.rawSource
          });
          setIsFromCameraFlow(true); // Camera capture
        } else {
          // No location from EXIF - get current location as fallback for Taatom camera
          logger.debug('No EXIF location found, getting current location for Taatom camera');
          try {
            const currentLocation = await getCurrentLocation();
            if (currentLocation && currentLocation.coords) {
              const coords = {
                lat: currentLocation.coords.latitude,
                lng: currentLocation.coords.longitude
              };
              setLocation(coords);
              
              // Get address from current location
              const address = await getAddressFromCoords(coords.lat, coords.lng);
              if (address) {
                setAddress(address);
              }
              
              // Store metadata - current location is still valid for Taatom camera
              setLocationMetadata({
                hasExifGps: false, // Not from EXIF, but from current GPS
                takenAt: new Date(),
                rawSource: 'exif' // Treat as valid GPS source for camera
              });
              setIsFromCameraFlow(true);
              
              logger.debug('Current location captured for Taatom camera:', coords);
            } else {
              // No current location available
              setLocationMetadata({
                hasExifGps: false,
                takenAt: null,
                rawSource: 'none'
              });
              setIsFromCameraFlow(true);
              
              Alert.alert(
                'Location Not Available',
                'Unable to get your current location. You can manually type the location.',
                [{ text: 'OK', style: 'default' }]
              );
            }
          } catch (locationError) {
            logger.error('Error getting current location:', locationError);
            setLocationMetadata({
              hasExifGps: false,
              takenAt: null,
              rawSource: 'none'
            });
            setIsFromCameraFlow(true);
            
            Alert.alert(
              'Location Not Available',
              'Unable to get your current location. You can manually type the location.',
              [{ text: 'OK', style: 'default' }]
            );
          }
        }
      }
    } catch (error) {
      logger.error('Error taking photo', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const takeVideo = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== ImagePicker.PermissionStatus.GRANTED) {
        Alert.alert('Permission needed', 'Please grant camera permissions to take videos.');
        return;
      }
    } catch (permissionError: any) {
      logger.debug('Camera permission request error:', permissionError);
      Alert.alert('Error', 'Failed to request camera permissions. Please try again.');
      return;
    }
    
    // Reset location before taking new video
    setLocation(null);
    setAddress('');
    
    // Record timestamp before capturing
    const captureStartTime = Date.now();
    
    try {
      let result;
      try {
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['videos'],
          allowsEditing: true,
          aspect: [9, 16], // Vertical aspect ratio for shorts
          quality: 0.8,
          exif: true, // Preserve EXIF data including location
        });
      } catch (pickerError: any) {
        logger.debug('Camera video ImagePicker error:', pickerError);
        if (pickerError?.code === 'E_PICKER_CANCELLED' || pickerError?.message?.includes('cancel')) {
          return;
        }
        const errorMessage = pickerError?.message || pickerError?.code || 'Failed to open camera';
        Alert.alert('Error', errorMessage);
        return;
      }
      
      if (result && !result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        
        // Check video duration (max 60 minutes = 3600 seconds)
        // Note: asset.duration from ImagePicker is typically in seconds, but can be in milliseconds on some platforms
        let durationInSeconds: number | null = null;
        if (asset.duration) {
          const MAX_VIDEO_DURATION = 60 * 60; // 60 minutes in seconds
          // Detect if duration is in milliseconds (if > 100 seconds, it's likely milliseconds for a normal video)
          // For example: 9 seconds = 9000ms, which is > 100, so we convert
          durationInSeconds = asset.duration > 100 ? asset.duration / 1000 : asset.duration;
          
          // Log for debugging
          logger.debug('Video duration check:', {
            rawDuration: asset.duration,
            durationInSeconds: durationInSeconds,
            isMilliseconds: asset.duration > 100
          });
          
          if (durationInSeconds > MAX_VIDEO_DURATION) {
            const minutes = Math.floor(durationInSeconds / 60);
            const seconds = Math.floor(durationInSeconds % 60);
            Alert.alert(
              'Video Too Long',
              `Video duration exceeds the maximum limit of 60 minutes. Your video is ${minutes}:${seconds.toString().padStart(2, '0')} (${minutes} minutes ${seconds} seconds). Please record a shorter video.`,
              [{ text: 'OK' }]
            );
            return;
          }
        }
        
        // Ensure URI is not empty before setting
        if (asset.uri && asset.uri.trim()) {
          setSelectedVideo(asset.uri);
          setSelectedImages([]);
          setPostType('short');
          
          // Get accurate video duration using Audio component
          let actualDuration: number | null = durationInSeconds;
          try {
            const { sound } = await Audio.Sound.createAsync(
              { uri: asset.uri },
              { shouldPlay: false }
            );
            const status = await sound.getStatusAsync();
            if (status.isLoaded && status.durationMillis) {
              actualDuration = status.durationMillis / 1000; // Convert milliseconds to seconds
              logger.debug('Video duration from Audio.Sound.createAsync (camera):', {
                durationMillis: status.durationMillis,
                durationSeconds: actualDuration
              });
            }
            await sound.unloadAsync();
          } catch (videoError) {
            logger.warn('Failed to get video duration from Audio.Sound.createAsync (camera), using asset.duration:', videoError);
            // Fallback to asset.duration if Audio.Sound.createAsync fails
            actualDuration = durationInSeconds;
          }
          
          // Store video duration and auto-match song selection duration (max 60 seconds for shorts)
          // The useEffect will automatically sync song selection duration with video duration
          const MAX_SHORT_DURATION = 60; // Max 60 seconds for shorts
          const shortDuration = actualDuration ? Math.min(actualDuration, MAX_SHORT_DURATION) : MAX_SHORT_DURATION;
          setVideoDuration(shortDuration);
          logger.info('Camera video captured, duration captured:', {
            videoDuration: actualDuration,
            shortDuration: shortDuration
          });
          
          // Reset audio choice and show modal to ask user
          setAudioChoice(null);
          setSelectedSong(null);
          setShowAudioChoiceModal(true);
          
          try {
            const { uri } = await VideoThumbnails.getThumbnailAsync(asset.uri, { time: 1000 });
            if (uri && uri.trim()) {
              setVideoThumbnail(uri);
            } else {
              setVideoThumbnail(null);
            }
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
            // Store location metadata for TripScore v2
            setLocationMetadata({
              hasExifGps: locationResult.hasExifGps,
              takenAt: locationResult.takenAt || null,
              rawSource: locationResult.rawSource
            });
            setIsFromCameraFlow(true); // Camera capture
            logger.debug('Location extraction result for camera video: Found', {
              hasExifGps: locationResult.hasExifGps,
              rawSource: locationResult.rawSource,
              takenAt: locationResult.takenAt
            });
          } else {
            // No location from EXIF - get current location as fallback for Taatom camera
            logger.debug('No EXIF location found, getting current location for Taatom camera video');
            try {
              const currentLocation = await getCurrentLocation();
              if (currentLocation && currentLocation.coords) {
                const coords = {
                  lat: currentLocation.coords.latitude,
                  lng: currentLocation.coords.longitude
                };
                setLocation(coords);
                
                // Get address from current location
                const address = await getAddressFromCoords(coords.lat, coords.lng);
                if (address) {
                  setAddress(address);
                }
                
                // Store metadata - current location is still valid for Taatom camera
                setLocationMetadata({
                  hasExifGps: false, // Not from EXIF, but from current GPS
                  takenAt: new Date(),
                  rawSource: 'exif' // Treat as valid GPS source for camera
                });
                setIsFromCameraFlow(true);
                
                logger.debug('Current location captured for Taatom camera video:', coords);
              } else {
                // No current location available
                setLocationMetadata({
                  hasExifGps: false,
                  takenAt: null,
                  rawSource: 'none'
                });
                setIsFromCameraFlow(true);
                
                Alert.alert(
                  'Location Not Available',
                  'Unable to get your current location. You can manually type the location.',
                  [{ text: 'OK', style: 'default' }]
                );
              }
            } catch (locationError) {
              logger.error('Error getting current location:', locationError);
              setLocationMetadata({
                hasExifGps: false,
                takenAt: null,
                rawSource: 'none'
              });
              setIsFromCameraFlow(true);
              
              Alert.alert(
                'Location Not Available',
                'Unable to get your current location. You can manually type the location.',
                [{ text: 'OK', style: 'default' }]
              );
            }
          }
        } else {
          Alert.alert('Error', 'Invalid video file captured. Please try again.');
        }
      }
    } catch (error: any) {
      logger.error('Error taking video', error);
      Alert.alert('Error', 'Failed to take video. Please try again.');
    }
  };

  // Throttle geocoding to avoid rate limit
  let lastCoords: { lat: number | null; lng: number | null } = {
    lat: null,
    lng: null,
  };
  let lastAddress = "";
  let lastGeocodeTime = 0;
  
  const getLocation = async (): Promise<boolean> => {
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
        return true; // Success
      }
      return false; // No location returned
    } catch (error: any) {
      // Safely extract error message without causing Babel _construct issues
      let errorMessage = 'Location error';
      try {
        if (error && typeof error === 'object') {
          // Handle CodedError and other Expo errors safely
          errorMessage = error.message || error.toString() || 'Location error';
        } else if (typeof error === 'string') {
          errorMessage = error;
        }
      } catch (e) {
        // If error extraction fails, use safe fallback
        errorMessage = 'Location error';
      }
      
      // Log as debug to avoid Babel serialization issues with CodedError
      logger.debug("Error getting location (non-critical):", errorMessage);
      return false; // Failed
    }
  };

  // Wrapper to ensure Formik onSubmit never throws unhandled promise rejections
  // This ensures the promise always resolves, even if handlePost throws an error
  const handlePostWrapper = async (values: PostFormValues, formikBag: any) => {
    try {
      await handlePost(values);
    } catch (error: any) {
      // Error is already handled in handlePost's try/catch, but this ensures
      // no unhandled promise rejection escapes to Formik
      // If error reaches here, it means it wasn't caught by handlePost's try/catch
      logger.error('[PostScreen] Unhandled error in handlePost wrapper (should not happen):', error);
      // Ensure promise resolves (doesn't reject) to prevent unhandled rejection
    }
    // Promise always resolves, never rejects
  };

  const handlePost = async (values: PostFormValues) => {
    // Duplicate submission prevention
    if (isSubmittingRef.current) {
      logger.debug('Post submission blocked: already in progress');
      return;
    }
    
    if (selectedImages.length === 0) {
      Alert.alert("Error", "Please select at least one image first.");
      return;
    }
    if (!user) {
      Alert.alert("Error", "You must be signed in to post.");
      return;
    }
    
    // Set submission guard
    isSubmittingRef.current = true;
    
    // Initialize upload session
    uploadSessionRef.current = {
      isActive: true,
      abortController: new AbortController(),
      lastProgressTime: Date.now()
    };
    
    setIsLoading(true);
    setIsUploading(true);
    setUploadProgress({ current: 0, total: selectedImages.length, percentage: 0 });
    setUploadError(null);
    
    // Progress watchdog: detect stalled uploads
    uploadSessionRef.current.progressWatchdog = setInterval(() => {
      const now = Date.now();
      const timeSinceLastProgress = now - (uploadSessionRef.current.lastProgressTime || now);
      
      if (timeSinceLastProgress > PROGRESS_STALL_THRESHOLD) {
        logger.warn('Upload progress stalled, may need retry');
        // Don't auto-retry, just log warning
        // User can manually retry if needed
      }
    }, PROGRESS_WATCHDOG_INTERVAL);
    
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

      // Determine source for TripScore v2
      // NEW RULE: hasExifGps is true for both EXIF GPS and assetInfo.location
      // Both are treated as verified GPS evidence (medium trust)
      let source: 'taatom_camera_live' | 'gallery_exif' | 'gallery_no_exif' | 'manual_only' = 'manual_only';
      if (isFromCameraFlow) {
        source = 'taatom_camera_live';
      } else if (locationMetadata?.hasExifGps) {
        // hasExifGps is true for both EXIF GPS and assetInfo.location
        source = 'gallery_exif';
      } else if (locationMetadata && location?.lat && location?.lng) {
        // Location exists but not from verified GPS (e.g., manually added)
        source = 'gallery_no_exif';
      } else {
        source = 'manual_only';
      }

      // Sanitize caption before sending (caption is now optional)
      const sanitizedCaption = validateAndSanitizeCaption(values.comment);

      const response = await createPostWithProgress({
        images: imagesData,
        caption: sanitizedCaption || '',
        address: values.placeName || address,
        latitude: location?.lat,
        longitude: location?.lng,
        hasExifGps: locationMetadata?.hasExifGps || false,
        takenAt: locationMetadata?.takenAt || undefined,
        source: source,
        fromCamera: isFromCameraFlow,
        songId: selectedSong?._id,
        songStartTime: songStartTime,
        songEndTime: songEndTime,
        songVolume: 0.5,
        spotType: spotType || undefined,
        travelInfo: travelInfo || undefined,
      }, (progress) => {
        // Update last progress time for watchdog
        uploadSessionRef.current.lastProgressTime = Date.now();
        
        // Calculate overall progress: 50% optimization (already done) + 50% upload
        const uploadProgressPercent = progress / 100; // 0 to 1
        const overallProgress = 50 + (uploadProgressPercent * 50); // 50% to 100%
        
        // Progress reliability: never jump backward, cap at 99% until backend confirms
        setUploadProgress(prev => {
          const newPercentage = Math.min(overallProgress, 99); // Cap at 99% until success
          if (newPercentage < prev.percentage) {
            logger.warn('Progress attempted to go backward, keeping previous value');
            return prev;
          }
          return {
            current: uploadedCount + 1,
            total: totalImages,
            percentage: newPercentage
          };
        });
        
        // If this image is complete, move to next
        if (progress >= 100) {
          uploadedCount++;
        }
      });

      logger.debug('Post created successfully:', response);
      
      // Cleanup progress watchdog
      if (uploadSessionRef.current.progressWatchdog) {
        clearInterval(uploadSessionRef.current.progressWatchdog);
      }
      
      // Set final progress to 100% (backend confirmed success)
      setUploadProgress({
        current: totalImages,
        total: totalImages,
        percentage: 100
      });
      
      // Media memory safety: release references after successful upload
      releaseMediaReferences();
      
      // Clear draft on successful post
      await clearDraft();
      
      // Wait a moment to show 100% progress
      setTimeout(() => {
        clearUploadState();
        
        // Check if post requires verification (pending review)
        const requiresVerification = source === 'gallery_no_exif' || source === 'manual_only';
        
        if (requiresVerification) {
          Alert.alert(
            'Success!', 
            'Your post has been shared.\n\nThis post is under verification. We\'ll notify you shortly.',
            [
              {
                text: 'OK',
                onPress: () => {
                  setSelectedImages([]);
                  setLocation(null);
                  setAddress('');
                  setLocationMetadata(null);
                  setSelectedSong(null);
                  setAudioChoice(null);
                  setSongStartTime(0);
                  setSongEndTime(60);
                  // Update existing posts state
                  setHasExistingPosts(true);
                  router.replace('/(tabs)/home');
                },
              },
            ]
          );
        } else {
          Alert.alert('Success!', 'Your post has been shared.', [
            {
              text: 'OK',
              onPress: () => {
                setSelectedImages([]);
                setLocation(null);
                setAddress('');
                setLocationMetadata(null);
                setSelectedSong(null);
                setAudioChoice(null);
                setSongStartTime(0);
                setSongEndTime(60);
                // Update existing posts state
                setHasExistingPosts(true);
                router.replace('/(tabs)/home');
              },
            },
          ]);
        }
      }, 500);
      
    } catch (error: any) {
      logger.error('Post creation failed', error);
      
      // Check if upload was aborted
      if (error?.name === 'AbortError' || uploadSessionRef.current.abortController?.signal.aborted) {
        logger.debug('Upload was aborted by user');
        return; // Don't show error for user-initiated cancellation
      }
      
      // Extract error message with better error handling
      let errorMessage = 'Upload failed. Please try again.';
      if (error instanceof Error) {
        errorMessage = error.message || errorMessage;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      setUploadError(errorMessage);
      
      // Error & retry UX: show clear error message with retry option
      Alert.alert(
        'Upload failed',
        errorMessage,
        [
          {
            text: 'OK',
            onPress: () => {
              clearUploadState();
            }
          },
          {
            text: 'Retry',
            onPress: () => {
              // Retry with same draft data
              clearUploadState();
              handlePost(values);
            }
          }
        ]
      );
    } finally {
      setIsLoading(false);
      isSubmittingRef.current = false;
    }
  };

  // Wrapper to ensure Formik onSubmit never throws unhandled promise rejections
  // This ensures the promise always resolves, even if handleShort throws an error
  const handleShortWrapper = async (values: ShortFormValues, formikBag: any) => {
    try {
      await handleShort(values);
    } catch (error: any) {
      // Error is already handled in handleShort's try/catch, but this ensures
      // no unhandled promise rejection escapes to Formik
      // If error reaches here, it means it wasn't caught by handleShort's try/catch
      logger.error('[PostScreen] Unhandled error in handleShort wrapper (should not happen):', error);
      // Ensure promise resolves (doesn't reject) to prevent unhandled rejection
    }
    // Promise always resolves, never rejects
  };

  const handleShort = async (values: ShortFormValues) => {
    logger.debug('handleShort called with values:', values);
    logger.debug('selectedVideo:', selectedVideo);
    logger.debug('user:', user);
    
    // Duplicate submission prevention
    if (isSubmittingRef.current) {
      logger.debug('Short submission blocked: already in progress');
      return;
    }
    
    if (!selectedVideo || !selectedVideo.trim()) {
      Alert.alert("Error", "Please select a video first.");
      return;
    }
    if (!user) {
      Alert.alert("Error", "You must be signed in to post.");
      return;
    }
    
    // Set submission guard
    isSubmittingRef.current = true;
    
    // Initialize upload session
    uploadSessionRef.current = {
      isActive: true,
      abortController: new AbortController(),
      lastProgressTime: Date.now()
    };
    
    setIsLoading(true);
    setIsUploading(true);
    setUploadProgress({ current: 0, total: 1, percentage: 0 }); // Initialize with total: 1 for shorts
    setUploadError(null);
    
    // Progress watchdog: detect stalled uploads (more lenient for large files)
    uploadSessionRef.current.progressWatchdog = setInterval(() => {
      const now = Date.now();
      const timeSinceLastProgress = now - (uploadSessionRef.current.lastProgressTime || now);
      
      // For large files, be more lenient - only warn after 60 seconds of no progress
      // Large files may have periods of slow upload due to network conditions
      if (timeSinceLastProgress > PROGRESS_STALL_THRESHOLD) {
        logger.warn(`Upload progress stalled for ${Math.round(timeSinceLastProgress / 1000)} seconds, but continuing...`);
        // Don't abort - large files may have slow periods, just log warning
      }
    }, PROGRESS_WATCHDOG_INTERVAL);
    
    try {
      logger.debug('Creating short with video:', selectedVideo);
      
      // Extract filename from URI
      const filename = selectedVideo.split('/').pop() || 'short_video.mp4';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `video/${match[1]}` : 'video/mp4';

      // Determine source for TripScore v2 (same logic as posts)
      // NEW RULE: hasExifGps is true for both EXIF GPS and assetInfo.location
      // Both are treated as verified GPS evidence (medium trust)
      let source: 'taatom_camera_live' | 'gallery_exif' | 'gallery_no_exif' | 'manual_only' = 'manual_only';
      if (isFromCameraFlow) {
        source = 'taatom_camera_live';
      } else if (locationMetadata?.hasExifGps) {
        // hasExifGps is true for both EXIF GPS and assetInfo.location
        source = 'gallery_exif';
      } else if (locationMetadata && location?.lat && location?.lng) {
        // Location exists but not from verified GPS (e.g., manually added)
        source = 'gallery_no_exif';
      } else {
        source = 'manual_only';
      }

      // Detect audio source for copyright compliance
      // audioSource = "taatom_library" if background music from Taatom is selected
      // audioSource = "user_original" if using original video audio (no Taatom music)
      // CRITICAL: Check if user selected background music AND has a song selected
      const hasBackgroundMusic = audioChoice === 'background' && selectedSong && selectedSong._id;
      const audioSource: 'taatom_library' | 'user_original' = hasBackgroundMusic ? 'taatom_library' : 'user_original';
      
      // Log for debugging
      if (__DEV__) {
        console.log('🎵 [handleShort] Audio source determination:', {
          audioChoice: audioChoice,
          hasSelectedSong: !!selectedSong,
          selectedSongId: selectedSong?._id,
          selectedSongTitle: selectedSong?.title,
          hasBackgroundMusic: hasBackgroundMusic,
          audioSource: audioSource
        });
      }
      logger.info('handleShort - Audio source determination:', {
        audioChoice: audioChoice,
        hasSelectedSong: !!selectedSong,
        selectedSongId: selectedSong?._id,
        hasBackgroundMusic: hasBackgroundMusic,
        audioSource: audioSource
      });

      // If user_original, show copyright confirmation modal
      if (audioSource === 'user_original') {
        // Store upload data to proceed after copyright confirmation
        setPendingShortData({
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
          caption: validateAndSanitizeCaption(values.caption) || '',
          songId: audioChoice === 'background' && selectedSong ? selectedSong._id : undefined,
          songStartTime: audioChoice === 'background' && selectedSong ? songStartTime : undefined,
          songEndTime: audioChoice === 'background' && selectedSong ? songEndTime : undefined,
          songVolume: audioChoice === 'background' && selectedSong ? 1.0 : undefined,
          tags: values.tags.split(',').map(tag => tag.trim()).filter(tag => tag),
          spotType: spotType || undefined,
          travelInfo: travelInfo || undefined,
          address: values.placeName || address,
          latitude: location?.lat,
          longitude: location?.lng,
          hasExifGps: locationMetadata?.hasExifGps || false,
          takenAt: locationMetadata?.takenAt || undefined,
          source: source,
          fromCamera: isFromCameraFlow,
          audioSource: audioSource,
        });
        setShowCopyrightModal(true);
        isSubmittingRef.current = false;
        setIsLoading(false);
        setIsUploading(false);
        return; // Stop here, wait for user confirmation
      }

      // If taatom_library, proceed directly with upload
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
        hasExifGps: locationMetadata?.hasExifGps,
        source: source,
        fromCamera: isFromCameraFlow,
        audioSource: audioSource,
      });

      const shortData = {
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
        caption: validateAndSanitizeCaption(values.caption) || '',
        // CRITICAL BUG FIX: Preserve both audio tracks
        // If background music is selected, send music data with volume 1.0
        // Backend should mix music with original video audio (video at 0.6, music at 1.0)
        // If original only, don't send song data (video audio plays at 1.0)
        // Use hasBackgroundMusic to ensure consistency with audioSource
        // DEFENSIVE: Also check if selectedSong exists and has _id before using it
        songId: (hasBackgroundMusic && selectedSong?._id) ? selectedSong._id : undefined,
        songStartTime: (hasBackgroundMusic && selectedSong?._id) ? songStartTime : undefined,
        songEndTime: (hasBackgroundMusic && selectedSong?._id) ? songEndTime : undefined,
        songVolume: (hasBackgroundMusic && selectedSong?._id) ? 1.0 : undefined, // Music at full volume, video will be at 0.6
        tags: values.tags.split(',').map(tag => tag.trim()).filter(tag => tag),
        spotType: spotType || undefined,
        travelInfo: travelInfo || undefined,
        address: values.placeName || address,
        latitude: location?.lat,
        longitude: location?.lng,
        hasExifGps: locationMetadata?.hasExifGps || false,
        takenAt: locationMetadata?.takenAt || undefined,
        source: source,
        fromCamera: isFromCameraFlow,
        audioSource: audioSource,
        copyrightAccepted: true, // Auto-accepted for taatom_library
        copyrightAcceptedAt: new Date().toISOString(),
      };
      
      // Log data being sent for debugging
      if (__DEV__) {
        console.log('📤 [handleShort] Sending short data:', {
          hasSongId: !!shortData.songId,
          songId: shortData.songId,
          audioSource: shortData.audioSource,
          audioChoice: audioChoice,
          hasSelectedSong: !!selectedSong,
          selectedSongId: selectedSong?._id,
          selectedSongTitle: selectedSong?.title,
          hasBackgroundMusic: hasBackgroundMusic,
          songStartTime: shortData.songStartTime,
          songEndTime: shortData.songEndTime,
          songVolume: shortData.songVolume
        });
      }
      logger.info('handleShort - Sending short data:', {
        hasSongId: !!shortData.songId,
        songId: shortData.songId,
        audioSource: shortData.audioSource,
        audioChoice: audioChoice,
        hasSelectedSong: !!selectedSong,
        selectedSongId: selectedSong?._id,
        selectedSongTitle: selectedSong?.title,
        hasBackgroundMusic: hasBackgroundMusic,
        songStartTime: shortData.songStartTime,
        songEndTime: shortData.songEndTime,
        songVolume: shortData.songVolume
      });
      
      // CRITICAL VALIDATION: Warn if background music is expected but not being sent
      if (audioChoice === 'background' && selectedSong && !shortData.songId) {
        if (__DEV__) {
          console.error('❌ [handleShort] ERROR: Background music selected but songId is missing!', {
            audioChoice,
            selectedSongId: selectedSong._id,
            hasBackgroundMusic,
            shortDataSongId: shortData.songId,
            audioSource: shortData.audioSource
          });
        }
        logger.error('handleShort - ERROR: Background music selected but songId is missing!', {
          audioChoice,
          selectedSongId: selectedSong._id,
          hasBackgroundMusic,
          shortDataSongId: shortData.songId,
          audioSource: shortData.audioSource
        });
      }
      
      // Upload with real-time progress tracking
      const response = await createShortWithProgress(shortData, (progress) => {
        // Update last progress time for watchdog
        if (uploadSessionRef.current) {
          uploadSessionRef.current.lastProgressTime = Date.now();
        }
        
        // Update progress state in real-time
        // Progress is 0-95% during upload, 95-100% during backend processing
        setUploadProgress(prev => {
          const newPercentage = Math.min(progress, 99); // Cap at 99% until success
          // Never go backward
          if (newPercentage < prev.percentage) {
            logger.warn('Progress attempted to go backward, keeping previous value');
            return prev;
          }
          return {
            current: 1,
            total: 1,
            percentage: newPercentage
          };
        });
        
        logger.debug('Short upload progress:', progress + '%');
      });

      logger.debug('Short created successfully:', response);
      
      // Set final progress to 100% (backend confirmed success)
      setUploadProgress({
        current: 1,
        total: 1,
        percentage: 100
      });
      
      // Cleanup progress watchdog
      if (uploadSessionRef.current.progressWatchdog) {
        clearInterval(uploadSessionRef.current.progressWatchdog);
      }
      
      // Wait a moment to show 100% progress before showing success
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Media memory safety: release references after successful upload
      releaseMediaReferences();
      
      // Clear draft on successful post
      await clearDraft();
      
      // Check if short requires verification (pending review)
      const requiresVerification = source === 'gallery_no_exif' || source === 'manual_only';
      
      if (requiresVerification) {
        Alert.alert(
          'Success!', 
          'Your short has been uploaded.\n\nThis post is under verification. We\'ll notify you shortly.',
          [
            {
              text: 'OK',
              onPress: () => {
                clearUploadState();
                setSelectedVideo(null);
                setVideoDuration(null); // Clear video duration when video is removed
                setVideoThumbnail(null);
                setLocation(null);
                setLocationMetadata(null);
                setSelectedSong(null);
                setAudioChoice(null);
                setSongStartTime(0);
                setSongEndTime(60);
                // Update existing shorts state
                setHasExistingShorts(true);
                setAddress('');
                router.replace('/(tabs)/home');
              },
            },
          ]
        );
      } else {
        Alert.alert('Success!', 'Your short has been uploaded.', [
          {
            text: 'OK',
            onPress: () => {
              clearUploadState();
              setSelectedVideo(null);
              setVideoThumbnail(null);
              setLocation(null);
              setLocationMetadata(null);
              setSelectedSong(null);
              setAudioChoice(null);
              setSongStartTime(0);
              setSongEndTime(60);
              // Update existing shorts state
              setHasExistingShorts(true);
              setAddress('');
              router.replace('/(tabs)/home');
            },
          },
        ]);
      }
    } catch (error: any) {
      logger.error('Short creation failed', error);
      
      // Check if upload was aborted
      if (error?.name === 'AbortError' || uploadSessionRef.current.abortController?.signal.aborted) {
        logger.debug('Upload was aborted by user');
        return; // Don't show error for user-initiated cancellation
      }
      
      // Check for timeout errors and provide helpful message
      let errorMessage = error?.message || 'Failed to upload short';
      if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
        errorMessage = 'Upload took too long. This may happen with large files or slow connections. Please check your internet connection and try again.';
      } else if (errorMessage.includes('Network error') || errorMessage.includes('network')) {
        errorMessage = 'Network error occurred. Please check your internet connection and try again.';
      } else if (errorMessage.includes('413') || errorMessage.includes('too large')) {
        errorMessage = 'File is too large. Please try a smaller file or compress the video.';
      }
      
      // Sanitize error message for user display
      const sanitizedError = sanitizeErrorForDisplay({ message: errorMessage } as Error, 'PostUpload');
      setUploadError(sanitizedError);
      
      // Error & retry UX: show clear error message with retry option
      Alert.alert(
        'Upload failed',
        sanitizedError,
        [
          {
            text: 'OK',
            onPress: () => {
              clearUploadState();
            }
          },
          {
            text: 'Retry',
            onPress: () => {
              // Retry with same draft data
              clearUploadState();
              handleShort(values);
            }
          }
        ]
      );
    } finally {
      setIsLoading(false);
      isSubmittingRef.current = false;
    }
  };

  // Handle copyright confirmation - proceed with upload
  const handleCopyrightAgree = async () => {
    if (!pendingShortData) {
      logger.error('[PostScreen] handleCopyrightAgree called but pendingShortData is null');
      return;
    }
    
    setShowCopyrightModal(false);
    setCopyrightAccepted(true);
    
    // Resume upload with copyright acceptance
    try {
      setIsLoading(true);
      setIsUploading(true);
      setUploadProgress({ current: 0, total: 1, percentage: 0 }); // Initialize progress for shorts
      
      // Validate pendingShortData before attempting upload
      if (!pendingShortData.video || !pendingShortData.video.uri) {
        const error = new Error('Video file is missing. Please select a video and try again.');
        // Pass error as second parameter for proper Sentry tracking
        logger.error('[PostScreen] Short creation failed after copyright confirmation - missing video', error, {
          pendingShortData: pendingShortData ? {
            hasVideo: !!pendingShortData.video,
            hasVideoUri: !!pendingShortData.video?.uri,
            videoUri: pendingShortData.video?.uri,
            caption: pendingShortData.caption,
          } : null,
        });
        throw error;
      }
      
      logger.debug('[PostScreen] Proceeding with short creation after copyright confirmation', {
        videoUri: pendingShortData.video.uri,
        hasImage: !!pendingShortData.image,
        caption: pendingShortData.caption,
        audioSource: 'user_original',
      });
      
      // Upload with real-time progress tracking
      const response = await createShortWithProgress({
        ...pendingShortData,
        audioSource: 'user_original',
        copyrightAccepted: true,
        copyrightAcceptedAt: new Date().toISOString(),
      }, (progress) => {
        // Update last progress time for watchdog
        if (uploadSessionRef.current) {
          uploadSessionRef.current.lastProgressTime = Date.now();
        }
        
        // Update progress state in real-time
        setUploadProgress(prev => {
          const newPercentage = Math.min(progress, 99); // Cap at 99% until success
          // Never go backward
          if (newPercentage < prev.percentage) {
            logger.warn('Progress attempted to go backward, keeping previous value');
            return prev;
          }
          return {
            current: 1,
            total: 1,
            percentage: newPercentage
          };
        });
        
        logger.debug('Short upload progress:', progress + '%');
      });

      logger.debug('Short created successfully:', response);
      
      // Set final progress to 100% (backend confirmed success)
      setUploadProgress({
        current: 1,
        total: 1,
        percentage: 100
      });
      
      // Cleanup progress watchdog
      if (uploadSessionRef.current.progressWatchdog) {
        clearInterval(uploadSessionRef.current.progressWatchdog);
      }
      
      // Wait a moment to show 100% progress before showing success
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Media memory safety: release references after successful upload
      releaseMediaReferences();
      
      // Clear draft on successful post
      await clearDraft();
      
      // Check if short requires verification (pending review)
      const requiresVerification = pendingShortData.source === 'gallery_no_exif' || pendingShortData.source === 'manual_only';
      
      if (requiresVerification) {
        Alert.alert(
          'Success!', 
          'Your short has been uploaded.\n\nThis post is under verification. We\'ll notify you shortly.',
          [
            {
              text: 'OK',
              onPress: () => {
                clearUploadState();
                setSelectedVideo(null);
                setVideoDuration(null); // Clear video duration when video is removed
                setVideoThumbnail(null);
                setLocation(null);
                setLocationMetadata(null);
                setSelectedSong(null);
                setAudioChoice(null);
                setSongStartTime(0);
                setSongEndTime(60);
                setPendingShortData(null);
                setCopyrightAccepted(false);
                setHasExistingShorts(true);
                setAddress('');
                router.replace('/(tabs)/home');
              },
            },
          ]
        );
      } else {
        Alert.alert('Success!', 'Your short has been uploaded.', [
          {
            text: 'OK',
            onPress: () => {
              clearUploadState();
              setSelectedVideo(null);
              setVideoThumbnail(null);
              setLocation(null);
              setLocationMetadata(null);
              setSelectedSong(null);
              setAudioChoice(null);
              setSongStartTime(0);
              setSongEndTime(60);
              setPendingShortData(null);
              setCopyrightAccepted(false);
              setHasExistingShorts(true);
              setAddress('');
              router.replace('/(tabs)/home');
            },
          },
        ]);
      }
    } catch (error: any) {
      // Ensure error is an Error instance for proper Sentry tracking
      const errorToLog = error instanceof Error 
        ? error 
        : new Error(error?.message || String(error) || 'Something went wrong. Please try again later.');
      
      // Log full error details before sanitization for debugging
      // Pass error as second parameter (not nested in data object) for proper Sentry tracking
      logger.error('[PostScreen] Short creation failed after copyright confirmation', errorToLog, {
        errorMessage: error?.message,
        errorStack: error?.stack,
        errorName: error?.name,
        pendingShortData: pendingShortData ? {
          hasVideo: !!pendingShortData.video,
          videoUri: pendingShortData.video?.uri,
          videoType: pendingShortData.video?.type,
          videoName: pendingShortData.video?.name,
          hasImage: !!pendingShortData.image,
          caption: pendingShortData.caption,
          audioSource: pendingShortData.audioSource,
        } : null,
      });
      
      // Extract user-friendly error message with better handling for large files
      let errorMessage = 'Upload failed. Please try again.';
      if (error?.message) {
        // Check for specific error types
        if (error.message.includes('timeout') || error.message.includes('Timeout')) {
          errorMessage = 'Upload took too long. This may happen with large files or slow connections. Please check your internet connection and try again.';
        } else if (error.message.includes('Network error') || error.message.includes('network')) {
          errorMessage = 'Network error occurred. Please check your internet connection and try again.';
        } else if (error.message.includes('413') || error.message.includes('too large')) {
          errorMessage = 'File is too large. Please try a smaller file or compress the video.';
        } else if (!error.message.includes('Error:') && !error.message.includes('TypeError') && !error.message.includes('ReferenceError')) {
          // Check if it's already a user-friendly message
          errorMessage = error.message;
        } else {
          // Try to extract meaningful part from technical errors
          const match = error.message.match(/([^:]+)(?::\s*(.+))?$/);
          if (match && match[2]) {
            errorMessage = match[2].trim();
          }
        }
      }
      
      setUploadError(errorMessage);
      Alert.alert(
        'Upload failed',
        errorMessage,
        [
          {
            text: 'OK',
            onPress: () => {
              clearUploadState();
              setPendingShortData(null);
              setCopyrightAccepted(false);
            }
          },
        ]
      );
    } finally {
      setIsLoading(false);
      setIsUploading(false);
      isSubmittingRef.current = false;
    }
  };

  // Handle copyright cancellation
  const handleCopyrightCancel = () => {
    setShowCopyrightModal(false);
    setPendingShortData(null);
    setCopyrightAccepted(false);
    isSubmittingRef.current = false;
    setIsLoading(false);
    setIsUploading(false);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : isWeb ? undefined : 'height'}
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <NavBar title="New Post" />
        <ScrollView 
          style={{ flex: 1, padding: theme.spacing.md }} 
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 80, 100) }}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          nestedScrollEnabled={true}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
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
              resizeMode="cover"
              defaultSource={require('../../assets/avatars/male_avatar.png')}
              onError={(error) => {
                logger.warn('Profile picture load error:', error);
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
              marginTop: theme.spacing.md, 
              marginBottom: theme.spacing.sm,
              paddingVertical: theme.spacing.sm
            }}>
              <View style={{
                width: 120,
                height: 120,
                borderRadius: 60,
                backgroundColor: theme.colors.primary + '15',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: theme.spacing.sm
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
                marginBottom: theme.spacing.xs, 
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
                marginBottom: theme.spacing.sm,
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
              marginTop: theme.spacing.sm,
              marginBottom: theme.spacing.lg,
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
                {/* Elegant Image Preview - Grid Layout for Multiple Images */}
                {selectedImages.length === 1 ? (
                  // Single image - full width, left aligned
                  <View style={{ width: '100%', aspectRatio: 1, borderRadius: theme.borderRadius.xl, overflow: 'hidden' }}>
                    <Image 
                      source={{ uri: selectedImages[0].uri }} 
                      style={{ width: "100%", height: "100%", resizeMode: "cover" }} 
                    />
                  </View>
                ) : selectedImages.length === 2 ? (
                  // 2 images - side by side
                  <View style={{ flexDirection: 'row', gap: theme.spacing.xs, borderRadius: theme.borderRadius.xl, overflow: 'hidden' }}>
                    {selectedImages.map((image, index) => (
                      <View key={index} style={{ flex: 1, aspectRatio: 1 }}>
                        <Image 
                          source={{ uri: image.uri }} 
                          style={{ width: "100%", height: "100%", resizeMode: "cover" }} 
                        />
                      </View>
                    ))}
                  </View>
                ) : selectedImages.length === 3 ? (
                  // 3 images - 2 on top, 1 on bottom
                  <View style={{ borderRadius: theme.borderRadius.xl, overflow: 'hidden' }}>
                    <View style={{ flexDirection: 'row', gap: theme.spacing.xs, marginBottom: theme.spacing.xs }}>
                      {selectedImages.slice(0, 2).map((image, index) => (
                        <View key={index} style={{ flex: 1, aspectRatio: 1 }}>
                          <Image 
                            source={{ uri: image.uri }} 
                            style={{ width: "100%", height: "100%", resizeMode: "cover" }} 
                          />
                        </View>
                      ))}
                    </View>
                    <View style={{ aspectRatio: 2 }}>
                      <Image 
                        source={{ uri: selectedImages[2].uri }} 
                        style={{ width: "100%", height: "100%", resizeMode: "cover" }} 
                      />
                    </View>
                  </View>
                ) : selectedImages.length === 4 ? (
                  // 4 images - 2x2 grid
                  <View style={{ borderRadius: theme.borderRadius.xl, overflow: 'hidden' }}>
                    <View style={{ flexDirection: 'row', gap: theme.spacing.xs, marginBottom: theme.spacing.xs }}>
                      {selectedImages.slice(0, 2).map((image, index) => (
                        <View key={index} style={{ flex: 1, aspectRatio: 1 }}>
                          <Image 
                            source={{ uri: image.uri }} 
                            style={{ width: "100%", height: "100%", resizeMode: "cover" }} 
                          />
                        </View>
                      ))}
                    </View>
                    <View style={{ flexDirection: 'row', gap: theme.spacing.xs }}>
                      {selectedImages.slice(2, 4).map((image, index) => (
                        <View key={index} style={{ flex: 1, aspectRatio: 1 }}>
                          <Image 
                            source={{ uri: image.uri }} 
                            style={{ width: "100%", height: "100%", resizeMode: "cover" }} 
                          />
                        </View>
                      ))}
                    </View>
                  </View>
                ) : (
                  // 5-10 images - elegant grid with scrollable preview
                  <View>
                    <View style={{ borderRadius: theme.borderRadius.xl, overflow: 'hidden' }}>
                      {/* First row: 2 large images */}
                      <View style={{ flexDirection: 'row', gap: theme.spacing.xs, marginBottom: theme.spacing.xs }}>
                        {selectedImages.slice(0, 2).map((image, index) => (
                          <View key={index} style={{ flex: 1, aspectRatio: 1 }}>
                            <Image 
                              source={{ uri: image.uri }} 
                              style={{ width: "100%", height: "100%", resizeMode: "cover" }} 
                            />
                          </View>
                        ))}
                      </View>
                      {/* Second row: 3 smaller images or remaining images */}
                      <View style={{ flexDirection: 'row', gap: theme.spacing.xs }}>
                        {selectedImages.slice(2, 5).map((image, index) => (
                          <View key={index} style={{ flex: 1, aspectRatio: 1 }}>
                            <Image 
                              source={{ uri: image.uri }} 
                              style={{ width: "100%", height: "100%", resizeMode: "cover" }} 
                            />
                            {index === 2 && selectedImages.length > 5 && (
                              // Overlay for "+X more" indicator
                              <View style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                backgroundColor: 'rgba(0,0,0,0.5)',
                                justifyContent: 'center',
                                alignItems: 'center'
                              }}>
                                <Text style={{ color: 'white', fontSize: theme.typography.h3.fontSize, fontWeight: '700' }}>
                                  +{selectedImages.length - 5}
                                </Text>
                              </View>
                            )}
                          </View>
                        ))}
                      </View>
                    </View>
                    {/* Horizontal scrollable view for all images */}
                    <ScrollView 
                      horizontal 
                      showsHorizontalScrollIndicator={false}
                      style={{ marginTop: theme.spacing.sm }}
                      contentContainerStyle={{ gap: theme.spacing.xs, paddingRight: theme.spacing.md }}
                    >
                      {selectedImages.map((image, index) => (
                        <View key={index} style={{ width: 80, height: 80, borderRadius: theme.borderRadius.md, overflow: 'hidden', marginRight: theme.spacing.xs }}>
                          <Image 
                            source={{ uri: image.uri }} 
                            style={{ width: "100%", height: "100%", resizeMode: "cover" }} 
                          />
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                )}
                
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
            ) : selectedVideo && selectedVideo.trim() ? (
              <View>
                {/* Video preview */}
                <View style={{ width: "100%", height: 300, borderRadius: theme.borderRadius.lg, overflow: 'hidden', backgroundColor: theme.colors.surface }}>
                  <Video
                    source={{ uri: selectedVideo }}
                    style={{ width: '100%', height: '100%' }}
                    useNativeControls
                    resizeMode={ResizeMode.CONTAIN}
                    // CRITICAL BUG FIX: Preserve original video audio when music is added
                    // Dual-audio mixing: video audio at 60% volume, music will overlay at 100%
                    isMuted={false}
                    volume={audioChoice === 'background' && selectedSong ? 0.6 : 1.0}
                  />
                </View>
                {/* Thumbnail preview below */}
                <View style={{ marginTop: theme.spacing.sm }}>
                  {videoThumbnail && videoThumbnail.trim() ? (
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
                      const pick = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [9, 16], quality: 0.9 });
                      if (!pick.canceled && pick.assets?.[0] && pick.assets[0].uri && pick.assets[0].uri.trim()) {
                        setVideoThumbnail(pick.assets[0].uri);
                      } else {
                        setVideoThumbnail(null);
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
                onSubmit={handlePostWrapper}
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
                          <Text style={{ fontSize: theme.typography.h3.fontSize, fontWeight: "700", color: theme.colors.text }}>Caption</Text>
                          <Text style={{ fontSize: theme.typography.small.fontSize, color: theme.colors.textSecondary, marginLeft: theme.spacing.xs }}>(Optional)</Text>
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
                    {location && (
                      <View style={{ 
                        backgroundColor: theme.colors.primary + '10', 
                        borderRadius: theme.borderRadius.md, 
                        padding: theme.spacing.sm, 
                        marginBottom: theme.spacing.md,
                        flexDirection: 'row',
                        alignItems: 'flex-start'
                      }}>
                        <Ionicons name="information-circle-outline" size={16} color={theme.colors.primary} style={{ marginRight: theme.spacing.xs, marginTop: 2 }} />
                        <Text style={{ 
                          color: theme.colors.textSecondary, 
                          fontSize: theme.typography.small.fontSize,
                          flex: 1,
                          lineHeight: 18
                        }}>
                          Use original camera photos (not WhatsApp/downloaded images) with location enabled so Taatom can verify your trip and count it in TripScore.
                        </Text>
                      </View>
                    )}
                    {/* TripScore Metadata Dropdowns for Photos - Always Available */}
                    <View style={{ marginBottom: theme.spacing.md }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.sm }}>
                        <View style={{
                          width: 32,
                          height: 32,
                          borderRadius: 16,
                          backgroundColor: theme.colors.primary + '15',
                          justifyContent: 'center',
                          alignItems: 'center',
                          marginRight: theme.spacing.xs
                        }}>
                          <Ionicons name="leaf" size={18} color={theme.colors.primary} />
                        </View>
                        <Text style={{ fontSize: theme.typography.h3.fontSize, fontWeight: "700", color: theme.colors.text }}>Spot Type</Text>
                        <Text style={{ fontSize: theme.typography.small.fontSize, color: theme.colors.textSecondary, marginLeft: theme.spacing.xs }}>(Optional)</Text>
                      </View>
                      <TouchableOpacity
                        style={{ 
                          backgroundColor: theme.colors.surface, 
                          borderRadius: theme.borderRadius.lg, 
                          borderWidth: 2, 
                          borderColor: spotType ? theme.colors.primary : theme.colors.border,
                          paddingHorizontal: theme.spacing.lg,
                          paddingVertical: theme.spacing.md,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          ...theme.shadows.small
                        }}
                        onPress={() => setShowSpotTypePicker(true)}
                        activeOpacity={0.7}
                      >
                        <Text style={{ 
                          color: spotType ? theme.colors.text : theme.colors.textSecondary, 
                          fontSize: theme.typography.body.fontSize,
                          fontWeight: spotType ? '600' : '400'
                        }}>
                          {spotType || 'Select Spot Type'}
                        </Text>
                        <Ionicons 
                          name="chevron-down" 
                          size={20} 
                          color={spotType ? theme.colors.primary : theme.colors.textSecondary} 
                        />
                      </TouchableOpacity>
                    </View>
                    <View style={{ marginBottom: theme.spacing.md }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.sm }}>
                        <View style={{
                          width: 32,
                          height: 32,
                          borderRadius: 16,
                          backgroundColor: theme.colors.primary + '15',
                          justifyContent: 'center',
                          alignItems: 'center',
                          marginRight: theme.spacing.xs
                        }}>
                          <Ionicons name="car" size={18} color={theme.colors.primary} />
                        </View>
                        <Text style={{ fontSize: theme.typography.h3.fontSize, fontWeight: "700", color: theme.colors.text }}>Travel Info</Text>
                        <Text style={{ fontSize: theme.typography.small.fontSize, color: theme.colors.textSecondary, marginLeft: theme.spacing.xs }}>(Optional)</Text>
                      </View>
                      <TouchableOpacity
                        style={{ 
                          backgroundColor: theme.colors.surface, 
                          borderRadius: theme.borderRadius.lg, 
                          borderWidth: 2, 
                          borderColor: travelInfo ? theme.colors.primary : theme.colors.border,
                          paddingHorizontal: theme.spacing.lg,
                          paddingVertical: theme.spacing.md,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          ...theme.shadows.small
                        }}
                        onPress={() => setShowTravelInfoPicker(true)}
                        activeOpacity={0.7}
                      >
                        <Text style={{ 
                          color: travelInfo ? theme.colors.text : theme.colors.textSecondary, 
                          fontSize: theme.typography.body.fontSize,
                          fontWeight: travelInfo ? '600' : '400'
                        }}>
                          {travelInfo || 'Select Travel Method'}
                        </Text>
                        <Ionicons 
                          name="chevron-down" 
                          size={20} 
                          color={travelInfo ? theme.colors.primary : theme.colors.textSecondary} 
                        />
                      </TouchableOpacity>
                    </View>
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
                      onPress={() => {
                        if (selectedVideo) {
                          // Convert photo form values to short form values
                          handleShort({
                            caption: (values as any).comment || (values as any).caption || '',
                            tags: values.tags || '',
                            placeName: values.placeName || '',
                          });
                        } else {
                          handleSubmit();
                        }
                      }}
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
                onSubmit={handleShortWrapper}
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
                          <Text style={{ fontSize: theme.typography.small.fontSize, color: theme.colors.textSecondary, marginLeft: theme.spacing.xs }}>(Optional)</Text>
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
                        marginBottom: theme.spacing.md,
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
                    {/* TripScore Metadata Dropdowns for Shorts - Always Available */}
                    <View style={{ marginBottom: theme.spacing.md }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.sm }}>
                        <View style={{
                          width: 32,
                          height: 32,
                          borderRadius: 16,
                          backgroundColor: theme.colors.primary + '15',
                          justifyContent: 'center',
                          alignItems: 'center',
                          marginRight: theme.spacing.xs
                        }}>
                          <Ionicons name="leaf" size={18} color={theme.colors.primary} />
                        </View>
                        <Text style={{ fontSize: theme.typography.h3.fontSize, fontWeight: "700", color: theme.colors.text }}>Spot Type</Text>
                        <Text style={{ fontSize: theme.typography.small.fontSize, color: theme.colors.textSecondary, marginLeft: theme.spacing.xs }}>(Optional)</Text>
                      </View>
                      <TouchableOpacity
                        style={{ 
                          backgroundColor: theme.colors.surface, 
                          borderRadius: theme.borderRadius.lg, 
                          borderWidth: 2, 
                          borderColor: spotType ? theme.colors.primary : theme.colors.border,
                          paddingHorizontal: theme.spacing.lg,
                          paddingVertical: theme.spacing.md,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          ...theme.shadows.small
                        }}
                        onPress={() => setShowSpotTypePicker(true)}
                        activeOpacity={0.7}
                      >
                        <Text style={{ 
                          color: spotType ? theme.colors.text : theme.colors.textSecondary, 
                          fontSize: theme.typography.body.fontSize,
                          fontWeight: spotType ? '600' : '400'
                        }}>
                          {spotType || 'Select Spot Type'}
                        </Text>
                        <Ionicons 
                          name="chevron-down" 
                          size={20} 
                          color={spotType ? theme.colors.primary : theme.colors.textSecondary} 
                        />
                      </TouchableOpacity>
                    </View>
                    <View style={{ marginBottom: theme.spacing.md }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.sm }}>
                        <View style={{
                          width: 32,
                          height: 32,
                          borderRadius: 16,
                          backgroundColor: theme.colors.primary + '15',
                          justifyContent: 'center',
                          alignItems: 'center',
                          marginRight: theme.spacing.xs
                        }}>
                          <Ionicons name="car" size={18} color={theme.colors.primary} />
                        </View>
                        <Text style={{ fontSize: theme.typography.h3.fontSize, fontWeight: "700", color: theme.colors.text }}>Travel Info</Text>
                        <Text style={{ fontSize: theme.typography.small.fontSize, color: theme.colors.textSecondary, marginLeft: theme.spacing.xs }}>(Optional)</Text>
                      </View>
                      <TouchableOpacity
                        style={{ 
                          backgroundColor: theme.colors.surface, 
                          borderRadius: theme.borderRadius.lg, 
                          borderWidth: 2, 
                          borderColor: travelInfo ? theme.colors.primary : theme.colors.border,
                          paddingHorizontal: theme.spacing.lg,
                          paddingVertical: theme.spacing.md,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          ...theme.shadows.small
                        }}
                        onPress={() => setShowTravelInfoPicker(true)}
                        activeOpacity={0.7}
                      >
                        <Text style={{ 
                          color: travelInfo ? theme.colors.text : theme.colors.textSecondary, 
                          fontSize: theme.typography.body.fontSize,
                          fontWeight: travelInfo ? '600' : '400'
                        }}>
                          {travelInfo || 'Select Travel Method'}
                        </Text>
                        <Ionicons 
                          name="chevron-down" 
                          size={20} 
                          color={travelInfo ? theme.colors.primary : theme.colors.textSecondary} 
                        />
                      </TouchableOpacity>
                    </View>
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
        message={postType === 'short' 
          ? `Uploading short... ${Math.round(uploadProgress.percentage || 0)}%`
          : uploadProgress.total > 1 
          ? `Uploading image ${uploadProgress.current} of ${uploadProgress.total}...`
          : "Please wait while your media is being uploaded..."}
        progress={uploadProgress.percentage || 0}
        type="upload"
        showCancel={true}
        onCancel={() => {
          setIsUploading(false);
          setUploadProgress({ current: 0, total: 0, percentage: 0 });
          setIsLoading(false);
          // Abort upload if in progress
          if (uploadSessionRef.current?.abortController) {
            uploadSessionRef.current.abortController.abort();
          }
        }}
      />

      {/* Spot Type Picker Modal - Compact Elegant UI */}
      <Modal
        visible={showSpotTypePicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowSpotTypePicker(false)}
        statusBarTranslucent={true}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
          activeOpacity={1}
          onPress={() => setShowSpotTypePicker(false)}
        >
          <TouchableOpacity 
            activeOpacity={1} 
            onPress={(e) => e.stopPropagation()}
            style={{ width: '100%', marginBottom: 0 }}
          >
            <View style={{ 
              backgroundColor: theme.colors.surface, 
              borderTopLeftRadius: 20, 
              borderTopRightRadius: 20,
              borderBottomLeftRadius: 0,
              borderBottomRightRadius: 0,
              paddingTop: theme.spacing.sm,
              paddingBottom: 0,
              marginBottom: 0,
              maxHeight: '70%',
              ...theme.shadows.large
            }}>
              {/* Drag Handle */}
              <View style={{ 
                alignSelf: 'center',
                width: 36,
                height: 3,
                borderRadius: 2,
                backgroundColor: theme.colors.border,
                marginBottom: theme.spacing.md,
                marginTop: theme.spacing.xs
              }} />
              
              {/* Header */}
              <View style={{ 
                flexDirection: 'row', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                paddingHorizontal: theme.spacing.md, 
                marginBottom: theme.spacing.md
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <View style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: theme.colors.primary + '15',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: theme.spacing.sm
                  }}>
                    <Ionicons name="leaf" size={16} color={theme.colors.primary} />
                  </View>
                  <Text style={{ 
                    fontSize: theme.typography.h3.fontSize, 
                    fontWeight: '700', 
                    color: theme.colors.text,
                    letterSpacing: 0.2
                  }}>
                    Select Spot Type
                  </Text>
                </View>
                <TouchableOpacity 
                  onPress={() => setShowSpotTypePicker(false)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: theme.colors.surfaceSecondary,
                    justifyContent: 'center',
                    alignItems: 'center'
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={16} color={theme.colors.text} />
                </TouchableOpacity>
              </View>
              
              {/* Options List */}
              <ScrollView 
                showsVerticalScrollIndicator={false}
                style={{ paddingHorizontal: theme.spacing.md }}
                contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + theme.spacing.lg, theme.spacing.xl) }}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
              >
                {[
                  { value: '', label: 'None', icon: 'remove-circle-outline' },
                  { value: 'Beach', label: 'Beach', icon: 'sunny-outline' },
                  { value: 'Mountain', label: 'Mountain', icon: 'triangle-outline' },
                  { value: 'City', label: 'City', icon: 'business-outline' },
                  { value: 'Natural spots', label: 'Natural Spots', icon: 'leaf-outline' },
                  { value: 'Religious', label: 'Religious', icon: 'star-outline' },
                  { value: 'Cultural', label: 'Cultural', icon: 'library-outline' },
                  { value: 'General', label: 'General', icon: 'location-outline' }
                ].map((item) => (
                  <TouchableOpacity
                    key={item.value}
                    style={{
                      paddingHorizontal: theme.spacing.md,
                      paddingVertical: theme.spacing.sm,
                      marginBottom: theme.spacing.xs,
                      borderRadius: theme.borderRadius.md,
                      backgroundColor: spotType === item.value 
                        ? theme.colors.primary + '15' 
                        : theme.colors.surfaceSecondary,
                      borderWidth: spotType === item.value ? 1.5 : 0,
                      borderColor: spotType === item.value 
                        ? theme.colors.primary 
                        : 'transparent',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      minHeight: 44,
                      ...(spotType === item.value && theme.shadows.small)
                    }}
                    onPress={() => {
                      setSpotType(item.value);
                      setShowSpotTypePicker(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <View style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        backgroundColor: spotType === item.value 
                          ? theme.colors.primary + '20'
                          : theme.colors.background,
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginRight: theme.spacing.sm
                      }}>
                        <Ionicons 
                          name={item.icon as any} 
                          size={18} 
                          color={spotType === item.value ? theme.colors.primary : theme.colors.textSecondary}
                        />
                      </View>
                      <Text style={{ 
                        color: spotType === item.value ? theme.colors.primary : theme.colors.text, 
                        fontSize: theme.typography.body.fontSize,
                        fontWeight: spotType === item.value ? '600' : '500',
                        letterSpacing: 0.1
                      }}>
                        {item.label}
                      </Text>
                    </View>
                    {spotType === item.value && (
                      <View style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        backgroundColor: theme.colors.primary,
                        justifyContent: 'center',
                        alignItems: 'center'
                      }}>
                        <Ionicons name="checkmark" size={14} color="white" />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Travel Info Picker Modal - Compact Elegant UI */}
      <Modal
        visible={showTravelInfoPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowTravelInfoPicker(false)}
        statusBarTranslucent={true}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
          activeOpacity={1}
          onPress={() => setShowTravelInfoPicker(false)}
        >
          <TouchableOpacity 
            activeOpacity={1} 
            onPress={(e) => e.stopPropagation()}
            style={{ width: '100%', marginBottom: 0 }}
          >
            <View style={{ 
              backgroundColor: theme.colors.surface, 
              borderTopLeftRadius: 20, 
              borderTopRightRadius: 20,
              borderBottomLeftRadius: 0,
              borderBottomRightRadius: 0,
              paddingTop: theme.spacing.sm,
              paddingBottom: 0,
              marginBottom: 0,
              maxHeight: '70%',
              ...theme.shadows.large
            }}>
              {/* Drag Handle */}
              <View style={{ 
                alignSelf: 'center',
                width: 36,
                height: 3,
                borderRadius: 2,
                backgroundColor: theme.colors.border,
                marginBottom: theme.spacing.md,
                marginTop: theme.spacing.xs
              }} />
              
              {/* Header */}
              <View style={{ 
                flexDirection: 'row', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                paddingHorizontal: theme.spacing.md, 
                marginBottom: theme.spacing.md
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <View style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: theme.colors.primary + '15',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: theme.spacing.sm
                  }}>
                    <Ionicons name="car" size={16} color={theme.colors.primary} />
                  </View>
                  <Text style={{ 
                    fontSize: theme.typography.h3.fontSize, 
                    fontWeight: '700', 
                    color: theme.colors.text,
                    letterSpacing: 0.2
                  }}>
                    Select Travel Method
                  </Text>
                </View>
                <TouchableOpacity 
                  onPress={() => setShowTravelInfoPicker(false)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: theme.colors.surfaceSecondary,
                    justifyContent: 'center',
                    alignItems: 'center'
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={16} color={theme.colors.text} />
                </TouchableOpacity>
              </View>
              
              {/* Options List */}
              <ScrollView 
                showsVerticalScrollIndicator={false}
                style={{ paddingHorizontal: theme.spacing.md }}
                contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + theme.spacing.lg, theme.spacing.xl) }}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
              >
                {[
                  { value: '', label: 'None', icon: 'remove-circle-outline' },
                  { value: 'Drivable', label: 'Drivable', icon: 'car-outline' },
                  { value: 'Hiking', label: 'Hiking', icon: 'walk-outline' },
                  { value: 'Water Transport', label: 'Water Transport', icon: 'boat-outline' },
                  { value: 'Flight', label: 'Flight', icon: 'airplane-outline' },
                  { value: 'Train', label: 'Train', icon: 'train-outline' }
                ].map((item) => (
                  <TouchableOpacity
                    key={item.value}
                    style={{
                      paddingHorizontal: theme.spacing.md,
                      paddingVertical: theme.spacing.sm,
                      marginBottom: theme.spacing.xs,
                      borderRadius: theme.borderRadius.md,
                      backgroundColor: travelInfo === item.value 
                        ? theme.colors.primary + '15' 
                        : theme.colors.surfaceSecondary,
                      borderWidth: travelInfo === item.value ? 1.5 : 0,
                      borderColor: travelInfo === item.value 
                        ? theme.colors.primary 
                        : 'transparent',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      minHeight: 44,
                      ...(travelInfo === item.value && theme.shadows.small)
                    }}
                    onPress={() => {
                      setTravelInfo(item.value);
                      setShowTravelInfoPicker(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <View style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        backgroundColor: travelInfo === item.value 
                          ? theme.colors.primary + '20'
                          : theme.colors.background,
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginRight: theme.spacing.sm
                      }}>
                        <Ionicons 
                          name={item.icon as any} 
                          size={18} 
                          color={travelInfo === item.value ? theme.colors.primary : theme.colors.textSecondary}
                        />
                      </View>
                      <Text style={{ 
                        color: travelInfo === item.value ? theme.colors.primary : theme.colors.text, 
                        fontSize: theme.typography.body.fontSize,
                        fontWeight: travelInfo === item.value ? '600' : '500',
                        letterSpacing: 0.1
                      }}>
                        {item.label}
                      </Text>
                    </View>
                    {travelInfo === item.value && (
                      <View style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        backgroundColor: theme.colors.primary,
                        justifyContent: 'center',
                        alignItems: 'center'
                      }}>
                        <Ionicons name="checkmark" size={14} color="white" />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

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
                setVideoDuration(null); // Clear video duration when video is removed
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
          // CRITICAL FIX: Use ref to prevent race condition
          // If a song was just selected, don't reset audioChoice
          if (!songJustSelectedRef.current) {
            // User closed modal without selecting - reset audio choice
            if (!selectedSong) {
              setAudioChoice(null);
            }
          } else {
            // Song was just selected, reset the ref
            songJustSelectedRef.current = false;
          }
          setShowSongSelector(false);
        }}
        onSelect={(song, startTime, endTime) => {
          if (__DEV__) {
            console.log('🎵 [SongSelector] onSelect called:', {
              hasSong: !!song,
              songId: song?._id,
              songTitle: song?.title,
              startTime: startTime,
              endTime: endTime
            });
          }
          
          // CRITICAL: Update state in the correct order to avoid race conditions
          // First, update selectedSong and audioChoice together
          if (song && startTime !== undefined && endTime !== undefined) {
            // Mark that a song was just selected to prevent onClose from resetting
            songJustSelectedRef.current = true;
            
            // When a song is selected, set audioChoice to 'background'
            // This ensures audioSource will be 'taatom_library' when uploading
            setSelectedSong(song);
            setAudioChoice('background'); // CRITICAL: Set this BEFORE closing modal
            setSongStartTime(startTime);
            setSongEndTime(endTime);
            if (__DEV__) {
              console.log('✅ [SongSelector] Song selected, audioChoice set to background:', {
                songId: song._id,
                title: song.title,
                audioChoice: 'background',
                startTime: startTime,
                endTime: endTime
              });
            }
            logger.info('SongSelector - Song selected:', {
              songId: song._id,
              title: song.title,
              audioChoice: 'background'
            });
          } else if (!song) {
            // When song is removed, reset everything
            songJustSelectedRef.current = false;
            setSelectedSong(null);
            setAudioChoice(null);
            setSongStartTime(0);
            setSongEndTime(60);
            if (__DEV__) {
              console.log('🔄 [SongSelector] Song removed, audioChoice reset to null');
            }
            logger.info('SongSelector - Song removed, audioChoice reset to null');
          }
          
          // Close modal AFTER state updates
          setShowSongSelector(false);
        }}
        selectedSong={selectedSong}
        selectedStartTime={songStartTime}
        selectedEndTime={songEndTime}
        videoDuration={videoDuration} // Pass video duration to auto-match song selection
      />

        {/* Copyright Confirmation Modal */}
        <CopyrightConfirmationModal
          visible={showCopyrightModal}
          onCancel={handleCopyrightCancel}
          onAgree={handleCopyrightAgree}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

/* (Removed duplicate implementation of PostScreen and related duplicate code) */

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: isTablet ? theme.spacing.xl : 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: isTablet ? 500 : 400,
    borderRadius: isTablet ? theme.borderRadius.xl : 24,
    padding: isTablet ? theme.spacing.xxl : 28,
    ...(isWeb && {
      maxWidth: isTablet ? 600 : 500,
    } as any),
  },
  modalTitle: {
    fontSize: isTablet ? theme.typography.h1.fontSize : 24,
    fontFamily: getFontFamily('800'),
    fontWeight: '800',
    marginBottom: isTablet ? theme.spacing.sm : 8,
    textAlign: 'center',
    letterSpacing: isIOS ? -0.5 : 0,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  modalDescription: {
    fontSize: isTablet ? theme.typography.body.fontSize + 1 : 15,
    fontFamily: getFontFamily('400'),
    marginBottom: isTablet ? theme.spacing.sm : 8,
    textAlign: 'center',
    lineHeight: isTablet ? 26 : 22,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  audioChoiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: isTablet ? theme.spacing.xl : 20,
    borderRadius: isTablet ? theme.borderRadius.lg : 16,
    marginBottom: isTablet ? theme.spacing.lg : 16,
    ...(isWeb && {
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    } as any),
  },
  audioChoiceTextContainer: {
    flex: 1,
  },
  audioChoiceTitle: {
    fontSize: isTablet ? theme.typography.body.fontSize + 3 : 17,
    fontFamily: getFontFamily('700'),
    fontWeight: '700',
    color: 'white',
    marginBottom: isTablet ? 8 : 6,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  audioChoiceSubtitle: {
    fontSize: isTablet ? theme.typography.body.fontSize : 13,
    fontFamily: getFontFamily('400'),
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: isTablet ? 22 : 18,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  modalCancelButton: {
    padding: isTablet ? theme.spacing.lg : 16,
    borderRadius: isTablet ? theme.borderRadius.lg : 16,
    borderWidth: 1.5,
    alignItems: 'center',
    ...(isWeb && {
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    } as any),
  },
  modalCancelText: {
    fontSize: isTablet ? theme.typography.body.fontSize + 2 : 16,
    fontFamily: getFontFamily('700'),
    fontWeight: '700',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
});
