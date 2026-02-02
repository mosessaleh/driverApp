import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Platform, Image, ScrollView, RefreshControl, TextInput, Animated, PanResponder, ActivityIndicator, AppState, Alert, BackHandler } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useAuth } from '../src/context/AuthContext';
import { useSettings } from '../src/context/SettingsContext';
import { useTranslation } from '../src/hooks/useTranslation';
import { toggleDriverOnline, toggleDriverBusy, getDriverStatus, updateDriverLocation, getRide, api, endShift } from '../src/services/api';
import { StatusBar } from '../src/components/StatusBar';
import { StatusBarExpanded } from '../src/components/StatusBarExpanded';
import type { DriverStatus } from '../src/components/StatusBar';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import * as Linking from 'expo-linking';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ride, Booking } from '../src/types';
import { onDriverStatusUpdate, offDriverStatusUpdate, onRideOffer, offRideOffer, onRideOfferTimeout, offRideOfferTimeout, onRideOfferRejected, offRideOfferRejected, onRideCancelled, offRideCancelled, sendRideTimeout, acceptRide, rejectRide, joinChat, sendMessage, onNewMessage, offNewMessage, onPickupProximity, offPickupProximity, onPickupCountdownExpired, offPickupCountdownExpired } from '../src/services/socket';
import { sendLocalNotification } from '../src/services/notifications';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { SOCKET_BACKGROUND_TASK, LOCATION_BACKGROUND_TASK } from '../src/tasks/socketBackgroundTask';

const { width, height } = Dimensions.get('window');

export const options = {
  headerShown: false,
};

