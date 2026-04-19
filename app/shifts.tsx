import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../src/context/AuthContext';
import { useTranslation } from '../src/hooks/useTranslation';
import { getDriverCompletedShifts, getDriverHistory } from '../src/services/api';

type ShiftItem = {
  id: number | string;
  startVagt?: string | null;
  endVagt?: string | null;
  startKM?: number | null;
  endKM?: number | null;
  deffKM?: number | null;
  workTime?: number | null;
  salary?: number | null;
  ridesCount?: number | null;
};

type ShiftSummary = {
  totalShifts: number;
  totalWorkHours: number;
  totalEarnings: number;
  totalDistance: number;
};

type HistoryRide = {
  id?: number | string;
  createdAt?: string | null;
  price?: number | null;
  distanceKm?: number | null;
};

const EMPTY_SUMMARY: ShiftSummary = {
  totalShifts: 0,
  totalWorkHours: 0,
  totalEarnings: 0,
  totalDistance: 0,
};

const formatIsoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toSafeNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const buildSummary = (items: ShiftItem[]): ShiftSummary => {
  return {
    totalShifts: items.length,
    totalWorkHours: items.reduce((sum, item) => sum + toSafeNumber(item.workTime), 0),
    totalEarnings: items.reduce((sum, item) => sum + toSafeNumber(item.salary), 0),
    totalDistance: items.reduce((sum, item) => sum + toSafeNumber(item.deffKM), 0),
  };
};

const buildShiftFallbackFromHistory = (rides: HistoryRide[]): ShiftItem[] => {
  const grouped = new Map<string, HistoryRide[]>();

  rides.forEach((ride) => {
    if (!ride.createdAt) return;
    const created = new Date(ride.createdAt);
    if (Number.isNaN(created.getTime())) return;

    const key = formatIsoDate(created);
    const existing = grouped.get(key) || [];
    existing.push(ride);
    grouped.set(key, existing);
  });

  return Array.from(grouped.entries())
    .map(([day, dayRides], index): ShiftItem => {
      const sortedRides = [...dayRides].sort((a, b) => {
        const first = new Date(a.createdAt || '').getTime();
        const second = new Date(b.createdAt || '').getTime();
        return first - second;
      });

      const firstRideDate = new Date(sortedRides[0]?.createdAt || '');
      const lastRideDate = new Date(sortedRides[sortedRides.length - 1]?.createdAt || '');

      const startMs = firstRideDate.getTime();
      const endMs = lastRideDate.getTime();
      const workTimeHours =
        Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs
          ? (endMs - startMs) / (1000 * 60 * 60)
          : 0;

      return {
        id: `fallback-${day}-${index}`,
        startVagt: Number.isFinite(startMs) ? firstRideDate.toISOString() : null,
        endVagt: Number.isFinite(endMs) ? lastRideDate.toISOString() : null,
        workTime: workTimeHours,
        salary: sortedRides.reduce((sum, ride) => sum + toSafeNumber(ride.price), 0),
        deffKM: sortedRides.reduce((sum, ride) => sum + toSafeNumber(ride.distanceKm), 0),
        ridesCount: sortedRides.length,
      };
    })
    .sort((a, b) => {
      const first = new Date(a.startVagt || '').getTime();
      const second = new Date(b.startVagt || '').getTime();
      return second - first;
    });
};

