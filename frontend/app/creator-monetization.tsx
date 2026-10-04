import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { theme } from '../constants/theme';
import {
  activateCreatorMonetization,
  getCreatorMonetizationDashboard,
  requestCreatorWithdrawal,
  saveCreatorPayoutProfile,
  submitCreatorVerification,
  type MonetizationDashboard,
  type MonetizationGate,
} from '../services/creatorMonetization';

const STATUS_LABEL: Record<string, string> = {
  not_eligible: 'Not eligible',
  eligible: 'Eligible',
  active: 'Active',
  locked: 'Locked',
  under_review: 'Under review',
  terminated: 'Terminated',
};

const inr = (value: number) => `₹${Number(value || 0).toFixed(2)}`;
const count = (value: number) => Number(value || 0).toLocaleString('en-IN');

function statusCopy(status: string) {
  if (status === 'eligible') {
    return {
      title: "You're eligible for monetization.",
      body: 'Keep creating original content to maximize your earnings.',
    };
  }
  if (status === 'active') {
    return {
      title: 'Monetization is active.',
      body: 'New eligible views earn at the current rate. This month stays pending until it is validated.',
    };
  }
  if (status === 'locked') {
    return {
      title: 'Monetization is locked.',
      body: 'Your available balance can still be withdrawn. One qualifying month unlocks the account.',
    };
  }
  if (status === 'under_review') {
    return {
      title: 'Your account is under review.',
      body: 'New earnings are paused until TAATOM finishes the review.',
    };
  }
  if (status === 'terminated') {
    return {
      title: 'Monetization has ended.',
      body: 'This account can no longer earn from views.',
    };
  }
  return {
    title: "You're not eligible yet.",
    body: 'Reach the follower, video, and view requirements to qualify.',
  };
}

function verifyMeta(status: string) {
  if (status === 'verified') return { label: 'Verified', color: '#16A34A', bg: '#ECFDF3' };
  if (status === 'pending') return { label: 'In review', color: '#D97706', bg: '#FFF7ED' };
  if (status === 'rejected') return { label: 'Rejected', color: '#DC2626', bg: '#FEF2F2' };
  return { label: 'Not verified', color: '#EA580C', bg: '#FFF7ED' };
}

