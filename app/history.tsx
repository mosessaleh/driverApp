import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../src/context/AuthContext';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { getDriverHistory } from '../src/services/api';
import { offRideOffer, onRideOffer } from '../src/services/socket';
import { useTranslation } from '../src/hooks/useTranslation';

type RideItem = {
  id: number | string;
  pickupAddress?: string | null;
  stopAddress?: string | null;
  dropoffAddress?: string | null;
  createdAt?: string | null;
  status?: string;
  cancellationReason?: string | null;
  canceledBy?: string | null;
  price?: number | null;
};

type HistorySummary = {
  totalRides: number;
  totalAmount: number;
};

type QuickFilterKey = 'today' | 'thisWeek' | 'allTime' | 'custom';

type DateRange = {
  startDate?: string;
  endDate?: string;
};

type ShiftWindow = {
  startMs: number;
  endMs: number;
  startIso: string;
  endIso: string;
  shiftId?: string;
};

const MAX_RETRIES = 3;

const formatLocalDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateForInput = (date: Date) => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const buildIsoFromDateParts = (year: number, month: number, day: number): string | null => {
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const parseDateInput = (value: string): { iso?: string; isValid: boolean } => {
  const trimmed = value.trim();
  if (!trimmed) {
    return { iso: undefined, isValid: true };
  }

  const slashMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (slashMatch) {
    const [, dd, mm, yyyy] = slashMatch;
    const iso = buildIsoFromDateParts(Number(yyyy), Number(mm), Number(dd));
    return iso ? { iso, isValid: true } : { isValid: false };
  }

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, yyyy, mm, dd] = isoMatch;
    const iso = buildIsoFromDateParts(Number(yyyy), Number(mm), Number(dd));
    return iso ? { iso, isValid: true } : { isValid: false };
  }

  return { isValid: false };
};

const getSingleParam = (value: string | string[] | undefined): string | undefined => {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
};

