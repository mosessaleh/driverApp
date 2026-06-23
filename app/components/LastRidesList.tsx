import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { useTranslation } from '../../src/hooks/useTranslation';

type RideItem = {
  id?: number | string;
  startTime?: string; // ISO or hh:mm
  from?: string;
  to?: string;
  price?: number | string;
  status?: string;
};

type Props = {
  rides: RideItem[];
  maxItems?: number;
};

function formatTime(ts?: string) {
  if (!ts) return '--:--';
  if (/^\d{2}:\d{2}$/.test(ts)) return ts;
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
}

const COUNTRY_NAMES = new Set([
  'afghanistan', 'albania', 'algeria', 'andorra', 'angola', 'antigua and barbuda', 'argentina', 'armenia', 'australia', 'austria', 'azerbaijan',
  'bahamas', 'bahrain', 'bangladesh', 'barbados', 'belarus', 'belgium', 'belize', 'benin', 'bhutan', 'bolivia', 'bosnia and herzegovina', 'botswana', 'brazil', 'brunei', 'bulgaria', 'burkina faso', 'burundi',
  'cabo verde', 'cambodia', 'cameroon', 'canada', 'central african republic', 'chad', 'chile', 'china', 'colombia', 'comoros', 'costa rica', 'côte d’ivoire', 'croatia', 'cuba', 'cyprus', 'czech republic',
  'democratic republic of the congo', 'denmark', 'djibouti', 'dominica', 'dominican republic',
  'ecuador', 'egypt', 'el salvador', 'equatorial guinea', 'eritrea', 'estonia', 'eswatini', 'ethiopia',
  'fiji', 'finland', 'france',
  'gabon', 'gambia', 'georgia', 'germany', 'ghana', 'greece', 'grenada', 'guatemala', 'guinea', 'guinea-bissau', 'guyana',
  'haiti', 'honduras', 'hungary',
  'iceland', 'india', 'indonesia', 'iran', 'iraq', 'ireland', 'israel', 'italy',
  'jamaica', 'japan', 'jordan',
  'kazakhstan', 'kenya', 'kiribati', 'kosovo', 'kuwait', 'kyrgyzstan',
  'laos', 'latvia', 'lebanon', 'lesotho', 'liberia', 'libya', 'liechtenstein', 'lithuania', 'luxembourg',
  'madagascar', 'malawi', 'malaysia', 'maldives', 'mali', 'malta', 'marshall islands', 'mauritania', 'mauritius', 'mexico', 'micronesia', 'moldova', 'monaco', 'mongolia', 'montenegro', 'morocco', 'mozambique',
  'myanmar',
  'namibia', 'nauru', 'nepal', 'netherlands', 'new zealand', 'nicaragua', 'niger', 'nigeria', 'north korea', 'north macedonia', 'norway',
  'oman',
  'pakistan', 'palau', 'panama', 'papua new guinea', 'paraguay', 'peru', 'philippines', 'poland', 'portugal',
  'qatar',
  'romania', 'russia', 'rwanda',
  'saint kitts and nevis', 'saint lucia', 'saint vincent and the grenadines', 'samoa', 'san marino', 'são tomé and príncipe', 'saudi arabia', 'senegal', 'serbia', 'seychelles', 'sierra leone', 'singapore', 'slovakia', 'slovenia', 'solomon islands', 'somalia', 'south africa', 'south korea', 'south sudan', 'spain', 'sri lanka', 'sudan', 'suriname', 'sweden', 'switzerland', 'syria',
  'taiwan', 'tajikistan', 'tanzania', 'thailand', 'timor-leste', 'togo', 'tonga', 'trinidad and tobago', 'tunisia', 'turkey', 'turkmenistan', 'tuvalu',
  'uganda', 'ukraine', 'united arab emirates', 'united kingdom', 'united states', 'uruguay', 'uzbekistan',
  'vanuatu', 'vatican city', 'venezuela', 'vietnam',
  'yemen', 'zambia', 'zimbabwe'
]);

function shortenAddress(address?: string) {
  if (!address) return 'Unknown';
  const cleaned = address.trim();
  const parts = cleaned.split(',').map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return 'Unknown';

  const lastPart = parts[parts.length - 1].replace(/^\d{3,4}\s*/g, '').trim();
  const lastLower = lastPart.toLowerCase();

  if (COUNTRY_NAMES.has(lastLower) && parts.length > 1) {
    const previousPart = parts[parts.length - 2].replace(/^\d{3,4}\s*/g, '').trim();
    return previousPart || lastPart || cleaned;
  }

  return lastPart || cleaned;
}

function getStatusLabel(status: string | undefined, t: (key: string) => string) {
  const normalized = String(status || '').toUpperCase();
  if (['DISPATCHED', 'ONGOING', 'PICKED_UP', 'IN_PROGRESS'].includes(normalized)) return t('status_on_ride');
  if (normalized === 'COMPLETED') return t('ride_status_completed');
  if (normalized === 'CANCELED' || normalized === 'CANCELLED') return t('ride_status_cancelled');
  return status || '';
}

export default function LastRidesList({ rides, maxItems = 6 }: Props) {
  const { t } = useTranslation();
  const data = rides ? rides.slice(0, maxItems) : [];

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.header}>Recent Rides</Text>
          <Text style={styles.sub}>Latest ride data from your dashboard</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{data.length}/{maxItems}</Text>
        </View>
      </View>

      {data.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No recent rides available yet.</Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item, idx) => (item.id != null ? String(item.id) : String(idx))}
          renderItem={({ item, index }) => (
            <View style={[styles.row, index % 2 === 0 ? styles.rowEven : styles.rowOdd]}>
              {!!getStatusLabel(item.status, t) && (
                <Text
                  style={[
                    styles.statusText,
                    ['DISPATCHED', 'ONGOING', 'PICKED_UP', 'IN_PROGRESS'].includes(String(item.status || '').toUpperCase())
                      ? styles.statusTextActive
                      : styles.statusTextMuted,
                  ]}
                  numberOfLines={1}
                >
                  {getStatusLabel(item.status, t)}
                </Text>
              )}
              <Text style={styles.lineText} numberOfLines={1} ellipsizeMode="tail">
                {formatTime(item.startTime)} • {shortenAddress(item.from)} → {shortenAddress(item.to)} • {item.price != null ? `${item.price} DKK` : '--'}
              </Text>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          scrollEnabled={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  header: { fontWeight: '800', fontSize: 16, color: '#0f172a' },
  sub: { fontSize: 12, color: '#64748b', marginTop: 4, lineHeight: 16 },
  badge: {
    backgroundColor: '#e0f2fe',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
  },
  badgeText: {
    color: '#0c4a6e',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyState: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
  },
  row: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  rowEven: { backgroundColor: '#f8fafc' },
  rowOdd: { backgroundColor: '#ffffff' },
  lineText: {
    color: '#0f172a',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  statusText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    marginBottom: 3,
  },
  statusTextActive: {
    color: '#0369a1',
  },
  statusTextMuted: {
    color: '#475569',
  },
  sep: { height: 1, backgroundColor: '#e2e8f0', marginVertical: 0 },
});
