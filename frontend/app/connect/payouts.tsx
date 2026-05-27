import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import {
  getMyPayouts,
  getCurrencySymbol,
  MyPayout,
  MyPayoutsResponse,
} from '../../services/connect';
import logger from '../../utils/logger';

const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth >= 768;
const isWeb = Platform.OS === 'web';
const isIOS = Platform.OS === 'ios';

const getFontFamily = () => {
  if (isWeb) return 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  if (isIOS) return 'System';
  return 'Roboto';
};

const MONTH_NAMES = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const formatAmount = (amount: number, currency: string) => {
  const sym = getCurrencySymbol(currency || 'INR');
  const n = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;
  const value = n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sym}${value}`;
};

const formatDate = (iso: string | null) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
};

const STATUS_META: Record<MyPayout['status'], { label: string; bg: string; color: string }> = {
  calculated: { label: 'Awaiting payout', bg: '#FEF3C7', color: '#92400E' },
  pending: { label: 'Pending', bg: '#FEF3C7', color: '#92400E' },
  processing: { label: 'Processing', bg: '#DBEAFE', color: '#1E40AF' },
  completed: { label: 'Paid', bg: '#D1FAE5', color: '#065F46' },
  failed: { label: 'Failed', bg: '#FEE2E2', color: '#991B1B' },
};

function StatusBadge({ status }: { status: MyPayout['status'] }) {
  const meta = STATUS_META[status] || STATUS_META.pending;
  return (
    <View style={[badgeStyles.badge, { backgroundColor: meta.bg }]}>
      <Text style={[badgeStyles.text, { color: meta.color }]}>{meta.label}</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 11,
    fontFamily: getFontFamily(),
    fontWeight: '600',
  },
});

function BreakdownRow({
  label,
  value,
  hint,
  themeColors,
  emphasize,
  negative,
}: {
  label: string;
  value: string;
  hint?: string;
  themeColors: any;
  emphasize?: boolean;
  negative?: boolean;
}) {
  return (
    <View style={breakdownStyles.row}>
      <View style={breakdownStyles.labelCol}>
        <Text
          style={[
            breakdownStyles.label,
            emphasize && breakdownStyles.labelEmphasize,
            { color: emphasize ? themeColors.text : themeColors.textSecondary },
          ]}
        >
          {label}
        </Text>
        {hint ? (
          <Text style={[breakdownStyles.hint, { color: themeColors.textSecondary }]}>{hint}</Text>
        ) : null}
      </View>
      <Text
        style={[
          breakdownStyles.value,
          emphasize && breakdownStyles.valueEmphasize,
          { color: emphasize ? themeColors.text : negative ? '#DC2626' : themeColors.text },
        ]}
      >
        {negative ? `−${value}` : value}
      </Text>
    </View>
  );
}

const breakdownStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  labelCol: {
    flex: 1,
    paddingRight: 12,
  },
  label: {
    fontSize: 13,
    fontFamily: getFontFamily(),
  },
  labelEmphasize: {
    fontWeight: '700',
    fontSize: 14,
  },
  hint: {
    fontSize: 11,
    fontFamily: getFontFamily(),
    marginTop: 2,
  },
  value: {
    fontSize: 13,
    fontFamily: getFontFamily(),
    fontVariant: ['tabular-nums'],
  },
  valueEmphasize: {
    fontWeight: '700',
    fontSize: 15,
  },
});

function PayoutCard({ payout, themeColors }: { payout: MyPayout; themeColors: any }) {
  const [expanded, setExpanded] = useState(false);
  const periodLabel = `${MONTH_NAMES[payout.periodMonth] || payout.periodMonth} ${payout.periodYear}`;
  const isIntl = payout.isInternational;
  const methodLabel = isIntl
    ? payout.payoutMethod === 'wise_bank'
      ? 'International bank'
      : 'Wise email'
    : payout.payoutMethod === 'cashfree_upi'
    ? 'UPI'
    : 'Bank transfer';

  return (
    <View style={[cardStyles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
      <TouchableOpacity
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.7}
        style={cardStyles.headerRow}
      >
        <View style={cardStyles.headerLeft}>
          <Text style={[cardStyles.period, { color: themeColors.text }]}>{periodLabel}</Text>
          <Text style={[cardStyles.pageName, { color: themeColors.textSecondary }]} numberOfLines={1}>
            {payout.pageName || 'Connect page'}
          </Text>
          <View style={cardStyles.metaRow}>
            <StatusBadge status={payout.status} />
            <Text style={[cardStyles.method, { color: themeColors.textSecondary }]}>· {methodLabel}</Text>
          </View>
        </View>
        <View style={cardStyles.headerRight}>
          <Text style={[cardStyles.payout, { color: themeColors.text }]}>
            {formatAmount(payout.creatorPayout, payout.currency)}
          </Text>
          <Text style={[cardStyles.subscriberCount, { color: themeColors.textSecondary }]}>
            {payout.subscriberCount} {payout.subscriberCount === 1 ? 'subscriber' : 'subscribers'}
          </Text>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={themeColors.textSecondary}
            style={{ marginTop: 4 }}
          />
        </View>
      </TouchableOpacity>

      {expanded ? (
        <View style={[cardStyles.breakdown, { borderTopColor: themeColors.border }]}>
          <BreakdownRow
            label="Gross collected"
            hint={`From ${payout.subscriberCount} ${payout.subscriberCount === 1 ? 'subscriber' : 'subscribers'}`}
            value={formatAmount(payout.grossAmount, payout.currency)}
            themeColors={themeColors}
            emphasize
          />
          <BreakdownRow
            label={`Cashfree gateway fee (${payout.gatewayFeePercent}%)`}
            hint="Paid to Cashfree"
            value={formatAmount(payout.gatewayFee, payout.currency)}
            themeColors={themeColors}
            negative
          />
          {isIntl && payout.fxCharge > 0 ? (
            <BreakdownRow
              label="FX charge"
              hint="Currency conversion"
              value={formatAmount(payout.fxCharge, payout.currency)}
              themeColors={themeColors}
              negative
            />
          ) : null}
          <BreakdownRow
            label="Net after gateway"
            value={formatAmount(payout.netAfterGateway, payout.currency)}
            themeColors={themeColors}
          />
          <BreakdownRow
            label={`Taatom commission (${payout.commissionPercent}%)`}
            hint="Includes platform fee"
            value={formatAmount(payout.commissionAmount, payout.currency)}
            themeColors={themeColors}
            negative
          />
          <BreakdownRow
            label={`GST (${payout.gstPercent}% of commission)`}
            hint="Borne by Taatom — not from your share"
            value={formatAmount(payout.gstAmount, payout.currency)}
            themeColors={themeColors}
          />
          {isIntl && payout.wiseFee > 0 ? (
            <BreakdownRow
              label={`Wise transfer fee (${payout.wiseFeePercent}%)`}
              hint="Borne by you (international transfer)"
              value={formatAmount(payout.wiseFee, payout.currency)}
              themeColors={themeColors}
              negative
            />
          ) : null}
          <View style={[cardStyles.divider, { backgroundColor: themeColors.border }]} />
          <BreakdownRow
            label="Your payout"
            value={formatAmount(payout.creatorPayout, payout.currency)}
            themeColors={themeColors}
            emphasize
          />

          {payout.status === 'completed' ? (
            <View style={[cardStyles.refBox, { backgroundColor: themeColors.background }]}>
              {payout.processedAt ? (
                <Text style={[cardStyles.refLine, { color: themeColors.textSecondary }]}>
                  Paid on {formatDate(payout.processedAt)}
                </Text>
              ) : null}
              {payout.payoutReference ? (
                <Text style={[cardStyles.refLine, { color: themeColors.text }]}>
                  Ref: {payout.payoutReference}
                </Text>
              ) : null}
            </View>
          ) : null}

          {payout.status === 'failed' && payout.failureReason ? (
            <View style={[cardStyles.refBox, { backgroundColor: '#FEE2E2' }]}>
              <Text style={[cardStyles.refLine, { color: '#991B1B' }]}>
                {payout.failureReason}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    padding: 14,
  },
  headerLeft: {
    flex: 1,
    paddingRight: 12,
  },
  period: {
    fontSize: 16,
    fontFamily: getFontFamily(),
    fontWeight: '700',
  },
  pageName: {
    fontSize: 13,
    fontFamily: getFontFamily(),
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  method: {
    fontSize: 11,
    fontFamily: getFontFamily(),
  },
  headerRight: {
    alignItems: 'flex-end',
    minWidth: 100,
  },
  payout: {
    fontSize: 18,
    fontFamily: getFontFamily(),
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  subscriberCount: {
    fontSize: 11,
    fontFamily: getFontFamily(),
    marginTop: 2,
  },
  breakdown: {
    borderTopWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  divider: {
    height: 1,
    marginVertical: 6,
  },
  refBox: {
    marginTop: 10,
    marginBottom: 4,
    padding: 10,
    borderRadius: 8,
  },
  refLine: {
    fontSize: 12,
    fontFamily: getFontFamily(),
    marginVertical: 1,
  },
});

export default function PayoutsScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const [data, setData] = useState<MyPayoutsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await getMyPayouts({ page: 1, limit: 20 });
      setData(res);
    } catch (err: any) {
      logger.error('Error loading my payouts:', err);
      setError(err?.message || 'Failed to load payouts');
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const totalEarned =
    typeof data?.summary.totalEarned === 'number' && Number.isFinite(data.summary.totalEarned)
      ? data.summary.totalEarned
      : 0;
  const totalPending =
    typeof data?.summary.totalPending === 'number' && Number.isFinite(data.summary.totalPending)
      ? data.summary.totalPending
      : 0;
  const payouts = data?.payouts ?? [];
  // Use the currency of the most recent payout for the summary cards (defaults INR if none).
  const summaryCurrency = payouts[0]?.currency || 'INR';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={isTablet ? 28 : 24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Payouts</Text>
        <View style={styles.headerRight} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={styles.scrollInner}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.primary}
            />
          }
        >
          <View style={styles.summaryRow}>
            <View style={[styles.summaryCard, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Total earned</Text>
              <Text style={[styles.summaryValue, { color: theme.colors.text }]}>
                {formatAmount(totalEarned, summaryCurrency)}
              </Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Pending</Text>
              <Text style={[styles.summaryValue, { color: '#D97706' }]}>
                {formatAmount(totalPending, summaryCurrency)}
              </Text>
            </View>
          </View>

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.errorText, { color: '#DC2626' }]}>{error}</Text>
              <TouchableOpacity onPress={load} activeOpacity={0.7}>
                <Text style={[styles.retryText, { color: theme.colors.primary }]}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {!error && payouts.length === 0 ? (
            <View style={[styles.emptyBox, { backgroundColor: theme.colors.surface }]}>
              <Ionicons name="cash-outline" size={40} color={theme.colors.textSecondary} />
              <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No payouts yet</Text>
              <Text style={[styles.emptyHint, { color: theme.colors.textSecondary }]}>
                Payouts are calculated monthly. Once you have active subscribers, your earnings appear here at month-end.
              </Text>
            </View>
          ) : null}

          {payouts.map((p) => (
            <PayoutCard key={p._id} payout={p} themeColors={theme.colors} />
          ))}

          <View style={styles.bottomPadding} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontFamily: getFontFamily(),
    fontWeight: '700',
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flex: 1,
  },
  scrollInner: {
    padding: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  summaryCard: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
  },
  summaryLabel: {
    fontSize: 12,
    fontFamily: getFontFamily(),
    marginBottom: 6,
  },
  summaryValue: {
    fontSize: 18,
    fontFamily: getFontFamily(),
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  emptyBox: {
    alignItems: 'center',
    padding: 32,
    borderRadius: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: getFontFamily(),
    fontWeight: '700',
    marginTop: 12,
  },
  emptyHint: {
    fontSize: 13,
    fontFamily: getFontFamily(),
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18,
  },
  errorBox: {
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontFamily: getFontFamily(),
  },
  retryText: {
    fontSize: 13,
    fontFamily: getFontFamily(),
    fontWeight: '600',
  },
  bottomPadding: {
    height: 40,
  },
});