export default function DashboardScreen() {
    const { authState, logout } = useAuth();
    const { settings, isDarkMode, isRTL } = useSettings();
    const { t } = useTranslation();
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
   const [offerTotalSeconds, setOfferTotalSeconds] = useState(0);
   const [offerTimeout, setOfferTimeout] = useState<NodeJS.Timeout | null>(null);
   const [rideOfferSound, setRideOfferSound] = useState<any>(null);
   const [showChat, setShowChat] = useState(false);
   const [chatMessages, setChatMessages] = useState<any[]>([]);
   const [chatInput, setChatInput] = useState('');
   const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
   const [isSocketConnected, setIsSocketConnected] = useState(false);
   const [showShiftWarning, setShowShiftWarning] = useState(false);
   const [suppressShiftWarning, setSuppressShiftWarning] = useState(false);
   const [cancelCountdown, setCancelCountdown] = useState(0);
   const [showCancelText, setShowCancelText] = useState(false);
   const [showCancelModal, setShowCancelModal] = useState(false);
   const [cancelStep, setCancelStep] = useState<'reason' | 'confirm' | 'loading' | 'success' | 'error'>('reason');
   const [selectedCancelReason, setSelectedCancelReason] = useState<string | null>(null);
   const [cancelFeeEstimate, setCancelFeeEstimate] = useState<number>(0);
   const [cancelTimeElapsed, setCancelTimeElapsed] = useState<number>(0);
   const [cancelDistanceEstimate, setCancelDistanceEstimate] = useState<number>(0);
   const [cancelErrorMessage, setCancelErrorMessage] = useState<string>('');
   const [pickupCountdownStart, setPickupCountdownStart] = useState<number | null>(null);
   const [pickupCountdownDuration, setPickupCountdownDuration] = useState(300);
   const [showStatusExpanded, setShowStatusExpanded] = useState(false);
   const [totalRidesToday, setTotalRidesToday] = useState(0);
   const [earningsToday, setEarningsToday] = useState(0);

   const quickReplies = ["I'm on my way", "I've arrived", "Traffic on the way", "I'm arriving"];

   // Helper function to determine driver status
   const getDriverStatusType = (): DriverStatus => {
     if (bannedUntil && banCountdown > 0) return 'banned';
     if (activeRide) return 'on_ride';
     if (!driverOnline) return 'offline';
     if (driverBusy) return 'busy';
     return 'online';
   };

  // Animation for GO button text
  const textOpacityAnim = useRef(new Animated.Value(1)).current;

  // Animations for bouncing dots
  const dot1Anim = useRef(new Animated.Value(1)).current;
  const dot2Anim = useRef(new Animated.Value(1)).current;
  const dot3Anim = useRef(new Animated.Value(1)).current;

  const searchText = t('searching_trips');
  const searchLetters = useMemo(() => Array.from(searchText), [searchText]);
  const letterAnimValues = useMemo(
    () => searchLetters.map(() => new Animated.Value(1)),
    [searchLetters]
  );

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

  // Animation for bouncing dots
  useEffect(() => {
    if (driverOnline && !driverBusy && !activeRide) {
      const animateDot = (anim: Animated.Value, delay: number) => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: 1.5,
              duration: 600,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 1,
              duration: 600,
              useNativeDriver: true,
            }),
          ])
        ).start();
      };
      setTimeout(() => animateDot(dot1Anim, 0), 0);
      setTimeout(() => animateDot(dot2Anim, 0), 200);
      setTimeout(() => animateDot(dot3Anim, 0), 400);
      return () => {
        dot1Anim.stopAnimation();
        dot2Anim.stopAnimation();
        dot3Anim.stopAnimation();
        dot1Anim.setValue(1);
        dot2Anim.setValue(1);
        dot3Anim.setValue(1);
      };
    } else {
      dot1Anim.setValue(1);
      dot2Anim.setValue(1);
      dot3Anim.setValue(1);
    }
  }, [driverOnline, driverBusy, activeRide, dot1Anim, dot2Anim, dot3Anim]);

  const isSearching = driverOnline && !driverBusy && !activeRide;

  useEffect(() => {
    if (!isSearching || letterAnimValues.length === 0) {
      letterAnimValues.forEach(anim => anim.setValue(1));
      return;
    }

    const animations = letterAnimValues.map(anim =>
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1.28,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 1,
          duration: 160,
          useNativeDriver: true,
        }),
      ])
    );

    const loop = Animated.loop(
      Animated.sequence([
        Animated.stagger(70, animations),
        Animated.delay(200),
      ])
    );

    loop.start();

    return () => {
      loop.stop();
      letterAnimValues.forEach(anim => anim.setValue(1));
    };
  }, [isSearching, letterAnimValues]);

  useEffect(() => {
    if (authState.token) {
      getCurrentLocation();

      // Set shift start time from user data if available
      if (authState.user?.shiftStartTime) {
        setShiftStartTime(authState.user.shiftStartTime);
      }

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

        const totalSeconds = Math.max(1, Math.ceil((data?.timeoutMs || 30000) / 1000));
        setOfferTotalSeconds(totalSeconds);
        setRideOffer(data);
        setOfferCountdown(totalSeconds);

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

      // Listen for pickup proximity notifications
      const handlePickupProximity = async (data: { rideId: number; distanceMeters: number; countdownStart: number; countdownDuration: number }) => {
        console.log('Received pickup proximity notification:', data);
        // Only show countdown text, NOT the cancel button yet
        setShowCancelText(true);
        setPickupCountdownStart(data.countdownStart);
        setPickupCountdownDuration(data.countdownDuration);

        // Save to AsyncStorage to persist across app restarts
        try {
          await AsyncStorage.setItem(`pickupCountdown_${data.rideId}`, JSON.stringify({
            countdownStart: data.countdownStart,
            countdownDuration: data.countdownDuration,
            expired: false
          }));
        } catch (error) {
          console.error('Error saving pickup countdown to AsyncStorage:', error);
        }

        // Start countdown
        const startCountdown = () => {
          const interval = setInterval(() => {
            const now = Date.now();
            const elapsed = Math.floor((now - data.countdownStart) / 1000);
            const remaining = data.countdownDuration - elapsed;

            setCancelCountdown(prev => {
              if (remaining <= 0) {
                clearInterval(interval);
                // Countdown finished - show cancel button and clean up
                AsyncStorage.removeItem(`pickupCountdown_${data.rideId}`).catch(console.error);
                return 0;
              }
              return remaining;
            });
          }, 1000);
        };

        startCountdown();
      };

      // Listen for pickup countdown expired notification from server
      const handlePickupCountdownExpired = async (data: { rideId: number }) => {
        console.log('Received pickup countdown expired notification:', data);
        // Show cancel button immediately when server confirms countdown expired
        setCancelCountdown(0);
        // Clean up AsyncStorage
        try {
          await AsyncStorage.removeItem(`pickupCountdown_${data.rideId}`);
        } catch (error) {
          console.error('Error removing pickup countdown from AsyncStorage:', error);
        }
      };

      onPickupProximity(handlePickupProximity);

      // Listen for pickup countdown expired from server
      onPickupCountdownExpired(handlePickupCountdownExpired);

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
        offPickupProximity();
        offPickupCountdownExpired();
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
    const handleAppStateChange = async (nextAppState: string) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        Alert.alert(
          'Warning',
          'If you close the app or put it in the background, you may face problems receiving new ride requests. It is recommended to keep the app open to ensure notifications are received.',
          [{ text: 'OK' }]
        );

        // Register background task for socket reconnection
        if (Platform.OS !== 'web') {
          try {
            await BackgroundFetch.registerTaskAsync(SOCKET_BACKGROUND_TASK, {
              minimumInterval: 10, // 10 seconds
              stopOnTerminate: false,
              startOnBoot: true,
            });
            console.log('Background task registered');
          } catch (error) {
            console.error('Failed to register background task:', error);
          }
        }
      } else if (nextAppState === 'active') {
        // Reconnect socket when app becomes active
        if (authState.token) {
          console.log('Reconnecting socket on app active');
          // The socket connection should be handled by the existing logic
        }

        // Unregister background task
        if (Platform.OS !== 'web') {
          try {
            await BackgroundFetch.unregisterTaskAsync(SOCKET_BACKGROUND_TASK);
            console.log('Background task unregistered');
          } catch (error: any) {
            // Check if the error is because the task is not found (already unregistered or never registered)
            if (error.message && (error.message.includes('TaskNotFoundException') || error.message.includes('not found'))) {
              console.log('Background task was not registered, skipping unregister');
            } else {
              console.error('Failed to unregister background task:', error);
            }
          }
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, [authState.token]);


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

  // Handle push notifications
  useEffect(() => {
    // Handle notification when app is in foreground
    const foregroundSubscription = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received in foreground:', notification);
      // Handle foreground notification (e.g., show local notification or update UI)
    });

    // Handle notification response (when user taps on notification)
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response received:', response);
      const data = response.notification.request.content.data;
      if (data && data.type === 'newRide') {
        // Navigate to dashboard or handle ride offer
        console.log('User tapped on ride notification');
        // You can add navigation logic here
      }
    });

    return () => {
      foregroundSubscription.remove();
      responseSubscription.remove();
    };
  }, []);

  // Monitor socket connection status
  useEffect(() => {
    const checkSocketStatus = () => {
      // This is a simple check - in a real app, you'd get this from socket events
      // For now, we'll assume it's connected if we have a token
      setIsSocketConnected(!!authState.token);
    };

    checkSocketStatus();
    const interval = setInterval(checkSocketStatus, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
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

  // Shift elapsed time counter and warning check
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

        // Check for 11-hour warning
        const elapsedHours = (now - start) / (1000 * 60 * 60);
        if (elapsedHours >= 11 && !showShiftWarning && !suppressShiftWarning && !activeRide) {
          setShowShiftWarning(true);
          if (!driverBusy && authState.token) {
            toggleDriverBusy(true, authState.token).then(res => {
              if (res.success) {
                setDriverBusy(true);
              }
            });
          }
        }
      };

      updateElapsedTime(); // Initial update
      const interval = setInterval(updateElapsedTime, 1000);
      return () => clearInterval(interval);
    } else {
      setShiftElapsedTime('00:00:00');
      setShowShiftWarning(false);
    }
  }, [shiftStartTime, showShiftWarning, suppressShiftWarning]);

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

        // Check if shift has exceeded 11 hours
        const start = new Date(res.shiftStartTime).getTime();
        const now = Date.now();
        const elapsedHours = (now - start) / (1000 * 60 * 60);

        if (elapsedHours >= 11 && !suppressShiftWarning && !activeRide) {
          setShowShiftWarning(true);
          if (!driverBusy && authState.token) {
            toggleDriverBusy(true, authState.token).then(res => {
              if (res.success) {
                setDriverBusy(true);
              }
            });
          }
        } else {
          setShowShiftWarning(false);
        }
      } else {
        setShiftStartTime(null);
        setShowShiftWarning(false);
      }

      setTotalRidesToday(typeof res.totalRidesToday === 'number' ? res.totalRidesToday : 0);
      setEarningsToday(typeof res.earningsToday === 'number' ? res.earningsToday : 0);

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

            // Check for existing pickup countdown in AsyncStorage
            try {
              const countdownData = await AsyncStorage.getItem(`pickupCountdown_${ride.id}`);
              if (countdownData) {
                const { countdownStart, countdownDuration } = JSON.parse(countdownData);
                const now = Date.now();
                const elapsed = Math.floor((now - countdownStart) / 1000);
                const remaining = countdownDuration - elapsed;
                if (remaining > 0) {
                  // Countdown still running - show countdown text only
                  setShowCancelText(true);
                  setPickupCountdownStart(countdownStart);
                  setPickupCountdownDuration(countdownDuration);
                  setCancelCountdown(remaining);

                  // Resume countdown
                  const interval = setInterval(() => {
                    const nowInner = Date.now();
                    const elapsedInner = Math.floor((nowInner - countdownStart) / 1000);
                    const remainingInner = countdownDuration - elapsedInner;
                    setCancelCountdown(prev => {
                      if (remainingInner <= 0) {
                        clearInterval(interval);
                        AsyncStorage.removeItem(`pickupCountdown_${ride.id}`).catch(console.error);
                        return 0;
                      }
                      return remainingInner;
                    });
                  }, 1000);
                } else {
                  // Countdown already expired - show cancel button immediately
                  console.log(`Countdown already expired for ride ${ride.id}, showing cancel button`);
                  setShowCancelText(true);
                  setCancelCountdown(0);
                  AsyncStorage.removeItem(`pickupCountdown_${ride.id}`).catch(console.error);
                }
              }
            } catch (error) {
              console.error('Error loading pickup countdown from AsyncStorage:', error);
            }
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
        setShowCancelText(false);
        setCancelCountdown(0);
        setPickupCountdownStart(null);
        // Clean up any remaining countdown data
        try {
          const keys = await AsyncStorage.getAllKeys();
          const countdownKeys = keys.filter(key => key.startsWith('pickupCountdown_'));
          await AsyncStorage.multiRemove(countdownKeys);
        } catch (error) {
          console.error('Error cleaning up countdown data:', error);
        }
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

        // Request background location permission
        const backgroundStatus = await Location.requestBackgroundPermissionsAsync();
        if (backgroundStatus.status === 'granted') {
          console.log('Background location permission granted');
        }

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

        // Start background location tracking if permission granted
        if (backgroundStatus.status === 'granted' && Platform.OS !== 'web') {
          try {
            await Location.startLocationUpdatesAsync(LOCATION_BACKGROUND_TASK, {
              accuracy: Location.Accuracy.High,
              timeInterval: 30000, // 30 seconds
              distanceInterval: 50, // 50 meters
              showsBackgroundLocationIndicator: true,
            });
            console.log('Background location tracking started');
          } catch (error) {
            console.error('Failed to start background location tracking:', error);
          }
        }
      }
    } catch (e) {
      console.error('Error starting location tracking:', e);
      setIsTracking(false);
    }
  };

  const stopLocationTracking = async () => {
    if (locationSubscription) {
      locationSubscription.remove();
      setLocationSubscription(null);
    }

    // Stop background location tracking
    if (Platform.OS !== 'web') {
      try {
        // Check if location updates are currently running before trying to stop
        const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_BACKGROUND_TASK);
        if (isRunning) {
          await Location.stopLocationUpdatesAsync(LOCATION_BACKGROUND_TASK);
          console.log('Background location tracking stopped');
        } else {
          console.log('Background location tracking was not running, skipping stop');
        }
      } catch (error: any) {
        // Check if the error is because the task was not found (never started or already stopped)
        if (error.message && (error.message.includes('TaskNotFoundException') || error.message.includes('not found'))) {
          console.log('Background location task was not found, it may have already been stopped or never started');
        } else {
          console.error('Failed to stop background location tracking:', error);
        }
      }
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
    // Clear cancel countdown
    setShowCancelText(false);
    setCancelCountdown(0);
    setPickupCountdownStart(null);
    // Clean up AsyncStorage
    try {
      await AsyncStorage.removeItem(`pickupCountdown_${rideId}`);
    } catch (error) {
      console.error('Error removing pickup countdown from AsyncStorage:', error);
    }
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

  // Calculate cancellation fee estimate based on time and distance
  const calculateCancelFeeEstimate = () => {
    if (!activeRide?.acceptedAt) return { fee: 0, timeMin: 0, distanceKm: 0 };
    
    const acceptedAt = new Date(activeRide.acceptedAt).getTime();
    const now = Date.now();
    const timeDiffMs = now - acceptedAt;
    const timeDiffMin = Math.floor(timeDiffMs / (1000 * 60));
    
    // Estimate distance based on average speed of 30 km/h
    const averageSpeedKmh = 30;
    const distanceKm = (timeDiffMin / 60) * averageSpeedKmh;
    
    // Calculate approximate fee (base + per km + per min)
    // Using approximate rates: base 30 DKK, 15 DKK/km, 2 DKK/min
    const basePrice = 30;
    const perKmPrice = 15;
    const perMinPrice = 2;
    
    const fee = Math.round(basePrice + (distanceKm * perKmPrice) + (timeDiffMin * perMinPrice));
    
    return { fee, timeMin: timeDiffMin, distanceKm: Math.round(distanceKm * 10) / 10 };
  };

  const handleCancelRide = async (reason: string) => {
    const rideId = activeRide?.id;
    if (!rideId) return;
    
    setCancelStep('loading');
    
    try {
      const res = await api.put(`/api/driver/rides/${rideId}/cancel`, {
        reason: reason,
        canceledBy: 'driver'
      }, authState.token!);
      
      if (res.ok) {
        setCancelStep('success');
        // Wait a bit then close and reset
        setTimeout(async () => {
          setShowCancelModal(false);
          setCancelStep('reason');
          setSelectedCancelReason(null);
          setShowPickupModal(false);
          setActiveRide(null);
          setCurrentRideId(null);
          setRouteCoordinates([]);
          setShowCancelText(false);
          setCancelCountdown(0);
          setPickupCountdownStart(null);
          
          // Clean up AsyncStorage
          try {
            await AsyncStorage.removeItem(`pickupCountdown_${rideId}`);
          } catch (error) {
            console.error('Error removing pickup countdown from AsyncStorage:', error);
          }
          
          // Reload driver status to update busy state
          await loadDriverStatus();
        }, 2000);
      } else {
        setCancelStep('error');
        setCancelErrorMessage(res.error || t('cancel_ride_error_message'));
      }
    } catch (e: any) {
      console.error('Error canceling ride:', e);
      setCancelStep('error');
      setCancelErrorMessage(e?.message || t('cancel_ride_error_message'));
    }
  };

  const openCancelModal = () => {
    const estimate = calculateCancelFeeEstimate();
    setCancelFeeEstimate(estimate.fee);
    setCancelTimeElapsed(estimate.timeMin);
    setCancelDistanceEstimate(estimate.distanceKm);
    setCancelStep('reason');
    setSelectedCancelReason(null);
    setCancelErrorMessage('');
    setShowCancelModal(true);
  };

  const closeCancelModal = () => {
    if (cancelStep === 'loading') return; // Prevent closing while processing
    setShowCancelModal(false);
    setTimeout(() => {
      setCancelStep('reason');
      setSelectedCancelReason(null);
      setCancelErrorMessage('');
    }, 300);
  };

  const selectCancelReason = (reason: string) => {
    setSelectedCancelReason(reason);
    setCancelStep('confirm');
  };

  const goBackToReason = () => {
    setCancelStep('reason');
    setSelectedCancelReason(null);
  };

  const confirmCancelRide = () => {
    if (selectedCancelReason) {
      handleCancelRide(selectedCancelReason);
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
    if (bannedUntil && banCountdown > 0) return `${t('banned')} - ${banCountdown}${t('seconds_short')}`;
    if (!driverOnline) return t('offline');
    if (driverBusy) return `${t('online')} - ${t('busy')}`;
    return `${t('online')} - ${t('available')}`;
  };

  const getStatusColor = () => {
    if (bannedUntil && banCountdown > 0) return '#dc3545'; // red
    if (!driverOnline) return '#dc3545'; // red
    if (driverBusy) return '#ffc107'; // yellow
    return '#28a745'; // green
  };

  const calculateEtaMinutes = (
    from: { latitude: number; longitude: number },
    to: { lat: number; lon: number }
  ) => {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const R = 6371; // km
    const dLat = toRad(to.lat - from.latitude);
    const dLon = toRad(to.lon - from.longitude);
    const lat1 = toRad(from.latitude);
    const lat2 = toRad(to.lat);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceKm = R * c;
    return Math.max(1, Math.ceil(distanceKm * 2)); // ~30km/h average
  };

  const getPickupEtaMinutes = () => {
    if (!currentLocation || !rideOffer?.rideData?.startLatLon) return null;
    const { lat, lon } = rideOffer.rideData.startLatLon || {};
    if (typeof lat !== 'number' || typeof lon !== 'number') return null;
    return calculateEtaMinutes(currentLocation, { lat, lon });
  };

  const pickupEtaMinutes = getPickupEtaMinutes();
  const offerProgress = offerTotalSeconds > 0
    ? Math.max(0, Math.min(1, offerCountdown / offerTotalSeconds))
    : 0;

  const styles = getStyles(isDarkMode, isRTL);

  return (
    <View style={styles.container}>
      {/* New Status Bar */}
      <StatusBar
        status={getDriverStatusType()}
        shiftElapsedTime={shiftElapsedTime}
        isSocketConnected={isSocketConnected}
        banCountdown={banCountdown}
        unreadMessages={unreadMessagesCount}
        onPress={() => setShowStatusExpanded(true)}
      />

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
              <Text style={styles.menuItemIcon}>👤</Text>
              <Text style={styles.menuItemText}>{t('profile')}</Text>
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
              <Text style={styles.menuItemIcon}>📋</Text>
              <Text style={styles.menuItemText}>{t('history')}</Text>
            </TouchableOpacity>
          )}
          {!activeRide && (
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowMenu(false);
                router.push('/analytics');
              }}
            >
              <Text style={styles.menuItemIcon}>📊</Text>
              <Text style={styles.menuItemText}>{t('analytics')}</Text>
            </TouchableOpacity>
          )}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowMenu(false);
                goToSettings();
              }}
            >
              <Text style={styles.menuItemIcon}>⚙️</Text>
              <Text style={styles.menuItemText}>{t('settings')}</Text>
            </TouchableOpacity>
            {!driverBusy && driverOnline && !bannedUntil && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setShowMenu(false);
                  handleToggleBusy();
                }}
              >
                <Text style={styles.menuItemIcon}>⏸️</Text>
                <Text style={styles.menuItemText}>{t('pause')}</Text>
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
                <Text style={styles.menuItemIcon}>▶️</Text>
                <Text style={styles.menuItemText}>{t('end_pause')}</Text>
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
              <Text style={styles.menuItemIcon}>🏁</Text>
              <Text style={styles.menuItemText}>{t('end_shift')}</Text>
            </TouchableOpacity>
            )}
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
                  setSuppressShiftWarning(false);
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
          <View style={styles.pickupModalCard}>
            <View style={styles.pickupHandle} />
            <View style={styles.pickupHeaderRow}>
              <View style={styles.pickupBadge}>
                <Text style={styles.pickupBadgeText}>{t('pickup')}</Text>
              </View>
              <View style={styles.pickupHeaderMeta}>
                <View style={styles.pickupIdPill}>
                  <Text style={styles.pickupIdText}>#{activeRide.id}</Text>
                </View>
                {activeRide.riderPhone && (
                  <TouchableOpacity
                    style={styles.callIconInModal}
                    onPress={() => Linking.openURL(`tel:${activeRide.riderPhone}`)}
                  >
                    <Text style={styles.callIconText}>📞</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
            <View style={styles.pickupInfoRow}>
              <View style={styles.pickupInfoCard}>
                <Text style={styles.pickupInfoLabel}>{t('price')}</Text>
                <Text style={[styles.pickupInfoValue, styles.pickupInfoValueAccent]}>{activeRide.price} DKK</Text>
              </View>
              <View style={styles.pickupInfoCard}>
                <Text style={styles.pickupInfoLabel}>{t('distance')}</Text>
                <Text style={styles.pickupInfoValue}>{activeRide.distanceKm} km</Text>
              </View>
            </View>
            <View style={styles.pickupAddressCard}>
              <View style={styles.pickupAddressHeader}>
                <View style={styles.pickupDot} />
                <Text style={styles.pickupAddressLabel}>{t('pickup')}</Text>
              </View>
              <Text style={styles.pickupAddressValue} numberOfLines={2} ellipsizeMode="tail">
                {activeRide.pickupAddress}
              </Text>
            </View>
            {activeRide.vehicleTypeName ? (
              <View style={styles.rideTypeBadge}>
                <Text style={styles.rideTypeBadgeText}>{activeRide.vehicleTypeName}</Text>
              </View>
            ) : null}
            <View style={styles.pickupActions}>
              <View style={styles.pickupActionRow}>
                <TouchableOpacity
                  style={[styles.pickupNavButton, styles.pickupActionButton]}
                  onPress={() => handleNav(`${currentLocation?.latitude},${currentLocation?.longitude}`, activeRide.pickupAddress)}
                >
                  <Text style={styles.pickupNavText}>{t('nav')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.pickupChatButton, styles.pickupActionButton]}
                  onPress={() => {
                    setShowChat(true);
                    setUnreadMessagesCount(0);
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={styles.pickupChatButtonText}>💬 {t('chat')}</Text>
                    {unreadMessagesCount > 0 && (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadBadgeText}>{unreadMessagesCount}</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.pickupButton} onLongPress={handlePickupConfirm} delayLongPress={1500} disabled={isPickupLoading}>
                {isPickupLoading ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={[styles.pickupButtonText, { marginLeft: 10 }]}>Picking up passenger...</Text>
                  </View>
                ) : (
                  <Text style={styles.pickupButtonText}>{t('hold_to_pickup')}</Text>
                )}
              </TouchableOpacity>
              {showCancelText && cancelCountdown > 0 && (
                <Text style={styles.cancelOnText}>
                  Cancel on: {Math.floor(cancelCountdown / 60)}:{(cancelCountdown % 60).toString().padStart(2, '0')}
                </Text>
              )}
              {showCancelText && cancelCountdown === 0 && (
                <TouchableOpacity style={styles.cancelRideButton} onPress={openCancelModal}>
                  <Text style={styles.cancelRideButtonText}>{t('cancel_ride')}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      )}

      {/* Cancel Ride Modal - New Design */}
      {showCancelModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.cancelModalCard}>
            {/* Header */}
            <View style={styles.cancelModalHeader}>
              <Text style={styles.cancelModalTitle}>
                {cancelStep === 'reason' && t('cancel_ride_title')}
                {cancelStep === 'confirm' && t('cancel_ride_confirm_title')}
                {cancelStep === 'loading' && t('cancel_ride_processing')}
                {cancelStep === 'success' && t('cancel_ride_success')}
                {cancelStep === 'error' && t('cancel_ride_error')}
              </Text>
              {cancelStep !== 'loading' && (
                <TouchableOpacity onPress={closeCancelModal} style={styles.cancelModalCloseButton}>
                  <Text style={styles.cancelModalCloseText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Step 1: Select Reason */}
            {cancelStep === 'reason' && (
              <View style={styles.cancelStepContainer}>
                <Text style={styles.cancelModalSubtitle}>{t('cancel_ride_subtitle')}</Text>
                
                {/* Warning Banner */}
                <View style={styles.cancelWarningBanner}>
                  <Text style={styles.cancelWarningIcon}>⚠️</Text>
                  <Text style={styles.cancelWarningText}>{t('cancel_ride_warning')}</Text>
                </View>

                {/* Fee Estimate Preview */}
                <View style={styles.cancelFeePreview}>
                  <View style={styles.cancelFeeRow}>
                    <Text style={styles.cancelFeeLabel}>{t('cancel_ride_time_elapsed')}</Text>
                    <Text style={styles.cancelFeeValue}>{cancelTimeElapsed} {t('minutes_short')}</Text>
                  </View>
                  <View style={styles.cancelFeeRow}>
                    <Text style={styles.cancelFeeLabel}>{t('cancel_ride_distance_traveled')}</Text>
                    <Text style={styles.cancelFeeValue}>{cancelDistanceEstimate} {t('kilometers_short')}</Text>
                  </View>
                  <View style={[styles.cancelFeeRow, styles.cancelFeeTotal]}>
                    <Text style={styles.cancelFeeTotalLabel}>{t('cancel_ride_fee_estimate')}</Text>
                    <Text style={styles.cancelFeeTotalValue}>{cancelFeeEstimate} DKK</Text>
                  </View>
                </View>

                {/* Reason Options */}
                <View style={styles.cancelReasonsList}>
                  {[
                    { key: 'passenger_no_show', icon: '👤', color: '#dc3545' },
                    { key: 'car_problem', icon: '🚗', color: '#fd7e14' },
                    { key: 'traffic_issue', icon: '🚦', color: '#ffc107' },
                    { key: 'wrong_address', icon: '📍', color: '#6f42c1' },
                    { key: 'emergency', icon: '🆘', color: '#dc3545' },
                    { key: 'other_reason', icon: '📝', color: '#6c757d' },
                  ].map((reason) => (
                    <TouchableOpacity
                      key={reason.key}
                      style={[styles.cancelReasonOption, { borderLeftColor: reason.color }]}
                      onPress={() => selectCancelReason(reason.key)}
                    >
                      <Text style={styles.cancelReasonIcon}>{reason.icon}</Text>
                      <Text style={styles.cancelReasonOptionText}>{t(reason.key)}</Text>
                      <Text style={styles.cancelReasonArrow}>›</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Step 2: Confirm Cancellation */}
            {cancelStep === 'confirm' && (
              <View style={styles.cancelStepContainer}>
                <View style={styles.cancelConfirmIconContainer}>
                  <Text style={styles.cancelConfirmIcon}>⚠️</Text>
                </View>
                <Text style={styles.cancelConfirmMessage}>{t('cancel_ride_confirm_message')}</Text>
                
                {/* Selected Reason Display */}
                <View style={styles.cancelSelectedReason}>
                  <Text style={styles.cancelSelectedReasonLabel}>{t('cancel_ride_select_reason')}</Text>
                  <Text style={styles.cancelSelectedReasonValue}>{t(selectedCancelReason || '')}</Text>
                </View>

                {/* Final Fee Display */}
                <View style={styles.cancelFinalFee}>
                  <Text style={styles.cancelFinalFeeLabel}>{t('cancel_ride_fee_estimate')}</Text>
                  <Text style={styles.cancelFinalFeeValue}>{cancelFeeEstimate} DKK</Text>
                </View>

                {/* Action Buttons */}
                <View style={styles.cancelConfirmButtons}>
                  <TouchableOpacity style={styles.cancelGoBackButton} onPress={goBackToReason}>
                    <Text style={styles.cancelGoBackButtonText}>{t('cancel_ride_go_back')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.cancelConfirmButton} onPress={confirmCancelRide}>
                    <Text style={styles.cancelConfirmButtonText}>{t('cancel_ride_confirm')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Step 3: Loading */}
            {cancelStep === 'loading' && (
              <View style={styles.cancelStepContainer}>
                <View style={styles.cancelLoadingContainer}>
                  <ActivityIndicator size="large" color="#dc3545" />
                  <Text style={styles.cancelLoadingText}>{t('cancel_ride_processing')}</Text>
                </View>
              </View>
            )}

            {/* Step 4: Success */}
            {cancelStep === 'success' && (
              <View style={styles.cancelStepContainer}>
                <View style={styles.cancelSuccessContainer}>
                  <View style={styles.cancelSuccessIcon}>
                    <Text style={styles.cancelSuccessIconText}>✓</Text>
                  </View>
                  <Text style={styles.cancelSuccessTitle}>{t('cancel_ride_success')}</Text>
                  <Text style={styles.cancelSuccessMessage}>{t('cancel_ride_success_message')}</Text>
                </View>
              </View>
            )}

            {/* Step 5: Error */}
            {cancelStep === 'error' && (
              <View style={styles.cancelStepContainer}>
                <View style={styles.cancelErrorContainer}>
                  <View style={styles.cancelErrorIcon}>
                    <Text style={styles.cancelErrorIconText}>✕</Text>
                  </View>
                  <Text style={styles.cancelErrorTitle}>{t('cancel_ride_error')}</Text>
                  <Text style={styles.cancelErrorMessage}>{cancelErrorMessage}</Text>
                  <TouchableOpacity style={styles.cancelRetryButton} onPress={goBackToReason}>
                    <Text style={styles.cancelRetryButtonText}>{t('retry')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Dropoff Modal */}
      {showDropoffModal && activeRide && (
        <View style={styles.rideModalContainer}>
          <View style={styles.dropoffModalCard}>
            <View style={styles.dropoffHandle} />
            <View style={styles.dropoffHeaderRow}>
              <View style={styles.dropoffBadge}>
                <Text style={styles.dropoffBadgeText}>{t('dropoff')}</Text>
              </View>
              <View style={styles.dropoffIdPill}>
                <Text style={styles.dropoffIdText}>#{activeRide.id}</Text>
              </View>
            </View>
            <View style={styles.dropoffInfoRow}>
              <View style={styles.dropoffInfoCard}>
                <Text style={styles.dropoffInfoLabel}>{t('price')}</Text>
                <Text style={[styles.dropoffInfoValue, styles.dropoffInfoValueAccent]}>
                  {activeRide.price} DKK
                </Text>
              </View>
              <View style={styles.dropoffInfoCard}>
                <Text style={styles.dropoffInfoLabel}>{t('distance')}</Text>
                <Text style={styles.dropoffInfoValue}>{activeRide.distanceKm} km</Text>
              </View>
            </View>
            <View style={styles.dropoffAddressCard}>
              <View style={styles.dropoffAddressHeader}>
                <View style={styles.dropoffDot} />
                <Text style={styles.dropoffAddressLabel}>{t('dropoff')}</Text>
              </View>
              <Text style={styles.dropoffAddressValue} numberOfLines={2} ellipsizeMode="tail">
                {activeRide.dropoffAddress}
              </Text>
            </View>
            <View style={styles.dropoffActions}>
              <TouchableOpacity
                style={styles.dropoffNavButton}
                onPress={() => handleNav(activeRide.pickupAddress, activeRide.dropoffAddress)}
              >
                <Text style={styles.dropoffNavText}>{t('nav')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dropoffButton} onLongPress={handleDropoffConfirm} delayLongPress={1500} disabled={isDropoffLoading}>
                {isDropoffLoading ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={[styles.dropoffButtonText, { marginLeft: 10 }]}>Dropping off...</Text>
                  </View>
                ) : (
                  <Text style={styles.dropoffButtonText}>{t('hold_to_dropoff')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Ride Offer Modal */}
      {rideOffer && (
        <View style={styles.rideOfferModal}>
          <View style={styles.rideOfferSheet}>
            <View style={styles.rideOfferHeader}>
              <Text style={styles.rideOfferTitle}>{t('ride_offer_title')}</Text>
              <View style={styles.rideOfferPill}>
                <Text style={styles.rideOfferPillText}>#{rideOffer.rideId}</Text>
              </View>
            </View>

            <View style={styles.rideOfferMetaRow}>
              <View style={styles.rideOfferMetaItem}>
                <Text style={styles.rideOfferMetaLabel}>{t('price')}</Text>
                <Text style={styles.rideOfferMetaValue}>{rideOffer.rideData.price} DKK</Text>
              </View>
              <View style={styles.rideOfferMetaItem}>
                <Text style={styles.rideOfferMetaLabel}>{t('distance')}</Text>
                <Text style={styles.rideOfferMetaValue}>{rideOffer.rideData.distanceKm} km</Text>
              </View>
              {pickupEtaMinutes !== null && (
                <View style={styles.rideOfferMetaItem}>
                  <Text style={styles.rideOfferMetaLabel}>{t('ride_offer_eta_to_pickup')}</Text>
                  <Text style={styles.rideOfferMetaValue}>{pickupEtaMinutes} {t('minutes_short')}</Text>
                </View>
              )}
            </View>

            <View style={styles.rideOfferAddressBlock}>
              <View style={styles.rideOfferAddressRow}>
                <Text style={styles.rideOfferAddressLabel}>{t('from')}</Text>
                <Text style={styles.rideOfferAddressValue} numberOfLines={2}>
                  {rideOffer.rideData.pickupAddress}
                </Text>
              </View>
              <View style={styles.rideOfferAddressRow}>
                <Text style={styles.rideOfferAddressLabel}>{t('to')}</Text>
                <Text style={styles.rideOfferAddressValue} numberOfLines={2}>
                  {rideOffer.rideData.dropoffAddress}
                </Text>
              </View>
            </View>

            <View style={styles.rideOfferCountdownRow}>
              <View style={styles.rideOfferCountdownTrack}>
                <View style={[styles.rideOfferCountdownFill, { width: `${offerProgress * 100}%` }]} />
              </View>
              <Text style={styles.rideOfferCountdownText}>{t('ride_offer_time_left', { seconds: offerCountdown })}</Text>
            </View>

            <View style={styles.rideOfferButtons}>
              <TouchableOpacity
                style={[styles.rideOfferButton, styles.acceptButton, styles.rideOfferPrimary]}
                onPress={async () => {
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
                  await loadDriverStatus();
                }}
              >
                <Text style={styles.acceptButtonText}>{t('ride_offer_accept')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.rideOfferButton, styles.rejectButton, styles.rideOfferSecondary]}
                onPress={async () => {
                  rejectRide(rideOffer.rideId, parseInt(authState.user?.id || '0'));
                  setRideOffer(null);
                  setOfferCountdown(0);
                  await stopRideOfferSound();
                  if (offerTimeout) {
                    clearInterval(offerTimeout);
                    setOfferTimeout(null);
                  }
                }}
              >
                <Text style={[styles.rejectButtonText, styles.rideOfferSecondaryText]}>{t('ride_offer_reject')}</Text>
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

      {/* Shift Warning Modal */}
      {showShiftWarning && (
        <View style={styles.modalOverlay}>
          <View style={styles.shiftWarningModal}>
            <Text style={styles.shiftWarningTitle}>⚠️ Shift Duration Warning</Text>
            <Text style={styles.shiftWarningMessage}>
              Your current shift has exceeded 11 hours, which violates Danish traffic safety regulations.
            </Text>
            <Text style={styles.shiftWarningMessage}>
              You must end your shift immediately. Failure to do so within 1 hour will result in a 3-day suspension from the platform.
            </Text>
            <View style={styles.shiftWarningButtons}>
              <TouchableOpacity
                style={[styles.shiftWarningButton, styles.shiftEndShiftButton]}
                onPress={() => {
                  setSuppressShiftWarning(true);
                  setShowShiftWarning(false);
                  setShowEndKMModal(true);
                }}
              >
                <Text style={styles.endShiftButtonText}>End Shift Now</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.shiftWarningButton, styles.laterButton]}
                onPress={() => setShowShiftWarning(false)}
              >
                <Text style={styles.laterButtonText}>Remind Me Later</Text>
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

      {/* Searching for Trips Bar */}
      {driverOnline && !driverBusy && !activeRide && (
        <View style={styles.searchingBar}>
          <View style={styles.searchingBars}>
            <Animated.View style={[styles.searchingBarItem, { transform: [{ scaleY: dot1Anim }] }]} />
            <Animated.View style={[styles.searchingBarItem, { transform: [{ scaleY: dot2Anim }] }]} />
            <Animated.View style={[styles.searchingBarItem, { transform: [{ scaleY: dot3Anim }] }]} />
          </View>
          <Text style={styles.searchingText}>
            {searchLetters.map((letter, index) => (
              <Animated.Text
                key={`search-letter-${index}`}
                style={[
                  styles.searchingLetter,
                  { transform: [{ scale: letterAnimValues[index] }] },
                ]}
              >
                {letter === ' ' ? '\u00A0' : letter}
              </Animated.Text>
            ))}
          </Text>
        </View>
      )}

      {/* Status Bar Expanded Modal */}
      <StatusBarExpanded
        visible={showStatusExpanded}
        onClose={() => setShowStatusExpanded(false)}
        status={getDriverStatusType()}
        shiftElapsedTime={shiftElapsedTime}
        shiftStartTime={shiftStartTime}
        isSocketConnected={isSocketConnected}
        currentLocation={currentLocation}
        locationPermission={locationPermission}
        isTracking={isTracking}
        totalRidesToday={totalRidesToday}
        earningsToday={earningsToday}
        rating={authState.user?.rating || 5.0}
      />

    </View>
  );
}

const getStyles = (isDarkMode: boolean, isRTL: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: isDarkMode ? '#0f0f0f' : '#ffffff',
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
    paddingHorizontal: 15,
    backgroundColor: isDarkMode ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.9)',
    borderBottomWidth: 1,
    borderBottomColor: isDarkMode ? '#333' : '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
  },
  statusText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  shiftTimeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  connectionIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginLeft: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 3,
    elevation: 4,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)',
  },
  header: {
    position: 'absolute',
    top: 60,
    left: 20,
    zIndex: 1000,
  },
  menuButton: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)',
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)',
  },
  hamburgerLine: {
    width: 24,
    height: 3,
    backgroundColor: isDarkMode ? '#fff' : '#333',
    marginVertical: 2,
    borderRadius: 1.5,
  },
  menuOverlay: {
    position: 'absolute',
    top: 130,
    left: 20,
    backgroundColor: isDarkMode ? 'rgba(30,30,30,0.95)' : 'rgba(255,255,255,0.95)',
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
    minWidth: 200,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
    zIndex: 1000,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
  },
  menuItemIcon: {
    fontSize: 18,
  },
  menuItemText: {
    fontSize: 16,
    color: isDarkMode ? '#fff' : '#333',
    fontWeight: '500',
    marginLeft: 12,
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
    backgroundColor: isDarkMode ? 'rgba(40,40,40,0.95)' : 'rgba(255,255,255,0.95)',
    margin: 20,
    borderRadius: 20,
    padding: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 15,
    alignItems: 'stretch',
    position: 'relative',
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
  },
  pickupModalCard: {
    backgroundColor: isDarkMode ? 'rgba(30,30,30,0.97)' : 'rgba(255,255,255,0.98)',
    margin: 20,
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 18,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    borderTopWidth: 4,
    borderTopColor: '#28a745',
  },
  pickupHandle: {
    alignSelf: 'center',
    width: 50,
    height: 5,
    borderRadius: 999,
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.2)' : '#e2e8f0',
    marginBottom: 12,
  },
  pickupHeaderRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  pickupBadge: {
    backgroundColor: isDarkMode ? 'rgba(34,197,94,0.18)' : '#dcfce7',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(34,197,94,0.45)' : '#bbf7d0',
  },
  pickupBadgeText: {
    color: isDarkMode ? '#86efac' : '#15803d',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  pickupHeaderMeta: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 8,
  },
  pickupIdPill: {
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#f1f3f5',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(255,255,255,0.15)' : '#e2e8f0',
  },
  pickupIdText: {
    fontSize: 12,
    fontWeight: '700',
    color: isDarkMode ? '#e2e8f0' : '#334155',
  },
  pickupInfoRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    gap: 10,
    marginBottom: 14,
  },
  pickupInfoCard: {
    flex: 1,
    backgroundColor: isDarkMode ? '#252525' : '#f8f9fa',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
  },
  pickupInfoLabel: {
    fontSize: 12,
    color: isDarkMode ? '#aaa' : '#6b7280',
    marginBottom: 4,
    textAlign: isRTL ? 'right' : 'left',
  },
  pickupInfoValue: {
    fontSize: 16,
    fontWeight: '700',
    color: isDarkMode ? '#fff' : '#111827',
    textAlign: isRTL ? 'right' : 'left',
  },
  pickupInfoValueAccent: {
    color: '#22c55e',
  },
  pickupAddressCard: {
    backgroundColor: isDarkMode ? '#1f2d1f' : '#f0fdf4',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(34,197,94,0.25)' : '#bbf7d0',
    marginBottom: 14,
  },
  pickupAddressHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  pickupAddressLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: isDarkMode ? '#86efac' : '#15803d',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  pickupAddressValue: {
    fontSize: 16,
    color: isDarkMode ? '#e2e8f0' : '#1f2937',
    fontWeight: '600',
    lineHeight: 22,
    textAlign: isRTL ? 'right' : 'left',
  },
  pickupActions: {
    gap: 10,
  },
  pickupActionRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    gap: 10,
  },
  pickupActionButton: {
    flex: 1,
  },
  pickupNavButton: {
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#f1f5f9',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(255,255,255,0.2)' : '#e2e8f0',
  },
  pickupNavText: {
    color: isDarkMode ? '#e2e8f0' : '#0f172a',
    fontSize: 15,
    fontWeight: '700',
  },
  pickupChatButton: {
    backgroundColor: isDarkMode ? 'rgba(56,189,248,0.18)' : '#e0f2fe',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(56,189,248,0.45)' : '#bae6fd',
  },
  pickupChatButtonText: {
    color: isDarkMode ? '#bae6fd' : '#0369a1',
    fontSize: 15,
    fontWeight: '700',
  },
  dropoffModalCard: {
    backgroundColor: isDarkMode ? 'rgba(30,30,30,0.97)' : 'rgba(255,255,255,0.98)',
    margin: 20,
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 18,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    borderTopWidth: 4,
    borderTopColor: '#dc3545',
  },
  dropoffHandle: {
    alignSelf: 'center',
    width: 50,
    height: 5,
    borderRadius: 999,
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.2)' : '#e2e8f0',
    marginBottom: 12,
  },
  dropoffHeaderRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  dropoffBadge: {
    backgroundColor: isDarkMode ? 'rgba(220,53,69,0.18)' : '#fee2e2',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(220,53,69,0.4)' : '#fecaca',
  },
  dropoffBadgeText: {
    color: isDarkMode ? '#fecaca' : '#b91c1c',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  dropoffIdPill: {
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#f1f3f5',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(255,255,255,0.15)' : '#e2e8f0',
  },
  dropoffIdText: {
    fontSize: 12,
    fontWeight: '700',
    color: isDarkMode ? '#e2e8f0' : '#334155',
  },
  dropoffInfoRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    gap: 10,
    marginBottom: 14,
  },
  dropoffInfoCard: {
    flex: 1,
    backgroundColor: isDarkMode ? '#252525' : '#f8f9fa',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
  },
  dropoffInfoLabel: {
    fontSize: 12,
    color: isDarkMode ? '#aaa' : '#6b7280',
    marginBottom: 4,
    textAlign: isRTL ? 'right' : 'left',
  },
  dropoffInfoValue: {
    fontSize: 16,
    fontWeight: '700',
    color: isDarkMode ? '#fff' : '#111827',
    textAlign: isRTL ? 'right' : 'left',
  },
  dropoffInfoValueAccent: {
    color: '#22c55e',
  },
  dropoffAddressCard: {
    backgroundColor: isDarkMode ? '#1f2937' : '#f8fafc',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
    marginBottom: 14,
  },
  dropoffAddressHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  dropoffDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#dc3545',
    marginRight: isRTL ? 0 : 8,
    marginLeft: isRTL ? 8 : 0,
  },
  dropoffAddressLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: isDarkMode ? '#fecaca' : '#b91c1c',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  dropoffAddressValue: {
    fontSize: 16,
    color: isDarkMode ? '#e2e8f0' : '#1f2937',
    fontWeight: '600',
    lineHeight: 22,
    textAlign: isRTL ? 'right' : 'left',
  },
  dropoffActions: {
    gap: 10,
  },
  dropoffNavButton: {
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#f1f5f9',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(255,255,255,0.2)' : '#e2e8f0',
  },
  dropoffNavText: {
    color: isDarkMode ? '#e2e8f0' : '#0f172a',
    fontSize: 15,
    fontWeight: '700',
  },
  rideModalHeaderRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  rideIdPill: {
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#f1f3f5',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(255,255,255,0.15)' : '#e2e8f0',
  },
  rideIdPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: isDarkMode ? '#e2e8f0' : '#334155',
  },
  rideMetaRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  rideMetaPill: {
    backgroundColor: isDarkMode ? 'rgba(34,197,94,0.12)' : '#dcfce7',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(34,197,94,0.3)' : '#bbf7d0',
  },
  rideMetaPillText: {
    color: isDarkMode ? '#86efac' : '#15803d',
    fontSize: 12,
    fontWeight: '700',
  },
  ridePickupLabelRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  pickupDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#28a745',
    marginRight: isRTL ? 0 : 8,
    marginLeft: isRTL ? 8 : 0,
  },
  ridePickupLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: isDarkMode ? '#9ae6b4' : '#15803d',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  rideModalPrice: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#28a745',
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    textAlign: isRTL ? 'right' : 'left',
  },
  rideModalDistance: {
    fontSize: 16,
    color: isDarkMode ? '#ccc' : '#666',
    marginBottom: 4,
    textAlign: isRTL ? 'right' : 'left',
  },
  rideModalAddress: {
    fontSize: 16,
    color: isDarkMode ? '#e2e8f0' : '#1f2937',
    marginBottom: 6,
    lineHeight: 22,
    fontWeight: '600',
    textAlign: isRTL ? 'right' : 'left',
  },
  rideModalType: {
    fontSize: 16,
    color: isDarkMode ? '#ccc' : '#666',
    marginBottom: 8,
  },
  rideTypeBadge: {
    alignSelf: isRTL ? 'flex-end' : 'flex-start',
    backgroundColor: isDarkMode ? 'rgba(59,130,246,0.15)' : '#e0f2fe',
    borderColor: isDarkMode ? 'rgba(59,130,246,0.3)' : '#bae6fd',
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    marginBottom: 12,
  },
  rideTypeBadgeText: {
    color: isDarkMode ? '#93c5fd' : '#0369a1',
    fontSize: 12,
    fontWeight: '700',
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
    alignItems: 'stretch',
  },
  rideActionRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    gap: 10,
  },
  rideActionButton: {
    flex: 1,
    width: 'auto',
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
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#28a745',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 12,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(255,255,255,0.2)' : '#fff',
  },
  pickupButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  dropoffButton: {
    backgroundColor: '#dc3545',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#dc3545',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 12,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(255,255,255,0.2)' : '#fff',
  },
  dropoffButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
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
  cancelOnText: {
    color: '#dc3545',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 10,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  floatingGoButton: {
    position: 'absolute',
    bottom: 40,
    left: '50%',
    marginLeft: -45, // Half of width to center
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#28a745',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 20,
    borderWidth: 4,
    borderColor: '#fff',
  },
  floatingGoButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
   rideOfferModal: {
     position: 'absolute',
     top: 0,
     left: 0,
     right: 0,
     bottom: 0,
     backgroundColor: 'rgba(0, 0, 0, 0.55)',
     justifyContent: 'flex-end',
     alignItems: 'center',
     zIndex: 3000,
   },
   rideOfferSheet: {
     backgroundColor: isDarkMode ? '#1f1f1f' : '#ffffff',
     width: '100%',
     borderTopLeftRadius: 24,
     borderTopRightRadius: 24,
     padding: 20,
     paddingBottom: 28,
     shadowColor: '#000',
     shadowOffset: { width: 0, height: -6 },
     shadowOpacity: 0.2,
     shadowRadius: 12,
     elevation: 20,
     borderWidth: 1,
     borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
   },
   rideOfferHeader: {
     flexDirection: 'row',
     justifyContent: 'space-between',
     alignItems: 'center',
     marginBottom: 12,
   },
   rideOfferTitle: {
     fontSize: 18,
     fontWeight: '700',
     color: isDarkMode ? '#fff' : '#222',
     flex: 1,
   },
   rideOfferPill: {
     backgroundColor: isDarkMode ? '#2f2f2f' : '#f1f3f5',
     borderRadius: 20,
     paddingVertical: 6,
     paddingHorizontal: 12,
     marginLeft: 12,
   },
   rideOfferPillText: {
     color: isDarkMode ? '#fff' : '#333',
     fontSize: 12,
     fontWeight: '600',
   },
   rideOfferMetaRow: {
     flexDirection: 'row',
     justifyContent: 'space-between',
     gap: 10,
     marginBottom: 14,
   },
   rideOfferMetaItem: {
     flex: 1,
     backgroundColor: isDarkMode ? '#2a2a2a' : '#f8f9fa',
     borderRadius: 12,
     paddingVertical: 10,
     paddingHorizontal: 12,
     borderWidth: 1,
     borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
   },
   rideOfferMetaLabel: {
     fontSize: 12,
     color: isDarkMode ? '#bbb' : '#666',
     marginBottom: 4,
   },
   rideOfferMetaValue: {
     fontSize: 16,
     fontWeight: '700',
     color: isDarkMode ? '#fff' : '#222',
   },
   rideOfferAddressBlock: {
     backgroundColor: isDarkMode ? '#2a2a2a' : '#f8f9fa',
     borderRadius: 14,
     padding: 14,
     marginBottom: 16,
     borderWidth: 1,
     borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
   },
   rideOfferAddressRow: {
     flexDirection: isRTL ? 'row-reverse' : 'row',
     alignItems: 'flex-start',
     marginBottom: 10,
   },
   rideOfferAddressLabel: {
     fontSize: 12,
     fontWeight: '700',
     color: isDarkMode ? '#9ad0ff' : '#007bff',
     width: 50,
     textAlign: isRTL ? 'right' : 'left',
   },
   rideOfferAddressValue: {
     flex: 1,
     fontSize: 14,
     color: isDarkMode ? '#e5e5e5' : '#333',
     lineHeight: 20,
     textAlign: isRTL ? 'right' : 'left',
   },
   rideOfferCountdownRow: {
     marginBottom: 16,
   },
   rideOfferCountdownTrack: {
     height: 8,
     backgroundColor: isDarkMode ? '#3a3a3a' : '#e9ecef',
     borderRadius: 8,
     overflow: 'hidden',
   },
   rideOfferCountdownFill: {
     height: '100%',
     backgroundColor: '#dc3545',
   },
   rideOfferCountdownText: {
     marginTop: 8,
     fontSize: 13,
     fontWeight: '600',
     color: isDarkMode ? '#ffb3b3' : '#b02a37',
     textAlign: 'center',
   },
   rideOfferButtons: {
     flexDirection: 'column',
     gap: 10,
     width: '100%',
   },
   rideOfferButton: {
     paddingVertical: 14,
     paddingHorizontal: 20,
     borderRadius: 12,
     alignItems: 'center',
   },
   rideOfferPrimary: {
     width: '100%',
   },
   rideOfferSecondary: {
     backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#f1f3f5',
     borderWidth: 1,
     borderColor: isDarkMode ? 'rgba(255,255,255,0.15)' : '#dee2e6',
     width: '100%',
   },
   rideOfferSecondaryText: {
     color: isDarkMode ? '#f8f9fa' : '#343a40',
     textShadowColor: 'transparent',
   },
   acceptButton: {
     backgroundColor: '#28a745',
     shadowColor: '#28a745',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 2,
    borderColor: '#fff',
  },
   rejectButton: {
     backgroundColor: '#dc3545',
     shadowColor: '#dc3545',
     shadowOffset: { width: 0, height: 4 },
     shadowOpacity: 0.3,
     shadowRadius: 8,
     elevation: 4,
     borderWidth: 2,
     borderColor: '#fff',
   },
  acceptButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  rejectButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  callIconInModal: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#f8fafc',
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(255,255,255,0.15)' : '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  callIconText: {
    color: '#28a745',
    fontSize: 18,
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
  shiftWarningModal: {
    backgroundColor: isDarkMode ? '#333' : '#fff',
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
  shiftWarningTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#dc3545',
    marginBottom: 15,
    textAlign: 'center',
  },
  shiftWarningMessage: {
    fontSize: 16,
    color: isDarkMode ? '#ccc' : '#666',
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 22,
  },
  shiftWarningButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 20,
  },
  shiftWarningButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  shiftEndShiftButton: {
    backgroundColor: '#dc3545',
  },
  laterButton: {
    backgroundColor: '#6c757d',
  },
  endShiftButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  laterButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  searchingBar: {
    position: 'absolute',
    bottom: 22,
    left: 16,
    right: 16,
    minHeight: 64,
    backgroundColor: isDarkMode ? '#0b1220' : '#f8fafc',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    zIndex: 1000,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(148,163,184,0.18)' : 'rgba(148,163,184,0.35)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 14,
  },
  searchingText: {
    textAlign: 'center',
  },
  searchingLetter: {
    color: isDarkMode ? '#e5e7eb' : '#0f172a',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  searchingBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    width: 48,
    height: 24,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: isDarkMode ? 'rgba(23,162,184,0.12)' : 'rgba(23,162,184,0.08)',
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(23,162,184,0.3)' : 'rgba(23,162,184,0.25)',
    marginBottom: 8,
    flexShrink: 0,
  },
  searchingBarItem: {
    width: 4,
    height: 14,
    borderRadius: 3,
    backgroundColor: '#17a2b8',
    marginHorizontal: 2,
  },
  cancelRideButton: {
    backgroundColor: '#dc3545',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  cancelRideButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Cancel Modal - New Styles
  cancelModalCard: {
    backgroundColor: isDarkMode ? '#1e1e1e' : '#fff',
    margin: 20,
    borderRadius: 20,
    padding: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  cancelModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: isDarkMode ? '#333' : '#f0f0f0',
    backgroundColor: isDarkMode ? '#252525' : '#f8f9fa',
  },
  cancelModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: isDarkMode ? '#fff' : '#333',
    flex: 1,
  },
  cancelModalCloseButton: {
    padding: 5,
  },
  cancelModalCloseText: {
    fontSize: 20,
    color: isDarkMode ? '#999' : '#666',
  },
  cancelStepContainer: {
    padding: 20,
  },
  cancelModalSubtitle: {
    fontSize: 14,
    color: isDarkMode ? '#aaa' : '#666',
    marginBottom: 15,
    textAlign: 'center',
  },
  // Warning Banner
  cancelWarningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDarkMode ? '#3d2817' : '#fff3cd',
    padding: 12,
    borderRadius: 12,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  cancelWarningIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  cancelWarningText: {
    flex: 1,
    fontSize: 12,
    color: isDarkMode ? '#ffc107' : '#856404',
    lineHeight: 18,
  },
  // Fee Preview
  cancelFeePreview: {
    backgroundColor: isDarkMode ? '#252525' : '#f8f9fa',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
  },
  cancelFeeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cancelFeeLabel: {
    fontSize: 14,
    color: isDarkMode ? '#aaa' : '#666',
  },
  cancelFeeValue: {
    fontSize: 14,
    color: isDarkMode ? '#fff' : '#333',
    fontWeight: '500',
  },
  cancelFeeTotal: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: isDarkMode ? '#444' : '#ddd',
  },
  cancelFeeTotalLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: isDarkMode ? '#fff' : '#333',
  },
  cancelFeeTotalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#dc3545',
  },
  // Reason Options
  cancelReasonsList: {
    gap: 10,
  },
  cancelReasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDarkMode ? '#252525' : '#f8f9fa',
    padding: 15,
    borderRadius: 12,
    borderLeftWidth: 4,
  },
  cancelReasonIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  cancelReasonOptionText: {
    flex: 1,
    fontSize: 15,
    color: isDarkMode ? '#fff' : '#333',
  },
  cancelReasonArrow: {
    fontSize: 20,
    color: isDarkMode ? '#666' : '#999',
  },
  // Confirm Step
  cancelConfirmIconContainer: {
    alignItems: 'center',
    marginBottom: 15,
  },
  cancelConfirmIcon: {
    fontSize: 50,
  },
  cancelConfirmMessage: {
    fontSize: 15,
    color: isDarkMode ? '#ccc' : '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  cancelSelectedReason: {
    backgroundColor: isDarkMode ? '#252525' : '#f8f9fa',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
  },
  cancelSelectedReasonLabel: {
    fontSize: 12,
    color: isDarkMode ? '#999' : '#666',
    marginBottom: 5,
  },
  cancelSelectedReasonValue: {
    fontSize: 16,
    fontWeight: '500',
    color: isDarkMode ? '#fff' : '#333',
  },
  cancelFinalFee: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: isDarkMode ? '#3d1f1f' : '#f8d7da',
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
  },
  cancelFinalFeeLabel: {
    fontSize: 14,
    color: isDarkMode ? '#ff6b6b' : '#721c24',
  },
  cancelFinalFeeValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#dc3545',
  },
  cancelConfirmButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelGoBackButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: isDarkMode ? '#444' : '#e9ecef',
  },
  cancelGoBackButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: isDarkMode ? '#fff' : '#495057',
  },
  cancelConfirmButton: {
    flex: 1.5,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#dc3545',
  },
  cancelConfirmButtonText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#fff',
  },
  // Loading Step
  cancelLoadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  cancelLoadingText: {
    marginTop: 15,
    fontSize: 14,
    color: isDarkMode ? '#aaa' : '#666',
  },
  // Success Step
  cancelSuccessContainer: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  cancelSuccessIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#28a745',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  cancelSuccessIconText: {
    fontSize: 35,
    color: '#fff',
    fontWeight: 'bold',
  },
  cancelSuccessTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: isDarkMode ? '#fff' : '#333',
    marginBottom: 10,
  },
  cancelSuccessMessage: {
    fontSize: 14,
    color: isDarkMode ? '#aaa' : '#666',
    textAlign: 'center',
  },
  // Error Step
  cancelErrorContainer: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  cancelErrorIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#dc3545',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  cancelErrorIconText: {
    fontSize: 35,
    color: '#fff',
    fontWeight: 'bold',
  },
  cancelErrorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: isDarkMode ? '#fff' : '#333',
    marginBottom: 10,
  },
  cancelErrorMessage: {
    fontSize: 14,
    color: isDarkMode ? '#aaa' : '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  cancelRetryButton: {
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 12,
    backgroundColor: '#007bff',
  },
  cancelRetryButtonText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#fff',
  },
  // Legacy styles (keep for compatibility)
  cancelReasonButton: {
    backgroundColor: '#6c757d',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  cancelReasonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  closeButton: {
    backgroundColor: '#6c757d',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
