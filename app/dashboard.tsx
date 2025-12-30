import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Platform, Image, ScrollView, RefreshControl, TextInput, Animated, PanResponder, ActivityIndicator } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useAuth } from '../src/context/AuthContext';
import { toggleDriverOnline, toggleDriverBusy, getDriverStatus, updateDriverLocation, getRide, api } from '../src/services/api';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Audio } from 'expo-av';
import * as Linking from 'expo-linking';
import { Ride, Booking } from '../src/types';
import { onDriverStatusUpdate, offDriverStatusUpdate, onRideOffer, offRideOffer } from '../src/services/socket';

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
  const [lastLocationUpdate, setLastLocationUpdate] = useState(0);
  const [lastStatusCheck, setLastStatusCheck] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [showEndShiftMenu, setShowEndShiftMenu] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showEndKMModal, setShowEndKMModal] = useState(false);
  const [endKM, setEndKM] = useState('');
  const [currentRideOffer, setCurrentRideOffer] = useState<any>(null);
  const [isAcceptingRide, setIsAcceptingRide] = useState(false);
  const [rideSound, setRideSound] = useState<Audio.Sound | null>(null);
  const [activeRide, setActiveRide] = useState<any>(null);
  const [currentRideId, setCurrentRideId] = useState<number | null>(null);
  const [showPickupModal, setShowPickupModal] = useState(false);
  const [showDropoffModal, setShowDropoffModal] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState<any[]>([]);
  const [isPickupLoading, setIsPickupLoading] = useState(false);
  const [isDropoffLoading, setIsDropoffLoading] = useState(false);

  // Animation for GO button text
  const textOpacityAnim = useRef(new Animated.Value(1)).current;

  // Slider refs and state
  const sliderPositionRef = useRef(0);
  const [sliderPosition, setSliderPosition] = useState(0);
  const sliderWidth = Dimensions.get('window').width * 0.8; // Assuming slider takes 80% of screen width

  // Slider pan responder
  const sliderPanResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      // Optional: start animation
    },
    onPanResponderMove: (evt, gestureState) => {
      const newPosition = Math.max(0, Math.min(sliderWidth, sliderPositionRef.current + gestureState.dx));
      setSliderPosition(newPosition);
      sliderPositionRef.current = newPosition;
    },
    onPanResponderRelease: () => {
      if (sliderPosition >= sliderWidth * 0.8) { // If slid far enough
        handlePickupConfirm();
      } else {
        // Reset slider
        setSliderPosition(0);
        sliderPositionRef.current = 0;
      }
    },
  });

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
      getCurrentLocation();

      // Load driver status immediately on mount
      const loadInitialStatus = async () => {
        await loadDriverStatus();
      };
      loadInitialStatus();

      let pollingInterval: NodeJS.Timeout | null = null;

      // Polling every 15 seconds only if no active ride
      if (!activeRide) {
        pollingInterval = setInterval(() => {
          loadDriverStatus();
        }, 15000);
      }

      // Listen for real-time driver status updates
      const handleDriverStatusUpdate = (data: { currentRideId: number | null; isBusy: boolean; rideAccepted: number | null; isOnline?: boolean }) => {
        // Update driver status based on WebSocket data
        if (data.isOnline !== undefined && data.isOnline !== driverOnline) {
          setDriverOnline(data.isOnline);
        }
        if (data.isBusy !== driverBusy) {
          setDriverBusy(data.isBusy);
        }
        // Check for ride offers immediately with the status data only if no active ride
        if (!activeRide) {
          checkForRideOffers(data);
        }
      };

      // Listen for ride offers
      const handleRideOffer = async (data: { rideId: number; timestamp: number }) => {
        if (!authState.token) return;
        // Fetch ride details to show offer
        const rideRes = await getRide(data.rideId.toString(), authState.token);
        if (rideRes.ok && rideRes.data) {
          const ride = rideRes.data;
          // Check if ride is still available
          if (ride.driverId || ride.status !== 'CONFIRMED') {
            // Ride not available, ignore
            return;
          }
          // Show ride offer
          setCurrentRideOffer({
            id: ride.id,
            price: ride.price,
            distanceKm: ride.distanceKm,
            riderName: ride.riderName,
          });
          // Play sound when ride offer is received
          await playRideSound();
        }
      };

      // Add listeners only if no active ride
      if (!activeRide) {
        onRideOffer(handleRideOffer);
        onDriverStatusUpdate(handleDriverStatusUpdate);
      }

      // Listen for socket connect to check for existing rides
      const handleSocketConnect = () => {
        loadDriverStatus();
      };
      // Assuming socket has connect event, but since it's not exposed, we can call loadDriverStatus on mount
      // For now, call it once on mount if no active ride
      if (!activeRide) {
        loadDriverStatus();
      }

      return () => {
        if (pollingInterval) {
          clearInterval(pollingInterval);
        }
        stopLocationTracking();
        offDriverStatusUpdate();
        offRideOffer();
        // Cleanup sound
        if (rideSound) {
          try {
            rideSound.unloadAsync();
          } catch (error) {
            console.error('Error unloading sound on cleanup:', error);
          }
        }
      };
    }
    return () => {
      stopLocationTracking();
    };
  }, [authState.token, activeRide]);


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
      return;
    }
    try {
      const res = await getDriverStatus(authState.token);
      if (res.isOnline !== undefined && res.isOnline !== driverOnline) {
        const wasOnline = driverOnline;
        setDriverOnline(res.isOnline);
        // Auto start tracking if became online
        if (res.isOnline && !wasOnline) {
          startLocationTracking();
        }
      }
      if (res.isBusy !== undefined && res.isBusy !== driverBusy) {
        setDriverBusy(res.isBusy);
      }

      // Check for current active ride - re-enabled for initial detection
      if (res.currentRideId && !activeRide) {
        const rideRes = await getRide(res.currentRideId.toString(), authState.token);
        if (rideRes.ok && rideRes.data) {
          const ride = rideRes.data;

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
            sliderPositionRef.current = sliderWidth * 0.05;
            setSliderPosition(sliderWidth * 0.05); // Reset slider
            // Fetch directions after a short delay to ensure location is available
            setTimeout(() => {
              if (currentLocation) {
                fetchDirections(
                  { lat: currentLocation.latitude, lng: currentLocation.longitude },
                  { lat: ride.startLatLon.lat, lng: ride.startLatLon.lon }
                );
              }
            }, 1000);
          } else if (ride.status === 'PICKED_UP') {
            // Picked up, show dropoff modal
            setActiveRide(ride);
            setShowDropoffModal(true);
            fetchDirections(
              { lat: ride.startLatLon.lat, lng: ride.startLatLon.lon },
              { lat: ride.endLatLon.lat, lng: ride.endLatLon.lon }
            );
          }
        }
      } else if (!res.currentRideId) {
        // Clear any existing ride displays
        setCurrentRideOffer(null);
        setActiveRide(null);
        setShowPickupModal(false);
        setShowDropoffModal(false);
      }

      // Check for ride offers
      checkForRideOffers(res);
    } catch (e) {
      console.error('Error loading driver status:', e);
    }
  };

  const playRideSound = async () => {
    try {
      // Prevent multiple sound instances or if there's an active ride
      if (rideSound || activeRide || currentRideId) {
        return;
      }

      // Set audio mode to play at maximum volume
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });

      const { sound } = await Audio.Sound.createAsync(
        require('../assets/music/rideGetting.mp3'),
        { shouldPlay: true, isLooping: true, volume: 0.8 } // Loop until accepted or rejected
      );
      setRideSound(sound);

      // Listen for sound finish to clean up
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          stopRideSound();
        }
      });
    } catch (error) {
      console.error('Error playing ride sound:', error);
    }
  };

  const stopRideSound = async () => {
    if (rideSound) {
      try {
        const status = await rideSound.getStatusAsync();
        if (status.isLoaded) {
          await rideSound.stopAsync();
        }
        await rideSound.unloadAsync();
        setRideSound(null);
      } catch (error) {
        console.error('Error stopping sound:', error);
        setRideSound(null);
      }
    }
  };

  const playBeepSound = async (soundFile: any) => {
    try {
      const { sound } = await Audio.Sound.createAsync(soundFile, { shouldPlay: true });
      // No need to set state since it's a short beep
    } catch (error) {
      console.error('Error playing beep sound:', error);
    }
  };

  const playAcceptBeep = () => playBeepSound(require('../assets/music/beep-accept.mp3'));
  const playPickupBeep = () => playBeepSound(require('../assets/music/beep-pickup.mp3'));
  const playDropoffBeep = () => playBeepSound(require('../assets/music/beep-dropoff.mp3'));

  const checkForRideOffers = async (status?: any) => {
    if (isAcceptingRide || activeRide) return;
    if (!authState.token || !driverOnline || driverBusy) return;

    // Since we rely on WebSocket for real-time updates, we don't need polling
    // This function is now mainly called when WebSocket events trigger it
    // For ride offers, they come via 'rideOffer' event, not through status polling

    // If status is provided (from WebSocket or initial load), use it
    if (status && status.currentRideId && status.rideAccepted === 0 && !activeRide) {
      // Fetch ride details to check availability
      const rideRes = await getRide(status.currentRideId.toString(), authState.token);
      if (rideRes.ok && rideRes.data) {
        const ride = rideRes.data;
        // Check if ride is still available
        if (ride.driverId || ride.status !== 'CONFIRMED') {
          // Clear the offer if not available
          if (currentRideOffer) {
            setCurrentRideOffer(null);
            await stopRideSound();
          }
        } else if (!currentRideOffer) {
          setCurrentRideOffer({
            id: ride.id,
            price: ride.price,
            distanceKm: ride.distanceKm,
            riderName: ride.riderName,
          });
          // Play sound when ride offer is received (only once)
          await playRideSound();
        }
      } else {
        // If fetch fails, clear offer to be safe
        if (currentRideOffer) {
          setCurrentRideOffer(null);
          await stopRideSound();
        }
      }
    } else if ((!status?.currentRideId || status?.rideAccepted !== 0) && currentRideOffer) {
      setCurrentRideOffer(null);
      // Stop sound when ride offer is cleared
      await stopRideSound();
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

            // Send location update to database only every 30 seconds
            const now = Date.now();
            if (authState.token && now - lastLocationUpdate >= 30000) {
              try {
                await updateDriverLocation(
                  newLocation.latitude,
                  newLocation.longitude,
                  authState.token,
                  new Date().toISOString()
                );
                setLastLocationUpdate(now);
              } catch (error) {
                console.error('Failed to update location on server:', error);
              }
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


  const handlePickupConfirm = async () => {
    const rideId = activeRide?.id || currentRideId;
    if (!rideId) {
      return;
    }
    setIsPickupLoading(true);
    try {
      // Update ride status to PICKED_UP and set pickedAt timestamp
      const res = await api.put(`/api/driver/rides/${rideId}/status`, {
        status: 'PICKED_UP',
        pickedAt: new Date().toISOString()
      }, authState.token!);
      if (res.ok) {
        setIsPickupLoading(false);
        setShowPickupModal(false);
        setShowDropoffModal(true);
      } else {
        setIsPickupLoading(false);
        alert('Failed to update ride status');
      }
    } catch (e) {
      console.error('Error picking up ride:', e);
      setIsPickupLoading(false);
      alert('Error picking up ride');
    }
  };

  const handleDropoffConfirm = async () => {
    const rideId = activeRide?.id;
    if (!rideId) return;
    setIsDropoffLoading(true);
    try {
      const res = await api.put(`/api/driver/rides/${rideId}/status`, {
        status: 'COMPLETED',
        droppedAt: new Date().toISOString()
      }, authState.token!);
      if (res.ok) {
        setShowDropoffModal(false);
        setActiveRide(null);
        setCurrentRideId(null);
        if (res.paymentResult && !res.paymentResult.success) {
          alert(`Ride completed but payment failed: ${res.paymentResult.error}`);
        } else {
          alert('Ride completed successfully');
        }
      } else {
        alert('Failed to complete ride');
      }
    } catch (e) {
      console.error('Error completing ride:', e);
      alert('Error completing ride');
    } finally {
      setIsDropoffLoading(false);
    }
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

    setIsAcceptingRide(true);

    await stopRideSound();

    // Double-check ride availability before accepting
    const rideRes = await getRide(currentRideOffer.id, authState.token);
    if (!rideRes.ok || !rideRes.data || rideRes.data.driverId || rideRes.data.status !== 'CONFIRMED') {
      setCurrentRideOffer(null);
      await stopRideSound();
      alert('Ride is no longer available');
      return;
    }

    try {
      const res = await api.post(`/api/drivers/${authState.user.id}/accept-ride`, {
        rideId: currentRideOffer.id
      }, authState.token);

      if (res.ok) {
        // Fetch full ride details
        const rideRes = await getRide(currentRideOffer.id, authState.token);
        if (rideRes.ok && rideRes.data) {
          setActiveRide(rideRes.data);
          setCurrentRideId(currentRideOffer.id);
          setCurrentRideOffer(null);
          setShowPickupModal(true);
          sliderPositionRef.current = sliderWidth * 0.05;
          setSliderPosition(sliderWidth * 0.05); // Reset slider
          await stopRideSound();
        } else {
          setCurrentRideId(currentRideOffer.id);
          setCurrentRideOffer(null);
          setShowPickupModal(true);
          sliderPositionRef.current = sliderWidth * 0.05;
          setSliderPosition(sliderWidth * 0.05); // Reset slider
          await stopRideSound();
        }
      } else {
        alert('Failed to accept ride');
      }
    } catch (e) {
      console.error('Error accepting ride:', e);
      alert('Error accepting ride');
    } finally {
      setIsAcceptingRide(false);
    }
  };

  const handleRejectRide = async () => {
    if (!authState.token || !authState.user || !currentRideOffer) return;

    await stopRideSound();

    try {
      // Clear the ride offer from driver status
      await api.post(`/api/drivers/${authState.user.id}/reject-ride`, {
        rideId: currentRideOffer.id
      }, authState.token);

      setCurrentRideOffer(null);
    } catch (e) {
      console.error('Error rejecting ride:', e);
      // Still clear the offer locally
      setCurrentRideOffer(null);
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
            <Text style={styles.rideOfferId}>#{currentRideOffer.id}</Text>
            <Text style={styles.rideOfferPrice}>{currentRideOffer.price} DKK</Text>
            <Text style={styles.rideOfferDistance}>{currentRideOffer.distanceKm} km</Text>
            <Text style={styles.rideOfferRider}>{currentRideOffer.riderName}</Text>
            <View style={styles.rideOfferButtons}>
              <TouchableOpacity style={styles.rejectRideButton} onPress={handleRejectRide}>
                <Text style={styles.rejectRideButtonText}>Reject</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.acceptRideButton} onPress={handleAcceptRide} disabled={isAcceptingRide}>
                <Text style={styles.acceptRideButtonText}>
                  {isAcceptingRide ? 'Accepting...' : 'Accept Ride'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Pickup Modal */}
      {showPickupModal && activeRide && (
        <View style={styles.rideModalContainer}>
          <View style={styles.rideModalCard}>
            <Text style={styles.rideModalId}>#{activeRide.id}</Text>
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
              <TouchableOpacity style={styles.pickupButton} onLongPress={handlePickupConfirm} delayLongPress={3000} disabled={isPickupLoading}>
                {isPickupLoading ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={[styles.pickupButtonText, { marginLeft: 10 }]}>Picking up passenger...</Text>
                  </View>
                ) : (
                  <Text style={styles.pickupButtonText}>Hold to Pick Up</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Dropoff Modal */}
      {showDropoffModal && activeRide && (
        <View style={styles.rideModalContainer}>
          <View style={styles.rideModalCard}>
            <Text style={styles.rideModalId}>#{activeRide.id}</Text>
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
              <TouchableOpacity style={styles.dropoffButton} onLongPress={handleDropoffConfirm} delayLongPress={3000} disabled={isDropoffLoading}>
                {isDropoffLoading ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={[styles.dropoffButtonText, { marginLeft: 10 }]}>Dropping off...</Text>
                  </View>
                ) : (
                  <Text style={styles.dropoffButtonText}>Hold to Drop Off</Text>
                )}
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
    position: 'relative',
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
    marginBottom: 8,
  },
  rideOfferId: {
    position: 'absolute',
    top: 10,
    left: 10,
    fontSize: 14,
    color: '#999',
    fontWeight: 'bold',
  },
  rideOfferButtons: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
  },
  rejectRideButton: {
    backgroundColor: '#dc3545',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
  },
  rejectRideButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  acceptRideButton: {
    backgroundColor: '#28a745',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flex: 1,
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
    position: 'relative',
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
    marginBottom: 8,
  },
  rideModalId: {
    position: 'absolute',
    top: 10,
    left: 10,
    fontSize: 14,
    color: '#999',
    fontWeight: 'bold',
  },
  rideModalButtons: {
    flexDirection: 'column',
    width: '100%',
    gap: 10,
  },
  rideNavButton: {
    backgroundColor: '#007bff',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    width: '100%',
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
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
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
    width: '100%',
    alignItems: 'center',
  },
  dropoffButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  sliderContainer: {
    width: '100%',
    justifyContent: 'center',
  },
  sliderTrack: {
    height: 50,
    backgroundColor: '#f0f0f0',
    borderRadius: 25,
    position: 'relative',
    overflow: 'hidden',
  },
  sliderFill: {
    height: '100%',
    backgroundColor: '#28a745',
    borderRadius: 25,
  },
  sliderThumb: {
    position: 'absolute',
    top: 0,
    width: 50,
    height: 50,
    backgroundColor: '#fff',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  sliderThumbText: {
    color: '#28a745',
    fontSize: 20,
    fontWeight: 'bold',
  },
  sliderText: {
    textAlign: 'center',
    marginTop: 8,
    fontSize: 14,
    color: '#666',
  },
  sliderSpinner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinner: {
    width: 30,
    height: 30,
    borderWidth: 3,
    borderColor: '#28a745',
    borderTopColor: 'transparent',
    borderRadius: 15,
  },
});