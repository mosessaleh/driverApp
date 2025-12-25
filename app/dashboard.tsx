import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Platform, Image, ScrollView, RefreshControl, TextInput, Animated } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useAuth } from '../src/context/AuthContext';
import { toggleDriverOnline, toggleDriverBusy, getDriverStatus, updateDriverLocation, getRide, api } from '../src/services/api';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Audio } from 'expo-av';
import * as Linking from 'expo-linking';
import { Ride, Booking } from '../src/types';
import { onDriverStatusUpdate, offDriverStatusUpdate } from '../src/services/socket';

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
  const [currentRideOffer, setCurrentRideOffer] = useState<any>(null);
  const [rideSound, setRideSound] = useState<Audio.Sound | null>(null);
  const [activeRide, setActiveRide] = useState<any>(null);
  const [showPickupModal, setShowPickupModal] = useState(false);
  const [showDropoffModal, setShowDropoffModal] = useState(false);
  const [pickupProgress, setPickupProgress] = useState(new Animated.Value(0));
  const [routeCoordinates, setRouteCoordinates] = useState<any[]>([]);

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

      // Listen for real-time driver status updates
      const handleDriverStatusUpdate = (data: { currentRideId: number | null; isBusy: boolean; rideAccepted: number | null }) => {
        console.log('Received driverStatusUpdate event:', data);
        setDriverOnline(prev => prev); // Keep online status, or update if needed
        setDriverBusy(data.isBusy);
        console.log('Updated local state from event: driverBusy =', data.isBusy);
        // Check for ride offers immediately
        checkForRideOffers();
      };

      onDriverStatusUpdate(handleDriverStatusUpdate);

      // Check status every 5 seconds and check for rides
      const statusLogInterval = setInterval(async () => {
        try {
          const res = await getDriverStatus(authState.token!);

          // Update local state if changed
          if (res.isOnline !== driverOnline) {
            setDriverOnline(res.isOnline);
          }
          if (res.isBusy !== driverBusy) {
            setDriverBusy(res.isBusy);
          }

          // Check for ride offers
          checkForRideOffers();
        } catch (e) {
          console.error('Error checking status:', e);
        }
      }, 5000);

      return () => {
        stopLocationTracking();
        offDriverStatusUpdate();
        clearInterval(statusLogInterval);
        // Cleanup sound
        if (rideSound) {
          rideSound.unloadAsync();
        }
      };
    }
    return () => {
      stopLocationTracking();
    };
  }, [authState.token, driverOnline, driverBusy, currentRideOffer]);

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

      // Check for current active ride
      if (res.currentRideId) {
        console.log('Found current ride, fetching details for rideId:', res.currentRideId);
        const rideRes = await getRide(res.currentRideId, authState.token);
        if (rideRes.ok && rideRes.data) {
          const ride = rideRes.data;
          console.log('Ride status:', ride.status);
          if (ride.status === 'CONFIRMED') {
            // Assigned but not accepted, show offer
            setCurrentRideOffer({
              id: ride.id,
              price: ride.price,
              distanceKm: ride.distanceKm,
              riderName: ride.riderName,
            });
            await playRideSound();
          } else if (ride.status === 'DISPATCHED' || ride.status === 'ONGOING') {
            // Accepted, show pickup modal
            setActiveRide(ride);
            setShowPickupModal(true);
            if (currentLocation) {
              fetchDirections(
                { lat: currentLocation.latitude, lng: currentLocation.longitude },
                { lat: ride.startLatLon.lat, lng: ride.startLatLon.lon }
              );
            }
          } else if (ride.status === 'PICKED_UP') {
            // Picked up, show dropoff modal
            setActiveRide(ride);
            setShowDropoffModal(true);
            fetchDirections(
              { lat: ride.startLatLon.lat, lng: ride.startLatLon.lon },
              { lat: ride.endLatLon.lat, lng: ride.endLatLon.lon }
            );
          }
        } else {
          console.log('Failed to fetch ride details');
        }
      }
    } catch (e) {
      console.error('Error loading driver status:', e);
    }
  };

  const playRideSound = async () => {
    try {
      // Set audio mode to play at maximum volume
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });

      const { sound } = await Audio.Sound.createAsync(
        require('../assets/music/rideGetting.mp3'),
        { shouldPlay: true, isLooping: true, volume: 1.0 }
      );
      setRideSound(sound);
    } catch (error) {
      console.error('Error playing ride sound:', error);
    }
  };

  const stopRideSound = async () => {
    if (rideSound) {
      await rideSound.unloadAsync();
      setRideSound(null);
    }
  };

  const checkForRideOffers = async () => {
    console.log('checkForRideOffers called, token exists:', !!authState.token, 'auth user ID:', authState.user?.id);
    if (!authState.token || !driverOnline || driverBusy) return;

    try {
      const res = await getDriverStatus(authState.token);
      console.log('Driver status for ride check:', {
        currentRideId: res.currentRideId,
        rideAccepted: res.rideAccepted,
        isOnline: res.isOnline,
        isBusy: res.isBusy,
        hasActiveShift: res.hasActiveShift,
        currentRideOffer: !!currentRideOffer
      });

      if (res.currentRideId && res.rideAccepted === 0) {
        console.log('Driver has pending ride offer, checking availability for rideId:', res.currentRideId);
        // Fetch ride details to check availability
        const rideRes = await getRide(res.currentRideId, authState.token);
        console.log('Ride fetch result:', rideRes);
        if (rideRes.ok && rideRes.data) {
          const ride = rideRes.data;
          console.log('Fetched ride details:', { id: ride.id, status: ride.status, driverId: ride.driverId });
          // Check if ride is still available
          if (ride.driverId || ride.status !== 'CONFIRMED') {
            console.log('Ride is not available for acceptance:', { driverId: ride.driverId, status: ride.status });
            // Clear the offer if not available
            if (currentRideOffer) {
              setCurrentRideOffer(null);
              await stopRideSound();
            }
          } else if (!currentRideOffer) {
            console.log('Setting ride offer:', ride);
            setCurrentRideOffer({
              id: ride.id,
              price: ride.price,
              distanceKm: ride.distanceKm,
              riderName: ride.riderName,
            });
            // Play sound when ride offer is received
            await playRideSound();
          }
        } else {
          console.log('getRide failed:', rideRes);
          // If fetch fails, clear offer to be safe
          if (currentRideOffer) {
            setCurrentRideOffer(null);
            await stopRideSound();
          }
        }
      } else if ((!res.currentRideId || res.rideAccepted !== 0) && currentRideOffer) {
        console.log('Clearing ride offer');
        setCurrentRideOffer(null);
        // Stop sound when ride offer is cleared
        await stopRideSound();
      } else {
        console.log('Ride offer conditions not met:', {
          hasCurrentRideId: !!res.currentRideId,
          rideAcceptedIs0: res.rideAccepted === 0,
          noCurrentOffer: !currentRideOffer
        });
      }
    } catch (e) {
      console.error('Error checking for ride offers:', e);
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
        router.push('/login');
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

  const handleNav = (origin: string, destination: string) => {
    const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=driving`;
    Linking.openURL(url);
  };

  const pickupAnimationRef = useRef<Animated.CompositeAnimation | null>(null);

  const handlePickupPressIn = () => {
    // Start filling animation
    pickupAnimationRef.current = Animated.timing(pickupProgress, {
      toValue: 1,
      duration: 3000,
      useNativeDriver: false,
    });
    pickupAnimationRef.current.start(async ({ finished }) => {
      if (finished) {
        try {
          // Update ride status to picked_up
          const res = await api.put(`/api/driver/rides/${activeRide.id}/status`, { status: 'picked_up' }, authState.token!);
          if (res.ok) {
            setShowPickupModal(false);
            setShowDropoffModal(true);
            setPickupProgress(new Animated.Value(0)); // Reset for next use
          } else {
            alert('Failed to update ride status');
          }
        } catch (e) {
          console.error('Error picking up ride:', e);
          alert('Error picking up ride');
        }
      }
    });
  };

  const handlePickupPressOut = () => {
    // Stop animation and reset
    if (pickupAnimationRef.current) {
      pickupAnimationRef.current.stop();
      pickupAnimationRef.current = null;
    }
    Animated.timing(pickupProgress, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const fetchDirections = async (origin: { lat: number; lng: number }, destination: { lat: number; lng: number }) => {
    try {
      const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || 'YOUR_API_KEY';
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&mode=driving&key=${apiKey}`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.routes && data.routes.length > 0) {
        const points = data.routes[0].overview_polyline.points;
        // Decode polyline
        const coordinates = decodePolyline(points);
        setRouteCoordinates(coordinates);
      }
    } catch (error) {
      console.error('Error fetching directions:', error);
      // Fallback to straight line
      setRouteCoordinates([
        { latitude: origin.lat, longitude: origin.lng },
        { latitude: destination.lat, longitude: destination.lng },
      ]);
    }
  };

  const decodePolyline = (encoded: string) => {
    const poly = [];
    let index = 0, len = encoded.length;
    let lat = 0, lng = 0;

    while (index < len) {
      let b, shift = 0, result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lng += dlng;

      poly.push({
        latitude: lat / 1e5,
        longitude: lng / 1e5,
      });
    }
    return poly;
  };

  const handleAcceptRide = async () => {
    if (!authState.token || !authState.user || !currentRideOffer) return;

    console.log('Attempting to accept ride:', { rideId: currentRideOffer.id, driverId: authState.user.id });

    // Double-check ride availability before accepting
    const rideRes = await getRide(currentRideOffer.id, authState.token);
    if (!rideRes.ok || !rideRes.data || rideRes.data.driverId || rideRes.data.status !== 'CONFIRMED') {
      console.log('Ride no longer available, clearing offer');
      setCurrentRideOffer(null);
      await stopRideSound();
      alert('Ride is no longer available');
      return;
    }

    try {
      const res = await api.post(`/api/bookings/${currentRideOffer.id}/accept`, {
        driverId: authState.user.id
      }, authState.token);

      if (res.ok) {
        // Fetch full ride details
        const rideRes = await getRide(currentRideOffer.id, authState.token);
        if (rideRes.ok && rideRes.data) {
          setActiveRide(rideRes.data);
          setCurrentRideOffer(null);
          setShowPickupModal(true);
          await stopRideSound();
        } else {
          alert('Failed to fetch ride details');
        }
      } else {
        alert('Failed to accept ride');
      }
    } catch (e) {
      console.error('Error accepting ride:', e);
      alert('Error accepting ride');
    }
  };


  const goToSettings = () => {
    router.push('/settings');
  };

  const goToProfile = () => {
    router.push('/profile');
  };

  const getStatusText = () => {
    if (!driverOnline) return 'Offline';
    if (driverBusy) return 'Online - Busy';
    return 'Online - Available';
  };

  const getStatusColor = () => {
    if (!driverOnline) return '#dc3545'; // red
    if (driverBusy) return '#ffc107'; // yellow
    return '#28a745'; // green
  };

  return (
    <View style={styles.container}>
      {/* Status Bar */}
      <View style={[styles.statusBar, { backgroundColor: getStatusColor() }]}>
        <Text style={styles.statusText}>{getStatusText()}</Text>
      </View>

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
            {activeRide && (
              <>
                <Marker
                  coordinate={{
                    latitude: activeRide.startLatLon.lat,
                    longitude: activeRide.startLatLon.lon,
                  }}
                  title="Pickup"
                  pinColor="green"
                />
                {routeCoordinates.length > 0 && (
                  <Polyline
                    coordinates={routeCoordinates}
                    strokeColor="#007bff"
                    strokeWidth={3}
                  />
                )}
                {showDropoffModal && (
                  <Marker
                    coordinate={{
                      latitude: activeRide.endLatLon.lat,
                      longitude: activeRide.endLatLon.lon,
                    }}
                    title="Dropoff"
                    pinColor="red"
                  />
                )}
              </>
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

      {/* Ride Offer Modal */}
      {currentRideOffer && (
        <View style={styles.rideOfferContainer}>
          <View style={styles.rideOfferCard}>
            <Text style={styles.rideOfferPrice}>{currentRideOffer.price} DKK</Text>
            <Text style={styles.rideOfferDistance}>{currentRideOffer.distanceKm} km</Text>
            <Text style={styles.rideOfferRider}>{currentRideOffer.riderName}</Text>
            <TouchableOpacity style={styles.acceptRideButton} onPress={handleAcceptRide}>
              <Text style={styles.acceptRideButtonText}>Accept Ride</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Pickup Modal */}
      {showPickupModal && activeRide && (
        <View style={styles.rideModalContainer}>
          <View style={styles.rideModalCard}>
            <Text style={styles.rideModalPrice}>{activeRide.price} DKK</Text>
            <Text style={styles.rideModalDistance}>{activeRide.distanceKm} km</Text>
            <Text style={styles.rideModalAddress}>{activeRide.pickupAddress}</Text>
            <Text style={styles.rideModalType}>{activeRide.vehicleTypeName}</Text>
            <View style={styles.rideModalButtons}>
              <TouchableOpacity
                style={styles.rideNavButton}
                onPress={() => handleNav(`${currentLocation?.latitude},${currentLocation?.longitude}`, activeRide.pickupAddress)}
              >
                <Text style={styles.rideNavButtonText}>NAV</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.pickupButton} onPressIn={handlePickupPressIn} onPressOut={handlePickupPressOut} activeOpacity={1}>
                <Animated.View
                  style={[
                    styles.pickupFill,
                    {
                      width: pickupProgress.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                    },
                  ]}
                />
                <Text style={styles.pickupButtonText}>Pick Up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Dropoff Modal */}
      {showDropoffModal && activeRide && (
        <View style={styles.rideModalContainer}>
          <View style={styles.rideModalCard}>
            <Text style={styles.rideModalPrice}>{activeRide.price} DKK</Text>
            <Text style={styles.rideModalDistance}>{activeRide.distanceKm} km</Text>
            <Text style={styles.rideModalAddress}>{activeRide.dropoffAddress}</Text>
            <View style={styles.rideModalButtons}>
              <TouchableOpacity
                style={styles.rideNavButton}
                onPress={() => handleNav(activeRide.pickupAddress, activeRide.dropoffAddress)}
              >
                <Text style={styles.rideNavButtonText}>NAV</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dropoffButton}>
                <Text style={styles.dropoffButtonText}>Drop Off</Text>
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
  statusBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  statusText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
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
    top: 120,
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
  rideOfferContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  rideOfferCard: {
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    alignItems: 'center',
  },
  rideOfferPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  rideOfferDistance: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  rideOfferRider: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  },
  acceptRideButton: {
    backgroundColor: '#28a745',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  acceptRideButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  rideModalContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  rideModalCard: {
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    alignItems: 'center',
  },
  rideModalPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  rideModalDistance: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  rideModalAddress: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  rideModalType: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  },
  rideModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  rideNavButton: {
    backgroundColor: '#007bff',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flex: 1,
    marginRight: 10,
    alignItems: 'center',
  },
  rideNavButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  pickupButton: {
    backgroundColor: '#28a745',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flex: 1,
    marginLeft: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pickupFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  pickupButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  dropoffButton: {
    backgroundColor: '#dc3545',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flex: 1,
    marginLeft: 10,
    alignItems: 'center',
  },
  dropoffButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});