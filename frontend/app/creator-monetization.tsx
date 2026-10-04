import React, { useCallback, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
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

function ProgressRow({
  label,
  gate,
  color,
  muted,
  track,
  detail,
}: {
  label: string;
  gate: MonetizationGate;
  color: string;
  muted: string;
  track: string;
  detail?: string;
}) {
  const ratio = gate.required > 0 ? Math.min(1, gate.current / gate.required) : 0;
  return (
    <View style={styles.progressBlock}>
      <View style={styles.rowBetween}>
        <Text style={[styles.progressLabel, { color }]}>{label}</Text>
        <Text style={[styles.progressValue, { color: gate.met ? '#0F9D58' : color }]}>
          {gate.current.toLocaleString('en-IN')} / {gate.required.toLocaleString('en-IN')}
        </Text>
      </View>
      <View style={[styles.track, { backgroundColor: track }]}>
        <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: gate.met ? '#0F9D58' : '#1C73B4' }]} />
      </View>
      <Text style={[styles.hint, { color: muted }]}>
        {detail || (gate.met ? 'Requirement met' : 'Still short of this requirement')}
      </Text>
    </View>
  );
}

export default function CreatorMonetizationScreen() {
  const router = useRouter();
  const { theme: themeContext, isDark } = useTheme();
  const colors = themeContext?.colors || theme.colors;
  const hasLoaded = React.useRef(false);
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

  const surface = colors.surface || (isDark ? '#0F1C2E' : '#FFFFFF');
  const text = colors.text || (isDark ? '#FFFFFF' : '#0F172A');
  const muted = colors.textSecondary || (isDark ? '#94A3B8' : '#64748B');
  const border = colors.border || (isDark ? '#1E293B' : '#E2E8F0');
  const background = colors.background || (isDark ? '#07111F' : '#F4F7FB');

  const reason = dashboard?.status === 'locked'
    ? dashboard.lockReason
    : dashboard?.status === 'under_review' || dashboard?.status === 'terminated'
      ? dashboard.reviewReason || dashboard.lockReason
      : dashboard?.withdrawalHoldReason || '';

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: background }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: surface, borderBottomColor: border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" size={22} color={text} />
        </TouchableOpacity>
        <View>
          <Text style={[styles.kicker, { color: muted }]}>Creator Dashboard</Text>
          <Text style={[styles.title, { color: text }]}>Monetization</Text>
        </View>
      </View>

      {loading && !dashboard ? (
        <ActivityIndicator style={styles.loader} color="#1C73B4" />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} />}
        >
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {dashboard ? (
            <>
              <View style={[styles.card, { backgroundColor: surface, borderColor: border }]}>
                <View style={styles.rowBetween}>
                  <Text style={[styles.section, { color: text }]}>Status</Text>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{STATUS_LABEL[dashboard.status] || dashboard.status}</Text>
                  </View>
                </View>
                <Text style={[styles.hint, { color: muted }]}>
                  Month {dashboard.monthKey} · Asia/Kolkata. Activation is not automatic.
                </Text>
                {reason ? <Text style={styles.reason}>{reason}</Text> : null}
                <ProgressRow label="Followers" gate={dashboard.followers} color={text} muted={muted} track={border} />
                <ProgressRow label="Videos this month" gate={dashboard.videos} color={text} muted={muted} track={border} />
                <ProgressRow label="Monthly views" gate={dashboard.monthlyViews} color={text} muted={muted} track={border} detail="All views recorded this month" />
                <ProgressRow label="Eligible views" gate={dashboard.eligibleViewsProgress} color={text} muted={muted} track={border} detail={dashboard.eligibleViewsProgress.met ? 'These valid views meet the requirement and are used for earnings' : 'Only valid views count toward the requirement and earnings'} />
              </View>

              <View style={[styles.card, { backgroundColor: surface, borderColor: border }]}>
                <Text style={[styles.section, { color: text }]}>Earnings</Text>
                <Text style={[styles.hint, { color: muted }]}>
                  Rate {inr(dashboard.ratePerThousand)} per 1,000 eligible views.
                  {dashboard.ratePerThousand > 0 ? ' This month stays pending until the month is validated.' : ' TAATOM has not set a rupee rate yet, so earnings stay at ₹0.00.'}
                  {dashboard.status === 'eligible' || dashboard.status === 'not_eligible' ? ' Views before you activate do not earn.' : ''}
                </Text>
                <View style={styles.moneyGrid}>
                  <Money label="This month" value={inr(dashboard.thisMonthEarnings)} text={text} muted={muted} />
                  <Money label="Pending" value={inr(dashboard.pending)} text={text} muted={muted} />
                  <Money label="Available" value={inr(dashboard.available)} text={text} muted={muted} />
                  <Money label="Withdrawn" value={inr(dashboard.withdrawn)} text={text} muted={muted} />
                </View>
                {dashboard.canActivate ? (
                  <TouchableOpacity style={styles.primary} disabled={busy} onPress={() => run(activateCreatorMonetization)}>
                    <Text style={styles.primaryText}>{busy ? 'Working…' : 'Activate monetization'}</Text>
                  </TouchableOpacity>
                ) : null}
                {!dashboard.canWithdraw && dashboard.withdrawBlockReason ? (
                  <Text style={[styles.hint, { color: muted }]}>{dashboard.withdrawBlockReason}</Text>
                ) : null}
              </View>

              <View style={[styles.card, { backgroundColor: surface, borderColor: border }]}>
                <Text style={[styles.section, { color: text }]}>Payout and identity</Text>
                <Text style={[styles.hint, { color: muted }]}>
                  Verification: {dashboard.verificationStatus}. {dashboard.verificationNote}
                </Text>
                <Field label="Legal name" value={legalName} onChangeText={setLegalName} text={text} border={border} muted={muted} />
                <View style={styles.methodRow}>
                  {dashboard.paymentMethods.map((item) => (
                    <TouchableOpacity
                      key={item}
                      style={[styles.method, method === item && styles.methodOn]}
                      onPress={() => setMethod(item as 'bank' | 'upi')}
                    >
                      <Text style={[styles.methodText, { color: method === item ? '#fff' : text }]}>
                        {item === 'bank' ? 'Bank account' : 'UPI'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {method === 'bank' ? (
                  <>
                    <Field label="Account name" value={bankAccountName} onChangeText={setBankAccountName} text={text} border={border} muted={muted} />
                    <Field label="Account number" value={bankAccountNumber} onChangeText={setBankAccountNumber} text={text} border={border} muted={muted} placeholder={dashboard.payoutProfile.bankAccountNumber || 'Account number'} keyboardType="number-pad" />
                    <Field label="IFSC" value={bankIfsc} onChangeText={setBankIfsc} text={text} border={border} muted={muted} autoCapitalize="characters" />
                  </>
                ) : (
                  <Field label="UPI ID" value={upiId} onChangeText={setUpiId} text={text} border={border} muted={muted} autoCapitalize="none" />
                )}
                {dashboard.requireTaxIdentity ? (
                  <Field label="PAN" value={taxId} onChangeText={setTaxId} text={text} border={border} muted={muted} autoCapitalize="characters" placeholder={dashboard.payoutProfile.taxId || 'PAN'} />
                ) : null}
                <TouchableOpacity
                  style={styles.secondary}
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
                  <Text style={styles.secondaryText}>Save payout details</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondary} disabled={busy} onPress={() => run(submitCreatorVerification)}>
                  <Text style={styles.secondaryText}>Submit for verification</Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.card, { backgroundColor: surface, borderColor: border }]}>
                <Text style={[styles.section, { color: text }]}>Withdraw</Text>
                <Field label="Amount (INR)" value={amount} onChangeText={setAmount} text={text} border={border} muted={muted} keyboardType="decimal-pad" />
                <TouchableOpacity
                  style={[styles.primary, !dashboard.canWithdraw && styles.disabled]}
                  disabled={busy || !dashboard.canWithdraw}
                  onPress={() => run(() => requestCreatorWithdrawal(Number(amount)))}
                >
                  <Text style={styles.primaryText}>Request withdrawal</Text>
                </TouchableOpacity>
                <Text style={[styles.hint, { color: muted }]}>
                  Minimum {inr(dashboard.minimumWithdrawal)}. TAATOM marks the payout paid after a manual transfer. Timing depends on the bank, verification, and holidays.
                </Text>
                {dashboard.withdrawals.map((row) => (
                  <View key={row.id} style={[styles.history, { borderColor: border }]}>
                    <Text style={{ color: text, fontWeight: '600' }}>{inr(row.amount)} · {row.method.toUpperCase()}</Text>
                    <Text style={[styles.hint, { color: muted }]}>
                      {row.status}{row.payoutReference ? ` · ${row.payoutReference}` : ''}{row.rejectionReason ? ` · ${row.rejectionReason}` : ''}{row.holdReason ? ` · ${row.holdReason}` : ''}
                    </Text>
                  </View>
                ))}
              </View>

              {dashboard.notices?.length ? (
                <View style={[styles.card, { backgroundColor: surface, borderColor: border }]}>
                  <Text style={[styles.section, { color: text }]}>Notices</Text>
                  {dashboard.notices.map((notice, index) => (
                    <Text key={`${notice.at || index}`} style={[styles.hint, { color: text }]}>{notice.message}</Text>
                  ))}
                </View>
              ) : null}

              <View style={[styles.card, { backgroundColor: surface, borderColor: border }]}>
                <Text style={[styles.section, { color: text }]}>Program rules</Text>
                <Text style={[styles.policy, { color: muted }]}>{dashboard.policyText}</Text>
                <Text style={[styles.hint, { color: muted }]}>
                  {dashboard.consecutiveFailMonths} failing month(s) toward a lock at {dashboard.failMonthsToLock}. Locked accounts unlock after {dashboard.qualifyingMonthsToUnlock} qualifying month.
                </Text>
              </View>
            </>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Money({ label, value, text, muted }: { label: string; value: string; text: string; muted: string }) {
  return (
    <View style={styles.money}>
      <Text style={[styles.hint, { color: muted }]}>{label}</Text>
      <Text style={[styles.moneyValue, { color: text }]}>{value}</Text>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  text,
  border,
  muted,
  placeholder,
  keyboardType,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  text: string;
  border: string;
  muted: string;
  placeholder?: string;
  keyboardType?: 'default' | 'number-pad' | 'decimal-pad';
  autoCapitalize?: 'none' | 'characters' | 'sentences';
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: muted }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder || label}
        placeholderTextColor={muted}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        style={[styles.input, { color: text, borderColor: border }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  back: { padding: 4 },
  kicker: { fontSize: 12, fontWeight: '600' },
  title: { fontSize: 20, fontWeight: '700' },
  loader: { marginTop: 40 },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 10 },
  section: { fontSize: 16, fontWeight: '700' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  badge: { backgroundColor: '#1C73B4', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  progressBlock: { gap: 4 },
  progressLabel: { fontSize: 14, fontWeight: '600' },
  progressValue: { fontSize: 13, fontWeight: '600' },
  track: { height: 8, borderRadius: 99, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 99 },
  hint: { fontSize: 13, lineHeight: 18 },
  reason: { color: '#B45309', fontSize: 14, lineHeight: 20 },
  error: { color: '#B91C1C', marginBottom: 8 },
  moneyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  money: { width: '47%', gap: 2 },
  moneyValue: { fontSize: 18, fontWeight: '700' },
  primary: { backgroundColor: '#1C73B4', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '700' },
  secondary: { borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#1C73B4' },
  secondaryText: { color: '#1C73B4', fontWeight: '700' },
  disabled: { opacity: 0.45 },
  methodRow: { flexDirection: 'row', gap: 8 },
  method: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  methodOn: { backgroundColor: '#1C73B4', borderColor: '#1C73B4' },
  methodText: { fontWeight: '600' },
  field: { gap: 4 },
  fieldLabel: { fontSize: 12, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  history: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8 },
  policy: { fontSize: 14, lineHeight: 21 },
});