export default function CreatorMonetizationScreen() {
  const router = useRouter();
  const { theme: themeContext, isDark } = useTheme();
  const colors = themeContext?.colors || theme.colors;
  const scrollRef = useRef<ScrollView>(null);
  const rulesY = useRef(0);
  const historyY = useRef(0);
  const hasLoaded = useRef(false);
  const [dashboard, setDashboard] = useState<MonetizationDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [legalName, setLegalName] = useState('');
  const [method, setMethod] = useState<'bank' | 'upi'>('bank');
  const [bankAccountName, setBankAccountName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');
  const [upiId, setUpiId] = useState('');
  const [taxId, setTaxId] = useState('');
  const [amount, setAmount] = useState('');

  const load = useCallback(async (quiet = false) => {
    try {
      if (!quiet) setLoading(true);
      const next = await getCreatorMonetizationDashboard();
      setDashboard(next);
      setLegalName(next.payoutProfile.legalName || '');
      setMethod(next.payoutProfile.method === 'upi' ? 'upi' : 'bank');
      setBankAccountName(next.payoutProfile.bankAccountName || '');
      setBankIfsc(next.payoutProfile.bankIfsc || '');
      setUpiId(next.payoutProfile.upiId || '');
      setAmount((current) => current || String(next.minimumWithdrawal || 1000));
      setError('');
      hasLoaded.current = true;
    } catch (err: any) {
      setError(err.message || 'Could not load Creator Dashboard.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    load(hasLoaded.current);
  }, [load]));

  const run = async (action: () => Promise<MonetizationDashboard>) => {
    try {
      setBusy(true);
      const next = await action();
      setDashboard(next);
      setError('');
    } catch (err: any) {
      Alert.alert('Creator Dashboard', err.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const surface = isDark ? '#111827' : '#FFFFFF';
  const text = colors.text || (isDark ? '#F8FAFC' : '#0F172A');
  const muted = isDark ? '#94A3B8' : '#64748B';
  const border = isDark ? '#1F2937' : '#E8EEF5';
  const background = isDark ? '#0B1220' : '#F4F7FB';
  const fieldBg = isDark ? '#0F172A' : '#FFFFFF';
  const soft = isDark ? '#1E293B' : '#F3F6FA';
  const blue = '#2F6FED';

  const reason = dashboard?.status === 'locked'
    ? dashboard.lockReason
    : dashboard?.status === 'under_review' || dashboard?.status === 'terminated'
      ? dashboard.reviewReason || dashboard.lockReason
      : '';
  const copy = statusCopy(dashboard?.status || 'not_eligible');
  const verify = verifyMeta(dashboard?.verificationStatus || 'none');
  const total = (dashboard?.pending || 0) + (dashboard?.available || 0) + (dashboard?.withdrawn || 0);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: background }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: background }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color={text} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={[styles.kicker, { color: muted }]}>Creator Dashboard</Text>
          <Text style={[styles.title, { color: text }]}>Monetization</Text>
        </View>
        <TouchableOpacity
          onPress={() => scrollRef.current?.scrollTo({ y: rulesY.current, animated: true })}
          style={styles.iconBtn}
          accessibilityLabel="Program rules"
        >
          <Ionicons name="help-circle-outline" size={24} color={text} />
        </TouchableOpacity>
      </View>

      {loading && !dashboard ? (
        <ActivityIndicator style={styles.loader} color={blue} />
      ) : (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} />}
        >
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {dashboard ? (
            <>
              <LinearGradient
                colors={isDark ? ['#123044', '#12352E'] : ['#E5F7FF', '#E9FFF6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.statusCard}
              >
                <View style={styles.statusTop}>
                  <View style={[styles.dollar, { backgroundColor: isDark ? '#1E3A4C' : '#F3FBFF' }]}>
                    <Text style={[styles.dollarMark, { color: blue }]}>$</Text>
                  </View>
                  <View style={styles.statusCopy}>
                    <View style={styles.statusRow}>
                      <Text style={[styles.statusLabel, { color: muted }]}>Status</Text>
                      <View style={[styles.pill, dashboard.status === 'eligible' || dashboard.status === 'active' ? styles.pillGood : styles.pillWarn]}>
                        <Ionicons
                          name={dashboard.status === 'eligible' || dashboard.status === 'active' ? 'checkmark-circle' : 'alert-circle'}
                          size={14}
                          color={dashboard.status === 'eligible' || dashboard.status === 'active' ? '#16A34A' : '#D97706'}
                        />
                        <Text style={[styles.pillText, { color: dashboard.status === 'eligible' || dashboard.status === 'active' ? '#16A34A' : '#D97706' }]}>
                          {STATUS_LABEL[dashboard.status] || dashboard.status}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.statusTitle, { color: text }]}>{copy.title}</Text>
                    <Text style={[styles.statusBody, { color: muted }]}>{copy.body}</Text>
                  </View>
                  <MaterialCommunityIcons name="crown-outline" size={42} color={isDark ? '#64748B' : '#B7C3D6'} />
                </View>
                {reason ? <Text style={styles.reason}>{reason}</Text> : null}
                {dashboard.canActivate ? (
                  <TouchableOpacity style={[styles.primary, { backgroundColor: blue }]} disabled={busy} onPress={() => run(activateCreatorMonetization)}>
                    <Text style={styles.primaryText}>{busy ? 'Working…' : 'Activate monetization'}</Text>
                  </TouchableOpacity>
                ) : null}
              </LinearGradient>

              <View style={[styles.card, { backgroundColor: surface }]}>
                <Text style={[styles.cardTitle, { color: text }]}>Progress to qualify</Text>
                <QualifyRow icon="person-outline" label="Followers" gate={dashboard.followers} detail={`Reach ${count(dashboard.followers.required)} followers`} text={text} muted={muted} blue={blue} soft={isDark ? '#1E3A5F' : '#EAF2FF'} track={isDark ? '#1E293B' : '#E8EEF5'} />
                <QualifyRow icon="play-outline" label="Videos this month" gate={dashboard.videos} detail={`Post at least ${count(dashboard.videos.required)} eligible videos`} text={text} muted={muted} blue={blue} soft={isDark ? '#1E3A5F' : '#EAF2FF'} track={isDark ? '#1E293B' : '#E8EEF5'} />
                <QualifyRow icon="stats-chart-outline" label="Monthly views" gate={dashboard.monthlyViews} detail={`Get ${count(dashboard.monthlyViews.required)} views recorded this month`} text={text} muted={muted} blue={blue} soft={isDark ? '#1E3A5F' : '#EAF2FF'} track={isDark ? '#1E293B' : '#E8EEF5'} />
                <QualifyRow icon="eye-outline" label="Eligible views" gate={dashboard.eligibleViewsProgress} detail="Only these valid views count toward the requirement and earnings" text={text} muted={muted} blue={blue} soft={isDark ? '#1E3A5F' : '#EAF2FF'} track={isDark ? '#1E293B' : '#E8EEF5'} />
              </View>

              <View style={[styles.card, { backgroundColor: surface }]}>
                <Text style={[styles.cardTitle, { color: text }]}>Earnings</Text>
                <View style={styles.totalRow}>
                  <View style={[styles.miniIcon, { backgroundColor: isDark ? '#1E3A5F' : '#EAF2FF' }]}>
                    <Ionicons name="wallet-outline" size={18} color={blue} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: muted }]}>Total earnings</Text>
                    <Text style={[styles.totalValue, { color: text }]}>{inr(total)}</Text>
                  </View>
                </View>
                <View style={[styles.split, { backgroundColor: soft }]}>
                  <Split label="Available" value={inr(dashboard.available)} text={text} muted={muted} />
                  <Split label="Pending" value={inr(dashboard.pending)} text={text} muted={muted} />
                  <Split label="Withdrawn" value={inr(dashboard.withdrawn)} text={text} muted={muted} />
                </View>
                <Text style={[styles.note, { color: muted }]}>
                  This month {inr(dashboard.thisMonthEarnings)} at {inr(dashboard.ratePerThousand)} per 1,000 eligible views.
                  {dashboard.ratePerThousand > 0 ? ' Pending moves to Available after the Asia/Kolkata month is validated.' : ' TAATOM has not set a rupee rate yet, so earnings stay at ₹0.00.'}
                  {dashboard.status === 'eligible' || dashboard.status === 'not_eligible' ? ' Views before you activate do not earn.' : ''}
                </Text>
                <View style={styles.infoRow}>
                  <Ionicons name="information-circle-outline" size={16} color={muted} />
                  <Text style={[styles.note, { color: muted, flex: 1 }]}>
                    Payouts are processed after verification and may take 3–7 business days.
                  </Text>
                </View>
              </View>

              <View style={[styles.card, { backgroundColor: surface }]}>
                <View style={styles.identityHead}>
                  <View style={[styles.miniIcon, { backgroundColor: isDark ? '#1E3A5F' : '#EAF2FF' }]}>
                    <Ionicons name="person-outline" size={18} color={blue} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: text }]}>Payout and identity</Text>
                    <Text style={[styles.note, { color: muted }]}>Verify your identity and add payout details to receive earnings.</Text>
                  </View>
                  <View style={[styles.verifyBadge, { backgroundColor: verify.bg }]}>
                    <Text style={[styles.verifyText, { color: verify.color }]}>{verify.label}</Text>
                  </View>
                </View>
                {dashboard.verificationNote ? <Text style={styles.reason}>{dashboard.verificationNote}</Text> : null}
                {dashboard.withdrawalHoldReason ? <Text style={styles.reason}>{dashboard.withdrawalHoldReason}</Text> : null}

                <Text style={[styles.blockTitle, { color: text }]}>Payout account</Text>
                <Text style={[styles.note, { color: muted }]}>Add your bank or UPI details to receive payments.</Text>
                <View style={[styles.segment, { backgroundColor: soft }]}>
                  {(['bank', 'upi'] as const).filter((item) => dashboard.paymentMethods.includes(item)).map((item) => (
                    <TouchableOpacity
                      key={item}
                      style={[styles.segmentBtn, method === item && { backgroundColor: blue }]}
                      onPress={() => setMethod(item)}
                    >
                      <Text style={[styles.segmentText, { color: method === item ? '#fff' : muted }]}>
                        {item === 'bank' ? 'Bank account' : 'UPI'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Field icon="person-outline" label="Legal name" value={legalName} onChangeText={setLegalName} placeholder="Enter your legal name" text={text} muted={muted} border={border} background={fieldBg} />
                {method === 'bank' ? (
                  <>
                    <Field icon="card-outline" label="Account name" value={bankAccountName} onChangeText={setBankAccountName} placeholder="As per bank records" text={text} muted={muted} border={border} background={fieldBg} />
                    <Field icon="keypad-outline" label="Account number" value={bankAccountNumber} onChangeText={setBankAccountNumber} placeholder={dashboard.payoutProfile.bankAccountNumber || 'Enter account number'} keyboardType="number-pad" text={text} muted={muted} border={border} background={fieldBg} />
                    <Field icon="business-outline" label="IFSC" value={bankIfsc} onChangeText={setBankIfsc} placeholder="Enter IFSC code" autoCapitalize="characters" text={text} muted={muted} border={border} background={fieldBg} />
                  </>
                ) : (
                  <Field icon="at-outline" label="UPI ID" value={upiId} onChangeText={setUpiId} placeholder="name@bank" autoCapitalize="none" text={text} muted={muted} border={border} background={fieldBg} />
                )}
                {dashboard.requireTaxIdentity ? (
                  <Field icon="card-outline" label="PAN" value={taxId} onChangeText={setTaxId} placeholder={dashboard.payoutProfile.taxId || 'Enter PAN number'} autoCapitalize="characters" text={text} muted={muted} border={border} background={fieldBg} />
                ) : null}

                <TouchableOpacity
                  style={[styles.primary, { backgroundColor: blue }]}
                  disabled={busy}
                  onPress={() => run(() => saveCreatorPayoutProfile({
                    legalName,
                    method,
                    bankAccountName,
                    bankAccountNumber,
                    bankIfsc,
                    upiId,
                    taxId,
                  }))}
                >
                  <Text style={styles.primaryText}>Save payout details</Text>
                </TouchableOpacity>
                {dashboard.verificationStatus !== 'verified' ? (
                  <TouchableOpacity style={[styles.outline, { borderColor: blue }]} disabled={busy} onPress={() => run(submitCreatorVerification)}>
                    <Text style={[styles.outlineText, { color: blue }]}>Submit for verification</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  style={[styles.outline, { borderColor: blue }]}
                  onPress={() => scrollRef.current?.scrollTo({ y: historyY.current, animated: true })}
                >
                  <Text style={[styles.outlineText, { color: blue }]}>View payout history</Text>
                </TouchableOpacity>

                <View style={styles.withdrawHead}>
                  <View style={[styles.miniIcon, { backgroundColor: isDark ? '#1E3A5F' : '#EAF2FF' }]}>
                    <Ionicons name="cash-outline" size={18} color={blue} />
                  </View>
                  <Text style={[styles.blockTitle, { color: text, marginTop: 0 }]}>Withdraw</Text>
                </View>
                <Text style={[styles.fieldLabel, { color: muted }]}>Amount (INR)</Text>
                <View style={[styles.amountBox, { borderColor: border, backgroundColor: fieldBg }]}>
                  <Text style={[styles.rupee, { color: muted }]}>₹</Text>
                  <TextInput
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="decimal-pad"
                    placeholder={String(dashboard.minimumWithdrawal || 1000)}
                    placeholderTextColor={muted}
                    style={[styles.amountInput, { color: text }]}
                  />
                  <Ionicons name="chevron-down" size={16} color={muted} />
                </View>
                <TouchableOpacity
                  style={[styles.primary, { backgroundColor: dashboard.canWithdraw ? blue : (isDark ? '#1E293B' : '#E8F1FF') }]}
                  disabled={busy || !dashboard.canWithdraw}
                  onPress={() => run(() => requestCreatorWithdrawal(Number(String(amount).replace(/,/g, ''))))}
                >
                  <Text style={[styles.primaryText, !dashboard.canWithdraw && { color: '#93A4C3' }]}>Request withdrawal</Text>
                </TouchableOpacity>
                <Text style={[styles.note, { color: muted }]}>
                  {dashboard.withdrawBlockReason
                    ? dashboard.withdrawBlockReason
                    : `Minimum withdrawal amount is ${inr(dashboard.minimumWithdrawal).replace('.00', '')}. Payouts are processed via bank transfer and may take 3–7 business days.`}
                </Text>
              </View>

              <View
                style={[styles.card, { backgroundColor: surface }]}
                onLayout={(event) => { historyY.current = event.nativeEvent.layout.y; }}
              >
                <Text style={[styles.cardTitle, { color: text }]}>Payout history</Text>
                {dashboard.withdrawals.length === 0 ? (
                  <Text style={[styles.note, { color: muted }]}>No withdrawals yet.</Text>
                ) : dashboard.withdrawals.map((row) => (
                  <View key={row.id} style={[styles.history, { borderColor: border }]}>
                    <Text style={{ color: text, fontWeight: '700' }}>{inr(row.amount)} · {row.method === 'upi' ? 'UPI' : 'Bank'}</Text>
                    <Text style={[styles.note, { color: muted }]}>
                      {row.status}{row.payoutReference ? ` · ${row.payoutReference}` : ''}{row.rejectionReason ? ` · ${row.rejectionReason}` : ''}{row.holdReason ? ` · ${row.holdReason}` : ''}
                    </Text>
                  </View>
                ))}
              </View>

              {dashboard.notices?.length ? (
                <View style={[styles.card, { backgroundColor: surface }]}>
                  <Text style={[styles.cardTitle, { color: text }]}>Notices</Text>
                  {dashboard.notices.map((notice, index) => (
                    <Text key={`${notice.at || index}`} style={[styles.note, { color: text }]}>{notice.message}</Text>
                  ))}
                </View>
              ) : null}

              <View onLayout={(event) => { rulesY.current = event.nativeEvent.layout.y; }} style={{ gap: 12 }}>
                <View style={[styles.card, { backgroundColor: surface }]}>
                  <View style={styles.ruleHead}>
                    <View style={[styles.miniIcon, { backgroundColor: isDark ? '#1E3A5F' : '#EAF2FF' }]}>
                      <Ionicons name="document-text-outline" size={18} color={blue} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.cardTitle, { color: text }]}>Program rules</Text>
                      <Text style={[styles.note, { color: muted }]}>
                        A view earns only when it comes from a logged-in TAATOM account that meets our eligibility criteria.
                      </Text>
                    </View>
                  </View>
                </View>
                <Rule icon="eye-outline" tint="#16A34A" bg={isDark ? '#052E16' : '#ECFDF3'} title="Eligible views" body="A view counts only if it comes from a logged-in TAATOM account that is not the video owner, is verified, watched at least one second, and has not already counted for that video. Logged-out traffic, repeats, and your own views do not earn." surface={surface} text={text} muted={muted} />
                <Rule icon="play-outline" tint="#7C3AED" bg={isDark ? '#2E1065' : '#F5F3FF'} title="Eligible content" body="Your own shorts and long videos that are active and not hidden, archived, flagged, or removed are eligible. Photos do not earn. YouTube imports do not earn unless TAATOM marks that video eligible." surface={surface} text={text} muted={muted} />
                <Rule icon="shield-checkmark-outline" tint="#EA580C" bg={isDark ? '#431407' : '#FFF7ED'} title="Original content" body="Content must be original, follow the community guidelines, and not infringe copyright." surface={surface} text={text} muted={muted} />
                <Rule icon="ban-outline" tint="#DC2626" bg={isDark ? '#450A0A' : '#FEF2F2'} title="Prohibited actions" body="Do not buy views or followers, use bots, automated viewing, fake accounts, view exchanges, or bug abuse. TAATOM may remove invalid views, reverse earnings, lock the account, hold a withdrawal, or end monetization." surface={surface} text={text} muted={muted} />
                <Rule icon="calendar-outline" tint={blue} bg={isDark ? '#1E3A5F' : '#EFF6FF'} title="Payout timeline" body={`This month's earnings stay pending until the Asia/Kolkata month is validated, then move to Available. The minimum withdrawal is ${inr(dashboard.minimumWithdrawal)} unless TAATOM changes it. Payouts are paid after a manual transfer. Timing depends on the bank, verification, and holidays.`} surface={surface} text={text} muted={muted} />
                <Rule icon="gift-outline" tint="#DB2777" bg={isDark ? '#500724' : '#FDF2F8'} title="Consistent growth" body="The program rewards consistent original travel content: create, share, engage, grow, and earn." surface={surface} text={text} muted={muted} />
                <Rule icon="lock-closed-outline" tint="#DC2626" bg={isDark ? '#450A0A' : '#FEF2F2'} title="Account standing" body={`${dashboard.consecutiveFailMonths} failing month(s) toward a lock at ${dashboard.failMonthsToLock}. A passing month resets that streak. Locked accounts unlock after ${dashboard.qualifyingMonthsToUnlock} qualifying month, and the available balance can still be withdrawn. Under review, new earnings stop. The account must stay verified. Activation is not automatic.`} surface={surface} text={text} muted={muted} />
              </View>
            </>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function QualifyRow({
  icon,
  label,
  gate,
  detail,
  text,
  muted,
  blue,
  soft,
  track,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  gate: MonetizationGate;
  detail: string;
  text: string;
  muted: string;
  blue: string;
  soft: string;
  track: string;
}) {
  const ratio = gate.required > 0 ? Math.min(1, gate.current / gate.required) : 0;
  return (
    <View style={styles.qualify}>
      <View style={[styles.miniIcon, { backgroundColor: soft }]}>
        <Ionicons name={icon} size={18} color={blue} />
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <View style={styles.rowBetween}>
          <Text style={[styles.qualifyLabel, { color: text }]}>{label}</Text>
          <Text style={[styles.qualifyCount, { color: gate.met ? '#16A34A' : blue }]}>
            {count(gate.current)} / {count(gate.required)}
          </Text>
        </View>
        <View style={[styles.track, { backgroundColor: track }]}>
          <View style={[styles.fill, { width: `${Math.max(ratio * 100, ratio > 0 ? 4 : 0)}%`, backgroundColor: gate.met ? '#16A34A' : blue }]} />
        </View>
        <Text style={[styles.note, { color: muted }]}>{detail}</Text>
      </View>
    </View>
  );
}

function Split({ label, value, text, muted }: { label: string; value: string; text: string; muted: string }) {
  return (
    <View style={styles.splitItem}>
      <Text style={[styles.note, { color: muted }]}>{label}</Text>
      <Text style={[styles.splitValue, { color: text }]}>{value}</Text>
    </View>
  );
}

function Field({
  icon,
  label,
  value,
  onChangeText,
  placeholder,
  text,
  muted,
  border,
  background,
  keyboardType,
  autoCapitalize,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  text: string;
  muted: string;
  border: string;
  background: string;
  keyboardType?: 'default' | 'number-pad' | 'decimal-pad';
  autoCapitalize?: 'none' | 'characters' | 'sentences';
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: muted }]}>{label}</Text>
      <View style={[styles.inputWrap, { borderColor: border, backgroundColor: background }]}>
        <Ionicons name={icon} size={16} color={muted} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          style={[styles.input, { color: text }]}
        />
      </View>
    </View>
  );
}

function Rule({
  icon,
  tint,
  bg,
  title,
  body,
  surface,
  text,
  muted,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  bg: string;
  title: string;
  body: string;
  surface: string;
  text: string;
  muted: string;
}) {
  return (
    <View style={[styles.card, { backgroundColor: surface }]}>
      <View style={styles.ruleHead}>
        <View style={[styles.miniIcon, { backgroundColor: bg }]}>
          <Ionicons name={icon} size={18} color={tint} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.qualifyLabel, { color: text }]}>{title}</Text>
          <Text style={[styles.note, { color: muted }]}>{body}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, alignItems: 'center' },
  kicker: { fontSize: 12, fontWeight: '600' },
  title: { fontSize: 20, fontWeight: '800' },
  loader: { marginTop: 48 },
  content: { padding: 16, gap: 14, paddingBottom: 48 },
  statusCard: { borderRadius: 24, padding: 16, gap: 12 },
  statusTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  dollar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  dollarMark: { fontSize: 22, fontWeight: '800' },
  statusCopy: { flex: 1, gap: 4 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusLabel: { fontSize: 13, fontWeight: '600' },
  statusTitle: { fontSize: 16, fontWeight: '800' },
  statusBody: { fontSize: 13, lineHeight: 18 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  pillGood: { backgroundColor: '#ECFDF3' },
  pillWarn: { backgroundColor: '#FFF7ED' },
  pillText: { fontSize: 12, fontWeight: '700' },
  card: { borderRadius: 22, padding: 16, gap: 12 },
  cardTitle: { fontSize: 16, fontWeight: '800' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  qualify: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  qualifyLabel: { fontSize: 15, fontWeight: '700' },
  qualifyCount: { fontSize: 14, fontWeight: '800' },
  track: { height: 8, borderRadius: 99, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 99 },
  miniIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  totalRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  totalValue: { fontSize: 28, fontWeight: '800' },
  split: { flexDirection: 'row', borderRadius: 16, paddingVertical: 12 },
  splitItem: { flex: 1, alignItems: 'center', gap: 2 },
  splitValue: { fontSize: 14, fontWeight: '800' },
  infoRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  note: { fontSize: 13, lineHeight: 18 },
  reason: { color: '#B45309', fontSize: 13, lineHeight: 18 },
  error: { color: '#B91C1C' },
  identityHead: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  verifyBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  verifyText: { fontSize: 11, fontWeight: '800' },
  blockTitle: { fontSize: 15, fontWeight: '800', marginTop: 4 },
  segment: { flexDirection: 'row', borderRadius: 14, padding: 4, gap: 4 },
  segmentBtn: { flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  segmentText: { fontWeight: '700', fontSize: 14 },
  field: { gap: 6 },
  fieldLabel: { fontSize: 12, fontWeight: '600' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
  },
  input: { flex: 1, paddingVertical: 12, fontSize: 15 },
  primary: { borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  outline: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5, backgroundColor: 'transparent' },
  outlineText: { fontWeight: '800', fontSize: 15 },
  withdrawHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  amountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
  },
  rupee: { fontSize: 16, fontWeight: '700' },
  amountInput: { flex: 1, paddingVertical: 12, fontSize: 16, fontWeight: '700' },
  history: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, gap: 2 },
  ruleHead: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
});
