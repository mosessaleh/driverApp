import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Platform, Image, ScrollView, RefreshControl, TextInput, Animated, PanResponder, ActivityIndicator, AppState, Alert, BackHandler } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useAuth } from '../src/context/AuthContext';
import { useSettings } from '../src/context/SettingsContext';
import { toggleDriverOnline, toggleDriverBusy, getDriverStatus, updateDriverLocation, getRide, api, endShift } from '../src/services/api';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import * as Linking from 'expo-linking';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ride, Booking } from '../src/types';
import { onDriverStatusUpdate, offDriverStatusUpdate, onRideOffer, offRideOffer, onRideOfferTimeout, offRideOfferTimeout, onRideOfferRejected, offRideOfferRejected, onRideCancelled, offRideCancelled, sendRideTimeout, acceptRide, rejectRide, joinChat, sendMessage, onNewMessage, offNewMessage } from '../src/services/socket';
import { sendLocalNotification } from '../src/services/notifications';
import * as Notifications from 'expo-notifications';

const { width, height } = Dimensions.get('window');

export default function DashboardScreen() {
   const { authState, logout } = useAuth();
   const { settings, isDarkMode } = useSettings();
   const router = useRouter();
   const [driverOnline, setDriverOnline] = useState(false);
   const [driverBusy, setDriverBusy] = useState(false);
   const [bannedUntil, setBannedUntil] = useState<Date | null>(null);
   const [banCountdown, setBanCountdown] = useState(0);
   const [shiftStartTime, setShiftStartTime] = useState<string | null>(null);
   const [shiftElapsedTime, setShiftElapsedTime] = useState('00:00:00');
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
   const [showChat, setShowChat] = useState(false);
   const [chatMessages, setChatMessages] = useState<any[]>([]);
   const [chatInput, setChatInput] = useState('');
   const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
   const [isBatchNotificationActive, setIsBatchNotificationActive] = useState(false);

   const quickReplies = ["I'm on my way", "I've arrived", "Traffic on the way", "I'm arriving"];

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

      // Set shift start time from user data if available
      if (authState.user?.shiftStartTime) {
        setShiftStartTime(authState.user.shiftStartTime);
      }

      // Load batch notification state
      loadBatchNotificationState();

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

        // Play ride offer sound if enabled
        if (settings.sound.rideOfferSound) {
          playRideOfferSound();
        }

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

      // Listen for ride cancellation
      const handleRideCancelled = async (data: { rideId: number }) => {
        console.log('=== RECEIVED RIDE CANCELLED ===');
        console.log('Cancellation data:', data);
        console.log('Current ride offer:', rideOffer);
        // Only clear if this cancellation matches the current offer
        if (rideOffer && rideOffer.rideId === data.rideId) {
          console.log('Clearing offer due to cancellation for matching rideId');
          await stopRideOfferSound();
          setRideOffer(null);
          setOfferCountdown(0);
          if (offerTimeout) {
            clearInterval(offerTimeout);
            setOfferTimeout(null);
          }
        } else {
          console.log('Ignoring cancellation for non-matching rideId');
        }
      };

      onRideCancelled(handleRideCancelled);

      // Listen for chat messages
      const handleNewMessage = (data: { message: string; sender: string; timestamp: string }) => {
        console.log('Received chat message:', data);
        setChatMessages(prev => [...prev, data]);

        // If message is from client (passenger), increment unread count and play sound
        if (data.sender !== 'driver') {
          setUnreadMessagesCount(prev => prev + 1);
          if (settings.sound.messageSound) {
            playMessageSound();
          }
        }
      };

      onNewMessage(handleNewMessage);

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
        offRideCancelled();
        offNewMessage();
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

  // Handle app state changes (background/foreground)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        Alert.alert(
          'Warning',
          'If you close the app or put it in the background, you may face problems receiving new ride requests. It is recommended to keep the app open to ensure notifications are received.',
          [{ text: 'OK' }]
        );
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, []);


  // Handle back button press on Android
  useEffect(() => {
    const backAction = () => {
      Alert.alert(
        'Warning',
        'If you close the app, you may face problems receiving new ride requests. Are you sure you want to exit?',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => null },
          { text: 'Exit', style: 'destructive', onPress: () => BackHandler.exitApp() }
        ]
      );
      return true; // Prevent default back action
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);

    return () => backHandler?.remove();
  }, []);

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

  // Shift elapsed time counter
  useEffect(() => {
    if (shiftStartTime) {
      const updateElapsedTime = () => {
        const start = new Date(shiftStartTime).getTime();
        const now = Date.now();
        const elapsed = Math.floor((now - start) / 1000);

        const hours = Math.floor(elapsed / 3600);
        const minutes = Math.floor((elapsed % 3600) / 60);
        const seconds = elapsed % 60;

        const formatted = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        setShiftElapsedTime(formatted);
      };

      updateElapsedTime(); // Initial update
      const interval = setInterval(updateElapsedTime, 1000);
      return () => clearInterval(interval);
    } else {
      setShiftElapsedTime('00:00:00');
    }
  }, [shiftStartTime]);

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

  // Join chat room when active ride is available
  useEffect(() => {
    if (activeRide && activeRide.id) {
      console.log('Joining chat room for ride:', activeRide.id);
      joinChat(activeRide.id);
      // Clear previous chat messages when starting new ride
      setChatMessages([]);
      setUnreadMessagesCount(0);
    }
  }, [activeRide]);

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

      // Set shift start time
      if (res.shiftStartTime) {
        setShiftStartTime(res.shiftStartTime);
      } else {
        setShiftStartTime(null);
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

  const loadBatchNotificationState = async () => {
    try {
      const state = await AsyncStorage.getItem('batchNotificationActive');
      if (state === 'true') {
        setIsBatchNotificationActive(true);
        startBatchNotification();
      }
    } catch (error) {
      console.error('Error loading batch notification state:', error);
    }
  };

  const startBatchNotification = async () => {
    console.log('startBatchNotification called, driverId:', authState.user?.id);
    if (!authState.token || !authState.user?.id) {
      console.log('No token or user id');
      return;
    }
    try {
      const response = await api.post('/api/driver-batch-notification/start', { driverId: authState.user.id }, authState.token);
      console.log('API response:', response);
      AsyncStorage.setItem('batchNotificationActive', 'true');
    } catch (error) {
      console.error('Error starting batch notification:', error);
      alert('Error starting batch notification: ' + (error as Error).message);
    }
  };

  const stopBatchNotification = async () => {
    console.log('stopBatchNotification called, driverId:', authState.user?.id);
    if (!authState.token || !authState.user?.id) {
      console.log('No token or user id');
      return;
    }
    try {
      const response = await api.post('/api/driver-batch-notification/stop', { driverId: authState.user.id }, authState.token);
      console.log('API response:', response);
      AsyncStorage.setItem('batchNotificationActive', 'false');
    } catch (error) {
      console.error('Error stopping batch notification:', error);
      alert('Error stopping batch notification: ' + (error as Error).message);
    }
  };

  const toggleBatchNotification = async () => {
    console.log('toggleBatchNotification called, active:', isBatchNotificationActive);
    console.log('authState.user:', authState.user);
    if (isBatchNotificationActive) {
      await stopBatchNotification();
      setIsBatchNotificationActive(false);
      alert('Batch notification stopped');
    } else {
      await startBatchNotification();
      setIsBatchNotificationActive(true);
      alert('Batch notification started');
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

  const handleEndShift = async () => {
    if (!endKM || isNaN(Number(endKM))) {
      alert('Please enter a valid end KM');
      return;
    }

    if (authState.token) {
      try {
        // Stop tracking first
        stopLocationTracking();

        // Call end shift API
        const data = await endShift(Number(endKM), authState.token);

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
    // Play pickup beep sound if enabled
    if (settings.sound.pickupDropoffSound) {
      playPickupBeep();
    }
    setIsPickupLoading(true);
    // Update ride status locally for immediate UI update
    setActiveRide((prev: any) => prev ? { ...prev, status: 'PICKED_UP' } : null);
    setShowPickupModal(false);
    setShowDropoffModal(true);
    // Clear previous route and fetch new route from pickup to dropoff
    setRouteCoordinates([]);
    fetchDirections(
      { lat: activeRide.startLatLon.lat, lng: activeRide.startLatLon.lon },
      { lat: activeRide.endLatLon.lat, lng: activeRide.endLatLon.lon }
    );
    try {
      // Update ride status to PICKED_UP and set pickedAt timestamp
      const res = await api.put(`/api/driver/rides/${rideId}/status`, {
        status: 'PICKED_UP',
        pickedAt: new Date().toISOString()
      }, authState.token!);
      if (!res.ok) {
        // If API fails, revert the local changes
        setActiveRide((prev: any) => prev ? { ...prev, status: 'DISPATCHED' } : null);
        setShowPickupModal(true);
        setShowDropoffModal(false);
        setRouteCoordinates([]);
        alert('Failed to update ride status');
      }
    } catch (e) {
      console.error('Error picking up ride:', e);
      // Revert on error
      setActiveRide((prev: any) => prev ? { ...prev, status: 'DISPATCHED' } : null);
      setShowPickupModal(true);
      setShowDropoffModal(false);
      setRouteCoordinates([]);
      alert('Error picking up ride');
    } finally {
      setIsPickupLoading(false);
    }
  };

  const handleDropoffConfirm = async () => {
    const rideId = activeRide?.id;
    if (!rideId) return;
    // Play dropoff beep sound if enabled
    if (settings.sound.pickupDropoffSound) {
      playDropoffBeep();
    }
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
        // Reload driver status to update busy state after ride completion
        await loadDriverStatus();
        // Animate map back to driver's current location
        if (currentLocation && mapRef.current) {
          mapRef.current.animateToRegion({
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }, 1000);
        }
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
  const playMessageSound = () => playBeepSound(require('../assets/music/icq_message.mp3'));

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

  const handleSendMessage = () => {
    if (!chatInput.trim() || !activeRide) return;

    const message = {
      message: chatInput.trim(),
      sender: 'driver',
      timestamp: new Date().toISOString()
    };

    sendMessage(activeRide.id, message.message, message.sender);
    setChatMessages(prev => [...prev, message]);
    setChatInput('');
  };

  const handleQuickReply = (reply: string) => {
    if (!activeRide) return;

    const message = {
      message: reply,
      sender: 'driver',
      timestamp: new Date().toISOString()
    };

    sendMessage(activeRide.id, message.message, message.sender);
    setChatMessages(prev => [...prev, message]);
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

  const styles = getStyles(isDarkMode);

  return (
    <View style={styles.container}>
      {/* Status Bar */}
      <View style={[styles.statusBar, { backgroundColor: getStatusColor() }]}>
        <Text style={styles.shiftTimeText}>{shiftElapsedTime}</Text>
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
          {!activeRide && (
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowMenu(false);
                goToProfile();
              }}
            >
              <Text style={styles.menuItemText}>Profile</Text>
            </TouchableOpacity>
          )}
          {!activeRide && (
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowMenu(false);
                router.push('/history');
              }}
            >
              <Text style={styles.menuItemText}>History</Text>
            </TouchableOpacity>
          )}
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
           {!activeRide && (
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowMenu(false);
                setShowEndKMModal(true);
              }}
            >
              <Text style={styles.menuItemText}>End Shift</Text>
            </TouchableOpacity>
           )}
           <TouchableOpacity
             style={styles.menuItem}
             onPress={() => {
               setShowMenu(false);
               toggleBatchNotification();
             }}
           >
             <Text style={styles.menuItemText}>
               {isBatchNotificationActive ? 'Stop Batch Notification' : 'Start Batch Notification'}
             </Text>
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
                onPress={handleEndShift}
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
            {activeRide.riderPhone && (
              <TouchableOpacity
                style={styles.callIconInModal}
                onPress={() => Linking.openURL(`tel:${activeRide.riderPhone}`)}
              >
                <Text style={styles.callIconText}>📞</Text>
              </TouchableOpacity>
            )}
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
              <TouchableOpacity
                style={styles.chatButton}
                onPress={() => {
                  setShowChat(true);
                  setUnreadMessagesCount(0);
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.chatButtonText}>💬 Chat</Text>
                  {unreadMessagesCount > 0 && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadBadgeText}>{unreadMessagesCount}</Text>
                    </View>
                  )}
                </View>
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

      {/* Chat Modal */}
      {showChat && (
        <View style={styles.chatModal}>
          <View style={styles.chatModalCard}>
            <View style={styles.chatModalHeader}>
              <Text style={styles.chatModalTitle}>Chat with Passenger</Text>
              <TouchableOpacity onPress={() => setShowChat(false)}>
                <Text style={styles.chatModalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.chatMessages}>
              {chatMessages.map((msg, idx) => (
                <View key={idx} style={[styles.chatMessage, msg.sender === 'driver' ? styles.driverMessage : styles.passengerMessage]}>
                  <Text style={styles.messageText}>{msg.message}</Text>
                </View>
              ))}
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickRepliesContainer}>
              {quickReplies.map((reply, idx) => (
                <TouchableOpacity key={idx} style={styles.quickReplyButton} onPress={() => handleQuickReply(reply)}>
                  <Text style={styles.quickReplyText}>{reply}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.chatInputContainer}>
              <TextInput
                style={styles.chatInput}
                value={chatInput}
                onChangeText={setChatInput}
                placeholder="Type message..."
                onSubmitEditing={handleSendMessage}
                returnKeyType="send"
              />
              <TouchableOpacity style={styles.chatSendButton} onPress={handleSendMessage}>
                <Text style={styles.chatSendButtonText}>Send</Text>
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

const getStyles = (isDarkMode: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: isDarkMode ? '#121212' : '#f5f5f5',
  },
  statusBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    zIndex: 1000,
  },
  statusText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  shiftTimeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  header: {
    position: 'absolute',
    top: 60,
    left: 20,
    zIndex: 1000,
  },
  menuButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.9)',
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
    backgroundColor: isDarkMode ? '#fff' : '#333',
    marginVertical: 2,
  },
  menuOverlay: {
    position: 'absolute',
    top: 100,
    left: 20,
    backgroundColor: isDarkMode ? '#333' : '#fff',
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
    borderBottomColor: isDarkMode ? '#555' : '#f0f0f0',
  },
  menuItemText: {
    fontSize: 16,
    color: isDarkMode ? '#fff' : '#333',
  },
  mapContainer: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: isDarkMode ? '#121212' : '#f0f0f0',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  mapPlaceholderText: {
    fontSize: 16,
    color: isDarkMode ? '#ccc' : '#666',
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
    borderColor: isDarkMode ? '#555' : '#ddd',
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 20,
    paddingHorizontal: 15,
    fontSize: 16,
    backgroundColor: isDarkMode ? '#333' : '#f9f9f9',
    color: isDarkMode ? '#fff' : '#000',
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
    backgroundColor: isDarkMode ? '#333' : 'white',
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
    color: isDarkMode ? '#fff' : '#333',
    marginBottom: 8,
  },
  rideModalDistance: {
    fontSize: 16,
    color: isDarkMode ? '#ccc' : '#666',
    marginBottom: 4,
  },
  rideModalAddress: {
    fontSize: 16,
    color: isDarkMode ? '#ccc' : '#666',
    marginBottom: 4,
  },
  rideModalType: {
    fontSize: 16,
    color: isDarkMode ? '#ccc' : '#666',
    marginBottom: 8,
  },
  rideModalId: {
    position: 'absolute',
    top: 10,
    left: 10,
    fontSize: 14,
    color: isDarkMode ? '#ccc' : '#999',
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
    backgroundColor: isDarkMode ? '#555' : '#f0f0f0',
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
    color: isDarkMode ? '#ccc' : '#666',
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
    backgroundColor: isDarkMode ? '#333' : '#fff',
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
    color: isDarkMode ? '#fff' : '#333',
    textAlign: 'center',
    marginBottom: 10,
  },
  endShiftMessage: {
    fontSize: 16,
    color: isDarkMode ? '#ccc' : '#666',
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
    backgroundColor: isDarkMode ? '#333' : 'white',
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
    color: isDarkMode ? '#fff' : '#333',
    marginBottom: 10,
  },
  rideOfferId: {
    fontSize: 16,
    color: isDarkMode ? '#ccc' : '#666',
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
    color: isDarkMode ? '#ccc' : '#666',
    marginBottom: 4,
  },
  rideOfferAddress: {
    fontSize: 14,
    color: isDarkMode ? '#ccc' : '#666',
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
  callIconInModal: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 1000,
  },
  callIconText: {
    color: '#28a745',
    fontSize: 24,
  },
  chatButton: {
    backgroundColor: '#17a2b8',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  chatButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  chatModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 3000,
  },
  chatModalCard: {
    backgroundColor: isDarkMode ? '#333' : 'white',
    width: '90%',
    maxWidth: 400,
    height: '70%',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    flexDirection: 'column',
  },
  chatModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: isDarkMode ? '#555' : '#f0f0f0',
  },
  chatModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: isDarkMode ? '#fff' : '#333',
  },
  chatModalClose: {
    fontSize: 24,
    color: isDarkMode ? '#ccc' : '#666',
    padding: 5,
  },
  chatMessages: {
    flex: 1,
    paddingVertical: 10,
  },
  chatMessage: {
    marginBottom: 10,
    padding: 10,
    borderRadius: 8,
    maxWidth: '80%',
  },
  driverMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007bff',
  },
  passengerMessage: {
    alignSelf: 'flex-start',
    backgroundColor: isDarkMode ? '#555' : '#e9ecef',
  },
  messageText: {
    color: '#000',
    fontSize: 14,
  },
  chatInputContainer: {
    flexDirection: 'row',
    paddingTop: 10,
  },
  chatInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: isDarkMode ? '#555' : '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 10,
    fontSize: 14,
    backgroundColor: isDarkMode ? '#444' : '#f9f9f9',
    color: isDarkMode ? '#fff' : '#000',
  },
  chatSendButton: {
    backgroundColor: '#007bff',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatSendButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  unreadBadge: {
    backgroundColor: '#dc3545',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    paddingHorizontal: 4,
  },
  unreadBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  quickRepliesContainer: {
    maxHeight: 50,
    paddingVertical: 5,
    borderTopWidth: 1,
    borderTopColor: isDarkMode ? '#555' : '#f0f0f0',
  },
  quickReplyButton: {
    backgroundColor: '#6c757d',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginHorizontal: 5,
    marginVertical: 5,
  },
  quickReplyText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
});