export default function ShiftsScreen() {
  const { authState } = useAuth();
  const router = useRouter();
  const { t, getCurrentLanguage } = useTranslation();

  const [shifts, setShifts] = useState<ShiftItem[]>([]);
  const [summary, setSummary] = useState<ShiftSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const isMountedRef = useRef(true);

  const language = getCurrentLanguage();
  const locale = language === 'ar' ? 'ar-EG' : language === 'da' ? 'da-DK' : 'en-GB';

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const formatDateTime = useCallback(
    (dateString?: string | null) => {
      if (!dateString) return t('not_available');
      const date = new Date(dateString);
      if (Number.isNaN(date.getTime())) return t('not_available');

      return date.toLocaleString(locale, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    },
    [locale, t]
  );

  const formatNumber = useCallback(
    (value?: number | null, maximumFractionDigits = 0) => {
      return new Intl.NumberFormat(locale, { maximumFractionDigits }).format(toSafeNumber(value));
    },
    [locale]
  );

  const loadShifts = useCallback(
    async (isRefresh = false) => {
      if (!authState.token || !isMountedRef.current) return;

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const response = await getDriverCompletedShifts(authState.token, 120);

        if (!isMountedRef.current) return;

        if (response?.ok && Array.isArray(response.shifts)) {
          const normalizedShifts: ShiftItem[] = response.shifts
            .filter((shift: any) => shift?.endVagt)
            .map((shift: any) => ({
              id: shift.id,
              startVagt: shift.startVagt || null,
              endVagt: shift.endVagt || null,
              startKM: shift.startKM,
              endKM: shift.endKM,
              deffKM: shift.deffKM,
              workTime: shift.workTime,
              salary: shift.salary,
              ridesCount: shift.ridesCount,
            }));

          const nextSummary: ShiftSummary = response.summary
            ? {
                totalShifts: toSafeNumber(response.summary.totalShifts) || normalizedShifts.length,
                totalWorkHours: toSafeNumber(response.summary.totalWorkHours),
                totalEarnings: toSafeNumber(response.summary.totalEarnings),
                totalDistance: toSafeNumber(response.summary.totalDistance),
              }
            : buildSummary(normalizedShifts);

          setShifts(normalizedShifts);
          setSummary(nextSummary);
          return;
        }

        throw new Error('Invalid shifts response');
      } catch (error) {
        console.warn('Completed shifts API failed. Falling back to grouped history.', error);

        try {
          const today = new Date();
          const threeMonthsAgo = new Date(today);
          threeMonthsAgo.setMonth(today.getMonth() - 3);

          const fallbackHistory = await getDriverHistory(
            authState.token,
            formatIsoDate(threeMonthsAgo),
            formatIsoDate(today)
          );

          if (!isMountedRef.current) return;

          if (fallbackHistory?.ok && Array.isArray(fallbackHistory.rides)) {
            const fallbackShifts = buildShiftFallbackFromHistory(fallbackHistory.rides);
            setShifts(fallbackShifts);
            setSummary(buildSummary(fallbackShifts));
            return;
          }
        } catch (fallbackError) {
          console.error('Fallback history loading failed:', fallbackError);
        }

        if (isMountedRef.current) {
          setShifts([]);
          setSummary(EMPTY_SUMMARY);
          Alert.alert(t('error'), t('shifts_load_failed'));
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [authState.token, t]
  );

  useFocusEffect(
    useCallback(() => {
      loadShifts(false);

      return () => {};
    }, [loadShifts])
  );

  const onRefreshData = useCallback(async () => {
    await loadShifts(true);
  }, [loadShifts]);

  const goBack = useCallback(() => {
    router.back();
  }, [router]);

  const openShiftHistory = useCallback(
    (shift: ShiftItem) => {
      if (!shift.startVagt || !shift.endVagt) {
        Alert.alert(t('error'), t('shifts_missing_time'));
        return;
      }

      router.push({
        pathname: '/history',
        params: {
          fromShift: '1',
          shiftId: String(shift.id),
          shiftStart: shift.startVagt,
          shiftEnd: shift.endVagt,
        },
      });
    },
    [router, t]
  );

  const summaryCards = useMemo(
    () => [
      {
        key: 'totalShifts',
        icon: 'layers-outline' as const,
        label: t('total_shifts'),
        value: formatNumber(summary.totalShifts),
      },
      {
        key: 'totalWorkHours',
        icon: 'time-outline' as const,
        label: t('shifts_total_hours'),
        value: `${formatNumber(summary.totalWorkHours, 1)} ${t('hours_short')}`,
      },
      {
        key: 'totalEarnings',
        icon: 'wallet-outline' as const,
        label: t('total_amount'),
        value: `${formatNumber(summary.totalEarnings)} DKK`,
      },
      {
        key: 'totalDistance',
        icon: 'navigate-outline' as const,
        label: t('shifts_total_distance'),
        value: `${formatNumber(summary.totalDistance, 1)} ${t('kilometers_short')}`,
      },
    ],
    [formatNumber, summary.totalDistance, summary.totalEarnings, summary.totalShifts, summary.totalWorkHours, t]
  );

  const renderShiftItem = useCallback(
    ({ item }: { item: ShiftItem }) => {
      return (
        <TouchableOpacity
          style={styles.shiftCard}
          activeOpacity={0.9}
          onPress={() => openShiftHistory(item)}
        >
          <View style={styles.shiftCardTopRow}>
            <View style={styles.shiftBadge}>
              <Text style={styles.shiftBadgeText}>#{item.id}</Text>
            </View>
            <View style={styles.arrowWrap}>
              <Ionicons name="chevron-forward" size={18} color="#1d4ed8" />
            </View>
          </View>

          <View style={styles.dateRow}>
            <Ionicons name="play-circle-outline" size={16} color="#16a34a" />
            <Text style={styles.dateText}>
              {t('shifts_started_at')}: {formatDateTime(item.startVagt)}
            </Text>
          </View>

          <View style={styles.dateRow}>
            <Ionicons name="stop-circle-outline" size={16} color="#dc2626" />
            <Text style={styles.dateText}>
              {t('shifts_ended_at')}: {formatDateTime(item.endVagt)}
            </Text>
          </View>

          <View style={styles.metricsRow}>
            <View style={styles.metricPill}>
              <Text style={styles.metricLabel}>{t('shifts_work_time')}</Text>
              <Text style={styles.metricValue}>
                {formatNumber(item.workTime, 1)} {t('hours_short')}
              </Text>
            </View>

            <View style={styles.metricPill}>
              <Text style={styles.metricLabel}>{t('shifts_earnings')}</Text>
              <Text style={styles.metricValue}>{formatNumber(item.salary)} DKK</Text>
            </View>
          </View>

          <View style={styles.metricsRow}>
            <View style={styles.metricPill}>
              <Text style={styles.metricLabel}>{t('shifts_distance')}</Text>
              <Text style={styles.metricValue}>
                {formatNumber(item.deffKM, 1)} {t('kilometers_short')}
              </Text>
            </View>

            <View style={styles.metricPill}>
              <Text style={styles.metricLabel}>{t('shifts_rides')}</Text>
              <Text style={styles.metricValue}>{formatNumber(item.ridesCount)}</Text>
            </View>
          </View>

          <View style={styles.ctaRow}>
            <Text style={styles.ctaText}>{t('shifts_open_history')}</Text>
            <Ionicons name="arrow-forward-circle" size={18} color="#2563eb" />
          </View>
        </TouchableOpacity>
      );
    },
    [formatDateTime, formatNumber, openShiftHistory, t]
  );

  const renderEmptyState = useCallback(() => {
    return (
      <View style={styles.emptyState}>
        {loading ? <ActivityIndicator size="large" color="#1d4ed8" /> : null}
        <Text style={styles.emptyText}>{loading ? t('shifts_loading') : t('shifts_no_data')}</Text>
      </View>
    );
  }, [loading, t]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={goBack}>
          <Ionicons name="chevron-back" size={20} color="#1d4ed8" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('completed_shifts')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <FlatList
        data={shifts}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderShiftItem}
        style={styles.list}
        contentContainerStyle={[
          styles.listContent,
          shifts.length === 0 ? styles.listContentEmpty : undefined,
        ]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.summaryGrid}>
            {summaryCards.map((card) => (
              <View key={card.key} style={styles.summaryCard}>
                <View style={styles.summaryIconWrap}>
                  <Ionicons name={card.icon} size={16} color="#1d4ed8" />
                </View>
                <Text style={styles.summaryLabel}>{card.label}</Text>
                <Text style={styles.summaryValue}>{card.value}</Text>
              </View>
            ))}
          </View>
        }
        ListEmptyComponent={renderEmptyState}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefreshData} tintColor="#1d4ed8" />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eef3fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginHorizontal: 12,
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryCard: {
    width: '48.5%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dbeafe',
    padding: 12,
    marginBottom: 10,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: '#dbeafe',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    color: '#0f172a',
    fontWeight: '800',
  },
  shiftCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dbeafe',
    padding: 14,
    marginBottom: 12,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  shiftCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  shiftBadge: {
    backgroundColor: '#eff6ff',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  shiftBadgeText: {
    color: '#1e40af',
    fontSize: 12,
    fontWeight: '800',
  },
  arrowWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  dateText: {
    marginLeft: 6,
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  metricPill: {
    width: '48.5%',
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  metricLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '700',
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 13,
    color: '#0f172a',
    fontWeight: '800',
  },
  ctaRow: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ctaText: {
    fontSize: 13,
    color: '#2563eb',
    fontWeight: '800',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  emptyText: {
    marginTop: 12,
    textAlign: 'center',
    fontSize: 15,
    color: '#64748b',
    fontWeight: '600',
  },
});
