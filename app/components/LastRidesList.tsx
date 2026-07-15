import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { useTranslation } from '../../src/hooks/useTranslation';

type RideItem = {
  id?: number | string;
  startTime?: string;
  from?: string;
  to?: string;
  price?: number | string;
  status?: string;
};

type Props = {
  rides: RideItem[];
  maxItems?: number;
  isDarkMode?: boolean;
};

function formatTime(ts?: string) {
  if (!ts) return '--:--';
  if (/^\d{2}:\d{2}$/.test(ts)) return ts;
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  return (
    d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0')
  );
}

function shortenAddress(address?: string) {
  if (!address) return 'Unknown';
  const cleaned = address.trim();
  const parts = cleaned
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) return 'Unknown';
  return parts[0] || cleaned;
}

function getStatusInfo(status: string | undefined, t: (key: string) => string) {
  const normalized = String(status || '').toUpperCase();
  if (['DISPATCHED', 'ONGOING', 'PICKED_UP', 'IN_PROGRESS'].includes(normalized)) {
    return { label: t('status_on_ride'), color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' };
  }
  if (normalized === 'COMPLETED') {
    return { label: t('ride_status_completed'), color: '#22c55e', bg: 'rgba(34,197,94,0.12)' };
  }
  if (normalized === 'CANCELED' || normalized === 'CANCELLED') {
    return { label: t('ride_status_cancelled'), color: '#ef4444', bg: 'rgba(239,68,68,0.12)' };
  }
  return null;
}

export default function LastRidesList({ rides, maxItems = 6, isDarkMode = false }: Props) {
  const { t } = useTranslation();
  const data = rides ? rides.slice(0, maxItems) : [];
  const styles = React.useMemo(() => getStyles(isDarkMode), [isDarkMode]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('recent_rides') || 'Recent Rides'}</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{data.length}</Text>
        </View>
      </View>

      {data.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyText}>{t('no_recent_rides') || 'No rides yet'}</Text>
        </View>
      ) : (
        data.map((item, index) => {
          const statusInfo = getStatusInfo(item.status, t);
          const isLast = index === data.length - 1;
          return (
            <View key={item.id != null ? String(item.id) : String(index)}>
              <View style={styles.rideCard}>
                <View
                  style={[
                    styles.statusLine,
                    statusInfo ? { backgroundColor: statusInfo.color } : null,
                  ]}
                />
                <View style={styles.rideContent}>
                  <View style={styles.rideTop}>
                    <Text style={styles.rideTime}>{formatTime(item.startTime)}</Text>
                    {statusInfo && (
                      <View style={[styles.statusChip, { backgroundColor: statusInfo.bg }]}>
                        <View style={[styles.statusDot, { backgroundColor: statusInfo.color }]} />
                        <Text style={[styles.statusChipText, { color: statusInfo.color }]}>
                          {statusInfo.label}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.ridePrice}>
                      {item.price != null ? `${item.price} DKK` : '--'}
                    </Text>
                  </View>
                  <Text style={styles.rideRoute} numberOfLines={1} ellipsizeMode="tail">
                    <Text style={styles.routeFrom}>{shortenAddress(item.from)}</Text>
                    <Text style={styles.routeArrow}> → </Text>
                    <Text style={styles.routeTo}>{shortenAddress(item.to)}</Text>
                  </Text>
                </View>
              </View>
              {!isLast && <View style={styles.sep} />}
            </View>
          );
        })
      )}
    </View>
  );
}

const getStyles = (isDarkMode: boolean) =>
  StyleSheet.create({
    container: {
      backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14,
    },
    headerTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: isDarkMode ? '#f1f5f9' : '#0f172a',
    },
    countBadge: {
      backgroundColor: isDarkMode ? 'rgba(148,163,184,0.15)' : '#f1f5f9',
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    countBadgeText: {
      fontSize: 12,
      fontWeight: '700',
      color: isDarkMode ? '#94a3b8' : '#64748b',
    },
    empty: {
      alignItems: 'center',
      paddingVertical: 28,
    },
    emptyIcon: {
      fontSize: 28,
      marginBottom: 8,
    },
    emptyText: {
      fontSize: 13,
      color: isDarkMode ? '#64748b' : '#94a3b8',
    },
    rideCard: {
      flexDirection: 'row',
      paddingVertical: 12,
      minHeight: 52,
    },
    statusLine: {
      width: 3,
      borderRadius: 2,
      marginRight: 12,
      backgroundColor: 'transparent',
    },
    rideContent: {
      flex: 1,
      justifyContent: 'center',
    },
    rideTop: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
      gap: 8,
    },
    rideTime: {
      fontSize: 13,
      fontWeight: '700',
      color: isDarkMode ? '#94a3b8' : '#64748b',
      fontVariant: ['tabular-nums'],
    },
    statusChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
      gap: 4,
    },
    statusDot: {
      width: 5,
      height: 5,
      borderRadius: 3,
    },
    statusChipText: {
      fontSize: 10,
      fontWeight: '700',
    },
    ridePrice: {
      fontSize: 14,
      fontWeight: '800',
      color: isDarkMode ? '#e2e8f0' : '#0f172a',
      marginLeft: 'auto',
    },
    rideRoute: {
      fontSize: 13,
      lineHeight: 18,
    },
    routeFrom: {
      color: isDarkMode ? '#cbd5e1' : '#334155',
      fontWeight: '500',
    },
    routeArrow: {
      color: isDarkMode ? '#475569' : '#94a3b8',
      fontWeight: '600',
    },
    routeTo: {
      color: isDarkMode ? '#cbd5e1' : '#334155',
      fontWeight: '500',
    },
    sep: {
      height: 1,
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
    },
  });
