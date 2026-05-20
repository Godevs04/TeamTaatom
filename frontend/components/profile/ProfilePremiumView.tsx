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
  verifiedCount,
  tripsCount,
  countriesCount,
  verifiedLocations,
  highlightPosts,
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
  onOpenChat,
  onHighlightPress,
}: ProfilePremiumViewProps) {
  const router = useRouter();
  const topPercent = tripScore > 0 ? Math.min(99, Math.max(5, Math.round((tripScore % 500) / 5))) : 0;

  const timeline = verifiedLocations.slice(0, 4);
  const tags = countriesCount > 0 ? `${countriesCount} countries` : 'Traveler';

  return (
    <View style={styles.wrap}>
      <View style={styles.headerBlock}>
        <LinearGradient
          colors={isDark ? ['#0F1E30', '#122236', '#152A42'] : ['#E8F4FF', '#F5FAFF', '#FFFFFF']}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.headerInner}>
          <View style={styles.avatarRow}>
            <View style={[styles.avatarOuter, { borderColor: isDark ? '#FFFFFF' : `${accent}55` }]}>
              <Image
                source={
                  profilePic
                    ? { uri: optimizeCloudinaryUrl(profilePic, { width: 200, height: 200 }) }
                    : require('../../assets/avatars/male_avatar.png')
                }
                style={styles.avatar as ImageStyle}
              />
            </View>
            <View style={styles.nameCol}>
              <Text style={[styles.displayName, { color: textPrimary }]} numberOfLines={1}>
                {fullName}
              </Text>
              {username ? (
                <Text style={[styles.handle, { color: textSecondary }]} numberOfLines={1}>
                  @{username}
                </Text>
              ) : null}
            </View>
          </View>
          <Text style={[styles.tags, { color: textSecondary }]}>{tags}</Text>
          {bio ? (
            <View style={styles.bioWrap}>
              <BioDisplay bio={bio} />
            </View>
          ) : null}
          <View style={styles.actionRow}>
            <Pressable
              style={[styles.btnOutline, { borderColor: accent + '60', flex: 1, justifyContent: 'center' }]}
              onPress={onOpenConnect}
            >
              <Ionicons name="people-outline" size={16} color={accent} />
              <Text style={[styles.btnOutlineText, { color: textPrimary }]}>Connect</Text>
            </Pressable>
            {onOpenChat ? (
              <Pressable
                style={[styles.btnIcon, { borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(91,188,248,0.25)' }]}
                onPress={onOpenChat}
              >
                <Ionicons name="chatbubble-outline" size={18} color={textPrimary} />
              </Pressable>
            ) : (
              <Pressable
                style={[styles.btnIcon, { borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(91,188,248,0.25)' }]}
                onPress={onEditProfile}
              >
                <Ionicons name="create-outline" size={18} color={textPrimary} />
              </Pressable>
            )}
          </View>
        </View>
      </View>

      {/* Stats strip */}
      <PremiumGlassCard style={styles.statsCard} contentStyle={styles.statsInner} subtle>
        <Pressable style={styles.statCell} onPress={onOpenTripScore}>
          <Text style={[styles.statValue, { color: textPrimary }]}>{tripScore}</Text>
          <Text style={[styles.statLabel, { color: textSecondary }]}>TripScore</Text>
          {topPercent > 0 ? (
            <Text style={[styles.statHint, { color: accent }]}>Top {topPercent}%</Text>
          ) : null}
        </Pressable>
        <View style={[styles.statDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(91,188,248,0.15)' }]} />
        <Pressable style={styles.statCell} onPress={onOpenJourneys}>
          <Text style={[styles.statValue, { color: textPrimary }]}>{tripsCount}</Text>
          <Text style={[styles.statLabel, { color: textSecondary }]}>Trips</Text>
        </Pressable>
        <View style={[styles.statDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(91,188,248,0.15)' }]} />
        <Pressable style={styles.statCell} onPress={onOpenFollowers}>
          <Text style={[styles.statValue, { color: textPrimary }]}>{followersCount}</Text>
          <Text style={[styles.statLabel, { color: textSecondary }]}>Followers</Text>
        </Pressable>
      </PremiumGlassCard>

      {/* Journey map */}
      <Pressable onPress={onOpenMap}>
        <PremiumGlassCard style={styles.sectionCard} contentStyle={styles.journeyInner} subtle>
          <View style={styles.sectionHead}>
            <Text style={[styles.sectionTitle, { color: textPrimary }]}>Your Journey Map</Text>
            <Ionicons name="chevron-forward" size={18} color={textSecondary} />
          </View>
          <View style={styles.journeyRow}>
            <View style={styles.journeyList}>
              {timeline.length > 0 ? (
                timeline.map((loc, i) => (
                  <View key={`${loc.latitude}-${i}`} style={styles.journeyLine}>
                    <View style={[styles.journeyDot, { backgroundColor: accent }]} />
                    <Text style={[styles.journeyText, { color: textSecondary }]} numberOfLines={1}>
                      {formatLocationLine(loc.address, loc.date)}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={[styles.journeyEmpty, { color: textSecondary }]}>
                  Post with a location to start your map
                </Text>
              )}
            </View>
            <View style={styles.globeMini}>
              {verifiedLocations.length > 0 ? (
                <RotatingGlobe locations={verifiedLocations} size={100} onPress={onOpenMap} />
              ) : (
                <Ionicons name="earth" size={48} color={accent} style={{ opacity: 0.5 }} />
              )}
            </View>
          </View>
        </PremiumGlassCard>
      </Pressable>

      {/* Achievements */}
      {/* Achievements section removed as per request */}

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
                <View style={[styles.verifiedPill, { backgroundColor: accent + '20' }]}>
                  <Text style={[styles.verifiedPillText, { color: accent }]}>Verified</Text>
                </View>
              </View>
            </View>
          ))}
        </PremiumGlassCard>
      ) : null}

      {/* Quote */}
      <PremiumGlassCard style={[styles.sectionCard, styles.quoteCard]} contentStyle={styles.quoteInner} subtle>
        <Ionicons name="chatbox-ellipses-outline" size={28} color={accent} style={{ opacity: 0.6, marginBottom: 8 }} />
        <Text style={[styles.quoteText, { color: textPrimary }]}>
          Not all those who wander are lost.
        </Text>
        <Text style={[styles.quoteAuthor, { color: textSecondary }]}>— J.R.R. Tolkien</Text>
      </PremiumGlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingBottom: 8,
  },
  coverWrap: {
    marginHorizontal: 0,
    height: COVER_H + AVATAR / 2 + 120,
    marginBottom: 8,
  },
  coverImg: {
    width: '100%',
    height: COVER_H,
  },
  coverBottom: {
    paddingHorizontal: 16,
    marginTop: -AVATAR / 2,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  avatarOuter: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    borderWidth: 3,
    borderColor: '#fff',
    overflow: 'visible',
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: AVATAR / 2,
  },
  verifiedDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameCol: {
    flex: 1,
    paddingBottom: 8,
    minWidth: 0,
  },
  displayName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F8FCFF',
  },
  handle: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.65)',
    marginTop: 2,
  },
  levelBadge: {
    width: 72,
    height: 72,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 4,
  },
  levelText: {
    fontSize: 14,
    fontWeight: '900',
    marginTop: 2,
  },
  levelSub: {
    fontSize: 9,
    fontWeight: '700',
  },
  tags: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 10,
  },
  bioWrap: {
    marginTop: 8,
    width: '100%',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
  },
  btnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 999,
    overflow: 'hidden',
  },
  btnPrimaryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  btnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
  },
  btnOutlineText: {
    fontSize: 13,
    fontWeight: '700',
  },
  btnIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsCard: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  statsInner: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '900',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statHint: {
    fontSize: 9,
    fontWeight: '700',
    marginTop: 2,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginVertical: 4,
  },
  sectionCard: {
    marginHorizontal: 16,
    marginBottom: 12,
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
  journeyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  journeyList: {
    flex: 1,
    gap: 10,
    paddingRight: 8,
  },
  journeyLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  journeyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  journeyText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  journeyEmpty: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  globeMini: {
    width: 110,
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  achieveInner: {
    padding: 14,
  },
  achieveRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  achieveItem: {
    width: (SCREEN_W - 32 - 28) / 4,
    alignItems: 'center',
  },
  achieveHex: {
    width: 52,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    transform: [{ rotate: '0deg' }],
  },
  achieveLabel: {
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 12,
  },
  achieveProg: {
    fontSize: 9,
    fontWeight: '800',
    marginTop: 2,
  },
  highlightsBlock: {
    marginBottom: 12,
  },
  highlightsScroll: {
    paddingHorizontal: 16,
    gap: 10,
  },
  highlightCard: {
    width: 120,
    height: 160,
  },
  highlightGlass: {
    flex: 1,
    overflow: 'hidden',
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
  verifiedPill: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  verifiedPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  quoteCard: {
    marginBottom: 16,
  },
  quoteInner: {
    padding: 18,
    alignItems: 'center',
  },
  quoteText: {
    fontSize: 15,
    fontWeight: '600',
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 22,
  },
  quoteAuthor: {
    fontSize: 12,
    marginTop: 8,
    fontWeight: '600',
  },
});
