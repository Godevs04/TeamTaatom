import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ImageStyle,
  Pressable,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import CloudGlassSurface from '../cloud/CloudGlassSurface';
import PremiumGlassCard from '../ui/PremiumGlassCard';
import RotatingGlobe from '../RotatingGlobe';
import BioDisplay from '../BioDisplay';
import { optimizeCloudinaryUrl } from '../../utils/imageCache';

const { width: SCREEN_W } = Dimensions.get('window');
const AVATAR = 96;

export interface ProfilePremiumViewProps {
  profilePic?: string;
  fullName: string;
  username?: string;
  bio?: string;
  createdAt?: string;
  tripScore?: number;
  postCount: number;
  followersCount: number;
  followingCount: number;
  verifiedCount: number | null;
  tripsCount: number;
  countriesCount: number;
  verifiedLocations?: Array<{ latitude: number; longitude: number; address: string; date?: string }>;
  highlightPosts?: Array<{ _id: string; imageUrl?: string }>;
  userId?: string;
  isDark: boolean;
  accent: string;
  textPrimary: string;
  textSecondary: string;
  onEditProfile: () => void;
  onOpenMap: () => void;
  onOpenTripScore: () => void;
  onOpenJourneys: () => void;
  onOpenConnect: () => void;
  onOpenFollowers: () => void;
  onOpenFollowing: () => void;
  onOpenChat?: () => void;
  onHighlightPress?: (postId: string) => void;
  onAvatarLongPress?: (source: any) => void;
  onAvatarPressOut?: () => void;
}

