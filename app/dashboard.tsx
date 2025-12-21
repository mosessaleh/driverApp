import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Platform, Image, ScrollView, RefreshControl, TextInput, Animated } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useAuth } from '../src/context/AuthContext';
import { toggleDriverOnline, toggleDriverBusy, getDriverStatus, updateDriverLocation, getRide, api } from '../src/services/api';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import RideOfferModal from '../src/components/RideOfferModal';
import { Ride, Booking } from '../src/types';
import { getSocket } from '../src/services/socket';

const { width, height } = Dimensions.get('window');

export default function DashboardScreen() {
  const { authState, logout } = useAuth();
  const router = useRouter();
  const [driverOnline, setDriverOnline] = useState(false);
  const [driverBusy, setDriverBusy] = useState(false);
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
  const [routeCoordinates, setRouteCoordinates] = useState<Array<[number, number]> | null>(null);

  // Animation for GO button text
  const textOpacityAnim = useRef(new Animated.Value(1)).current;

  // Map ref for animating to location
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    if (!driverOnline) {
      // Text opacity animation
      const textFade = Animated.loop(
        Animated.sequence([
          Animated.timing(textOpacityAnim, {
            toValue: 0.3,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(textOpacityAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      textFade.start();
      return () => textFade.stop();
    }
  }, [driverOnline, textOpacityAnim]);

  useEffect(() => {
    if (authState.token) {
      loadDriverStatus();
      getCurrentLocation();
      // Start polling for ride offers
      const interval = setInterval(checkForRideOffer, 1000); // Check every 1 second

      // Listen for new ride socket events
      const socket = getSocket();
      if (socket) {
        socket.on('newRide', (data) => {
          console.log('Received new ride via socket:', data);
          // Note: Local notification removed due to Expo Go limitations

          // Set ride offer immediately
          if (!rideOffer) {
            const ride = {
              id: data.rideId,
              riderName: data.riderName,
              pickupAddress: data.pickupAddress,
              dropoffAddress: data.dropoffAddress,
              price: data.price,
              status: 'PENDING',
              pickupTime: new Date().toISOString(),
              distanceKm: data.distanceKm,
              durationMin: data.durationMin,
              vehicleType: data.vehicleType,
              passengers: data.passengers,
              paymentStatus: 'PENDING_PAYMENT',
              paymentMethod: data.paymentMethod || 'card',
              scheduled: data.scheduled || false,
            };
            setRideOffer(ride);
            setEtaMinutes(data.etaMinutes || 5);
          }
        });
      }

      return () => {
        clearInterval(interval);
        stopLocationTracking();
        if (socket) {
          socket.off('newRide');
        }
      };
    }
    return () => {
      stopLocationTracking();
    };
  }, [authState.token]);

  // Animate map to current location when it changes
  useEffect(() => {
    if (currentLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 1000);
    }
  }, [currentLocation]);

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
        const wasOnline = driverOnline;
        setDriverOnline(res.isOnline);
        console.log('Driver online status set to:', res.isOnline);
        // Auto start tracking if became online
        if (res.isOnline && !wasOnline) {
          console.log('Auto starting location tracking');
          startLocationTracking();
        }
      }
      if (res.isBusy !== undefined) {
        setDriverBusy(res.isBusy);
        console.log('Driver busy status set to:', res.isBusy);
      }
    } catch (e) {
      console.error('Error loading driver status:', e);
    }
  };

  const checkForRideOffer = async () => {
    if (!authState.token || !driverOnline) return;

    try {
      const res = await getDriverStatus(authState.token);
      if (res.currentRideId && res.rideAccepted === 0 && !rideOffer) {
        console.log('تم تلقي رحلة جديدة عبر الـ polling');
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

          // Calculate ETA and get route
          if (currentLocation && ride.startLatLon) {
            const etaRes = await api.get(`/api/route?startLat=${currentLocation.latitude}&startLon=${currentLocation.longitude}&endLat=${ride.startLatLon.lat}&endLon=${ride.startLatLon.lon}`);
            if (etaRes.ok && etaRes.route && etaRes.route.duration) {
              setEtaMinutes(Math.ceil(etaRes.route.duration / 60));
              // Store route coordinates for drawing the path
              if (etaRes.route.geometry && etaRes.route.geometry.coordinates) {
                setRouteCoordinates(etaRes.route.geometry.coordinates);
              }
            } else {
              setEtaMinutes(5); // fallback
            }
          }
        }
      } else if ((!res.currentRideId || res.rideAccepted !== 0) && rideOffer) {
        setRideOffer(null);
        setEtaMinutes(null);
        setRouteCoordinates(null);
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

        // Logout after ending shift
        await logout();
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

  const handleToggleBusy = async () => {
    if (!authState.token) return;
    try {
      const res = await toggleDriverBusy(!driverBusy, authState.token);
      if (res.success) {
        setDriverBusy(!driverBusy);
      }
    } catch (e) {
      console.error('Error toggling busy status:', e);
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
        setRouteCoordinates(null);
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
    setRouteCoordinates(null);
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
           {!driverBusy && driverOnline && (
             <TouchableOpacity
               style={styles.menuItem}
               onPress={() => {
                 setShowMenu(false);
                 handleToggleBusy();
               }}
             >
               <Text style={styles.menuItemText}>Pause</Text>
             </TouchableOpacity>
           )}
           {driverBusy && driverOnline && (
             <TouchableOpacity
               style={styles.menuItem}
               onPress={() => {
                 setShowMenu(false);
                 handleToggleBusy();
               }}
             >
               <Text style={styles.menuItemText}>End Pause</Text>
             </TouchableOpacity>
           )}
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
          <MapView
            ref={mapRef}
            style={styles.map}
            provider="google"
            initialRegion={{
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
            showsUserLocation={true}
            followsUserLocation={isTracking}
          >
            {rideOffer && rideOffer.startLatLon && (
              <Marker
                coordinate={{
                  latitude: rideOffer.startLatLon.lat,
                  longitude: rideOffer.startLatLon.lon,
                }}
              >
                <PersonIcon />
              </Marker>
            )}
            {routeCoordinates && (
              <Polyline
                coordinates={routeCoordinates.map(coord => ({
                  latitude: coord[1],
                  longitude: coord[0],
                }))}
                strokeColor="#007bff"
                strokeWidth={4}
              />
            )}
          </MapView>
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
          <Animated.Text style={[styles.floatingGoButtonText, { opacity: textOpacityAnim }]}>GO</Animated.Text>
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

const PersonIcon = () => (
  <View style={styles.personIcon}>
    <View style={styles.personHead} />
    <View style={styles.personBody} />
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    position: 'absolute',
    top: 20,
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
    left: '50%',
    marginLeft: -40, // Half of width to center
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#28a745',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 15,
    // Add gradient-like effect with border
    borderWidth: 3,
    borderColor: '#fff',
  },
  floatingGoButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
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
  personIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'gray',
    justifyContent: 'center',
    alignItems: 'center',
  },
  personHead: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'white',
    position: 'absolute',
    top: 4,
  },
  personBody: {
    width: 4,
    height: 12,
    backgroundColor: 'white',
    position: 'absolute',
    bottom: 4,
  },
});