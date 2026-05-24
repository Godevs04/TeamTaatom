import React from 'react';
// Strike 17: Profile Bulk Selection & Action Mandate integration.
import {
  View,
  Text,
  StyleSheet,
  Image,
  ImageStyle,
  Pressable,
  ScrollView,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import PremiumGlassCard from '../ui/PremiumGlassCard';
import CloudGlassSurface from '../cloud/CloudGlassSurface';
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
  followersCount: number;
  followingCount: number;
  verifiedCount: number | null;
  tripsCount: number;
  countriesCount: number;
  verifiedLocations: Array<{ latitude: number; longitude: number; address: string; date?: string }>;
  highlightPosts: Array<{ _id: string; imageUrl?: string }>;
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
}

function formatLocationLine(address: string, date?: string): string {
  const city = address?.split(',')[0]?.trim() || address || 'Unknown';
  if (!date) return city;
  try {
    const d = new Date(date);
    return `${city} · ${d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
  } catch {
    return city;
  }
}

export default function ProfilePremiumView({
  profilePic,
  fullName,
  username,
  bio,
  tripScore = 0,
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
}: ProfilePremiumViewProps) {
  const router = useRouter();
  const timeline = verifiedLocations.slice(0, 4);

  return (
    <View style={styles.wrap}>
      {/* Floating profile image overlapping the top card */}
      <View style={{ alignItems: 'center', zIndex: 10, marginTop: 16 }}>
        <View style={[styles.avatarOuter, {
          borderColor: isDark ? 'rgba(255,255,255,0.8)' : '#FFFFFF',
          borderWidth: 4,
          backgroundColor: isDark ? '#122236' : '#FFFFFF',
          shadowColor: accent,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.3,
          shadowRadius: 16,
          elevation: 10,
        }]}>
          <Image
            source={
              profilePic
                ? { uri: optimizeCloudinaryUrl(profilePic, { width: 200, height: 200 }) }
                : require('../../assets/avatars/male_avatar.png')
            }
            style={styles.avatar as ImageStyle}
          />
        </View>
      </View>

      <View style={[styles.headerBlock, {
        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.8)',
        marginTop: -AVATAR / 2, // Pull up under the floating avatar
      }]}>
        <LinearGradient
          colors={isDark ? ['#0F1E30', '#122236', '#152A42'] : ['#F5FAFF', '#FFFFFF', '#E8F4FF']}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <View style={styles.headerInner}>
          {/* Phase 3: The Identity Block (Centered Hierarchy below avatar) */}
          <View style={styles.identityBlock}>
            <Text style={[styles.displayNameText, { color: textPrimary }]}>
              {fullName}
            </Text>
            {username ? (
              <Text style={[styles.handleText, { color: textSecondary }]}>
                @{username}
              </Text>
            ) : null}
            
            {bio ? (
              <View style={styles.bioContainer}>
                <BioDisplay bio={bio} />
              </View>
            ) : null}
          </View>

          {/* Phase 2: Pill-styled Metrics */}
          <View style={styles.metricsContainer}>
            <Pressable style={styles.metricPill} onPress={onOpenTripScore}>
              <LinearGradient colors={isDark ? ['#1A2B3C', '#122236'] : ['#F0F8FF', '#FFFFFF']} style={styles.metricPillGrad} />
              <Ionicons name="compass" size={16} color={accent} style={{ marginBottom: 4 }} />
              <Text style={[styles.metricValue, { color: textPrimary }]}>{tripScore}</Text>
              <Text style={[styles.metricLabel, { color: textSecondary }]}>Score</Text>
            </Pressable>
            
            <Pressable style={styles.metricPill} onPress={onOpenFollowers}>
              <LinearGradient colors={isDark ? ['#1A2B3C', '#122236'] : ['#F0F8FF', '#FFFFFF']} style={styles.metricPillGrad} />
              <Ionicons name="people" size={16} color={accent} style={{ marginBottom: 4 }} />
              <Text style={[styles.metricValue, { color: textPrimary }]}>{followersCount}</Text>
              <Text style={[styles.metricLabel, { color: textSecondary }]}>Followers</Text>
            </Pressable>
            
            <Pressable style={styles.metricPill} onPress={onOpenFollowing}>
              <LinearGradient colors={isDark ? ['#1A2B3C', '#122236'] : ['#F0F8FF', '#FFFFFF']} style={styles.metricPillGrad} />
              <Ionicons name="person-add" size={16} color={accent} style={{ marginBottom: 4 }} />
              <Text style={[styles.metricValue, { color: textPrimary }]}>{followingCount}</Text>
              <Text style={[styles.metricLabel, { color: textSecondary }]}>Following</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Standalone Rotating Globe with Glowing Backdrop */}
      <View style={styles.globeWrapper}>
        <View style={[styles.globeGlow, { backgroundColor: isDark ? 'rgba(91,188,248,0.1)' : 'rgba(91,188,248,0.15)' }]} />
        <View style={styles.globeContainer}>
          <RotatingGlobe locations={verifiedLocations} size={160} onPress={onOpenMap} />
        </View>
      </View>

      {/* Standalone Connect Button directly below the globe */}
      <View style={{ alignItems: 'center', marginBottom: 24, marginTop: -10 }}>
        <Pressable
          style={({ pressed }) => [
            styles.connectButtonPill,
            { backgroundColor: accent, opacity: pressed ? 0.9 : 1 }
          ]}
          onPress={onOpenConnect}
        >
          <LinearGradient
            colors={['rgba(255,255,255,0.2)', 'transparent']}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          />
          <Ionicons name="people" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.connectButtonText}>Connect</Text>
        </Pressable>
      </View>

      {/* Recent highlights */}
      {highlightPosts.length > 0 ? (
        <View style={styles.highlightsBlock}>
          <Text style={[styles.sectionTitle, { color: textPrimary, marginHorizontal: 16, marginBottom: 10 }]}>
            Recent Highlights
          </Text>
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
                      <View style={[styles.highlightImg, { backgroundColor: '#1a2b3c', alignItems: 'center', justifyContent: 'center' }]}>
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

      {/* Travel timeline */}
      {timeline.length > 1 ? (
        <PremiumGlassCard style={styles.sectionCard} contentStyle={styles.timelineInner} subtle>
          <Text style={[styles.sectionTitle, { color: textPrimary, marginBottom: 12 }]}>Travel Timeline</Text>
          {timeline.map((loc, i) => (
            <View key={`tl-${i}`} style={styles.timelineRow}>
              <View style={styles.timelineRail}>
                <View style={[styles.timelineDot, { backgroundColor: accent }]} />
                {i < timeline.length - 1 ? (
                  <View style={[styles.timelineLine, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(91,188,248,0.2)' }]} />
                ) : null}
              </View>
              <View style={styles.timelineBody}>
                <Text style={[styles.timelinePlace, { color: textPrimary }]} numberOfLines={1}>
                  {loc.address?.split(',')[0] || 'Location'}
                </Text>
                {loc.date ? (
                  <Text style={[styles.timelineDate, { color: textSecondary }]}>
                    {new Date(loc.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
        </PremiumGlassCard>
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
    marginTop: 0,
    marginBottom: 24,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
  },
  headerInner: {
    padding: 24,
    paddingTop: 16, // Reduced top padding to account for floating avatar
    position: 'relative',
    alignItems: 'center',
  },
  editProfileAbsolute: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  identityBlock: {
    alignItems: 'center',
    marginTop: 56, // Push down below floating avatar overlap
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  displayNameText: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  handleText: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 12,
  },
  bioContainer: {
    width: '100%',
    alignItems: 'center',
  },
  metricsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    width: '100%',
  },
  metricPill: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  metricPillGrad: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.8,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 4,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  avatarOuter: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    borderWidth: 3,
    borderColor: '#fff',
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: AVATAR / 2,
  },
  sectionCard: {
    marginHorizontal: 0,
    marginBottom: 12,
    borderRadius: 0,
    borderWidth: 0,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  journeyInner: {
    padding: 14,
  },
  globeWrapper: {
    position: 'relative',
    width: '100%',
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  globeGlow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    top: '50%',
    left: '50%',
    transform: [{ translateX: -100 }, { translateY: -100 }],
    filter: 'blur(30px)', // using generic CSS blur (note: React Native may ignore this or require a different approach depending on platform, but we'll try it and provide a fallback color with opacity).
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    overflow: 'hidden',
  },
  connectButtonText: {
    color: '#FFFFFF',
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
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  highlightImg: {
    width: '100%',
    height: '100%',
  },
  highlightGrad: {
    ...StyleSheet.absoluteFillObject,
  },
  timelineInner: {
    padding: 14,
  },
  timelineRow: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  timelineRail: {
    width: 24,
    alignItems: 'center',
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginTop: 4,
    minHeight: 24,
  },
  timelineBody: {
    flex: 1,
    paddingLeft: 8,
  },
  timelinePlace: {
    fontSize: 14,
    fontWeight: '700',
  },
  timelineDate: {
    fontSize: 11,
    marginTop: 2,
  },
});