export default function ProfilePremiumView({
  profilePic,
  fullName,
  username,
  bio,
  tripScore = 0,
  postCount,
  followersCount,
  followingCount = 0,
  verifiedCount,
  tripsCount,
  countriesCount,
  verifiedLocations = [],
  highlightPosts = [],
  userId,
  isDark,
  accent,
  textPrimary,
  textSecondary,
  onEditProfile,
  onOpenMap,
  onOpenTripScore,
  onOpenJourneys,
  onOpenConnect,
  onOpenFollowers,
  onOpenFollowing,
  onOpenChat,
  onHighlightPress,
  onAvatarLongPress,
  onAvatarPressOut,
}: ProfilePremiumViewProps) {
  const router = useRouter();

  const textPassive = isDark ? '#38BDF8' : '#1C73B4';
  const borderTint = 'rgba(28, 115, 180, 0.15)';

  return (
    <View style={styles.wrap}>
      <PremiumGlassCard
        style={styles.headerBlock}
        contentStyle={styles.headerInner}
        strong={false}
        subtle={false}
        blur={true}
      >
        {/* Phase 4: Absolute positioned Edit Button */}
        <Pressable 
          style={styles.editProfileAbsolute} 
          onPress={onEditProfile}
          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
        >
          <Ionicons name="create-outline" size={18} color={isDark ? '#7AB3D6' : '#1C73B4'} />
        </Pressable>

        {/* Phase 2: Top Row (Avatar & Telemetry Stats) */}
        <View style={styles.topRow}>
          {/* Left Column (Avatar) */}
          <Pressable
            onLongPress={() => {
              const avatarSource = profilePic
                ? { uri: optimizeCloudinaryUrl(profilePic, { width: 300, height: 300 }) }
                : require('../../assets/avatars/male_avatar.png');
              onAvatarLongPress?.(avatarSource);
            }}
            onPressOut={onAvatarPressOut}
            delayLongPress={200}
            style={styles.avatarGradientWrapper}
          >
            <LinearGradient
              colors={['#1C73B4', '#50C878']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFillObject, { borderRadius: 37, padding: 2, alignItems: 'center', justifyContent: 'center' }]}
            >
              <View style={[
                styles.avatarContainer,
                {
                  backgroundColor: isDark ? '#080F19' : '#F0F5FA',
                }
              ]}>
                <Image
                  source={
                    profilePic
                      ? { uri: optimizeCloudinaryUrl(profilePic, { width: 150, height: 150 }) }
                      : require('../../assets/avatars/male_avatar.png')
                  }
                  style={styles.avatarImage as ImageStyle}
                />
              </View>
            </LinearGradient>
          </Pressable>

          {/* Right Column (Telemetry Stats) */}
          <View style={styles.statsContainer}>
            {/* Stat Block 1 */}
            <View style={styles.statBlock}>
              <Text style={[styles.statValue, { color: textPrimary }]}>{postCount}</Text>
              <Text style={[styles.statLabel, { color: textSecondary }]}>Posts</Text>
            </View>

            {/* Separator */}
            <View style={styles.separator} />

            {/* Stat Block 2 */}
            <Pressable style={styles.statBlock} onPress={onOpenFollowers}>
              <Text style={[styles.statValue, { color: textPrimary }]}>{followersCount}</Text>
              <Text style={[styles.statLabel, { color: textSecondary }]}>Followers</Text>
            </Pressable>

            {/* Separator */}
            <View style={styles.separator} />

            {/* Stat Block 3 */}
            <Pressable style={styles.statBlock} onPress={onOpenFollowing}>
              <Text style={[styles.statValue, { color: textPrimary }]}>{followingCount}</Text>
              <Text style={[styles.statLabel, { color: textSecondary }]}>Following</Text>
            </Pressable>
          </View>
        </View>

        {/* Phase 3: Middle Block (Identity & Typography Hierarchy) */}
        <View style={styles.identityBlock}>
          {isDark ? (
            <>
              {username ? (
                <Text style={[styles.handleText, { color: '#FFFFFF', fontSize: 15, fontWeight: '600', marginTop: 0 }]}>
                  @{username}
                </Text>
              ) : null}
              <Text style={[styles.displayNameText, { color: '#38BDF8', fontSize: 15, fontWeight: '700', marginTop: 2 }]}>
                {fullName}
              </Text>
            </>
          ) : (
            <>
              <Text style={[styles.displayNameText, { color: '#1C73B4', fontSize: 15, fontWeight: '700', marginTop: 0 }]}>
                {fullName}
              </Text>
              {username ? (
                <Text style={[styles.handleText, { color: textSecondary, fontSize: 15, fontWeight: '600', marginTop: 2 }]}>
                  @{username}
                </Text>
              ) : null}
            </>
          )}
          {bio ? (
            <BioDisplay bio={bio} maxLines={3} fontSize={15} leftAlign={true} />
          ) : null}
        </View>

        {/* Phase 5: Trip Score Telemetry Strip (Bottom Anchor) */}
        <Pressable 
          style={styles.tripScoreStrip}
          onPress={onOpenTripScore}
        >
          <Text style={[styles.tripScoreLabel, { color: textSecondary }]}>
            TRIP SCORE
          </Text>
          <Text style={[styles.tripScoreValue, { color: textPrimary }]}>{tripScore}</Text>
        </Pressable>
      </PremiumGlassCard>

      <View style={styles.globeWrapper}>
        <View style={styles.globeContainer}>
          <RotatingGlobe locations={verifiedLocations} size={160} onPress={onOpenMap} />
        </View>
      </View>

      {/* Standalone Connect Button directly below the globe */}
      <View style={{ alignItems: 'center', marginBottom: 24, marginTop: 15 }}>
        <Pressable
          style={({ pressed }) => [
            styles.connectButtonPill,
            { backgroundColor: 'transparent', opacity: pressed ? 0.9 : 1 }
          ]}
          onPress={onOpenConnect}
        >
          <LinearGradient
            colors={['#1C73B4', '#50C878']}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
          <Ionicons name="people" size={18} color="#FFFFFF" style={{ marginRight: 6, zIndex: 1 }} />
          <Text style={[styles.connectButtonText, { color: '#FFFFFF', zIndex: 1 }]}>Connect</Text>
        </Pressable>
      </View>

      {/* Recent highlights */}
      {highlightPosts.length > 0 ? (
        <View style={styles.highlightsBlock}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.highlightsScroll}>
            {highlightPosts.slice(0, 6).map((p) => {
              const uri = p.imageUrl ? optimizeCloudinaryUrl(p.imageUrl, { width: 280, height: 360 }) : null;
              return (
                <Pressable
                  key={p._id}
                  style={styles.highlightCard}
                  onPress={() => (onHighlightPress ? onHighlightPress(p._id) : userId && router.push(`/user-posts/${userId}?postId=${p._id}`))}
                >
                  <CloudGlassSurface blur={false} borderRadius={16} style={styles.highlightGlass}>
                    {uri ? (
                      <Image source={{ uri }} style={styles.highlightImg as ImageStyle} />
                    ) : (
                      <View style={[styles.highlightImg, { backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' }]}>
                        <Ionicons name="image-outline" size={32} color={textSecondary} />
                      </View>
                    )}
                    <LinearGradient colors={['transparent', 'rgba(0,0,0,0.75)']} style={styles.highlightGrad} />
                  </CloudGlassSurface>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingBottom: 8,
  },
  headerBlock: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 24,
    borderRadius: 16,
    shadowOpacity: 0,
    elevation: 0,
  },
  headerInner: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    position: 'relative',
  },
  editProfileAbsolute: {
    position: 'absolute',
    top: 16,
    right: 18,
    opacity: 0.85,
    zIndex: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  avatarGradientWrapper: {
    width: 74,
    height: 74,
    borderRadius: 37,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    overflow: 'hidden',
    shadowOpacity: 0,
    elevation: 0,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 35,
  },
  statsContainer: {
    flex: 1,
    marginLeft: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statBlock: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  separator: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(28, 115, 180, 0.12)',
  },
  identityBlock: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    marginTop: 12,
    width: '100%',
  },
  displayNameText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  handleText: {
    fontSize: 15,
    fontWeight: '600',
    opacity: 0.9,
  },
  bioText: {
    fontSize: 15,
    lineHeight: 21,
    maxWidth: '92%',
  },
  tripScoreStrip: {
    marginTop: 16,
    paddingTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    borderTopWidth: 1,
    borderColor: 'rgba(28, 115, 180, 0.15)',
  },
  tripScoreLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  tripScoreValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  globeWrapper: {
    position: 'relative',
    width: '100%',
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 0,
  },
  globeContainer: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectButtonPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 30,
    overflow: 'hidden',
  },
  connectButtonText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  highlightsBlock: {
    marginBottom: 12,
  },
  highlightsScroll: {
    paddingHorizontal: 16,
    gap: 10,
  },
  highlightCard: {
    width: 130,
    height: 170,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  highlightGlass: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(28, 115, 180, 0.15)',
  },
  highlightImg: {
    width: '100%',
    height: '100%',
  },
  highlightGrad: {
    ...StyleSheet.absoluteFillObject,
  },
});
