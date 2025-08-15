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
} from "react-native";
import { Formik } from "formik";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "../../context/ThemeContext";
import  NavBar from "../../components/NavBar";
import { postSchema } from "../../utils/validation";
import { getCurrentLocation, getAddressFromCoords } from "../../utils/geo";
import { createPost } from "../../services/posts";
import { getUserFromStorage } from "../../services/auth";
import { UserType } from "../../types/user";


interface PostFormValues {
  comment: string;
  placeName: string;
}

export default function PostScreen() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<UserType | null>(null);
  const router = useRouter();
  const { theme } = useTheme();

  // Get user from storage
  useEffect(() => {
    const loadUser = async () => {
      const userData = await getUserFromStorage();
      setUser(userData);
      console.log('PostScreen: User loaded:', userData);
    };
    loadUser();
  }, []);

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
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) {
      setSelectedImage(result.assets[0].uri);
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
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) {
      setSelectedImage(result.assets[0].uri);
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
    try {
      console.log('Creating post with image:', selectedImage);
      
      // Extract filename from URI
      const filename = selectedImage.split('/').pop() || 'post_image.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      const response = await createPost({
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

      console.log('Post created successfully:', response);
      
      Alert.alert('Success!', 'Your post has been shared.', [
        {
          text: 'OK',
          onPress: () => {
            setSelectedImage(null);
            setLocation(null);
            setAddress('');
            router.replace('/(tabs)/home');
          },
        },
      ]);
    } catch (error: any) {
      console.error('Post creation failed:', error);
      Alert.alert('Upload failed', error?.message || 'Please try again later.');
    } finally {
      setIsLoading(false);
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
        {!selectedImage ? (
          <>
            <View style={{ alignItems: 'center', marginTop: theme.spacing.xl, marginBottom: theme.spacing.xl }}>
              <Ionicons name="image-outline" size={80} color={theme.colors.textSecondary} style={{ marginBottom: theme.spacing.md }} />
              <Ionicons name="cloud-upload-outline" size={60} color={theme.colors.primary} style={{ marginBottom: theme.spacing.md }} />
              <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.h2.fontSize, fontWeight: '700', marginBottom: theme.spacing.sm, textAlign: 'center' }}>
                No Post Yet
              </Text>
              <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.body.fontSize, textAlign: 'center', marginBottom: theme.spacing.lg }}>
                Share your first moment by uploading a photo or taking one now!
              </Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-around", marginVertical: theme.spacing.xl }}>
              <TouchableOpacity style={{ alignItems: "center", backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.lg, padding: theme.spacing.lg, width: "45%", ...theme.shadows.medium }} onPress={pickImage}>
                <Ionicons name="images" size={48} color={theme.colors.primary} />
                <Text style={{ color: theme.colors.text, fontSize: theme.typography.body.fontSize, marginTop: theme.spacing.sm, textAlign: "center" }}>Choose from Library</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ alignItems: "center", backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.lg, padding: theme.spacing.lg, width: "45%", ...theme.shadows.medium }} onPress={takePhoto}>
                <Ionicons name="camera" size={48} color={theme.colors.primary} />
                <Text style={{ color: theme.colors.text, fontSize: theme.typography.body.fontSize, marginTop: theme.spacing.sm, textAlign: "center" }}>Take Photo</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={{ position: "relative", marginVertical: theme.spacing.md }}>
            <Image source={{ uri: selectedImage }} style={{ width: "100%", height: 300, borderRadius: theme.borderRadius.lg, resizeMode: "cover" }} />
            <TouchableOpacity style={{ position: "absolute", top: theme.spacing.sm, right: theme.spacing.sm, backgroundColor: theme.colors.background, borderRadius: 16 }} onPress={() => { setSelectedImage(null); setLocation(null); setAddress(""); }}>
              <Ionicons name="close-circle" size={32} color={theme.colors.error} />
            </TouchableOpacity>
          </View>
        )}
        {selectedImage && (
          <View style={{ backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.lg, padding: theme.spacing.lg, marginTop: theme.spacing.md, ...theme.shadows.medium }}>
            <Formik
              initialValues={{ comment: "", placeName: "" }}
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
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/* (Removed duplicate implementation of PostScreen and related duplicate code) */

// styles removed, now handled inline with theme context
