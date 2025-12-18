import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Platform, Image, ScrollView, RefreshControl, TextInput } from 'react-native';
import { useAuth } from '../src/context/AuthContext';
import { toggleDriverOnline, getDriverStatus, updateDriverLocation, getRide, api } from '../src/services/api';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import RideOfferModal from '../src/components/RideOfferModal';
import { Ride, Booking } from '../src/types';

// Map component showing location info and OpenStreetMap attribution
const MapComponent = ({
  currentLocation,
  isTracking,
  onStartTracking,
  onStopTracking
}: {
  currentLocation: { latitude: number; longitude: number } | null;
  isTracking: boolean;
  onStartTracking: () => void;
  onStopTracking: () => void;
}) => {
  if (!currentLocation) {
    return (
      <View style={styles.mapPlaceholder}>
        <Text style={styles.mapPlaceholderText}>Location not available</Text>
      </View>
    );
  }

  return (
    <View style={styles.mapContainer}>
      <View style={styles.locationInfo}>
        <Text style={styles.locationTitle}>Your Current Location</Text>
        <Text style={styles.locationCoords}>
          Latitude: {currentLocation.latitude.toFixed(6)}
        </Text>
        <Text style={styles.locationCoords}>
          Longitude: {currentLocation.longitude.toFixed(6)}
        </Text>
        <TouchableOpacity
          style={[styles.trackingButton, isTracking && styles.trackingButtonActive]}
          onPress={isTracking ? onStopTracking : onStartTracking}
        >
          <Text style={styles.trackingButtonText}>
            {isTracking ? '⏹️ Stop Tracking' : '▶️ Start Tracking'}
          </Text>
        </TouchableOpacity>
        {isTracking && (
          <Text style={styles.trackingStatus}>🔴 Tracking Active...</Text>
        )}
      </View>
      <View style={styles.mapAttribution}>
        <Text style={styles.attributionText}>
          🗺️ Map uses OpenStreetMap
        </Text>
        <Text style={styles.attributionText}>
          © OpenStreetMap contributors
        </Text>
      </View>
    </View>
  );
};

const { width, height } = Dimensions.get('window');

