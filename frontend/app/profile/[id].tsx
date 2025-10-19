import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Image, StyleSheet, ActivityIndicator, TouchableOpacity, FlatList, SafeAreaView, Modal } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import api from '../../services/api';
import WorldMap from '../../components/WorldMap';
import PhotoCard from '../../components/PhotoCard';
import CustomAlert from '../../components/CustomAlert';
import Constants from 'expo-constants';

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams();
  const { theme } = useTheme();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showWorldMap, setShowWorldMap] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    type: 'info' as 'info' | 'success' | 'warning' | 'error',
  });
  // Remove selectedPost and modal logic

  // Use expoConfig for SDK 49+, fallback to manifest for older
  const GOOGLE_MAPS_API_KEY = Constants.expoConfig?.extra?.GOOGLE_MAPS_API_KEY || Constants.manifest?.extra?.GOOGLE_MAPS_API_KEY;

  const showAlert = (message: string, title?: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    setAlertConfig({ title: title || '', message, type });
    setAlertVisible(true);
  };

  const showError = (message: string, title?: string) => {
    showAlert(message, title || 'Error', 'error');
  };

  const showSuccess = (message: string, title?: string) => {
    showAlert(message, title || 'Success', 'success');
  };

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/profile/${id}`);
      let userProfile = res.data.profile;
      // If posts are not included, fetch them
      if (!Array.isArray(userProfile.posts)) {
        const postsRes = await api.get(`/posts/user/${id}`);
        userProfile.posts = postsRes.data.posts || [];
      }
      setProfile(userProfile);
      setIsFollowing(userProfile.followers?.some((u: any) => u._id === currentUser?._id));
    } catch (e) {
      console.error('Error fetching profile:', e);
      showError('Failed to load user profile');
    } finally {
      setLoading(false);
    }
  }, [id, currentUser]);

  useEffect(() => {
    setProfile(null);
    setLoading(true);
    setIsFollowing(false);
    setShowWorldMap(false);
    setSelectedPost(null);
  }, [id]);

  useEffect(() => {
    (async () => {
      try {
        const userData = await api.get('/auth/me');
        setCurrentUser(userData.data.user);
      } catch {}
    })();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (currentUser) fetchProfile();
    }, [fetchProfile, currentUser])
  );

  const handleFollow = async () => {
    if (!profile) return;
    setFollowLoading(true);
    try {
      const res = await api.post(`/profile/${profile._id}/follow`);
      setIsFollowing(res.data.isFollowing);
      await fetchProfile(); // Re-fetch profile and posts after follow/unfollow
      
      // Show success message
      if (res.data.isFollowing) {
        showSuccess('You are now following this user!');
      } else {
        showSuccess('You have unfollowed this user.');
      }
    } catch (e: any) {
      console.error('Error following/unfollowing user:', e);
      const errorMessage = e.response?.data?.message || 'Failed to update follow status';
      showError(errorMessage);
    } finally {
      setFollowLoading(false);
    }
  };

  if (loading || !profile) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <FlatList
        ListHeaderComponent={
          <View style={{ alignItems: 'center', padding: theme.spacing.lg }}>
            {/* Back Button */}
            <TouchableOpacity onPress={() => router.back()} style={{ position: 'absolute', left: 16, top: 16, zIndex: 10 }}>
              <Ionicons name="arrow-back" size={32} color={theme.colors.text} />
            </TouchableOpacity>
            <Image
              source={profile.profilePic ? { uri: profile.profilePic } : require('../../assets/avatars/male_avatar.png')}
              style={{ width: 90, height: 90, borderRadius: 45, borderWidth: 2, borderColor: theme.colors.primary, marginBottom: theme.spacing.md, marginTop: 16 }}
            />
            <Text style={{ fontSize: 22, fontWeight: '700', color: theme.colors.text }}>{profile.fullName}</Text>
            {/* Stats Row */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: theme.spacing.md, marginBottom: theme.spacing.md }}>
              <View style={{ alignItems: 'center', marginHorizontal: 16 }}>
                <Text style={{ fontWeight: '700', fontSize: 18, color: theme.colors.text }}>
                  {typeof profile.followers === 'number' ? profile.followers : Array.isArray(profile.followers) ? profile.followers.length : 0}
                </Text>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>Followers</Text>
              </View>
              <View style={{ alignItems: 'center', marginHorizontal: 16 }}>
                <Text style={{ fontWeight: '700', fontSize: 18, color: theme.colors.text }}>
                  {typeof profile.following === 'number' ? profile.following : Array.isArray(profile.following) ? profile.following.length : 0}
                </Text>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>Following</Text>
              </View>
              <View style={{ alignItems: 'center', marginHorizontal: 16 }}>
                <Text style={{ fontWeight: '700', fontSize: 18, color: theme.colors.text }}>
                  {(currentUser && (currentUser._id === profile._id || isFollowing)) && Array.isArray(profile.locations) ? profile.locations.length : '-'}
                </Text>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>Locations</Text>
              </View>
            </View>
            {currentUser && currentUser._id !== profile._id && (
              <TouchableOpacity
                style={{ marginTop: theme.spacing.sm, backgroundColor: isFollowing ? theme.colors.surface : theme.colors.primary, borderRadius: 20, paddingHorizontal: 32, paddingVertical: 10 }}
                onPress={handleFollow}
                disabled={followLoading}
              >
                <Text style={{ color: isFollowing ? theme.colors.text : '#fff', fontWeight: '700', fontSize: 16 }}>{isFollowing ? 'Following' : 'Follow'}</Text>
              </TouchableOpacity>
            )}
            {currentUser && currentUser._id !== profile._id && isFollowing && (
              <TouchableOpacity
                style={{ marginTop: theme.spacing.sm, backgroundColor: theme.colors.primary, borderRadius: 20, paddingHorizontal: 32, paddingVertical: 10 }}
                onPress={() => router.push(`/chat?userId=${profile._id}`)}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Message</Text>
              </TouchableOpacity>
            )}
            {/* 3D Globe (WorldMap) */}
            {profile.locations && profile.locations.length > 0 &&
              ((currentUser && currentUser._id === profile._id) || isFollowing) ? (
              <View style={{ alignItems: 'center', marginVertical: theme.spacing.lg }}>
                <TouchableOpacity onPress={() => setShowWorldMap(true)}>
                  <Ionicons name="earth" size={90} color={theme.colors.primary} />
                </TouchableOpacity>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 13, marginTop: 4 }}>{profile.locations.length} locations visited</Text>
              </View>
            ) : (
              <View style={{ alignItems: 'center', marginVertical: theme.spacing.lg, padding: 32 }}>
                <Ionicons name="earth" size={80} color={theme.colors.textSecondary} />
                <Text style={{ color: theme.colors.textSecondary, fontSize: 18, marginTop: 16 }}>
                  {currentUser && currentUser._id !== profile._id && !isFollowing
                    ? 'Follow to view posted locations'
                    : 'No locations yet'}
                </Text>
              </View>
            )}
            {/* Recent Posts Section Title */}
            {(currentUser && (currentUser._id === profile._id || isFollowing)) && (
              <Text style={{ fontSize: 18, fontWeight: '700', color: theme.colors.text, marginTop: theme.spacing.lg, marginBottom: theme.spacing.sm }}>
                Recent Posts
              </Text>
            )}
          </View>
        }
        data={(currentUser && (currentUser._id === profile._id || isFollowing)) ? (profile.posts || []).slice(0, 6) : []}
        keyExtractor={item => item._id}
        numColumns={3}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={{ flex: 1 / 3, aspectRatio: 1, margin: 2, borderRadius: 8, overflow: 'hidden' }}
            onPress={() => setSelectedPost(item)}
          >
            <Image source={{ uri: item.imageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={{ color: theme.colors.textSecondary, textAlign: 'center', marginTop: 32 }}>No posts yet.</Text>}
        contentContainerStyle={{ paddingBottom: 40 }}
      />
      {/* Post Modal: show image and location */}
      <Modal visible={!!selectedPost} transparent animationType="fade" onRequestClose={() => setSelectedPost(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' }}>
          {selectedPost && (
            <>
              <Image source={{ uri: selectedPost.imageUrl }} style={{ width: '90%', height: '60%', borderRadius: 16 }} resizeMode="contain" />
              {selectedPost.location?.address && (
                <Text style={{ color: '#fff', fontSize: 18, marginTop: 16, textAlign: 'center' }}>
                  📍 {selectedPost.location.address}
                </Text>
              )}
              <TouchableOpacity onPress={() => setSelectedPost(null)} style={{ marginTop: 24 }}>
                <Ionicons name="close-circle" size={48} color="#fff" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </Modal>
      {/* World Map Modal */}
      {profile.locations && profile.locations.length > 0 &&
        ((currentUser && currentUser._id === profile._id) || isFollowing) && GOOGLE_MAPS_API_KEY ? (
        <WorldMap
          visible={showWorldMap}
          locations={profile.locations}
          onClose={() => setShowWorldMap(false)}
        />
      ) : showWorldMap ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: 18 }}>Unable to load map. GOOGLE_MAPS_API_KEY is missing.</Text>
          <TouchableOpacity onPress={() => setShowWorldMap(false)} style={{ marginTop: 16 }}>
            <Text style={{ color: theme.colors.primary }}>Close</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      
      <CustomAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertVisible(false)}
      />
    </SafeAreaView>
  );
}