export default function HistoryScreen() {
  const { authState } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{
    fromShift?: string | string[];
    shiftId?: string | string[];
    shiftStart?: string | string[];
    shiftEnd?: string | string[];
  }>();
  const { t, getCurrentLanguage } = useTranslation();

  const [rides, setRides] = useState<RideItem[]>([]);
  const [summary, setSummary] = useState<HistorySummary>({ totalRides: 0, totalAmount: 0 });
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterVisible, setFilterVisible] = useState(false);
  const [activeQuickFilter, setActiveQuickFilter] = useState<QuickFilterKey>('allTime');
  const [activeShiftWindow, setActiveShiftWindow] = useState<ShiftWindow | null>(null);

  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const appliedRangeRef = useRef<DateRange>({});
  const shiftWindowRef = useRef<ShiftWindow | null>(null);

  const language = getCurrentLanguage();
  const locale = language === 'ar' ? 'ar-EG' : language === 'da' ? 'da-DK' : 'en-GB';

  const quickFilterOptions = useMemo(
    () => [
      { key: 'today' as const, label: t('filter_today') },
      { key: 'thisWeek' as const, label: t('filter_this_week') },
      { key: 'allTime' as const, label: t('filter_all_time') },
    ],
    [t]
  );

  const clearRetryTimeout = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, []);

  const loadHistory = useCallback(
    async (range: DateRange = appliedRangeRef.current, retryCount = 0) => {
      if (!authState.token || !isMountedRef.current) return;

      setLoading(true);
      try {
        const response = await getDriverHistory(authState.token, range.startDate, range.endDate);

        if (!isMountedRef.current) return;

        if (response.ok && Array.isArray(response.rides)) {
          const currentShiftWindow = shiftWindowRef.current;
          const filteredRides = currentShiftWindow
            ? response.rides.filter((ride: RideItem) => {
                const createdAtMs = new Date(ride.createdAt || '').getTime();
                if (!Number.isFinite(createdAtMs)) return false;
                return createdAtMs >= currentShiftWindow.startMs && createdAtMs <= currentShiftWindow.endMs;
              })
            : response.rides;

          const computedSummary = currentShiftWindow
            ? {
                totalRides: filteredRides.length,
                totalAmount: filteredRides.reduce((sum: number, ride: RideItem) => {
                  const price = Number(ride.price ?? 0);
                  return sum + (Number.isFinite(price) ? price : 0);
                }, 0),
              }
            : response.summary || { totalRides: 0, totalAmount: 0 };

          setRides(filteredRides);
          setSummary(computedSummary);
          return;
        }

        Alert.alert(t('error'), t('history_load_failed'));
      } catch (error) {
        console.error('Error loading history:', error);
        if (retryCount < MAX_RETRIES - 1) {
          const delay = Math.pow(2, retryCount) * 1000;
          clearRetryTimeout();
          retryTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current) {
              loadHistory(range, retryCount + 1);
            }
          }, delay);
          return;
        }

        if (isMountedRef.current) {
          Alert.alert(t('error'), t('history_load_failed_multiple'));
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    },
    [authState.token, clearRetryTimeout, t]
  );

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      clearRetryTimeout();
    };
  }, [clearRetryTimeout]);

  useEffect(() => {
    const handleRideOffer = () => {
      router.replace('/dashboard');
    };

    onRideOffer(handleRideOffer);

    return () => {
      offRideOffer(handleRideOffer);
    };
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      if (authState.token) {
        loadHistory(appliedRangeRef.current);
      }

      return () => {};
    }, [authState.token, loadHistory])
  );

  useEffect(() => {
    const fromShift = getSingleParam(params.fromShift);
    const shiftId = getSingleParam(params.shiftId);
    const shiftStart = getSingleParam(params.shiftStart);
    const shiftEnd = getSingleParam(params.shiftEnd);

    if (fromShift === '1' && shiftStart && shiftEnd) {
      const startMs = new Date(shiftStart).getTime();
      const endMs = new Date(shiftEnd).getTime();

      if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs >= startMs) {
        const shiftWindow: ShiftWindow = {
          startMs,
          endMs,
          startIso: new Date(startMs).toISOString(),
          endIso: new Date(endMs).toISOString(),
          shiftId,
        };

        shiftWindowRef.current = shiftWindow;
        setActiveShiftWindow(shiftWindow);

        const range: DateRange = {
          startDate: formatLocalDate(new Date(startMs)),
          endDate: formatLocalDate(new Date(endMs)),
        };

        appliedRangeRef.current = range;
        setStartDate(formatDateForInput(new Date(startMs)));
        setEndDate(formatDateForInput(new Date(endMs)));
        setActiveQuickFilter('custom');
        setFilterVisible(false);

        if (authState.token) {
          loadHistory(range);
        }

        return;
      }
    }

    shiftWindowRef.current = null;
    setActiveShiftWindow(null);
  }, [authState.token, loadHistory, params.fromShift, params.shiftEnd, params.shiftId, params.shiftStart]);

  const onRefreshData = useCallback(async () => {
    setRefreshing(true);
    await loadHistory(appliedRangeRef.current);
    if (isMountedRef.current) {
      setRefreshing(false);
    }
  }, [loadHistory]);

  const formatDate = useCallback(
    (dateString?: string | null) => {
      if (!dateString) return t('not_available');
      const date = new Date(dateString);
      if (Number.isNaN(date.getTime())) return t('not_available');

      return date.toLocaleDateString(locale, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    },
    [locale, t]
  );

  const formatTime = useCallback(
    (dateString?: string | null) => {
      if (!dateString) return '--:--';
      const date = new Date(dateString);
      if (Number.isNaN(date.getTime())) return '--:--';

      return date.toLocaleTimeString(locale, {
        hour: '2-digit',
        minute: '2-digit',
      });
    },
    [locale]
  );

  const formatAmount = useCallback(
    (amount?: number | null) => {
      const numeric = Number(amount ?? 0);
      return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(
        Number.isFinite(numeric) ? numeric : 0
      );
    },
    [locale]
  );

  const buildQuickFilterRange = useCallback(
    (filterKey: Exclude<QuickFilterKey, 'custom'>): { range: DateRange; startInput: string; endInput: string } => {
      const now = new Date();

      if (filterKey === 'today') {
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const iso = formatLocalDate(today);
        const input = formatDateForInput(today);
        return {
          range: { startDate: iso, endDate: iso },
          startInput: input,
          endInput: input,
        };
      }

      if (filterKey === 'thisWeek') {
        const dayOfWeek = now.getDay();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);

        return {
          range: {
            startDate: formatLocalDate(startOfWeek),
            endDate: formatLocalDate(endOfWeek),
          },
          startInput: formatDateForInput(startOfWeek),
          endInput: formatDateForInput(endOfWeek),
        };
      }

      return {
        range: {},
        startInput: '',
        endInput: '',
      };
    },
    []
  );

  const handleQuickFilter = useCallback(
    async (filterKey: Exclude<QuickFilterKey, 'custom'>) => {
      const { range, startInput, endInput } = buildQuickFilterRange(filterKey);

      setActiveQuickFilter(filterKey);
      setStartDate(startInput);
      setEndDate(endInput);
      setFilterVisible(false);

      appliedRangeRef.current = range;
      await loadHistory(range);
    },
    [buildQuickFilterRange, loadHistory]
  );

  const validateFilterInputs = useCallback((): DateRange | null => {
    const parsedStart = parseDateInput(startDate);
    const parsedEnd = parseDateInput(endDate);

    if (!parsedStart.isValid || !parsedEnd.isValid) {
      Alert.alert(t('error'), t('history_invalid_date_format'));
      return null;
    }

    if (parsedStart.iso && parsedEnd.iso && parsedStart.iso > parsedEnd.iso) {
      Alert.alert(t('error'), t('history_invalid_date_range'));
      return null;
    }

    return {
      startDate: parsedStart.iso,
      endDate: parsedEnd.iso,
    };
  }, [endDate, startDate, t]);

  const handleFilter = useCallback(async () => {
    const nextRange = validateFilterInputs();
    if (!nextRange) return;

    if (shiftWindowRef.current) {
      shiftWindowRef.current = null;
      setActiveShiftWindow(null);
      router.replace('/history');
    }

    appliedRangeRef.current = nextRange;
    setActiveQuickFilter(nextRange.startDate || nextRange.endDate ? 'custom' : 'allTime');
    setFilterVisible(false);
    await loadHistory(nextRange);
  }, [loadHistory, router, validateFilterInputs]);

  const handleClearFilter = useCallback(async () => {
    if (shiftWindowRef.current) {
      shiftWindowRef.current = null;
      setActiveShiftWindow(null);
      router.replace('/history');
    }

    setStartDate('');
    setEndDate('');
    setActiveQuickFilter('allTime');
    setFilterVisible(false);

    appliedRangeRef.current = {};
    await loadHistory({});
  }, [loadHistory, router]);

  const handleShowAllHistory = useCallback(async () => {
    shiftWindowRef.current = null;
    setActiveShiftWindow(null);

    setStartDate('');
    setEndDate('');
    setActiveQuickFilter('allTime');
    setFilterVisible(false);

    appliedRangeRef.current = {};
    router.replace('/history');
    await loadHistory({});
  }, [loadHistory, router]);

  const goBack = useCallback(() => {
    router.back();
  }, [router]);

  const renderRideItem = useCallback(
    ({ item }: { item: RideItem }) => {
      const normalizedStatus = String(item.status || '').toUpperCase();
      const isCanceled = normalizedStatus === 'CANCELED' || normalizedStatus === 'CANCELLED';
      const isCompleted = normalizedStatus === 'COMPLETED';
      const statusText = isCanceled
        ? t('ride_status_cancelled')
        : isCompleted
          ? t('ride_status_completed')
          : item.status || t('not_available');
      const statusBadgeStyle = isCanceled
        ? styles.statusBadgeCanceled
        : isCompleted
          ? styles.statusBadgeCompleted
          : styles.statusBadgePending;
      const statusTextStyle = isCanceled
        ? styles.statusBadgeCanceledText
        : isCompleted
          ? styles.statusBadgeCompletedText
          : styles.statusBadgePendingText;

      return (
        <TouchableOpacity
          style={styles.rideCard}
          activeOpacity={0.9}
          onPress={() => router.push(`/ride-details?id=${item.id}`)}
        >
          <View style={styles.rideHeaderRow}>
            <Text style={styles.rideId}>#{item.id}</Text>
            <View style={[styles.statusBadge, statusBadgeStyle]}>
              <Text style={[styles.statusBadgeText, statusTextStyle]}>
                {statusText}
              </Text>
            </View>
          </View>

          <Text style={styles.rideDateTime}>{formatDate(item.createdAt)} • {formatTime(item.createdAt)}</Text>

          <View style={styles.addressBlock}>
            <Text style={styles.addressLabel}>{t('pickup')}</Text>
            <Text style={styles.addressValue}>{item.pickupAddress || t('not_available')}</Text>
          </View>

          {!!item.stopAddress && (
            <View style={styles.addressBlock}>
              <Text style={styles.addressLabel}>{t('stop')}</Text>
              <Text style={styles.addressValue}>{item.stopAddress}</Text>
            </View>
          )}

          <View style={styles.addressBlock}>
            <Text style={styles.addressLabel}>{t('dropoff')}</Text>
            <Text style={styles.addressValue}>{item.dropoffAddress || t('not_available')}</Text>
          </View>

          {isCanceled && (item.cancellationReason || item.canceledBy) && (
            <View style={styles.cancellationBox}>
              {item.cancellationReason ? (
                <Text style={styles.cancellationText}>{`${t('cancellation_reason')}: ${t(item.cancellationReason)}`}</Text>
              ) : null}
              {item.canceledBy ? (
                <Text style={styles.cancellationText}>{`${t('canceled_by')}: ${t(`canceled_by_${item.canceledBy}`)}`}</Text>
              ) : null}
            </View>
          )}

          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>{t('price')}</Text>
            <Text style={styles.amountValue}>{formatAmount(item.price)} DKK</Text>
          </View>
        </TouchableOpacity>
      );
    },
    [formatAmount, formatDate, formatTime, router, t]
  );

  const renderEmptyState = useCallback(() => {
    return (
      <View style={styles.emptyState}>
        {loading ? <ActivityIndicator size="large" color="#1d4ed8" /> : null}
        <Text style={styles.emptyText}>{loading ? t('history_loading') : t('history_no_rides')}</Text>
      </View>
    );
  }, [loading, t]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={goBack}>
          <Text style={styles.backButtonText}>❮</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('history')}</Text>
        <TouchableOpacity
          style={[styles.filterToggleButton, filterVisible && styles.filterToggleButtonActive]}
          onPress={() => setFilterVisible((prev) => !prev)}
        >
          <Text style={[styles.filterToggleButtonText, filterVisible && styles.filterToggleButtonTextActive]}>
            {t('filter')}
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={rides}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderRideItem}
        style={styles.list}
        contentContainerStyle={[
          styles.listContent,
          rides.length === 0 ? styles.listContentEmpty : undefined,
        ]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            <View style={styles.summaryContainer}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>{t('total_rides')}</Text>
                <Text style={styles.summaryValue}>{summary.totalRides}</Text>
              </View>

              <View style={styles.summaryGap} />

              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>{t('total_amount')}</Text>
                <Text style={styles.summaryValue}>{formatAmount(summary.totalAmount)} DKK</Text>
              </View>
            </View>

            {activeShiftWindow ? (
              <View style={styles.shiftFilterBanner}>
                <View style={styles.shiftFilterBannerTextWrap}>
                  <Text style={styles.shiftFilterBannerTitle}>
                    {t('history_shift_filter_label', { shiftId: activeShiftWindow.shiftId || '--' })}
                  </Text>
                  <Text style={styles.shiftFilterBannerSubtitle}>{t('history_shift_filter_active')}</Text>
                  <Text style={styles.shiftFilterBannerRange}>
                    {formatDate(activeShiftWindow.startIso)} • {formatTime(activeShiftWindow.startIso)} - {formatDate(activeShiftWindow.endIso)} • {formatTime(activeShiftWindow.endIso)}
                  </Text>
                </View>

                <TouchableOpacity style={styles.shiftFilterBannerAction} onPress={handleShowAllHistory}>
                  <Text style={styles.shiftFilterBannerActionText}>{t('history_show_all')}</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {filterVisible ? (
              <View style={styles.filterContainer}>
                <Text style={styles.filterTitle}>{t('filter_by_date')}</Text>

                <View style={styles.quickFiltersRow}>
                  {quickFilterOptions.map((option, index) => {
                    const isActive = activeQuickFilter === option.key;
                    return (
                      <TouchableOpacity
                        key={option.key}
                        style={[
                          styles.quickFilterChip,
                          isActive && styles.quickFilterChipActive,
                          index === quickFilterOptions.length - 1 && styles.quickFilterChipLast,
                        ]}
                        onPress={() => handleQuickFilter(option.key)}
                      >
                        <Text style={[styles.quickFilterChipText, isActive && styles.quickFilterChipTextActive]}>
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.orText}>{t('or')}</Text>

                <View style={styles.inputRow}>
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>{t('from')}</Text>
                    <TextInput
                      style={styles.input}
                      placeholder={t('date_placeholder')}
                      value={startDate}
                      onChangeText={setStartDate}
                      placeholderTextColor="#94a3b8"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>

                  <View style={[styles.inputContainer, styles.inputContainerLast]}>
                    <Text style={styles.inputLabel}>{t('to')}</Text>
                    <TextInput
                      style={styles.input}
                      placeholder={t('date_placeholder')}
                      value={endDate}
                      onChangeText={setEndDate}
                      placeholderTextColor="#94a3b8"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                </View>

                <View style={styles.filterActionsRow}>
                  <TouchableOpacity style={[styles.filterActionButton, styles.applyButton]} onPress={handleFilter}>
                    <Text style={styles.applyButtonText}>{t('filter')}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={[styles.filterActionButton, styles.clearButton]} onPress={handleClearFilter}>
                    <Text style={styles.clearButtonText}>{t('clear')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}
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
  backButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginHorizontal: 12,
  },
  filterToggleButton: {
    minWidth: 74,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  filterToggleButtonActive: {
    backgroundColor: '#1d4ed8',
  },
  filterToggleButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
  },
  filterToggleButtonTextActive: {
    color: '#ffffff',
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
  summaryContainer: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryGap: {
    width: 10,
  },
  shiftFilterBanner: {
    backgroundColor: '#eff6ff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  shiftFilterBannerTextWrap: {
    flex: 1,
    marginRight: 10,
  },
  shiftFilterBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1e3a8a',
    marginBottom: 2,
  },
  shiftFilterBannerSubtitle: {
    fontSize: 12,
    color: '#1d4ed8',
    fontWeight: '600',
    marginBottom: 4,
  },
  shiftFilterBannerRange: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
  },
  shiftFilterBannerAction: {
    borderRadius: 10,
    backgroundColor: '#1d4ed8',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  shiftFilterBannerActionText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: 20,
    color: '#0f172a',
    fontWeight: '800',
  },
  filterContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dbeafe',
    padding: 12,
    marginBottom: 12,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  filterTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 10,
  },
  quickFiltersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quickFilterChip: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 6,
  },
  quickFilterChipLast: {
    marginRight: 0,
  },
  quickFilterChipActive: {
    backgroundColor: '#dbeafe',
    borderColor: '#60a5fa',
  },
  quickFilterChipText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '700',
  },
  quickFilterChipTextActive: {
    color: '#1e40af',
  },
  orText: {
    textAlign: 'center',
    marginVertical: 10,
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
  },
  inputContainer: {
    flex: 1,
    marginRight: 8,
  },
  inputContainerLast: {
    marginRight: 0,
  },
  inputLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 6,
    fontWeight: '600',
  },
  input: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 10,
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '500',
  },
  filterActionsRow: {
    flexDirection: 'row',
    marginTop: 12,
  },
  filterActionButton: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyButton: {
    backgroundColor: '#1d4ed8',
    marginRight: 8,
  },
  applyButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  clearButton: {
    backgroundColor: '#e2e8f0',
  },
  clearButtonText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '800',
  },
  rideCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    marginBottom: 12,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  rideHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  rideId: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusBadgeCompleted: {
    backgroundColor: '#dcfce7',
  },
  statusBadgeCanceled: {
    backgroundColor: '#fee2e2',
  },
  statusBadgePending: {
    backgroundColor: '#e2e8f0',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  statusBadgeCompletedText: {
    color: '#166534',
  },
  statusBadgeCanceledText: {
    color: '#991b1b',
  },
  statusBadgePendingText: {
    color: '#334155',
  },
  rideDateTime: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 10,
    fontWeight: '600',
  },
  addressBlock: {
    marginBottom: 8,
  },
  addressLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '700',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  addressValue: {
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '500',
  },
  cancellationBox: {
    marginTop: 6,
    borderRadius: 10,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    padding: 10,
  },
  cancellationText: {
    color: '#991b1b',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  amountRow: {
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  amountLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '700',
  },
  amountValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#166534',
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
