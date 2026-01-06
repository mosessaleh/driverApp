import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Platform, Image, ScrollView, RefreshControl, TextInput, Animated, PanResponder, ActivityIndicator, AppState } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useAuth } from '../src/context/AuthContext';
import { toggleDriverOnline, toggleDriverBusy, getDriverStatus, updateDriverLocation, getRide, api } from '../src/services/api';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import * as Linking from 'expo-linking';
import { Audio } from 'expo-av';
import { Ride, Booking } from '../src/types';
import { onDriverStatusUpdate, offDriverStatusUpdate, onRideOffer, offRideOffer, onRideOfferTimeout, offRideOfferTimeout, onRideOfferRejected, offRideOfferRejected, sendRideTimeout, acceptRide, rejectRide } from '../src/services/socket';

const { width, height } = Dimensions.get('window');

export default function DashboardScreen() {
  const { authState, logout } = useAuth();
  const router = useRouter();
  const [driverOnline, setDriverOnline] = useState(false);
  const [driverBusy, setDriverBusy] = useState(false);
  const [bannedUntil, setBannedUntil] = useState<Date | null>(null);
  const [banCountdown, setBanCountdown] = useState(0);
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
  const [activeRide, setActiveRide] = useState<any>(null);
  const [currentRideId, setCurrentRideId] = useState<number | null>(null);
  const [showPickupModal, setShowPickupModal] = useState(false);
  const [showDropoffModal, setShowDropoffModal] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState<any[]>([]);
  const [isPickupLoading, setIsPickupLoading] = useState(false);
  const [isDropoffLoading, setIsDropoffLoading] = useState(false);
  const [rideOffer, setRideOffer] = useState<any>(null);
  const [offerCountdown, setOfferCountdown] = useState(0);
  const [offerTimeout, setOfferTimeout] = useState<NodeJS.Timeout | null>(null);
  const [rideOfferSound, setRideOfferSound] = useState<any>(null);

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
    // Set audio mode for notifications
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
  }, []);

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

      // Load driver status after a short delay to ensure socket connection
      const loadInitialStatus = async () => {
        // Wait for socket connection
        await new Promise(resolve => setTimeout(resolve, 1000));
        await loadDriverStatus();
      };
      loadInitialStatus();

      // Listen for real-time driver status updates
      const handleDriverStatusUpdate = (data: { currentRideId: number | null; isBusy: boolean; rideAccepted: number | null; isOnline?: boolean; bannedUntil?: string }) => {
        // Update driver status based on WebSocket data
        if (data.isOnline !== undefined && data.isOnline !== driverOnline) {
          setDriverOnline(data.isOnline);
        }
        if (data.isBusy !== driverBusy) {
          setDriverBusy(data.isBusy);
        }
        if (data.bannedUntil) {
          const bannedDate = new Date(data.bannedUntil);
          setBannedUntil(bannedDate);
          const remaining = Math.max(0, Math.ceil((bannedDate.getTime() - Date.now()) / 1000));
          setBanCountdown(remaining);
        } else if (data.bannedUntil === null) {
          setBannedUntil(null);
          setBanCountdown(0);
        }
      };

      // Add listeners
      onDriverStatusUpdate(handleDriverStatusUpdate);

      // Listen for ride offers
      const handleRideOffer = (data: any) => {
        console.log('=== RECEIVED RIDE OFFER ===');
        console.log('Ride offer data:', data);
        console.log('Current driver state - online:', driverOnline, 'busy:', driverBusy);
        console.log('Current ride offer in state:', rideOffer);

        // Stop any existing sound first
        stopRideOfferSound();

        // Play ride offer sound
        playRideOfferSound();

        setRideOffer(data);
        setOfferCountdown(30); // 30 seconds countdown

        // Start countdown
        const timeout = setInterval(() => {
          setOfferCountdown(prev => {
            if (prev <= 1) {
              // Timeout - automatically reject the ride like clicking reject button
              console.log('Ride offer timed out, automatically rejecting ride');
              if (authState.token) {
                // Automatically reject the ride
                rejectRide(data.rideId, parseInt(authState.user?.id || '0'));
              }
              setRideOffer(null);
              setOfferCountdown(0);
              stopRideOfferSound().then(() => {
                console.log('Sound stopped after timeout');
              });
              if (offerTimeout) {
                clearInterval(offerTimeout);
                setOfferTimeout(null);
              }
              clearInterval(timeout);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);

        setOfferTimeout(timeout);
      };

      onRideOffer(handleRideOffer);

      // Listen for ride offer timeout
      const handleRideOfferTimeout = async (data: { rideId: number }) => {
        console.log('=== RECEIVED RIDE OFFER TIMEOUT ===');
        console.log('Timeout data:', data);
        console.log('Current ride offer:', rideOffer);
        // Only clear if this timeout matches the current offer
        if (rideOffer && rideOffer.rideId === data.rideId) {
          console.log('Clearing offer due to timeout for matching rideId');
          await stopRideOfferSound();
          setRideOffer(null);
          setOfferCountdown(0);
          if (offerTimeout) {
            clearInterval(offerTimeout);
            setOfferTimeout(null);
          }
        } else {
          console.log('Ignoring timeout for non-matching rideId');
        }
      };

      onRideOfferTimeout(handleRideOfferTimeout);

      // Listen for ride offer rejection
      const handleRideOfferRejected = async (data: { rideId: number }) => {
        console.log('=== RECEIVED RIDE OFFER REJECTED ===');
        console.log('Rejection data:', data);
        console.log('Current ride offer:', rideOffer);
        // Only clear if this rejection matches the current offer
        if (rideOffer && rideOffer.rideId === data.rideId) {
          console.log('Clearing offer due to rejection for matching rideId');
          await stopRideOfferSound();
          setRideOffer(null);
          setOfferCountdown(0);
          if (offerTimeout) {
            clearInterval(offerTimeout);
            setOfferTimeout(null);
          }
        } else {
          console.log('Ignoring rejection for non-matching rideId');
        }
      };

      onRideOfferRejected(handleRideOfferRejected);

      // Periodic status check to ensure driver stays connected
      const statusCheckInterval = setInterval(() => {
        if (authState.token && driverOnline) {
          loadDriverStatus();
        }
      }, 30000); // Check every 30 seconds

      return () => {
        stopLocationTracking();
        offDriverStatusUpdate();
        offRideOffer();
        offRideOfferTimeout();
        offRideOfferRejected();
        if (offerTimeout) {
          clearInterval(offerTimeout);
        }
        if (statusCheckInterval) {
          clearInterval(statusCheckInterval);
        }
        // Stop any playing sound when component unmounts
        stopRideOfferSound();
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

  // Countdown for ban
  useEffect(() => {
    if (bannedUntil) {
      const interval = setInterval(() => {
        const remaining = Math.max(0, Math.ceil((bannedUntil.getTime() - Date.now()) / 1000));
        setBanCountdown(remaining);
        if (remaining <= 0) {
          setBannedUntil(null);
          setBanCountdown(0);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [bannedUntil]);

  // Fit map to show pickup and dropoff when pickup or dropoff modal is shown
  useEffect(() => {
    if ((showPickupModal || showDropoffModal) && activeRide && mapRef.current) {
      const coordinates = showPickupModal ? [
        { latitude: currentLocation?.latitude || 0, longitude: currentLocation?.longitude || 0 },
        { latitude: activeRide.startLatLon.lat, longitude: activeRide.startLatLon.lon }
      ] : [
        { latitude: activeRide.startLatLon.lat, longitude: activeRide.startLatLon.lon },
        { latitude: activeRide.endLatLon.lat, longitude: activeRide.endLatLon.lon }
      ];
      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: { top: 50, right: 50, bottom: 200, left: 50 },
        animated: true,
      });
    }
  }, [showPickupModal, showDropoffModal, activeRide, currentLocation]);

  const loadDriverStatus = async (retryCount = 0) => {
    if (!authState.token) {
      return;
    }
    try {
      const res = await getDriverStatus(authState.token);
      console.log('Loaded driver status:', res);
      console.log('Current driver state - online:', driverOnline, 'busy:', driverBusy);

      // Ensure driver is marked as online if they have an active shift
      if (res.hasActiveShift && !res.isOnline) {
        console.log('Driver has active shift but not online, setting online');
        await toggleDriverOnline(true, authState.token);
        res.isOnline = true;
      }

      if (res.isOnline !== undefined && res.isOnline !== driverOnline) {
        const wasOnline = driverOnline;
        console.log(`Updating driver online status: ${wasOnline} -> ${res.isOnline}`);
        setDriverOnline(res.isOnline);
        // Auto start tracking if became online
        if (res.isOnline && !wasOnline) {
          startLocationTracking();
        }
      }
      if (res.isBusy !== undefined && res.isBusy !== driverBusy) {
        console.log(`Updating driver busy status: ${driverBusy} -> ${res.isBusy}`);
        setDriverBusy(res.isBusy);
      }

      if (res.bannedUntil) {
        const bannedDate = new Date(res.bannedUntil);
        setBannedUntil(bannedDate);
        const remaining = Math.max(0, Math.ceil((bannedDate.getTime() - Date.now()) / 1000));
        setBanCountdown(remaining);
      } else {
        setBannedUntil(null);
        setBanCountdown(0);
      }

      // Check for current active ride
      if (res.currentRideId && !activeRide) {
        const rideRes = await getRide(res.currentRideId.toString(), authState.token);
        if (rideRes.ok && rideRes.data) {
          const ride = rideRes.data;

          if (ride.status === 'DISPATCHED' || ride.status === 'ONGOING') {
            // Accepted, show pickup modal
            setActiveRide(ride);
            setShowPickupModal(true);
            sliderPositionRef.current = sliderWidth * 0.05;
            setSliderPosition(sliderWidth * 0.05); // Reset slider
            // Fetch directions from driver to pickup point (since not picked up yet)
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
            // Fetch directions after a short delay to ensure map is ready
            setTimeout(() => {
              fetchDirections(
                { lat: ride.startLatLon.lat, lng: ride.startLatLon.lon },
                { lat: ride.endLatLon.lat, lng: ride.endLatLon.lon }
              );
            }, 1000);
          }
        }
      } else if (!res.currentRideId) {
        // Clear any existing ride displays
        setActiveRide(null);
        setShowPickupModal(false);
        setShowDropoffModal(false);
      }
    } catch (e) {
      console.error('Error loading driver status:', e);
      // Retry up to 3 times with exponential backoff
      if (retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
        console.log(`Retrying driver status load in ${delay}ms (attempt ${retryCount + 1}/3)`);
        setTimeout(() => loadDriverStatus(retryCount + 1), delay);
      }
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
    // Play pickup beep sound
    playPickupBeep();
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
        // Clear previous route and fetch new route from pickup to dropoff
        setRouteCoordinates([]);
        fetchDirections(
          { lat: activeRide.startLatLon.lat, lng: activeRide.startLatLon.lon },
          { lat: activeRide.endLatLon.lat, lng: activeRide.endLatLon.lon }
        );
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
    // Play dropoff beep sound
    playDropoffBeep();
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
        setRouteCoordinates([]);
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

  const playBeepSound = async (soundFile: any, loop: boolean = false) => {
    try {
      const { sound } = await Audio.Sound.createAsync(soundFile, { isLooping: loop });
      await sound.playAsync();

      if (!loop) {
        // Unload the sound after playback to free resources
        sound.setOnPlaybackStatusUpdate((status: any) => {
          if (status.didJustFinish) {
            sound.unloadAsync();
          }
        });
      }

      return sound; // Return sound object for looping sounds
    } catch (error) {
      console.error('Error playing beep sound:', error);
      return null;
    }
  };

  const playPickupBeep = () => playBeepSound(require('../assets/music/PickUp.mp3'));
  const playDropoffBeep = () => playBeepSound(require('../assets/music/DropOff.mp3'));

  const playRideOfferSound = async () => {
    let loopCount = 0;
    const playNext = async () => {
      if (loopCount >= 12) return;
      const { sound } = await Audio.Sound.createAsync(require('../assets/music/rideGetting.mp3'));
      setRideOfferSound(sound);
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.didJustFinish) {
          loopCount++;
          sound.unloadAsync();
          setRideOfferSound(null);
          if (loopCount < 12) {
            playNext();
          }
        }
      });
      await sound.playAsync();
    };
    playNext();
  };

  const stopRideOfferSound = async () => {
    console.log('Stopping ride offer sound, current sound object:', rideOfferSound);
    if (rideOfferSound) {
      try {
        // For looped sounds, the most reliable way is to unload immediately
        await rideOfferSound.unloadAsync();
        console.log('Sound unloaded successfully');
        setRideOfferSound(null);
      } catch (error: any) {
        console.error('Error unloading sound:', error);
        // Force set to null even if unload failed
        setRideOfferSound(null);
      }
    } else {
      console.log('No sound object to stop');
    }
  };

  const goToSettings = () => {
    router.push('/settings');
  };

  const goToProfile = () => {
    router.push('/profile');
  };

  const getStatusText = () => {
    if (bannedUntil && banCountdown > 0) return `Banned - ${banCountdown}s`;
    if (!driverOnline) return 'Offline';
    if (driverBusy) return 'Online - Busy';
    return 'Online - Available';
  };

  const getStatusColor = () => {
    if (bannedUntil && banCountdown > 0) return '#dc3545'; // red
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
           {!driverBusy && driverOnline && !bannedUntil && (
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
           {driverBusy && driverOnline && !bannedUntil && (
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
            {activeRide && showPickupModal && (
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
                <Marker
                  coordinate={{
                    latitude: activeRide.endLatLon.lat,
                    longitude: activeRide.endLatLon.lon,
                  }}
                  title="Dropoff"
                  pinColor="red"
                />
              </>
            )}
            {activeRide && showDropoffModal && (
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
                <Marker
                  coordinate={{
                    latitude: activeRide.endLatLon.lat,
                    longitude: activeRide.endLatLon.lon,
                  }}
                  title="Dropoff"
                  pinColor="red"
                />
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
              <TouchableOpacity style={styles.pickupButton} onLongPress={handlePickupConfirm} delayLongPress={1500} disabled={isPickupLoading}>
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
              <TouchableOpacity style={styles.dropoffButton} onLongPress={handleDropoffConfirm} delayLongPress={1500} disabled={isDropoffLoading}>
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

      {/* Ride Offer Modal */}
      {rideOffer && (
        <View style={styles.rideOfferModal}>
          <View style={styles.rideOfferCard}>
            <Text style={styles.rideOfferTitle}>New Ride Available!</Text>
            <Text style={styles.rideOfferId}>#{rideOffer.rideId}</Text>
            <Text style={styles.rideOfferPrice}>{rideOffer.rideData.price} DKK</Text>
            <Text style={styles.rideOfferDistance}>{rideOffer.rideData.distanceKm} km</Text>
            <Text style={styles.rideOfferAddress}>From: {rideOffer.rideData.pickupAddress}</Text>
            <Text style={styles.rideOfferAddress}>To: {rideOffer.rideData.dropoffAddress}</Text>
            <Text style={styles.rideOfferCountdown}>{offerCountdown}s</Text>
            <View style={styles.rideOfferButtons}>
              <TouchableOpacity
                style={[styles.rideOfferButton, styles.acceptButton]}
                onPress={async () => {
                  // Accept the ride
                  acceptRide(rideOffer.rideId, parseInt(authState.user?.id || '0'));
                  setRideOffer(null);
                  setOfferCountdown(0);
                  stopRideOfferSound().then(() => {
                    console.log('Sound stopped after timeout');
                  });
                  if (offerTimeout) {
                    clearInterval(offerTimeout);
                    setOfferTimeout(null);
                  }
                  // Reload driver status to show pickup modal immediately
                  await loadDriverStatus();
                }}
              >
                <Text style={styles.acceptButtonText}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.rideOfferButton, styles.rejectButton]}
                onPress={async () => {
                  // Reject the ride
                  rejectRide(rideOffer.rideId, parseInt(authState.user?.id || '0'));
                  setRideOffer(null);
                  setOfferCountdown(0);
                  await stopRideOfferSound(); // Stop the sound
                  if (offerTimeout) {
                    clearInterval(offerTimeout);
                    setOfferTimeout(null);
                  }
                }}
              >
                <Text style={styles.rejectButtonText}>Reject</Text>
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
  mapPlaceholderText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
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
  rideOfferModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 3000,
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
    minWidth: 300,
  },
  rideOfferTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  rideOfferId: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  rideOfferPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#28a745',
    marginBottom: 8,
  },
  rideOfferDistance: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  rideOfferAddress: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
    textAlign: 'center',
  },
  rideOfferCountdown: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#dc3545',
    marginBottom: 15,
  },
  rideOfferButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  rideOfferButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  acceptButton: {
    backgroundColor: '#28a745',
  },
  rejectButton: {
    backgroundColor: '#dc3545',
  },
  acceptButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  rejectButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});