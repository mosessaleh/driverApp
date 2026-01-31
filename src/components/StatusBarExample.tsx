// TrafikTaxa Driver App - StatusBar Integration Example
// This file shows how to integrate the new StatusBar into dashboard.tsx

import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { StatusBar, DriverStatus } from './StatusBar';
import { StatusBarExpanded } from './StatusBarExpanded';

/**
 * 📝 HOW TO INTEGRATE IN dashboard.tsx:
 * 
 * 1. Import the components at the top of dashboard.tsx:
 *    import { StatusBar, DriverStatus } from '../src/components/StatusBar';
 *    import { StatusBarExpanded } from '../src/components/StatusBarExpanded';
 * 
 * 2. Add state for expanded modal:
 *    const [showStatusExpanded, setShowStatusExpanded] = useState(false);
 * 
 * 3. Create a helper to determine status:
 *    const getDriverStatus = (): DriverStatus => {
 *      if (bannedUntil && banCountdown > 0) return 'banned';
 *      if (activeRide) return 'on_ride';
 *      if (!driverOnline) return 'offline';
 *      if (driverBusy) return 'busy';
 *      return 'online';
 *    };
 * 
 * 4. Replace the old status bar (around line 1385-1394) with:
 *    <StatusBar
 *      status={getDriverStatus()}
 *      shiftElapsedTime={shiftElapsedTime}
 *      isSocketConnected={isSocketConnected}
 *      banCountdown={banCountdown}
 *      unreadMessagesCount={unreadMessagesCount}
 *      onPress={() => setShowStatusExpanded(true)}
 *    />
 * 
 * 5. Add the expanded modal at the end of the JSX (before closing View):
 *    <StatusBarExpanded
 *      visible={showStatusExpanded}
 *      onClose={() => setShowStatusExpanded(false)}
 *      status={getDriverStatus()}
 *      shiftElapsedTime={shiftElapsedTime}
 *      shiftStartTime={shiftStartTime}
 *      isSocketConnected={isSocketConnected}
 *      currentLocation={currentLocation}
 *      locationPermission={locationPermission}
 *      isTracking={isTracking}
 *      totalRidesToday={stats?.totalRides || 0}
 *      earningsToday={stats?.earnings || 0}
 *      rating={stats?.rating || 4.8}
 *    />
 */

interface StatusBarIntegrationProps {
  // Current states from dashboard
  driverOnline: boolean;
  driverBusy: boolean;
  bannedUntil: Date | null;
  banCountdown: number;
  activeRide: any;
  shiftElapsedTime: string;
  shiftStartTime: string | null;
  isSocketConnected: boolean;
  currentLocation: { latitude: number; longitude: number } | null;
  locationPermission: boolean;
  isTracking: boolean;
  unreadMessagesCount: number;
  // Optional stats
  totalRidesToday?: number;
  earningsToday?: number;
  rating?: number;
}

export const StatusBarIntegration: React.FC<StatusBarIntegrationProps> = (props) => {
  const [showExpanded, setShowExpanded] = useState(false);

  // Determine current driver status
  const getDriverStatus = (): DriverStatus => {
    if (props.bannedUntil && props.banCountdown > 0) return 'banned';
    if (props.activeRide) return 'on_ride';
    if (!props.driverOnline) return 'offline';
    if (props.driverBusy) return 'busy';
    return 'online';
  };

  return (
    <View style={styles.container}>
      {/* New Status Bar */}
      <StatusBar
        status={getDriverStatus()}
        shiftElapsedTime={props.shiftElapsedTime}
        isSocketConnected={props.isSocketConnected}
        banCountdown={props.banCountdown}
        unreadMessages={props.unreadMessagesCount}
        onPress={() => setShowExpanded(true)}
      />

      {/* Expanded Modal */}
      <StatusBarExpanded
        visible={showExpanded}
        onClose={() => setShowExpanded(false)}
        status={getDriverStatus()}
        shiftElapsedTime={props.shiftElapsedTime}
        shiftStartTime={props.shiftStartTime}
        isSocketConnected={props.isSocketConnected}
        currentLocation={props.currentLocation}
        locationPermission={props.locationPermission}
        isTracking={props.isTracking}
        totalRidesToday={props.totalRidesToday}
        earningsToday={props.earningsToday}
        rating={props.rating}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

/**
 * 🎨 COMPARISON: Old vs New
 * 
 * OLD STATUS BAR (Lines 1385-1394 in dashboard.tsx):
 * ----------------------------------------------
 * <View style={[styles.statusBar, { backgroundColor: getStatusColor() }]}>
 *   <View style={{ flexDirection: 'row', alignItems: 'center' }}>
 *     <Text style={styles.shiftTimeText}>{shiftElapsedTime}</Text>
 *     <View style={[styles.connectionIndicator, { backgroundColor: isSocketConnected ? '#28a745' : '#dc3545' }]} />
 *   </View>
 *   <Text style={styles.statusText}>{getStatusText()}</Text>
 * </View>
 * 
 * NEW STATUS BAR:
 * --------------
 * <StatusBar
 *   status={getDriverStatus()}
 *   shiftElapsedTime={shiftElapsedTime}
 *   isSocketConnected={isSocketConnected}
 *   banCountdown={banCountdown}
 *   unreadMessages={unreadMessagesCount}
 *   onPress={() => setShowStatusExpanded(true)}
 * />
 * 
 * ADVANTAGES OF NEW DESIGN:
 * ✅ Modern gradient colors based on status
 * ✅ Animated pulse effect when online/on_ride
 * ✅ Connection indicator with pulse animation
 * ✅ Shift progress bar (11-hour warning)
 * ✅ Unread messages badge
 * ✅ Expandable for detailed info
 * ✅ Better visual hierarchy
 * ✅ Support for dark/light mode
 * ✅ Type-safe with TypeScript
 * ✅ Reusable component
 */

export default StatusBarIntegration;
