import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

type LatLng = { latitude: number; longitude: number };

type Props = {
  center?: LatLng | null;
  markers?: Array<{ latitude: number; longitude: number; title?: string }>;
  polyline?: LatLng[];
};

export default function MapPlaceholder({ center, markers = [], polyline = [] }: Props) {
  const distanceKm = polyline && polyline.length > 1 ? calculatePolylineDistanceKm(polyline) : 0;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Map not available</Text>
      <Text style={styles.line}>Current location: {center ? `${center.latitude.toFixed(5)}, ${center.longitude.toFixed(5)}` : 'unavailable'}</Text>
      <Text style={styles.line}>Markers: {markers.length}</Text>
      <Text style={styles.line}>Route length (km): {distanceKm.toFixed(2)}</Text>
      <Text style={styles.note}>We will redesign the route UI without native maps.</Text>
    </View>
  );
}

function calculatePolylineDistanceKm(points: LatLng[]) {
  // Haversine
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineKm(points[i - 1], points[i]);
  }
  return total;
}

function haversineKm(a: LatLng, b: LatLng) {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const aa = sinDLat * sinDLat + sinDLon * sinDLon * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
  return R * c;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6', padding: 12, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  line: { fontSize: 14, marginTop: 4 },
  note: { marginTop: 10, fontSize: 12, color: '#666', textAlign: 'center' },
});