export default function DashboardScreen() {
  const { authState } = useAuth();
  const router = useRouter();
  const [driverOnline, setDriverOnline] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationPermission, setLocationPermission] = useState(false);
  const [locationSubscription, setLocationSubscription] = useState<any>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showEndShiftMenu, setShowEndShiftMenu] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showEndKMModal, setShowEndKMModal] = useState(false);
  const [endKM, setEndKM] = useState('');
  const [rideOffer, setRideOffer] = useState<Ride | null>(null);
  const [etaMinutes, setEtaMinutes] = useState<number | null>(null);

  useEffect(() => {
    if (authState.token) {
      loadDriverStatus();
      getCurrentLocation();
      // Start polling for ride offers
      const interval = setInterval(checkForRideOffer, 1000); // Check every 1 second
      return () => {
        clearInterval(interval);
        stopLocationTracking();
      };
    }
    return () => {
      stopLocationTracking();
    };
  }, [authState.token]);

  const loadDriverStatus = async () => {
    if (!authState.token) {
      console.log('No auth token for loading driver status');
      return;
    }
    try {
      console.log('Loading driver status...');
      const res = await getDriverStatus(authState.token);
      console.log('Driver status response:', res);
      if (res.isOnline !== undefined) {
        setDriverOnline(res.isOnline);
        console.log('Driver online status set to:', res.isOnline);
      }
    } catch (e) {
      console.error('Error loading driver status:', e);
    }
  };

  const checkForRideOffer = async () => {
    if (!authState.token || !driverOnline) return;

    try {
      const res = await getDriverStatus(authState.token);
      if (res.currentRideId && !rideOffer) {
        // Fetch ride details
        const rideRes = await getRide(res.currentRideId, authState.token);
        if (rideRes.success && rideRes.data) {
          const ride = rideRes.data;
          setRideOffer({
            id: ride.id,
            riderName: ride.riderName,
            pickupAddress: ride.pickupAddress,
            dropoffAddress: ride.dropoffAddress,
            price: ride.price,
            status: ride.status,
            pickupTime: ride.pickupTime,
            distanceKm: ride.distanceKm,
            durationMin: ride.durationMin,
            vehicleType: ride.vehicleType,
            passengers: 1,
            paymentStatus: 'PENDING_PAYMENT',
            paymentMethod: ride.paymentMethod || 'card',
            scheduled: ride.scheduled || false,
          });

          // Calculate ETA
          if (currentLocation && ride.startLatLon) {
            const etaRes = await api.get(`/api/route?startLat=${currentLocation.latitude}&startLon=${currentLocation.longitude}&endLat=${ride.startLatLon.lat}&endLon=${ride.startLatLon.lon}`);
            if (etaRes.ok && etaRes.route && etaRes.route.duration) {
              setEtaMinutes(Math.ceil(etaRes.route.duration / 60));
            } else {
              setEtaMinutes(5); // fallback
            }
          }
        }
      } else if (!res.currentRideId && rideOffer) {
        setRideOffer(null);
        setEtaMinutes(null);
      }
    } catch (e) {
      console.error('Error checking for ride offer:', e);
    }
  };

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setLocationPermission(true);
        const location = await Location.getCurrentPositionAsync({});
        setCurrentLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      }
    } catch (e) {
      console.error('Error getting location:', e);
    }
  };

  const startLocationTracking = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setLocationPermission(true);
        setIsTracking(true);

        const subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 2000, // Update every 2 seconds
            distanceInterval: 5, // Update every 5 meters
          },
          async (location) => {
            const newLocation = {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            };

            setCurrentLocation(newLocation);

            // Send location update to server
            if (authState.token) {
              console.log('Sending location update:', newLocation.latitude, newLocation.longitude);
              try {
                await updateDriverLocation(
                  newLocation.latitude,
                  newLocation.longitude,
                  authState.token,
                  new Date().toISOString()
                );
                console.log('Location updated successfully');
              } catch (error) {
                console.error('Failed to update location on server:', error);
              }
            } else {
              console.log('No auth token available for location update');
            }
          }
        );

        setLocationSubscription(subscription);
      }
    } catch (e) {
      console.error('Error starting location tracking:', e);
      setIsTracking(false);
    }
  };

  const stopLocationTracking = () => {
    if (locationSubscription) {
      locationSubscription.remove();
      setLocationSubscription(null);
    }
    setIsTracking(false);
  };

  const onRefresh = () => {
    setRefreshing(true);
    // Show end shift menu after a short delay
    setTimeout(() => {
      setRefreshing(false);
      setShowEndShiftMenu(true);
    }, 500);
  };

  const endShift = async () => {
    if (!endKM || isNaN(Number(endKM))) {
      alert('Please enter a valid end KM');
      return;
    }

    if (authState.token) {
      try {
        // Stop tracking first
        stopLocationTracking();

        // Call end shift API
        const data = await api.post('/api/driver/end-shift', { endKM: Number(endKM) }, authState.token);

        setDriverOnline(false);
        setShowEndKMModal(false);
        setEndKM('');
        alert(`Shift ended successfully!\nWork time: ${data.shiftData.workTime.toFixed(2)} hours\nTotal salary: ${data.shiftData.totalSalary} DKK\nHourly salary: ${data.shiftData.hourSalary.toFixed(2)} DKK`);
      } catch (error) {
        console.error('Error ending shift:', error);
        alert('Error ending shift: ' + (error as any).message);
      }
    }
  };

  const handleToggleOnline = async () => {
    if (!authState.token) return;
    try {
      const res = await toggleDriverOnline(!driverOnline, authState.token);
      if (res.success) {
        setDriverOnline(!driverOnline);
        // If going online, start location tracking automatically
        if (!driverOnline) {
          startLocationTracking();
        } else {
          // If going offline, stop location tracking
          stopLocationTracking();
        }
      }
    } catch (e) {
      console.error('Error toggling online status:', e);
    }
  };

  const handleAcceptRide = async (rideId: string) => {
    if (!authState.token || !authState.user) return;

    try {
      const res = await api.post(`/api/rides/${rideId}/accept`, {
        driverId: authState.user.id
      }, authState.token);

      if (res.ok) {
        setRideOffer(null);
        setEtaMinutes(null);
        // Navigate to active ride
        router.push(`/active-ride?id=${rideId}`);
      } else {
        alert('Failed to accept ride: ' + res.error);
      }
    } catch (e) {
      console.error('Error accepting ride:', e);
      alert('Error accepting ride');
    }
  };

  const handleDeclineRide = () => {
    setRideOffer(null);
    setEtaMinutes(null);
  };

  const goToSettings = () => {
    router.push('/settings');
  };

  const goToProfile = () => {
    router.push('/profile');
  };

  return (
    <View style={styles.container}>
      {/* Header with Hamburger Menu */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => setShowMenu(!showMenu)}
        >
          <View style={styles.hamburgerLine} />
          <View style={styles.hamburgerLine} />
          <View style={styles.hamburgerLine} />
        </TouchableOpacity>
      </View>

      {/* Hamburger Menu Overlay */}
      {showMenu && (
        <View style={styles.menuOverlay}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              setShowMenu(false);
              goToProfile();
            }}
          >
            <Text style={styles.menuItemText}>Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              setShowMenu(false);
              goToSettings();
            }}
          >
            <Text style={styles.menuItemText}>Settings</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              setShowMenu(false);
              setShowEndKMModal(true);
            }}
          >
            <Text style={styles.menuItemText}>End Shift</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Map View - Full Screen */}
      <View style={styles.mapContainer}>
        {currentLocation ? (
          <MapComponent
            currentLocation={currentLocation}
            isTracking={isTracking}
            onStartTracking={startLocationTracking}
            onStopTracking={stopLocationTracking}
          />
        ) : (
          <Text style={styles.mapPlaceholderText}>
            {locationPermission ? 'Getting location...' : 'Location permission required'}
          </Text>
        )}
      </View>

      {/* End KM Modal */}
      {showEndKMModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.endShiftMenu}>
            <Text style={styles.endShiftTitle}>End Shift</Text>
            <Text style={styles.endShiftMessage}>
              Please enter the final odometer reading (KM) for the vehicle:
            </Text>
            <TextInput
              style={styles.kmInput}
              placeholder="Enter end KM"
              value={endKM}
              onChangeText={setEndKM}
              keyboardType="numeric"
              placeholderTextColor="#999"
            />
            <View style={styles.endShiftButtons}>
              <TouchableOpacity
                style={[styles.endShiftButton, styles.cancelButton]}
                onPress={() => {
                  setShowEndKMModal(false);
                  setEndKM('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.endShiftButton, styles.confirmButton]}
                onPress={endShift}
              >
                <Text style={styles.confirmButtonText}>End Shift</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Floating Go Button */}
      {!driverOnline && (
        <TouchableOpacity style={styles.floatingGoButton} onPress={handleToggleOnline}>
          <Text style={styles.floatingGoButtonText}>GO</Text>
        </TouchableOpacity>
      )}

      <RideOfferModal
        visible={!!rideOffer}
        ride={rideOffer}
        etaMinutes={etaMinutes}
        onAccept={handleAcceptRide}
        onDecline={handleDeclineRide}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 1000,
  },
  menuButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  hamburgerLine: {
    width: 20,
    height: 2,
    backgroundColor: '#333',
    marginVertical: 2,
  },
  menuOverlay: {
    position: 'absolute',
    top: 100,
    left: 20,
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    minWidth: 150,
    zIndex: 1000,
  },
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuItemText: {
    fontSize: 16,
    color: '#333',
  },
  mapContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  mapPlaceholderText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  locationInfo: {
    backgroundColor: '#f8f9fa',
    padding: 20,
    borderRadius: 10,
    margin: 10,
    alignItems: 'center',
  },
  locationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  locationCoords: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  mapAttribution: {
    alignItems: 'center',
    padding: 10,
  },
  attributionText: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
  },
  trackingButton: {
    backgroundColor: '#007bff',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 10,
  },
  trackingButtonActive: {
    backgroundColor: '#dc3545',
  },
  trackingButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  trackingStatus: {
    fontSize: 12,
    color: '#dc3545',
    marginTop: 5,
    textAlign: 'center',
  },
  navbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingBottom: 30, // Extra padding for safe area
  },
  navButton: {
    flex: 1,
    alignItems: 'center',
  },
  navText: {
    fontSize: 16,
    color: '#007bff',
  },
  goButton: {
    backgroundColor: '#28a745',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    marginHorizontal: 10,
  },
  goButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  endShiftMenu: {
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 10,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  endShiftTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 10,
  },
  endShiftMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  endShiftButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  endShiftButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#6c757d',
  },
  confirmButton: {
    backgroundColor: '#dc3545',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  floatingGoButton: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#28a745',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  floatingGoButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2000,
  },
  kmInput: {
    height: 50,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 20,
    paddingHorizontal: 15,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
    textAlign: 'center',
  },
});