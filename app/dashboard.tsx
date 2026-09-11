import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
  Image,
  ScrollView,
  RefreshControl,
  TextInput,
  Animated,
  PanResponder,
  ActivityIndicator,
  AppState,
  Alert,
  BackHandler,
} from 'react-native';
// Load react-native-maps dynamically only on native builds to avoid native module init in Expo Go
// (we'll require it inside the component when needed)
import { useAuth } from '../src/context/AuthContext';
import { useSettings } from '../src/context/SettingsContext';
import { useTranslation } from '../src/hooks/useTranslation';
import {
  toggleDriverOnline,
  toggleDriverBusy,
  getDriverStatus,
  updateDriverLocation,
  getRide,
  api,
  endShift,
  getDriverUpcoming,
  getDriverSchedule,
  normalizeScheduledPendingOffers,
  normalizeOpenRides,
  getDriverHistory,
  getRidePreferences,
} from '../src/services/api';
import { StatusBar } from '../src/components/StatusBar';
import { StatusBarExpanded } from '../src/components/StatusBarExpanded';
import type { DriverStatus } from '../src/components/StatusBar';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ride, Booking, ScheduledPendingOffer, OpenRide } from '../src/types';
import {
  onDriverStatusUpdate,
  offDriverStatusUpdate,
  onRideOffer,
  offRideOffer,
  onRideOfferTimeout,
  offRideOfferTimeout,
  onRideOfferRejected,
  offRideOfferRejected,
  onScheduledOfferResult,
  offScheduledOfferResult,
  onRideCancelled,
  offRideCancelled,
  onRideAccepted,
  sendRideTimeout,
  acceptRide,
  rejectRide,
  onPickupProximity,
  offPickupProximity,
  onPickupCountdownExpired,
  offPickupCountdownExpired,
  onScheduledLateWarning,
  offScheduledLateWarning,
  onScheduledUpcomingOffersUpdate,
  offScheduledUpcomingOffersUpdate,
  onRideProposal,
  offRideProposal,
  onRideProposalTimeout,
  offRideProposalTimeout,
  onRideProposalRejected,
  offRideProposalRejected,
  onRideProposalCancelled,
  offRideProposalCancelled,
  onOpenRidesUpdate,
  offOpenRidesUpdate,
  acceptChainRide,
  onChainRideOffer,
  offChainRideOffer,
  onChainRideOfferTimeout,
  offChainRideOfferTimeout,
  onChainRideOfferRejected,
  offChainRideOfferRejected,
  onChainRideOfferCancelled,
  offChainRideOfferCancelled,
  onChainAccepted,
  offChainAccepted,
  onChainAcceptFailed,
  offChainAcceptFailed,
  onChainRideCancelled,
  offChainRideCancelled,
  getSocket,
} from '../src/services/socket';
import { sendLocalNotification } from '../src/services/notifications';
import { LOCATION_BACKGROUND_TASK } from '../src/tasks/socketBackgroundTask';
import { devLog, getGoogleMapsApiKey, requireGoogleMapsApiKey } from '../src/config/security';
import MapPlaceholder from './components/MapPlaceholder';
import LastRidesList from './components/LastRidesList';
import SearchingCard from './components/SearchingCard';
import EndKMModal from './components/EndKMModal';
import RatingInfoModal from './components/RatingInfoModal';
import ShiftWarningModal from './components/ShiftWarningModal';
import HamburgerMenu from './components/HamburgerMenu';
import StopModal from './components/StopModal';
import DropoffModal from './components/DropoffModal';
import RidePreferencesModal from './components/RidePreferencesModal';
import { getStyles } from '../src/styles/dashboard.styles';
import {
  buildSmartAlerts,
  type NetworkMode,
  type SmartAlert,
} from '../src/features/driverIntelligence';
import { encryptString, decryptString } from '../src/services/storageEncryption';

const { width, height } = Dimensions.get('window');

const DASHBOARD_SNAPSHOT_KEY = 'driver_dashboard_snapshot_v1';
const OFFLINE_LOCATION_QUEUE_KEY = 'driver_offline_location_queue_v1';
const MAX_OFFLINE_LOCATION_QUEUE = 80;
// A shift is considered "fresh" (just started) within this window, so we show
// the ride-preferences confirmation modal shortly after login for a new shift.
const FRESH_SHIFT_WINDOW_SECONDS = 45;

type QueuedLocationUpdate = {
  latitude: number;
  longitude: number;
  timestamp: string;
};

type DashboardSnapshot = {
  timestamp: number;
  driverOnline: boolean;
  driverBusy: boolean;
  upcomingRides: any[];
  pendingScheduledOffers: ScheduledPendingOffer[];
  currentLocation: { latitude: number; longitude: number } | null;
  totalRidesToday: number;
  earningsToday: number;
  lastRidePreview: {
    id: number;
    status: string;
  } | null;
};

export const options = {
  headerShown: false,
};

export default function DashboardScreen() {
  const { authState, logout } = useAuth();
  const { settings, isDarkMode, isRTL } = useSettings();
  const { t, getCurrentLanguage } = useTranslation();
  const router = useRouter();
  const googleMapsApiKey = getGoogleMapsApiKey();
  const [driverOnline, setDriverOnline] = useState(false);
  const [driverBusy, setDriverBusy] = useState(false);
  const [bannedUntil, setBannedUntil] = useState<Date | null>(null);
  const [banCountdown, setBanCountdown] = useState(0);
  const [restrictedOffers, setRestrictedOffers] = useState(false);
  const [restrictedOffersUntil, setRestrictedOffersUntil] = useState<Date | null>(null);
  const [shiftStartTime, setShiftStartTime] = useState<string | null>(null);
  const [shiftElapsedTime, setShiftElapsedTime] = useState('00:00:00');
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [locationPermission, setLocationPermission] = useState(false);
  const [locationSubscription, setLocationSubscription] = useState<any>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [lastLocationUpdate, setLastLocationUpdate] = useState(0);
  const [lastStatusCheck, setLastStatusCheck] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const hasInitialLoadedRef = useRef(false);
  const [showEndShiftMenu, setShowEndShiftMenu] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [menuMounted, setMenuMounted] = useState(false);
  const [showEndKMModal, setShowEndKMModal] = useState(false);
  const [endKM, setEndKM] = useState('');
  const [activeRide, setActiveRide] = useState<any>(null);
  const [currentRideId, setCurrentRideId] = useState<number | null>(null);
  const [showPickupModal, setShowPickupModal] = useState(false);
  const [showDropoffModal, setShowDropoffModal] = useState(false);
  const [showStopModal, setShowStopModal] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState<any[]>([]);
  const [isPickupLoading, setIsPickupLoading] = useState(false);
  const [isContinueLoading, setIsContinueLoading] = useState(false);
  const [isDropoffLoading, setIsDropoffLoading] = useState(false);
  const [rideOffer, setRideOffer] = useState<any>(null);
  const [offerCountdown, setOfferCountdown] = useState(0);
  const [offerTotalSeconds, setOfferTotalSeconds] = useState(0);
  const [offerTimeout, setOfferTimeout] = useState<ReturnType<typeof setInterval> | null>(null);
  const [rideProposal, setRideProposal] = useState<any>(null);
  const [proposalCountdown, setProposalCountdown] = useState(0);
  const [proposalTotalSeconds, setProposalTotalSeconds] = useState(0);
  const rideProposalRef = useRef<any>(null);
  const proposalTimeoutRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [openRides, setOpenRides] = useState<OpenRide[]>([]);
  const [chainOffer, setChainOffer] = useState<any>(null);
  const [chainCountdown, setChainCountdown] = useState(0);
  const [chainTotalSeconds, setChainTotalSeconds] = useState(0);
  const chainOfferRef = useRef<any>(null);
  const chainTimeoutRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [rideOfferSound, setRideOfferSound] = useState<any>(null);
  const [lateWarningSound, setLateWarningSound] = useState<any>(null);
  const [scheduledBanner, setScheduledBanner] = useState<{
    rideId: number;
    message: string;
    pickupTime?: string | null;
    selected?: boolean | null;
  } | null>(null);
  const scheduledBannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rideOfferSoundRef = useRef<any>(null);
  const lateWarningSoundRef = useRef<any>(null);
  const beepSoundRef = useRef<any>(null);
  const isAudioModeReadyRef = useRef(false);
  const [upcomingRides, setUpcomingRides] = useState<any[]>([]);
  const [recentRides, setRecentRides] = useState<any[]>([]);
  const [pendingScheduledOffers, setPendingScheduledOffers] = useState<ScheduledPendingOffer[]>([]);
  const [scheduledNow, setScheduledNow] = useState(Date.now());
  const [scheduledEtaMinutes, setScheduledEtaMinutes] = useState<number | null>(null);
  const latestLocationRef = useRef<{ latitude: number; longitude: number } | null>(null);

  const loadRecentRides = async (retryCount = 0) => {
    if (!authState.token) return;
    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 180 * 24 * 60 * 60 * 1000);
      const formatDate = (date: Date) => date.toISOString().slice(0, 10);
      const response = await getDriverHistory(
        authState.token,
        formatDate(startDate),
        formatDate(endDate),
        false,
        true,
      );

      if (response && response.ok && Array.isArray(response.rides)) {
        setRecentRides(response.rides.slice(0, 6));
      } else {
        console.warn('Driver history response did not include rides:', response);
        setRecentRides([]);
      }
    } catch (error) {
      console.error('Error loading recent rides:', error);
      if (retryCount < 2) {
        const delay = Math.pow(2, retryCount) * 1000;
        setTimeout(() => loadRecentRides(retryCount + 1), delay);
      }
    }
  };
  const nextScheduledRideRef = useRef<any>(null);
  const pendingScheduledOffersRef = useRef<ScheduledPendingOffer[]>([]);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [networkMode, setNetworkMode] = useState<NetworkMode>('online');
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);
  const [lastCachedRidePreview, setLastCachedRidePreview] = useState<{
    id: number;
    status: string;
  } | null>(null);
  const [showShiftWarning, setShowShiftWarning] = useState(false);
  const [suppressShiftWarning, setSuppressShiftWarning] = useState(false);
  const [cancelCountdown, setCancelCountdown] = useState(0);
  const [showCancelText, setShowCancelText] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelStep, setCancelStep] = useState<
    'reason' | 'confirm' | 'loading' | 'success' | 'error'
  >('reason');
  const [selectedCancelReason, setSelectedCancelReason] = useState<string | null>(null);
  const [cancelErrorMessage, setCancelErrorMessage] = useState<string>('');
  const [pickupCountdownStart, setPickupCountdownStart] = useState<number | null>(null);
  const [pickupCountdownDuration, setPickupCountdownDuration] = useState(300);
  const [countdownExpired, setCountdownExpired] = useState(false);
  const [cancelMode, setCancelMode] = useState<'early' | 'late'>('early');
  const [showStatusExpanded, setShowStatusExpanded] = useState(false);
  const [showRatingInfo, setShowRatingInfo] = useState(false);
  const [totalRidesToday, setTotalRidesToday] = useState(0);
  const [earningsToday, setEarningsToday] = useState(0);
  const [scheduleEligibility, setScheduleEligibility] = useState<any>(null);
  const [scheduleReasonMessage, setScheduleReasonMessage] = useState<string>('');
  const [showRidePreferences, setShowRidePreferences] = useState(false);
  const [hasRidePreferences, setHasRidePreferences] = useState(false);
  const driverOnlineRef = useRef(false);
  const driverBusyRef = useRef(false);
  const isSocketConnectedRef = useRef(false);
  const networkModeRef = useRef<NetworkMode>('online');
  const isFlushingQueueRef = useRef(false);
  const activeRideRef = useRef<any>(null);

  const waitFor = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const readQueuedLocations = async (): Promise<QueuedLocationUpdate[]> => {
    try {
      const raw = await AsyncStorage.getItem(OFFLINE_LOCATION_QUEUE_KEY);
      if (!raw) return [];
      const decrypted = await decryptString(raw);
      if (!decrypted) return [];
      const parsed = JSON.parse(decrypted);
      if (!Array.isArray(parsed)) return [];

      return parsed.filter((entry: any) => {
        const latitude = Number(entry?.latitude);
        const longitude = Number(entry?.longitude);
        return (
          Number.isFinite(latitude) &&
          Number.isFinite(longitude) &&
          typeof entry?.timestamp === 'string'
        );
      });
    } catch (error) {
      console.error('Error reading queued offline locations:', error);
      return [];
    }
  };

  const persistQueuedLocations = async (queue: QueuedLocationUpdate[]) => {
    const sanitized = queue.slice(-MAX_OFFLINE_LOCATION_QUEUE);
    if (sanitized.length === 0) {
      await AsyncStorage.removeItem(OFFLINE_LOCATION_QUEUE_KEY);
      setOfflineQueueCount(0);
      return;
    }

    await AsyncStorage.setItem(
      OFFLINE_LOCATION_QUEUE_KEY,
      await encryptString(JSON.stringify(sanitized)),
    );
    setOfflineQueueCount(sanitized.length);
  };

  const enqueueLocationForSync = async (
    location: { latitude: number; longitude: number },
    timestamp: string,
  ) => {
    const queued = await readQueuedLocations();
    queued.push({
      latitude: location.latitude,
      longitude: location.longitude,
      timestamp,
    });
    await persistQueuedLocations(queued);
  };

  const flushQueuedLocations = async () => {
    if (!authState.token || isFlushingQueueRef.current) return;

    isFlushingQueueRef.current = true;

    try {
      const queued = await readQueuedLocations();
      if (!queued.length) {
        setOfflineQueueCount(0);
        if (networkModeRef.current !== 'online') {
          setNetworkMode('online');
        }
        return;
      }

      setNetworkMode('syncing');
      networkModeRef.current = 'syncing';

      let index = 0;
      for (; index < queued.length; index += 1) {
        const point = queued[index];
        try {
          await updateDriverLocation(
            point.latitude,
            point.longitude,
            authState.token,
            point.timestamp,
          );
        } catch (error) {
          console.error('Error flushing queued location point:', error);
          break;
        }
      }

      if (index >= queued.length) {
        await AsyncStorage.removeItem(OFFLINE_LOCATION_QUEUE_KEY);
        setOfflineQueueCount(0);
        setNetworkMode('online');
        networkModeRef.current = 'online';
      } else {
        const remaining = queued.slice(index);
        await persistQueuedLocations(remaining);
        setNetworkMode('offline');
        networkModeRef.current = 'offline';
      }
    } catch (error) {
      console.error('Error while flushing offline queue:', error);
      setNetworkMode('offline');
      networkModeRef.current = 'offline';
    } finally {
      isFlushingQueueRef.current = false;
    }
  };

  const loadDashboardSnapshot = async () => {
    try {
      const rawSnapshot = await AsyncStorage.getItem(DASHBOARD_SNAPSHOT_KEY);
      if (!rawSnapshot) return;

      const decryptedSnapshot = await decryptString(rawSnapshot);
      if (!decryptedSnapshot) return;

      const snapshot: DashboardSnapshot = JSON.parse(decryptedSnapshot);

      if (!currentLocation && snapshot?.currentLocation) {
        setCurrentLocation(snapshot.currentLocation);
      }

      if (!upcomingRides.length && Array.isArray(snapshot?.upcomingRides)) {
        setUpcomingRides(snapshot.upcomingRides);
      }

      if (!pendingScheduledOffers.length && Array.isArray(snapshot?.pendingScheduledOffers)) {
        setPendingScheduledOffers(snapshot.pendingScheduledOffers);
      }

      if (typeof snapshot?.totalRidesToday === 'number' && totalRidesToday === 0) {
        setTotalRidesToday(snapshot.totalRidesToday);
      }

      if (typeof snapshot?.earningsToday === 'number' && earningsToday === 0) {
        setEarningsToday(snapshot.earningsToday);
      }

      if (snapshot?.lastRidePreview) {
        setLastCachedRidePreview(snapshot.lastRidePreview);
      }
    } catch (error) {
      console.error('Error loading dashboard snapshot cache:', error);
    }
  };

  useEffect(() => {
    driverOnlineRef.current = driverOnline;
    driverBusyRef.current = driverBusy;
    activeRideRef.current = activeRide;
  }, [driverOnline, driverBusy, activeRide]);

  useEffect(() => {
    isSocketConnectedRef.current = isSocketConnected;
  }, [isSocketConnected]);

  useEffect(() => {
    networkModeRef.current = networkMode;
  }, [networkMode]);

  useEffect(() => {
    loadDashboardSnapshot();
    readQueuedLocations()
      .then((queued) => {
        setOfflineQueueCount(queued.length);
        if (queued.length > 0) {
          setNetworkMode('offline');
        }
      })
      .catch((error) => {
        console.error('Error loading queued locations on mount:', error);
      });
  }, []);

  const getAudioMode = () => ({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    staysActiveInBackground: true,
    interruptionModeIOS: InterruptionModeIOS.DuckOthers,
    shouldDuckAndroid: true,
    interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
    playThroughEarpieceAndroid: false,
  });

  const ensureAudioMode = async () => {
    try {
      await Audio.setAudioModeAsync(getAudioMode());
      isAudioModeReadyRef.current = true;
      return true;
    } catch (error) {
      isAudioModeReadyRef.current = false;
      console.error('Error setting audio mode:', error);
      return false;
    }
  };

  const isAudioFocusException = (error: any) => {
    const errorMessage = String(error?.message || error || '');
    return errorMessage.includes('AudioFocusNotAcquiredException');
  };

  const runWithAudioFocusRetry = async (
    operation: () => Promise<any>,
    context: string,
    maxAttempts = 3,
  ) => {
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        if (!isAudioModeReadyRef.current || attempt > 1) {
          await ensureAudioMode();
        }
        return await operation();
      } catch (error) {
        lastError = error;
        if (!isAudioFocusException(error) || attempt === maxAttempts) {
          throw error;
        }
        const retryDelayMs = 140 * attempt;
        console.warn(
          `[Audio] ${context} failed to acquire focus (attempt ${attempt}/${maxAttempts}), retrying in ${retryDelayMs}ms`,
        );
        await waitFor(retryDelayMs);
      }
    }

    throw lastError;
  };

  const safelyUnloadSound = async (sound: any, context: string) => {
    if (!sound) return;
    try {
      await sound.stopAsync();
    } catch {
      // noop - sound might already be stopped/unloaded
    }
    try {
      await sound.unloadAsync();
    } catch (error) {
      console.warn(`Error unloading ${context}:`, error);
    }
  };

  const setRideOfferSoundSafe = (sound: any | null) => {
    rideOfferSoundRef.current = sound;
    setRideOfferSound(sound);
  };

  const setLateWarningSoundSafe = (sound: any | null) => {
    lateWarningSoundRef.current = sound;
    setLateWarningSound(sound);
  };

  const stopBeepSound = async () => {
    const currentBeep = beepSoundRef.current;
    if (!currentBeep) return;
    beepSoundRef.current = null;
    await safelyUnloadSound(currentBeep, 'beep sound');
  };

  // Helper function to determine driver status
  const getDriverStatusType = (): DriverStatus => {
    if (bannedUntil && banCountdown > 0) return 'banned';
    if (activeRide) return 'on_ride';
    if (!driverOnline) return 'offline';
    if (driverBusy) return 'busy';
    return 'online';
  };

  const getCurrentLocale = () => {
    const language = getCurrentLanguage();
    if (language === 'ar') return 'ar';
    if (language === 'da') return 'da-DK';
    return 'en-GB';
  };

  const formatScheduledDateTime = (value?: string | null) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString(getCurrentLocale());
  };

  const formatCountdown = (totalSeconds: number) => {
    const safeSeconds = Math.max(0, Math.floor(totalSeconds));
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const seconds = safeSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const getPendingOfferRemainingMs = (offer: ScheduledPendingOffer, nowMs: number) => {
    const byExpiry = Number.isFinite(offer?.expiresAtMs) ? Number(offer.expiresAtMs) - nowMs : 0;
    const fallback = Number(offer?.timeLeftMs || 0);
    return Math.max(0, Number.isFinite(byExpiry) && byExpiry > 0 ? byExpiry : fallback);
  };

  const getPendingOfferTimeoutMs = (offer: ScheduledPendingOffer) => {
    const stage = Number((offer as any)?.stage || 1);
    if (stage === 3) return 10 * 60 * 1000;
    return 3 * 60 * 1000;
  };

  const getScheduledUrgencyColor = (remainingMs: number, totalMs: number = 3 * 60 * 1000) => {
    const safeTotalMs = Math.max(1, Number(totalMs || 3 * 60 * 1000));
    const progress = Math.max(0, Math.min(1, remainingMs / safeTotalMs));
    const start = { r: 59, g: 130, b: 246 }; // blue
    const end = { r: 239, g: 68, b: 68 }; // red
    const r = Math.round(end.r + (start.r - end.r) * progress);
    const g = Math.round(end.g + (start.g - end.g) * progress);
    const b = Math.round(end.b + (start.b - end.b) * progress);
    return `rgb(${r}, ${g}, ${b})`;
  };

  const showScheduledBanner = (payload: {
    rideId: number;
    message: string;
    pickupTime?: string | null;
    selected?: boolean | null;
  }) => {
    setScheduledBanner(payload);
    if (scheduledBannerTimeoutRef.current) {
      clearTimeout(scheduledBannerTimeoutRef.current);
    }
    scheduledBannerTimeoutRef.current = setTimeout(() => {
      setScheduledBanner(null);
      scheduledBannerTimeoutRef.current = null;
    }, 5000);
  };

  // Animation for GO button text
  const textOpacityAnim = useRef(new Animated.Value(1)).current;

  // Animations for bouncing dots
  const dot1Anim = useRef(new Animated.Value(1)).current;
  const dot2Anim = useRef(new Animated.Value(1)).current;
  const dot3Anim = useRef(new Animated.Value(1)).current;
  const menuAnim = useRef(new Animated.Value(0)).current;

  const searchText = t('searching_trips');
  const searchLetters = useMemo(() => Array.from(searchText), [searchText]);
  const letterAnimValues = useMemo(
    () => searchLetters.map(() => new Animated.Value(1)),
    [searchLetters],
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
      const newPosition = Math.max(
        0,
        Math.min(sliderWidth, sliderPositionRef.current + gestureState.dx),
      );
      setSliderPosition(newPosition);
      sliderPositionRef.current = newPosition;
    },
    onPanResponderRelease: () => {
      if (sliderPosition >= sliderWidth * 0.8) {
        // If slid far enough
        handlePickupConfirm();
      } else {
        // Reset slider
        setSliderPosition(0);
        sliderPositionRef.current = 0;
      }
    },
  });

  // Map ref for animating to location
  const mapRef = useRef<any>(null);

  useEffect(() => {
    ensureAudioMode();
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
        ]),
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
          ]),
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

  useEffect(() => {
    let isCancelled = false;

    if (showMenu) {
      setMenuMounted(true);
      Animated.spring(menuAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 7,
        tension: 70,
      }).start();
    } else {
      Animated.timing(menuAnim, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && !isCancelled) {
          setMenuMounted(false);
        }
      });
    }

    return () => {
      isCancelled = true;
    };
  }, [showMenu, menuAnim]);

  useEffect(() => {
    return () => {
      if (scheduledBannerTimeoutRef.current) {
        clearTimeout(scheduledBannerTimeoutRef.current);
        scheduledBannerTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    latestLocationRef.current = currentLocation;
  }, [currentLocation]);

  useEffect(() => {
    pendingScheduledOffersRef.current = pendingScheduledOffers;
  }, [pendingScheduledOffers]);

  useEffect(() => {
    if (!upcomingRides.length && !pendingScheduledOffers.length) {
      return;
    }
    setScheduledNow(Date.now());
    const interval = setInterval(() => {
      setScheduledNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [upcomingRides.length, pendingScheduledOffers.length]);

  const isSearching = driverOnline && !driverBusy && !activeRide;

  const nextScheduledRide = useMemo(() => {
    if (!upcomingRides.length) return null;
    const now = scheduledNow;
    const futureRides = upcomingRides.filter((ride) => {
      const pickupMs = new Date(ride.pickupTime).getTime();
      return !Number.isNaN(pickupMs) && pickupMs >= now;
    });
    return futureRides.length > 0 ? futureRides[0] : null;
  }, [upcomingRides, scheduledNow]);

  useEffect(() => {
    nextScheduledRideRef.current = nextScheduledRide;
  }, [nextScheduledRide]);

  const scheduledCountdownSeconds = useMemo(() => {
    if (!nextScheduledRide?.pickupTime) return 0;
    const pickupMs = new Date(nextScheduledRide.pickupTime).getTime();
    if (Number.isNaN(pickupMs)) return 0;
    return Math.max(0, Math.ceil((pickupMs - scheduledNow) / 1000));
  }, [nextScheduledRide?.pickupTime, scheduledNow]);

  useEffect(() => {
    if (!isSearching || letterAnimValues.length === 0) {
      letterAnimValues.forEach((anim) => anim.setValue(1));
      return;
    }

    const animations = letterAnimValues.map((anim) =>
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
      ]),
    );

    const loop = Animated.loop(
      Animated.sequence([Animated.stagger(70, animations), Animated.delay(200)]),
    );

    loop.start();

    return () => {
      loop.stop();
      letterAnimValues.forEach((anim) => anim.setValue(1));
    };
  }, [isSearching, letterAnimValues]);

  useEffect(() => {
    if (authState.token) {
      loadDashboardSnapshot();
      readQueuedLocations()
        .then((queued) => {
          setOfflineQueueCount(queued.length);
          if (queued.length > 0) {
            setNetworkMode('offline');
          }
        })
        .catch((error) => {
          console.error('Error reading offline queue during auth bootstrap:', error);
        });

      setTimeout(() => {
        getCurrentLocation();
      }, 1200);

      // Set shift start time from user data if available
      if (authState.user?.shiftStartTime) {
        setShiftStartTime(authState.user.shiftStartTime);
      }

      // Load driver status after a short delay to ensure socket connection
      const loadInitialStatus = async () => {
        // Wait for socket connection
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await loadDriverStatus();
        await loadUpcomingRides();
        await loadRecentRides();
        await flushQueuedLocations();
        if (!hasInitialLoadedRef.current) {
          hasInitialLoadedRef.current = true;
          setIsInitialLoading(false);
        }
      };
      loadInitialStatus();

      // Listen for real-time driver status updates
      const handleDriverStatusUpdate = async (data: {
        currentRideId: number | null;
        isBusy: boolean;
        rideAccepted: number | null;
        isOnline?: boolean;
        bannedUntil?: string;
        restrictedOffers?: boolean;
        restrictedOffersUntil?: string | null;
      }) => {
        // Update driver status based on WebSocket data
        if (data.isOnline !== undefined && data.isOnline !== driverOnlineRef.current) {
          driverOnlineRef.current = data.isOnline;
          setDriverOnline(data.isOnline);
        }
        if (data.isBusy !== driverBusyRef.current) {
          driverBusyRef.current = data.isBusy;
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

        if (data.restrictedOffers !== undefined) {
          setRestrictedOffers(Boolean(data.restrictedOffers));
        }

        if (data.restrictedOffersUntil) {
          const untilDate = new Date(data.restrictedOffersUntil);
          setRestrictedOffersUntil(untilDate);
        } else if (data.restrictedOffersUntil === null) {
          setRestrictedOffersUntil(null);
        }

        // If we got a new currentRideId but activeRide isn't set yet, fetch it
        if (data.currentRideId && !activeRideRef.current && authState.token) {
          try {
            const rideRes = await getRide(data.currentRideId.toString(), authState.token);
            if (rideRes.ok && rideRes.data) {
              const ride = rideRes.data;
              if (ride.status === 'DISPATCHED' || ride.status === 'ONGOING') {
                setActiveRide(ride);
                setShowPickupModal(true);
              }
            }
          } catch {}
        }
      };

      // Add listeners
      onDriverStatusUpdate(handleDriverStatusUpdate);

      // Listen for ride offers
      const handleRideOffer = async (data: any) => {
        devLog('Ride offer received');

        const isScheduledOffer = !!(
          data?.scheduled ||
          data?.offerType === 'scheduled' ||
          data?.type === 'scheduled'
        );

        try {
          // Stop any existing sound first
          await stopRideOfferSound();

          // Play ride offer sound if enabled
          if (settings.sound.rideOfferSound) {
            if (isScheduledOffer) {
              await playScheduledOfferSoundOnce();
            } else {
              await playRideOfferSound();
            }
          }
        } catch (soundError) {
          console.error('Error while preparing ride offer sound:', soundError);
        }

        const defaultTimeoutMs = isScheduledOffer ? 15000 : 30000;
        const totalSeconds = Math.max(1, Math.ceil((data?.timeoutMs || defaultTimeoutMs) / 1000));
        setOfferTotalSeconds(totalSeconds);
        setRideOffer(data);
        setOfferCountdown(totalSeconds);

        // Start countdown
        const timeout = setInterval(() => {
          setOfferCountdown((prev) => {
            if (prev <= 1) {
              // Timeout - automatically reject the ride like clicking reject button
              devLog('Ride offer timed out, auto rejecting');
              if (!isScheduledOffer && authState.token) {
                // Automatically reject the ride
                rejectRide(data.rideId);
              } else if (isScheduledOffer && authState.token) {
                rejectRide(data.rideId);
              }
              setRideOffer(null);
              setOfferCountdown(0);
              stopRideOfferSound().then(() => devLog('Offer sound stopped after timeout'));
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
        devLog('Ride offer timeout event');
        // Only clear if this timeout matches the current offer
        if (rideOffer && rideOffer.rideId === data.rideId) {
          devLog('Clearing timed-out matching offer');
          await stopRideOfferSound();
          setRideOffer(null);
          setOfferCountdown(0);
          if (offerTimeout) {
            clearInterval(offerTimeout);
            setOfferTimeout(null);
          }
        } else {
          devLog('Ignoring timeout for non-matching offer');
        }
      };

      onRideOfferTimeout(handleRideOfferTimeout);

      // Listen for ride offer rejection
      const handleRideOfferRejected = async (data: { rideId: number }) => {
        devLog('Ride offer rejected event');
        // Only clear if this rejection matches the current offer
        if (rideOffer && rideOffer.rideId === data.rideId) {
          devLog('Clearing rejected matching offer');
          await stopRideOfferSound();
          setRideOffer(null);
          setOfferCountdown(0);
          if (offerTimeout) {
            clearInterval(offerTimeout);
            setOfferTimeout(null);
          }
        } else {
          devLog('Ignoring rejection for non-matching offer');
        }
      };

      onRideOfferRejected(handleRideOfferRejected);

      const handleScheduledOfferResult = (data: {
        rideId: number;
        selected: boolean;
        message?: string;
        pickupTime?: string;
        rideData?: any;
      }) => {
        devLog('Scheduled offer result received');
        const fallbackMessage = data.selected
          ? t('scheduled_ride_selected')
          : t('scheduled_ride_not_selected');
        showScheduledBanner({
          rideId: data.rideId,
          message: fallbackMessage,
          pickupTime: data.pickupTime || data?.rideData?.pickupTime || null,
          selected: data.selected,
        });
        loadUpcomingRides().catch(() => {});
        loadRecentRides().catch(() => {});
      };

      onScheduledOfferResult(handleScheduledOfferResult);

      // Listen for ride cancellation
      const handleRideCancelled = async (data: { rideId: number }) => {
        devLog('Ride cancelled event');
        // Only clear if this cancellation matches the current offer
        if (rideOffer && rideOffer.rideId === data.rideId) {
          devLog('Clearing cancelled matching offer');
          await stopRideOfferSound();
          setRideOffer(null);
          setOfferCountdown(0);
          if (offerTimeout) {
            clearInterval(offerTimeout);
            setOfferTimeout(null);
          }
        } else {
          devLog('Ignoring cancellation for non-matching offer');
        }
      };

      onRideCancelled(handleRideCancelled);

      const handleRideAccepted = async (data: { rideId: number }) => {
        devLog('Ride accepted event');
        try {
          const rideRes = await getRide(data.rideId.toString(), authState.token!);
          if (rideRes.ok && rideRes.data) {
            const ride = rideRes.data;
            if (ride.status === 'DISPATCHED' || ride.status === 'ONGOING') {
              setActiveRide(ride);
              setShowPickupModal(true);
              setShowDropoffModal(false);
              setShowStopModal(false);
              sliderPositionRef.current = sliderWidth * 0.05;
              setSliderPosition(sliderWidth * 0.05);
              setTimeout(() => {
                if (currentLocation) {
                  fetchDirections(
                    { lat: currentLocation.latitude, lng: currentLocation.longitude },
                    { lat: ride.startLatLon.lat, lng: ride.startLatLon.lon },
                  );
                }
              }, 1000);
            }
          }
        } catch (err) {
          console.error('Error handling ride accepted:', err);
        }
      };

      onRideAccepted(handleRideAccepted);

      // Listen for pickup proximity notifications
      const handlePickupProximity = async (data: {
        rideId: number;
        distanceMeters: number;
        countdownStart: number;
        countdownDuration: number;
      }) => {
        devLog('Pickup proximity event received');
        // Only show countdown text, NOT the cancel button yet
        setShowCancelText(true);
        setPickupCountdownStart(data.countdownStart);
        setPickupCountdownDuration(data.countdownDuration);
        const initialRemaining = Math.max(
          0,
          data.countdownDuration - Math.floor((Date.now() - data.countdownStart) / 1000),
        );
        setCancelCountdown(initialRemaining);

        // Save to AsyncStorage to persist across app restarts
        try {
          await AsyncStorage.setItem(
            `pickupCountdown_${data.rideId}`,
            JSON.stringify({
              countdownStart: data.countdownStart,
              countdownDuration: data.countdownDuration,
              expired: false,
            }),
          );
        } catch (error) {
          console.error('Error saving pickup countdown to AsyncStorage:', error);
        }

        // Start countdown
        const startCountdown = () => {
          const interval = setInterval(() => {
            const now = Date.now();
            const elapsed = Math.floor((now - data.countdownStart) / 1000);
            const remaining = data.countdownDuration - elapsed;

            setCancelCountdown(() => {
              if (remaining <= 0) {
                clearInterval(interval);
                // Countdown finished - show cancel button and persist expiration
                setShowCancelText(true);
                setCountdownExpired(true);
                AsyncStorage.setItem(
                  `pickupCountdown_${data.rideId}`,
                  JSON.stringify({
                    countdownStart: data.countdownStart,
                    countdownDuration: data.countdownDuration,
                    expired: true,
                    expiredAt: Date.now(),
                  }),
                ).catch(console.error);
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
        devLog('Pickup countdown expired event received');
        // Show cancel button immediately when server confirms countdown expired
        setCancelCountdown(0);
        setShowCancelText(true);
        setCountdownExpired(true);
        // Persist expired state for app restarts
        try {
          const storedCountdown = await AsyncStorage.getItem(`pickupCountdown_${data.rideId}`);
          const parsedCountdown = storedCountdown ? JSON.parse(storedCountdown) : {};
          await AsyncStorage.setItem(
            `pickupCountdown_${data.rideId}`,
            JSON.stringify({
              ...parsedCountdown,
              expired: true,
              expiredAt: Date.now(),
            }),
          );
        } catch (error) {
          console.error('Error saving expired pickup countdown:', error);
        }
      };

      onPickupProximity(handlePickupProximity);

      // Listen for pickup countdown expired from server
      onPickupCountdownExpired(handlePickupCountdownExpired);

      // Listen for scheduled late warnings
      const handleScheduledLateWarning = async (data: {
        rideId: number;
        lateMinutes: number;
        remainingMinutes: number;
        etaMinutes?: number;
        minutesBeforePickup?: number;
        pickupTime?: string;
      }) => {
        try {
          devLog('Scheduled late warning received');
          if (!settings.notifications.rideUpdates) {
            return;
          }
          if (settings.sound.rideOfferSound) {
            await playLateWarningSoundOnce();
          }

          const lateMinutes = data?.lateMinutes || 1;
          const remainingMinutes = Math.max(0, data?.remainingMinutes ?? 0);
          await sendLocalNotification(
            t('scheduled_late_warning_title'),
            t('scheduled_late_warning_body', {
              lateMinutes,
              remainingMinutes,
            }),
          );
        } catch (error) {
          console.error('Error handling scheduled late warning:', error);
        }
      };

      onScheduledLateWarning(handleScheduledLateWarning);

      const handleScheduledUpcomingOffersUpdate = (payload: any) => {
        try {
          const normalizedRaw = normalizeScheduledPendingOffers(payload?.pendingOffers) as any[];
          const normalized: ScheduledPendingOffer[] = normalizedRaw.filter(
            (offer) => offer && Number.isFinite(Number(offer.rideId)),
          );
          const previousIds = new Set(
            (pendingScheduledOffersRef.current || []).map(
              (offer: ScheduledPendingOffer) => offer.rideId,
            ),
          );
          const hasNewOffer = normalized.some((offer) => !previousIds.has(offer.rideId));

          setPendingScheduledOffers(normalized);

          if (hasNewOffer && settings.sound.rideOfferSound) {
            playScheduledOfferSoundTwice().catch((error) => {
              console.error('Error playing scheduled offer sound twice:', error);
            });
          }

          loadUpcomingRides().catch(() => {});
          loadRecentRides().catch(() => {});
        } catch (error) {
          console.error('Error handling scheduled upcoming offers update:', error);
        }
      };

      onScheduledUpcomingOffersUpdate(handleScheduledUpcomingOffersUpdate);

      // Listen for phase-2 open proposals (relaxed-preference modal)
      const handleRideProposal = async (data: any) => {
        devLog('Ride proposal received');
        try {
          await stopRideOfferSound();
          if (settings.sound.rideOfferSound) {
            await playProposalSound();
          }
        } catch (soundError) {
          console.error('Error while preparing proposal sound:', soundError);
        }

        const totalSeconds = Math.max(1, Math.ceil((data?.timeoutMs || 15000) / 1000));
        setProposalTotalSeconds(totalSeconds);
        rideProposalRef.current = data;
        setRideProposal(data);
        setProposalCountdown(totalSeconds);

        const timeout = setInterval(() => {
          setProposalCountdown((prev) => {
            if (prev <= 1) {
              rejectRide(data.rideId);
              rideProposalRef.current = null;
              setRideProposal(null);
              setProposalCountdown(0);
              stopRideOfferSound().then(() => {});
              clearInterval(timeout);
              proposalTimeoutRef.current = null;
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
        proposalTimeoutRef.current = timeout;
      };

      const clearProposal = async (rideId: number) => {
        if (rideProposalRef.current && rideProposalRef.current.rideId === rideId) {
          await stopRideOfferSound();
          rideProposalRef.current = null;
          setRideProposal(null);
          setProposalCountdown(0);
          if (proposalTimeoutRef.current) {
            clearInterval(proposalTimeoutRef.current);
            proposalTimeoutRef.current = null;
          }
        }
      };

      const handleRideProposalTimeout = (data: { rideId: number }) => clearProposal(data.rideId);
      const handleRideProposalRejected = (data: { rideId: number }) => clearProposal(data.rideId);
      const handleRideProposalCancelled = (data: { rideId: number }) => clearProposal(data.rideId);

      const handleOpenRidesUpdate = (data: any) => {
        setOpenRides(normalizeOpenRides(data?.openRides));
        loadUpcomingRides().catch(() => {});
      };

      onRideProposal(handleRideProposal);
      onRideProposalTimeout(handleRideProposalTimeout);
      onRideProposalRejected(handleRideProposalRejected);
      onRideProposalCancelled(handleRideProposalCancelled);
      onOpenRidesUpdate(handleOpenRidesUpdate);

      // Listen for "chain ride" offers (next ride after the current one finishes).
      const clearChainOffer = async (rideId: number) => {
        if (chainOfferRef.current && chainOfferRef.current.rideId === rideId) {
          await stopRideOfferSound();
          chainOfferRef.current = null;
          setChainOffer(null);
          setChainCountdown(0);
          if (chainTimeoutRef.current) {
            clearInterval(chainTimeoutRef.current);
            chainTimeoutRef.current = null;
          }
        }
      };

      const handleChainRideOffer = async (data: any) => {
        devLog('Chain ride offer received');
        try {
          await stopRideOfferSound();
          if (settings.sound.rideOfferSound) {
            await playProposalSound();
          }
        } catch (soundError) {
          console.error('Error while preparing chain offer sound:', soundError);
        }

        const totalSeconds = Math.max(1, Math.ceil((data?.timeoutMs || 15000) / 1000));
        setChainTotalSeconds(totalSeconds);
        chainOfferRef.current = data;
        setChainOffer(data);
        setChainCountdown(totalSeconds);

        const timeout = setInterval(() => {
          setChainCountdown((prev) => {
            if (prev <= 1) {
              rejectRide(data.rideId);
              chainOfferRef.current = null;
              setChainOffer(null);
              setChainCountdown(0);
              stopRideOfferSound().then(() => {});
              clearInterval(timeout);
              chainTimeoutRef.current = null;
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
        chainTimeoutRef.current = timeout;
      };

      const handleChainRideOfferTimeout = (data: { rideId: number }) =>
        clearChainOffer(data.rideId);
      const handleChainRideOfferRejected = (data: { rideId: number }) =>
        clearChainOffer(data.rideId);
      const handleChainRideOfferCancelled = (data: { rideId: number }) =>
        clearChainOffer(data.rideId);
      const handleChainAccepted = async (data: { rideId: number }) => {
        await clearChainOffer(data.rideId);
        await loadDriverStatus();
        loadUpcomingRides().catch(() => {});
      };
      const handleChainAcceptFailed = async (data: { rideId: number; reason?: string }) => {
        await clearChainOffer(data.rideId);
      };
      const handleChainRideCancelled = (data: { rideId: number }) => clearChainOffer(data.rideId);

      onChainRideOffer(handleChainRideOffer);
      onChainRideOfferTimeout(handleChainRideOfferTimeout);
      onChainRideOfferRejected(handleChainRideOfferRejected);
      onChainRideOfferCancelled(handleChainRideOfferCancelled);
      onChainAccepted(handleChainAccepted);
      onChainAcceptFailed(handleChainAcceptFailed);
      onChainRideCancelled(handleChainRideCancelled);

      // Periodic status check to ensure driver stays connected
      const statusCheckInterval = setInterval(() => {
        if (authState.token) {
          if (driverOnlineRef.current) {
            loadDriverStatus();
          }
          loadUpcomingRides();
          loadRecentRides();
        }
      }, 15000); // Check every 15 seconds

      return () => {
        stopLocationTracking();
        offDriverStatusUpdate();
        offRideOffer();
        offRideOfferTimeout();
        offRideOfferRejected();
        offScheduledOfferResult();
        offRideCancelled();
        offPickupProximity();
        offPickupCountdownExpired();
        offScheduledLateWarning();
        offScheduledUpcomingOffersUpdate();
        offRideProposal();
        offRideProposalTimeout();
        offRideProposalRejected();
        offRideProposalCancelled();
        offOpenRidesUpdate();
        offChainRideOffer();
        offChainRideOfferTimeout();
        offChainRideOfferRejected();
        offChainRideOfferCancelled();
        offChainAccepted();
        offChainAcceptFailed();
        offChainRideCancelled();
        if (offerTimeout) {
          clearInterval(offerTimeout);
        }
        if (proposalTimeoutRef.current) {
          clearInterval(proposalTimeoutRef.current);
          proposalTimeoutRef.current = null;
        }
        if (chainTimeoutRef.current) {
          clearInterval(chainTimeoutRef.current);
          chainTimeoutRef.current = null;
        }
        if (scheduledBannerTimeoutRef.current) {
          clearTimeout(scheduledBannerTimeoutRef.current);
          scheduledBannerTimeoutRef.current = null;
        }
        if (statusCheckInterval) {
          clearInterval(statusCheckInterval);
        }
        // Stop any playing sound when component unmounts
        stopRideOfferSound();
        stopLateWarningSound();
        stopBeepSound();
      };
    }
    return () => {
      stopLocationTracking();
    };
  }, [authState.token]);

  const preferencesCheckedRef = useRef(false);

  useEffect(() => {
    const token = authState.token;
    if (!token) {
      preferencesCheckedRef.current = false;
      return;
    }
    if (preferencesCheckedRef.current) return;

    const timer = setTimeout(async () => {
      preferencesCheckedRef.current = true;
      let isFreshShift = false;
      try {
        const status = await getDriverStatus(token);
        const shiftAge = status?.shiftStartTime
          ? (Date.now() - new Date(status.shiftStartTime).getTime()) / 1000
          : Infinity;
        isFreshShift = shiftAge <= FRESH_SHIFT_WINDOW_SECONDS;
      } catch {}

      if (!isFreshShift) return;

      try {
        const prefRes = await getRidePreferences(token);
        if (prefRes?.preferences) {
          setHasRidePreferences(true);
        }
      } catch {}

      // Show the preferences modal on a new shift regardless of whether saved
      // data exists, so the driver can confirm or update their preferences.
      setShowRidePreferences(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, [authState.token]);

  useEffect(() => {
    if (showRidePreferences && authState.token) {
      toggleDriverBusy(true, authState.token).catch(() => {});
    }
  }, [showRidePreferences]);

  // Handle app state changes (background/foreground)
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: string) => {
      if (nextAppState !== 'active' || !authState.token) {
        return;
      }

      try {
        await flushQueuedLocations();
        await loadDriverStatus();
        await loadUpcomingRides();
        await loadRecentRides();
      } catch (error) {
        console.error('Failed to refresh dashboard after app became active:', error);
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
      if (showMenu) {
        setShowMenu(false);
        return true;
      }
      if (showEndKMModal) {
        setShowEndKMModal(false);
        return true;
      }
      if (showCancelModal) {
        setShowCancelModal(false);
        return true;
      }
      if (showStatusExpanded) {
        setShowStatusExpanded(false);
        return true;
      }
      if (showShiftWarning) {
        setShowShiftWarning(false);
        return true;
      }

      Alert.alert(t('app_warning'), t('app_exit_warning'), [
        { text: t('app_exit_cancel'), style: 'cancel', onPress: () => null },
        { text: t('app_exit'), style: 'destructive', onPress: () => BackHandler.exitApp() },
      ]);
      return true;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);

    return () => backHandler?.remove();
  }, [t, showMenu, showEndKMModal, showCancelModal, showStatusExpanded, showShiftWarning]);

  // Monitor socket connection status
  useEffect(() => {
    let disposed = false;

    const checkSocketStatus = async () => {
      const socket = getSocket();
      const connected = Boolean(authState.token && socket?.connected);

      if (disposed) return;

      setIsSocketConnected(connected);

      if (!authState.token) {
        setNetworkMode('offline');
        return;
      }

      if (!connected) {
        setNetworkMode((previous) => (previous === 'syncing' ? 'syncing' : 'offline'));
        return;
      }

      try {
        const queued = await readQueuedLocations();
        if (disposed) return;

        setOfflineQueueCount(queued.length);

        if (queued.length > 0) {
          await flushQueuedLocations();
        } else {
          setNetworkMode('online');
        }
      } catch (error) {
        console.error('Error checking queued updates during socket monitor:', error);
      }
    };

    checkSocketStatus();
    const interval = setInterval(checkSocketStatus, 5000);

    return () => {
      disposed = true;
      clearInterval(interval);
    };
  }, [authState.token]);

  // Animate map to current location when it changes
  useEffect(() => {
    if (currentLocation && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        1000,
      );
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
            toggleDriverBusy(true, authState.token).then((res) => {
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

  // Fit map to show pickup, stop, and dropoff when ride modals are shown
  useEffect(() => {
    if ((showPickupModal || showDropoffModal || showStopModal) && activeRide && mapRef.current) {
      const stopCoordinate =
        activeRide?.stopLatLon &&
        typeof activeRide.stopLatLon.lat === 'number' &&
        typeof activeRide.stopLatLon.lon === 'number'
          ? { latitude: activeRide.stopLatLon.lat, longitude: activeRide.stopLatLon.lon }
          : null;
      let coordinates: { latitude: number; longitude: number }[] = [];
      if (showPickupModal) {
        coordinates = [
          { latitude: currentLocation?.latitude || 0, longitude: currentLocation?.longitude || 0 },
          { latitude: activeRide.startLatLon.lat, longitude: activeRide.startLatLon.lon },
        ];
      } else if (showStopModal) {
        if (stopCoordinate) {
          const originCoordinate = currentLocation
            ? { latitude: currentLocation.latitude, longitude: currentLocation.longitude }
            : { latitude: activeRide.startLatLon.lat, longitude: activeRide.startLatLon.lon };
          coordinates = [originCoordinate, stopCoordinate];
        } else {
          coordinates = [
            { latitude: activeRide.startLatLon.lat, longitude: activeRide.startLatLon.lon },
            { latitude: activeRide.endLatLon.lat, longitude: activeRide.endLatLon.lon },
          ];
        }
      } else {
        coordinates = [
          { latitude: activeRide.startLatLon.lat, longitude: activeRide.startLatLon.lon },
          ...(stopCoordinate ? [stopCoordinate] : []),
          { latitude: activeRide.endLatLon.lat, longitude: activeRide.endLatLon.lon },
        ];
      }
      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: { top: 50, right: 50, bottom: 200, left: 50 },
        animated: true,
      });
    }
  }, [showPickupModal, showDropoffModal, showStopModal, activeRide, currentLocation]);

  async function checkRidePreferencesBeforeOnline() {
    if (!authState.token) return true;
    try {
      const res = await getRidePreferences(authState.token);
      if (res?.preferences) {
        setHasRidePreferences(true);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  const loadDriverStatus = async (retryCount = 0) => {
    if (!authState.token) return;
    try {
      const res = await getDriverStatus(authState.token);
      const currentOnline = driverOnlineRef.current;
      const currentBusy = driverBusyRef.current;

      if (res.hasActiveShift && !preferencesCheckedRef.current) {
        preferencesCheckedRef.current = true;
        const shiftAge = res.shiftStartTime
          ? (Date.now() - new Date(res.shiftStartTime).getTime()) / 1000
          : Infinity;
        if (shiftAge <= FRESH_SHIFT_WINDOW_SECONDS) {
          try {
            const prefRes = await getRidePreferences(authState.token);
            if (prefRes?.preferences) {
              setHasRidePreferences(true);
            }
          } catch {}
          setShowRidePreferences(true);
        }
      }

      if (res.isOnline !== undefined && res.isOnline !== currentOnline) {
        driverOnlineRef.current = res.isOnline;
        setDriverOnline(res.isOnline);
        // Auto start tracking if became online
        if (res.isOnline && !currentOnline) {
          startLocationTracking();
        }
      }
      if (res.isBusy !== undefined && res.isBusy !== currentBusy) {
        driverBusyRef.current = res.isBusy;
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

      setRestrictedOffers(Boolean(res?.restrictedOffers));
      if (res?.restrictedOffersUntil) {
        setRestrictedOffersUntil(new Date(res.restrictedOffersUntil));
      } else {
        setRestrictedOffersUntil(null);
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
            toggleDriverBusy(true, authState.token).then((res) => {
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

      if (res.schedule) {
        setScheduleEligibility(res.schedule);
        setScheduleReasonMessage(res.schedule?.reasonMessage || '');
      }

      // Check for current active ride
      if (res.currentRideId && !activeRideRef.current) {
        const rideRes = await getRide(res.currentRideId.toString(), authState.token);
        if (rideRes.ok && rideRes.data) {
          const ride = rideRes.data;

          if (ride.status === 'DISPATCHED' || ride.status === 'ONGOING') {
            // Accepted, show pickup modal
            setActiveRide(ride);
            setShowPickupModal(true);
            setShowStopModal(false);
            setShowDropoffModal(false);
            sliderPositionRef.current = sliderWidth * 0.05;
            setSliderPosition(sliderWidth * 0.05); // Reset slider
            // Fetch directions from driver to pickup point (since not picked up yet)
            setTimeout(() => {
              if (currentLocation) {
                fetchDirections(
                  { lat: currentLocation.latitude, lng: currentLocation.longitude },
                  { lat: ride.startLatLon.lat, lng: ride.startLatLon.lon },
                );
              }
            }, 1000);

            // Check for existing pickup countdown in AsyncStorage
            try {
              const countdownData = await AsyncStorage.getItem(`pickupCountdown_${ride.id}`);
              if (countdownData) {
                const countdownPayload = JSON.parse(countdownData);
                if (countdownPayload?.expired) {
                  setShowCancelText(true);
                  setCancelCountdown(0);
                  setCountdownExpired(true);
                } else if (
                  typeof countdownPayload?.countdownStart === 'number' &&
                  typeof countdownPayload?.countdownDuration === 'number'
                ) {
                  const { countdownStart, countdownDuration } = countdownPayload;
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
                      setCancelCountdown(() => {
                        if (remainingInner <= 0) {
                          clearInterval(interval);
                          setShowCancelText(true);
                          setCountdownExpired(true);
                          AsyncStorage.setItem(
                            `pickupCountdown_${ride.id}`,
                            JSON.stringify({
                              ...countdownPayload,
                              expired: true,
                              expiredAt: Date.now(),
                            }),
                          ).catch(console.error);
                          return 0;
                        }
                        return remainingInner;
                      });
                    }, 1000);
                  } else {
                    // Countdown already expired - show cancel button immediately
                    devLog(`Countdown already expired for ride ${ride.id}, showing cancel button`);
                    setShowCancelText(true);
                    setCancelCountdown(0);
                    setCountdownExpired(true);
                    AsyncStorage.setItem(
                      `pickupCountdown_${ride.id}`,
                      JSON.stringify({
                        ...countdownPayload,
                        expired: true,
                        expiredAt: Date.now(),
                      }),
                    ).catch(console.error);
                  }
                }
              }
            } catch (error) {
              console.error('Error loading pickup countdown from AsyncStorage:', error);
            }
          } else if (ride.status === 'PICKED_UP') {
            // Picked up, show stop modal first if needed
            setActiveRide(ride);
            setShowPickupModal(false);
            const hasStop = !!ride.stopAddress;
            let stopCompleted = false;

            if (hasStop) {
              try {
                const storedStopCompleted = await AsyncStorage.getItem(`stopCompleted_${ride.id}`);
                stopCompleted = storedStopCompleted === 'true';
              } catch (error) {
                console.error('Error loading stop completion from AsyncStorage:', error);
              }
            }

            const stopWaypoint =
              ride?.stopLatLon &&
              typeof ride.stopLatLon.lat === 'number' &&
              typeof ride.stopLatLon.lon === 'number'
                ? { lat: ride.stopLatLon.lat, lng: ride.stopLatLon.lon }
                : null;

            if (hasStop && !stopCompleted) {
              setShowStopModal(true);
              setShowDropoffModal(false);
              setTimeout(() => {
                if (stopWaypoint) {
                  fetchDirections(
                    { lat: ride.startLatLon.lat, lng: ride.startLatLon.lon },
                    { lat: stopWaypoint.lat, lng: stopWaypoint.lng },
                  );
                } else {
                  fetchDirections(
                    { lat: ride.startLatLon.lat, lng: ride.startLatLon.lon },
                    { lat: ride.endLatLon.lat, lng: ride.endLatLon.lon },
                    stopWaypoint,
                  );
                }
              }, 1000);
            } else {
              setShowStopModal(false);
              setShowDropoffModal(true);
              setTimeout(() => {
                if (stopWaypoint && hasStop && stopCompleted) {
                  fetchDirections(
                    { lat: stopWaypoint.lat, lng: stopWaypoint.lng },
                    { lat: ride.endLatLon.lat, lng: ride.endLatLon.lon },
                  );
                } else {
                  fetchDirections(
                    { lat: ride.startLatLon.lat, lng: ride.startLatLon.lon },
                    { lat: ride.endLatLon.lat, lng: ride.endLatLon.lon },
                    stopWaypoint,
                  );
                }
              }, 1000);
            }
          }
        }
      } else if (!res.currentRideId) {
        // Clear any existing ride displays
        setActiveRide(null);
        setShowPickupModal(false);
        setShowStopModal(false);
        setShowDropoffModal(false);
        setShowCancelText(false);
        setCancelCountdown(0);
        setPickupCountdownStart(null);
        setCountdownExpired(false);
        // Clean up any remaining countdown data
        try {
          const keys = await AsyncStorage.getAllKeys();
          const countdownKeys = keys.filter((key) => key.startsWith('pickupCountdown_'));
          const stopKeys = keys.filter((key) => key.startsWith('stopCompleted_'));
          await AsyncStorage.multiRemove([...countdownKeys, ...stopKeys]);
        } catch (error) {
          console.error('Error cleaning up countdown data:', error);
        }
      }
    } catch (e: any) {
      console.error('Error loading driver status:', e);
      if (e?.status === 429 || e?.message?.includes('429')) {
        const retryAfterSec = Number(e?.retryAfter) || 30;
        devLog(`Rate limited (429), retrying in ${retryAfterSec}s`);
        setTimeout(() => loadDriverStatus(0), Math.min(retryAfterSec * 1000, 60000));
        return;
      }
      if (retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 1000;
        devLog(`Retrying driver status load in ${delay}ms (attempt ${retryCount + 1}/3)`);
        setTimeout(() => loadDriverStatus(retryCount + 1), delay);
      }
    }
  };

  const stopLateWarningSound = async () => {
    const currentSound = lateWarningSoundRef.current || lateWarningSound;
    if (!currentSound) return;
    await safelyUnloadSound(currentSound, 'late warning sound');
    if (lateWarningSoundRef.current === currentSound) {
      lateWarningSoundRef.current = null;
    }
    setLateWarningSound(null);
  };

  const loadUpcomingRides = async (retryCount = 0) => {
    if (!authState.token) {
      return;
    }
    try {
      const response = await getDriverUpcoming(authState.token);
      if (response.ok && response.rides) {
        setUpcomingRides(response.rides);
      } else {
        setUpcomingRides([]);
      }

      setOpenRides(normalizeOpenRides(response?.openRides));

      const normalizedRaw = normalizeScheduledPendingOffers(response?.pendingOffers) as any[];
      const normalizedPending: ScheduledPendingOffer[] = normalizedRaw.filter(
        (offer) => offer && Number.isFinite(Number(offer.rideId)),
      );
      setPendingScheduledOffers(normalizedPending);
    } catch (error) {
      console.error('Error loading upcoming rides:', error);
      if (retryCount < 2) {
        const delay = Math.pow(2, retryCount) * 1000;
        setTimeout(() => loadUpcomingRides(retryCount + 1), delay);
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
              const timestamp = new Date(now).toISOString();
              try {
                await updateDriverLocation(
                  newLocation.latitude,
                  newLocation.longitude,
                  authState.token,
                  timestamp,
                );
                setLastLocationUpdate(now);

                if (networkModeRef.current !== 'online') {
                  if (offlineQueueCount > 0) {
                    flushQueuedLocations();
                  } else {
                    setNetworkMode('online');
                    networkModeRef.current = 'online';
                  }
                }
              } catch (error) {
                console.error('Failed to update location on server:', error);
                await enqueueLocationForSync(newLocation, timestamp);
                setLastLocationUpdate(now);
                setNetworkMode('offline');
                networkModeRef.current = 'offline';
              }
            }
          },
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
          devLog('Background location tracking stopped');
        } else {
          devLog('Background location tracking already stopped');
        }
      } catch (error: any) {
        // Check if the error is because the task was not found (never started or already stopped)
        if (
          error.message &&
          (error.message.includes('TaskNotFoundException') || error.message.includes('not found'))
        ) {
          devLog('Background location task not found while stopping');
        } else {
          console.error('Failed to stop background location tracking:', error);
        }
      }
    }

    setIsTracking(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadDriverStatus();
      await loadUpcomingRides();
      await loadRecentRides();
    } catch {}
    setRefreshing(false);
  };

  const handleEndShift = async () => {
    if (!endKM || isNaN(Number(endKM))) {
      alert(t('shift_end_km_invalid'));
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
        alert(
          t('end_shift_success_message', {
            workTime: data.shiftData.workTime.toFixed(2),
            totalSalary: data.shiftData.totalSalary,
            hourSalary: data.shiftData.hourSalary.toFixed(2),
          }),
        );

        // Logout after ending shift
        await logout();
        router.push('/login');
      } catch (error) {
        console.error('Error ending shift:', error);
        alert(t('end_shift_error_message', { message: (error as any).message }));
      }
    }
  };

  const handleToggleOnline = async () => {
    if (!authState.token) return;
    try {
      if (!driverOnline) {
        const hasPreferences = await checkRidePreferencesBeforeOnline();
        if (!hasPreferences) {
          setShowRidePreferences(true);
          return;
        }
      }
      const res = await toggleDriverOnline(!driverOnline, authState.token);
      if (res.success) {
        setDriverOnline(!driverOnline);
        if (!driverOnline) {
          await toggleDriverBusy(false, authState.token);
          setDriverBusy(false);
        }
        if (res.schedule) {
          setScheduleEligibility(res.schedule);
          setScheduleReasonMessage(res.schedule?.reasonMessage || '');
        }
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
      Alert.alert(
        t('schedule_locked_title') as any,
        (e as any)?.message || t('schedule_locked_default'),
      );
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

  const handleNav = (origin: string, destination: string, waypoint?: string | null) => {
    const waypointParam = waypoint ? `&waypoints=${encodeURIComponent(waypoint)}` : '';
    const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}${waypointParam}&travelmode=driving`;
    Linking.openURL(url);
  };

  const handlePickupConfirm = async () => {
    const rideId = activeRide?.id || currentRideId;
    if (!rideId) {
      return;
    }
    const hasStop = !!activeRide?.stopAddress;
    // Play pickup beep sound if enabled
    if (settings.sound.pickupDropoffSound) {
      playPickupBeep();
    }
    setIsPickupLoading(true);
    // Update ride status locally for immediate UI update
    setActiveRide((prev: any) => (prev ? { ...prev, status: 'PICKED_UP' } : null));
    setShowPickupModal(false);
    if (hasStop) {
      setShowStopModal(true);
      setShowDropoffModal(false);
    } else {
      setShowStopModal(false);
      setShowDropoffModal(true);
    }
    // Clear cancel countdown
    setShowCancelText(false);
    setCancelCountdown(0);
    setPickupCountdownStart(null);
    setCountdownExpired(false);
    // Clean up AsyncStorage
    try {
      await AsyncStorage.removeItem(`pickupCountdown_${rideId}`);
    } catch (error) {
      console.error('Error removing pickup countdown from AsyncStorage:', error);
    }
    try {
      await AsyncStorage.removeItem(`stopCompleted_${rideId}`);
    } catch (error) {
      console.error('Error removing stop completion from AsyncStorage:', error);
    }
    // Clear previous route and fetch new route from pickup to dropoff
    setRouteCoordinates([]);
    const stopWaypoint =
      activeRide?.stopLatLon &&
      typeof activeRide.stopLatLon.lat === 'number' &&
      typeof activeRide.stopLatLon.lon === 'number'
        ? { lat: activeRide.stopLatLon.lat, lng: activeRide.stopLatLon.lon }
        : null;
    if (hasStop && stopWaypoint) {
      fetchDirections(
        { lat: activeRide.startLatLon.lat, lng: activeRide.startLatLon.lon },
        { lat: stopWaypoint.lat, lng: stopWaypoint.lng },
      );
    } else {
      fetchDirections(
        { lat: activeRide.startLatLon.lat, lng: activeRide.startLatLon.lon },
        { lat: activeRide.endLatLon.lat, lng: activeRide.endLatLon.lon },
        stopWaypoint,
      );
    }
    try {
      // Update ride status to PICKED_UP and set pickedAt timestamp
      const res = await api.put(
        `/api/driver/rides/${rideId}/status`,
        {
          status: 'PICKED_UP',
          pickedAt: new Date().toISOString(),
        },
        authState.token!,
      );
      if (!res.ok) {
        // If API fails, revert the local changes
        setActiveRide((prev: any) => (prev ? { ...prev, status: 'DISPATCHED' } : null));
        setShowPickupModal(true);
        setShowStopModal(false);
        setShowDropoffModal(false);
        setRouteCoordinates([]);
        alert(t('ride_status_update_failed'));
      }
    } catch (e) {
      console.error('Error picking up ride:', e);
      // Revert on error
      setActiveRide((prev: any) => (prev ? { ...prev, status: 'DISPATCHED' } : null));
      setShowPickupModal(true);
      setShowStopModal(false);
      setShowDropoffModal(false);
      setRouteCoordinates([]);
      alert(t('ride_pickup_error'));
    } finally {
      setIsPickupLoading(false);
    }
  };

  const handleContinueTrip = async () => {
    const rideId = activeRide?.id;
    if (!rideId) return;
    setIsContinueLoading(true);
    try {
      await AsyncStorage.setItem(`stopCompleted_${rideId}`, 'true');
      setShowPickupModal(false);
      setShowStopModal(false);
      setShowDropoffModal(true);
      setRouteCoordinates([]);
      const stopWaypoint =
        activeRide?.stopLatLon &&
        typeof activeRide.stopLatLon.lat === 'number' &&
        typeof activeRide.stopLatLon.lon === 'number'
          ? { lat: activeRide.stopLatLon.lat, lng: activeRide.stopLatLon.lon }
          : null;
      if (stopWaypoint) {
        await fetchDirections(
          { lat: stopWaypoint.lat, lng: stopWaypoint.lng },
          { lat: activeRide.endLatLon.lat, lng: activeRide.endLatLon.lon },
        );
      } else {
        await fetchDirections(
          { lat: activeRide.startLatLon.lat, lng: activeRide.startLatLon.lon },
          { lat: activeRide.endLatLon.lat, lng: activeRide.endLatLon.lon },
          stopWaypoint,
        );
      }
    } catch (error) {
      console.error('Error continuing trip:', error);
    } finally {
      setIsContinueLoading(false);
    }
  };

  const handleDropoffConfirm = async (meterPrice?: number) => {
    const rideId = activeRide?.id;
    if (!rideId) return;
    setShowStopModal(false);
    // Play dropoff beep sound if enabled
    if (settings.sound.pickupDropoffSound) {
      playDropoffBeep();
    }
    setIsDropoffLoading(true);
    try {
      const body: any = {
        status: 'COMPLETED',
        droppedAt: new Date().toISOString(),
      };
      if (meterPrice !== undefined && meterPrice > 0) {
        body.meterPrice = meterPrice;
      }
      const res = await api.put(`/api/driver/rides/${rideId}/status`, body, authState.token!);
      if (res.ok) {
        setShowDropoffModal(false);
        setActiveRide(null);
        setCurrentRideId(null);
        setRouteCoordinates([]);
        try {
          await AsyncStorage.removeItem(`stopCompleted_${rideId}`);
        } catch (error) {
          console.error('Error removing stop completion from AsyncStorage:', error);
        }
        // Reload driver status to update busy state after ride completion
        await loadDriverStatus();
        // Animate map back to driver's current location
        if (currentLocation && mapRef.current) {
          mapRef.current.animateToRegion(
            {
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            },
            1000,
          );
        }
        if (res.paymentResult && !res.paymentResult.success) {
          alert(t('ride_completed_payment_failed', { error: res.paymentResult.error }));
        } else {
          alert(t('ride_completed_success'));
        }
      } else {
        alert(t('ride_complete_failed'));
      }
    } catch (e) {
      console.error('Error completing ride:', e);
      alert(t('ride_complete_error'));
    } finally {
      setIsDropoffLoading(false);
    }
  };

  const handleCancelRide = async (reason: string) => {
    const rideId = activeRide?.id;
    if (!rideId) return;

    setCancelStep('loading');

    try {
      const res = await api.put(
        `/api/driver/rides/${rideId}/cancel`,
        {
          reason: reason,
          canceledBy: 'driver',
          cancelType: cancelMode,
        },
        authState.token!,
      );

      if (res.ok) {
        setCancelStep('success');
        // Wait a bit then close and reset
        setTimeout(async () => {
          setShowCancelModal(false);
          setCancelStep('reason');
          setSelectedCancelReason(null);
          setShowPickupModal(false);
          setShowStopModal(false);
          setShowDropoffModal(false);
          setActiveRide(null);
          setCurrentRideId(null);
          setRouteCoordinates([]);
          setShowCancelText(false);
          setCancelCountdown(0);
          setPickupCountdownStart(null);
          setCountdownExpired(false);

          // Clean up AsyncStorage
          try {
            await AsyncStorage.removeItem(`pickupCountdown_${rideId}`);
          } catch (error) {
            console.error('Error removing pickup countdown from AsyncStorage:', error);
          }
          try {
            await AsyncStorage.removeItem(`stopCompleted_${rideId}`);
          } catch (error) {
            console.error('Error removing stop completion from AsyncStorage:', error);
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
    const mode = countdownExpired ? 'late' : 'early';
    setCancelMode(mode);

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

  const fetchDirections = async (
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
    waypoint?: { lat: number; lng: number } | null,
  ) => {
    try {
      const googleMapsApiKey = getGoogleMapsApiKey();
      if (!googleMapsApiKey) {
        devLog('Google Maps API key unavailable for fetchDirections in DriverApp dashboard');
        const fallbackCoordinates = [
          { latitude: origin.lat, longitude: origin.lng },
          ...(waypoint ? [{ latitude: waypoint.lat, longitude: waypoint.lng }] : []),
          { latitude: destination.lat, longitude: destination.lng },
        ];
        setRouteCoordinates(fallbackCoordinates);
        return;
      }
      const waypointParam = waypoint ? `&waypoints=${waypoint.lat},${waypoint.lng}` : '';
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}${waypointParam}&mode=driving&key=${encodeURIComponent(googleMapsApiKey)}`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.routes && data.routes.length > 0) {
        const points = data.routes[0].overview_polyline.points;
        // Decode polyline
        const coordinates = decodePolyline(points);
        setRouteCoordinates(coordinates);
      } else {
        const fallbackCoordinates = [
          { latitude: origin.lat, longitude: origin.lng },
          ...(waypoint ? [{ latitude: waypoint.lat, longitude: waypoint.lng }] : []),
          { latitude: destination.lat, longitude: destination.lng },
        ];
        setRouteCoordinates(fallbackCoordinates);
      }
    } catch (error) {
      console.error('Error fetching directions:', error);
      // Fallback to straight line
      const fallbackCoordinates = [
        { latitude: origin.lat, longitude: origin.lng },
        ...(waypoint ? [{ latitude: waypoint.lat, longitude: waypoint.lng }] : []),
        { latitude: destination.lat, longitude: destination.lng },
      ];
      setRouteCoordinates(fallbackCoordinates);
    }
  };

  const decodePolyline = (encoded: string) => {
    const poly = [];
    let index = 0,
      len = encoded.length;
    let lat = 0,
      lng = 0;

    while (index < len) {
      let b,
        shift = 0,
        result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlat = result & 1 ? ~(result >> 1) : result >> 1;
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlng = result & 1 ? ~(result >> 1) : result >> 1;
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
      if (!loop && beepSoundRef.current) {
        await stopBeepSound();
      }

      const sound = await runWithAudioFocusRetry(async () => {
        const { sound } = await Audio.Sound.createAsync(soundFile, {
          isLooping: loop,
          volume: Math.max(0, Math.min(1, settings?.sound?.volume ?? 1)),
        });
        try {
          await sound.playAsync();
          return sound;
        } catch (error) {
          await safelyUnloadSound(sound, 'beep sound after failed playAsync');
          throw error;
        }
      }, 'playing beep sound');

      if (!loop) {
        beepSoundRef.current = sound;
        // Unload the sound after playback to free resources
        sound.setOnPlaybackStatusUpdate((status: any) => {
          if (status.didJustFinish) {
            if (beepSoundRef.current === sound) {
              beepSoundRef.current = null;
            }
            sound.unloadAsync().catch(() => null);
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
    try {
      await stopRideOfferSound();
      const sound = await runWithAudioFocusRetry(async () => {
        const { sound } = await Audio.Sound.createAsync(
          require('../assets/music/rideGetting.mp3'),
          {
            isLooping: true,
            volume: Math.max(0, Math.min(1, settings?.sound?.volume ?? 1)),
          },
        );
        try {
          await sound.playAsync();
          return sound;
        } catch (error) {
          await safelyUnloadSound(sound, 'ride offer sound after failed playAsync');
          throw error;
        }
      }, 'playing ride offer sound');

      setRideOfferSoundSafe(sound);
    } catch (error) {
      console.error('Error playing ride offer sound:', error);
    }
  };

  // Distinct sound for scheduled rides (plays once, unlike the looping normal offer).
  const playScheduledOfferSoundOnce = async () => {
    try {
      await stopRideOfferSound();
      const sound = await runWithAudioFocusRetry(async () => {
        const { sound } = await Audio.Sound.createAsync(require('../assets/music/AcceptRide.mp3'), {
          isLooping: false,
          volume: Math.max(0, Math.min(1, settings?.sound?.volume ?? 1)),
        });
        try {
          await sound.playAsync();
          return sound;
        } catch (error) {
          await safelyUnloadSound(sound, 'scheduled offer sound after failed playAsync');
          throw error;
        }
      }, 'playing scheduled offer sound');

      setRideOfferSoundSafe(sound);
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.didJustFinish) {
          if (rideOfferSoundRef.current === sound) {
            rideOfferSoundRef.current = null;
            setRideOfferSound(null);
          }
          sound.unloadAsync().catch(() => null);
        }
      });
    } catch (error) {
      console.error('Error playing scheduled offer sound:', error);
    }
  };

  const playScheduledOfferSoundTwice = async () => {
    await playScheduledOfferSoundOnce();
    setTimeout(() => {
      playScheduledOfferSoundOnce().catch((error) => {
        console.error('Error replaying scheduled offer sound:', error);
      });
    }, 900);
  };

  // Distinct message sound for the relaxed-preference proposal modal.
  const playProposalSound = async () => {
    try {
      await stopRideOfferSound();
      const sound = await runWithAudioFocusRetry(async () => {
        const { sound } = await Audio.Sound.createAsync(
          require('../assets/music/icq_message.mp3'),
          {
            isLooping: true,
            volume: Math.max(0, Math.min(1, settings?.sound?.volume ?? 1)),
          },
        );
        try {
          await sound.playAsync();
          return sound;
        } catch (error) {
          await safelyUnloadSound(sound, 'proposal sound after failed playAsync');
          throw error;
        }
      }, 'playing proposal sound');

      setRideOfferSoundSafe(sound);
    } catch (error) {
      console.error('Error playing proposal sound:', error);
    }
  };

  const stopRideOfferSound = async () => {
    const currentSound = rideOfferSoundRef.current || rideOfferSound;
    devLog('Stopping ride offer sound');
    if (currentSound) {
      await safelyUnloadSound(currentSound, 'ride offer sound');
      if (rideOfferSoundRef.current === currentSound) {
        rideOfferSoundRef.current = null;
      }
      setRideOfferSound(null);
      devLog('Ride offer sound unloaded');
    } else {
      devLog('No ride offer sound object to stop');
    }
  };

  const playLateWarningSoundOnce = async () => {
    try {
      await stopLateWarningSound();
      const sound = await runWithAudioFocusRetry(async () => {
        const { sound } = await Audio.Sound.createAsync(require('../assets/lateNoti.mp3'), {
          isLooping: false,
          volume: Math.max(0, Math.min(1, settings?.sound?.volume ?? 1)),
        });
        try {
          await sound.playAsync();
          return sound;
        } catch (error) {
          await safelyUnloadSound(sound, 'late warning sound after failed playAsync');
          throw error;
        }
      }, 'playing late warning sound');

      setLateWarningSoundSafe(sound);
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.didJustFinish) {
          if (lateWarningSoundRef.current === sound) {
            lateWarningSoundRef.current = null;
            setLateWarningSound(null);
          }
          sound.unloadAsync().catch(() => null);
        }
      });
    } catch (error) {
      console.error('Error playing late warning sound:', error);
    }
  };

  const goToSettings = () => {
    router.push('/settings');
  };

  const goToSchedule = () => {
    router.push('/schedule');
  };

  const goToProfile = () => {
    router.push('/profile');
  };

  const getStatusText = () => {
    if (bannedUntil && banCountdown > 0)
      return `${t('banned')} - ${banCountdown}${t('seconds_short')}`;
    if (!driverOnline) return t('offline');
    if (driverBusy) return `${t('online')} - ${t('busy')}`;
    return `${t('online')} - ${t('available')}`;
  };

  useEffect(() => {
    if (!authState.token) return;
    const syncSchedule = async () => {
      try {
        const response = await getDriverSchedule(authState.token!);
        if (response?.ok) {
          setScheduleEligibility(response?.eligibility || null);
          setScheduleReasonMessage(response?.eligibility?.reasonMessage || '');
        }
      } catch (error) {
        console.error('Error loading schedule snapshot on dashboard:', error);
      }
    };
    syncSchedule();
  }, [authState.token]);

  const getStatusColor = () => {
    if (bannedUntil && banCountdown > 0) return '#dc3545'; // red
    if (!driverOnline) return '#dc3545'; // red
    if (driverBusy) return '#ffc107'; // yellow
    return '#28a745'; // green
  };

  const calculateEtaMinutes = (
    from: { latitude: number; longitude: number },
    to: { lat: number; lon: number },
  ) => {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const R = 6371; // km
    const dLat = toRad(to.lat - from.latitude);
    const dLon = toRad(to.lon - from.longitude);
    const lat1 = toRad(from.latitude);
    const lat2 = toRad(to.lat);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceKm = R * c;
    return Math.max(1, Math.ceil(distanceKm * 2)); // ~30km/h average
  };

  const formatMinutesHuman = (minutes: number): string => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}min`;
  };

  const estimateDurationMinFromKm = (km: number): number => {
    const d = Number(km);
    if (!Number.isFinite(d) || d <= 0) return 1;
    let speedKmh = 30;
    if (d >= 5) speedKmh = 40;
    if (d >= 15) speedKmh = 50;
    if (d >= 40) speedKmh = 58;
    return Math.max(1, Math.ceil((d / speedKmh) * 60));
  };

  useEffect(() => {
    if (!nextScheduledRide) {
      setScheduledEtaMinutes(null);
      return;
    }

    const updateScheduledEta = () => {
      const ride = nextScheduledRideRef.current;
      const location = latestLocationRef.current;
      if (!ride || !location || !ride.startLatLon) {
        setScheduledEtaMinutes(null);
        return;
      }
      const { lat, lon } = ride.startLatLon || {};
      if (typeof lat !== 'number' || typeof lon !== 'number') {
        setScheduledEtaMinutes(null);
        return;
      }
      setScheduledEtaMinutes(calculateEtaMinutes(location, { lat, lon }));
    };

    updateScheduledEta();
    const interval = setInterval(updateScheduledEta, 30000);
    return () => clearInterval(interval);
  }, [nextScheduledRide?.id]);

  const scheduledDepartureTime = useMemo(() => {
    if (!nextScheduledRide?.pickupTime || scheduledEtaMinutes === null) return null;
    const pickupMs = new Date(nextScheduledRide.pickupTime).getTime();
    if (Number.isNaN(pickupMs)) return null;
    const departMs = pickupMs - scheduledEtaMinutes * 60 * 1000;
    if (Number.isNaN(departMs)) return null;
    return new Date(departMs).toLocaleTimeString(getCurrentLocale(), {
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [nextScheduledRide?.pickupTime, scheduledEtaMinutes, getCurrentLanguage]);

  const getPickupEtaMinutes = () => {
    if (!currentLocation || !rideOffer?.rideData?.startLatLon) return null;
    const { lat, lon } = rideOffer.rideData.startLatLon || {};
    if (typeof lat !== 'number' || typeof lon !== 'number') return null;
    return calculateEtaMinutes(currentLocation, { lat, lon });
  };

  const liveRidePreview = useMemo(() => {
    if (activeRide?.id) {
      return {
        id: Number(activeRide.id),
        status: String(activeRide.status || 'ACTIVE'),
      };
    }

    if (rideOffer?.rideId) {
      return {
        id: Number(rideOffer.rideId),
        status: 'OFFER',
      };
    }

    return null;
  }, [activeRide?.id, activeRide?.status, rideOffer?.rideId]);

  useEffect(() => {
    if (liveRidePreview) {
      setLastCachedRidePreview(liveRidePreview);
    }
  }, [liveRidePreview]);

  const pickupEtaMinutes = getPickupEtaMinutes();
  const rideEtaMinutes = (rideOffer?.rideData as any)?.durationMin
    ? Math.max(1, Math.ceil((rideOffer?.rideData as any)?.durationMin || 0))
    : rideOffer?.rideData?.distanceKm
      ? estimateDurationMinFromKm(rideOffer.rideData.distanceKm)
      : null;
  const scheduledCountdownText = formatCountdown(scheduledCountdownSeconds);
  const scheduledDepartureText = scheduledDepartureTime || t('not_available');
  const showScheduledInfoBar = !!nextScheduledRide;
  const scheduledCountdownMinutes = showScheduledInfoBar
    ? Math.max(0, Math.ceil(scheduledCountdownSeconds / 60))
    : null;
  const pendingScheduledCount = pendingScheduledOffers.length;
  const openRidesCount = openRides.length;
  const menuBadgeCount = pendingScheduledCount + openRidesCount;
  const nextPendingScheduledOffer = pendingScheduledOffers.length
    ? pendingScheduledOffers[0]
    : null;
  const pendingUrgencyColor = nextPendingScheduledOffer
    ? getScheduledUrgencyColor(
        getPendingOfferRemainingMs(nextPendingScheduledOffer, scheduledNow),
        getPendingOfferTimeoutMs(nextPendingScheduledOffer),
      )
    : '#3b82f6';
  const menuBadgeColor = openRidesCount > 0 ? '#0d9488' : pendingUrgencyColor;
  const isScheduledOffer = !!(
    rideOffer?.scheduled ||
    rideOffer?.offerType === 'scheduled' ||
    rideOffer?.type === 'scheduled'
  );
  const scheduledOfferTime = isScheduledOffer
    ? formatScheduledDateTime(rideOffer?.rideData?.pickupTime || rideOffer?.pickupTime)
    : null;
  const scheduledBannerTime = scheduledBanner?.pickupTime
    ? formatScheduledDateTime(scheduledBanner.pickupTime)
    : null;
  const scheduledBannerAccent =
    scheduledBanner?.selected === true
      ? '#22c55e'
      : scheduledBanner?.selected === false
        ? '#dc3545'
        : isDarkMode
          ? 'rgba(255,255,255,0.12)'
          : '#e2e8f0';
  const offerProgress =
    offerTotalSeconds > 0 ? Math.max(0, Math.min(1, offerCountdown / offerTotalSeconds)) : 0;

  const smartAlerts = useMemo<SmartAlert[]>(
    () =>
      buildSmartAlerts({
        networkMode,
        offlineQueueCount,
        nextScheduledRideCountdownMinutes: scheduledCountdownMinutes,
        scheduledEtaMinutes,
        restrictedOffers,
      }),
    [
      networkMode,
      offlineQueueCount,
      scheduledCountdownMinutes,
      scheduledEtaMinutes,
      restrictedOffers,
    ],
  );

  const floatingBottoms = useMemo(() => {
    const hasSearching = driverOnline && !driverBusy && !activeRide && !restrictedOffers;
    const hasScheduleHint =
      (!driverOnline && scheduleEligibility?.eligible === false && !!scheduleReasonMessage) ||
      (driverOnline && restrictedOffers);
    const hasSmartAlerts = driverOnline && !activeRide && smartAlerts.length > 0;

    const SEARCHING_H = 90;
    const SCHEDULE_HINT_H = 52;
    const SMART_ALERTS_H = 24 + Math.min(smartAlerts.length, 3) * 54 + 6;

    let currentBottom = 20;
    const searchingBottom = hasSearching ? currentBottom : null;
    if (hasSearching) currentBottom += SEARCHING_H + 8;

    const scheduleHintBottom = hasScheduleHint ? currentBottom : null;
    if (hasScheduleHint) currentBottom += SCHEDULE_HINT_H + 6;

    const smartAlertsBottom = hasSmartAlerts ? currentBottom : null;

    return { searchingBottom, scheduleHintBottom, smartAlertsBottom };
  }, [
    driverOnline,
    driverBusy,
    activeRide,
    restrictedOffers,
    smartAlerts.length,
    scheduleEligibility,
    scheduleReasonMessage,
  ]);

  useEffect(() => {
    if (!authState.token) return;

    const snapshot: DashboardSnapshot = {
      timestamp: Date.now(),
      driverOnline,
      driverBusy,
      upcomingRides: upcomingRides.slice(0, 20),
      pendingScheduledOffers: pendingScheduledOffers.slice(0, 20),
      currentLocation,
      totalRidesToday,
      earningsToday,
      lastRidePreview: liveRidePreview || lastCachedRidePreview,
    };

    (async () => {
      const encryptedSnapshot = await encryptString(JSON.stringify(snapshot));
      AsyncStorage.setItem(DASHBOARD_SNAPSHOT_KEY, encryptedSnapshot).catch((error) => {
        console.error('Error caching dashboard snapshot:', error);
      });
    })();
  }, [
    authState.token,
    driverOnline,
    driverBusy,
    upcomingRides,
    pendingScheduledOffers,
    currentLocation,
    totalRidesToday,
    earningsToday,
    liveRidePreview,
    lastCachedRidePreview,
  ]);

  const styles = getStyles(isDarkMode, isRTL, isScheduledOffer);

  return (
    <View style={styles.container}>
      {/* New Status Bar */}
      <StatusBar
        status={getDriverStatusType()}
        shiftElapsedTime={shiftElapsedTime}
        isSocketConnected={isSocketConnected}
        banCountdown={banCountdown}
        onPress={() => setShowStatusExpanded(true)}
      />

      {showScheduledInfoBar && (
        <View style={styles.scheduledInfoBar} pointerEvents="none">
          <View style={styles.scheduledInfoColumn}>
            <Text
              style={[styles.scheduledInfoText, styles.scheduledInfoTextLeft]}
              numberOfLines={1}
            >
              {t('scheduled_countdown_label')}: {scheduledCountdownText}
            </Text>
          </View>
          <View style={styles.scheduledInfoColumn}>
            <Text
              style={[styles.scheduledInfoText, styles.scheduledInfoTextRight]}
              numberOfLines={1}
            >
              {t('driver_departure_time_label')}: {scheduledDepartureText}
            </Text>
          </View>
        </View>
      )}

      {scheduledBanner && (
        <View
          style={[
            styles.scheduledBannerContainer,
            showScheduledInfoBar && styles.scheduledBannerContainerWithInfoBar,
          ]}
          pointerEvents="none"
        >
          <View style={[styles.scheduledBannerCard, { borderColor: scheduledBannerAccent }]}>
            <Text style={styles.scheduledBannerTitle}>{t('scheduled_ride_title')}</Text>
            <Text style={styles.scheduledBannerMessage}>
              {scheduledBanner.message ||
                (scheduledBanner.selected
                  ? t('scheduled_ride_selected')
                  : t('scheduled_ride_not_selected'))}
            </Text>
            {scheduledBannerTime && (
              <Text style={styles.scheduledBannerTime}>{scheduledBannerTime}</Text>
            )}
          </View>
        </View>
      )}

      <HamburgerMenu
        showMenu={showMenu}
        menuMounted={menuMounted}
        menuAnim={menuAnim}
        isRTL={isRTL}
        activeRide={!!activeRide}
        driverOnline={driverOnline}
        driverBusy={driverBusy}
        bannedUntil={bannedUntil}
        pendingScheduledCount={menuBadgeCount}
        pendingUrgencyColor={menuBadgeColor}
        onToggle={() => setShowMenu(!showMenu)}
        onClose={() => setShowMenu(false)}
        onProfile={() => {
          setShowMenu(false);
          goToProfile();
        }}
        onHistory={() => {
          setShowMenu(false);
          router.push('/history');
        }}
        onShifts={() => {
          setShowMenu(false);
          router.push('/shifts');
        }}
        onUpcoming={() => {
          setShowMenu(false);
          router.push('/upcoming');
        }}
        onAnalytics={() => {
          setShowMenu(false);
          router.push('/analytics');
        }}
        onSettings={() => {
          setShowMenu(false);
          goToSettings();
        }}
        onSchedule={() => {
          setShowMenu(false);
          goToSchedule();
        }}
        onRidePreferences={() => {
          setShowMenu(false);
          setShowRidePreferences(true);
        }}
        onToggleBusy={() => {
          setShowMenu(false);
          handleToggleBusy();
        }}
        onEndShift={() => {
          setShowMenu(false);
          setShowEndKMModal(true);
        }}
      />

      {isInitialLoading ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingOverlayText}>{t('loading')}</Text>
        </View>
      ) : (
        <>
          {/* ── Main Content (below status bar) ── */}
          <ScrollView
            style={styles.mainContent}
            contentContainerStyle={{ paddingBottom: 120 }}
            showsVerticalScrollIndicator={false}
          >
            {/* ── Open-to-all rides (no driver found) ── */}
            {openRides.length > 0 && (
              <View style={styles.openRidesCard}>
                <View style={styles.openRidesHeader}>
                  <Text style={styles.openRidesIcon}>🚕</Text>
                  <Text style={styles.openRidesTitle}>{t('open_rides_title')}</Text>
                </View>
                {openRides.map((ride) => (
                  <View key={ride.id} style={styles.openRideItem}>
                    <View style={styles.openRideInfo}>
                      <Text style={styles.openRideId}>#{ride.id}</Text>
                      <Text style={styles.openRideRoute} numberOfLines={1}>
                        {ride.pickupAddress}
                      </Text>
                      <Text style={styles.openRideRoute} numberOfLines={1}>
                        {ride.dropoffAddress}
                      </Text>
                      <View style={styles.openRideFooter}>
                        <Text style={styles.openRidePrice}>~{ride.price} DKK</Text>
                        {ride.distanceKm != null && (
                          <Text style={styles.openRideDistance}>
                            {t('open_rides_distance')}: {Math.round(ride.distanceKm * 10) / 10} km
                          </Text>
                        )}
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.openRideAcceptBtn}
                      onPress={async () => {
                        acceptRide(ride.id);
                        setOpenRides((prev) => prev.filter((r) => r.id !== ride.id));
                        await loadDriverStatus();
                        loadUpcomingRides().catch(() => {});
                      }}
                    >
                      <Text style={styles.openRideAcceptText}>{t('open_rides_accept')}</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* ── Upcoming Ride Card ── */}
            <View
              style={[
                styles.upcomingCard,
                nextScheduledRide
                  ? scheduledBanner?.selected !== false
                    ? styles.upcomingCardSelected
                    : styles.upcomingCardPending
                  : styles.upcomingCardEmpty,
              ]}
            >
              {nextScheduledRide ? (
                <>
                  <View style={styles.upcomingHeader}>
                    <Text style={styles.upcomingIcon}>📅</Text>
                    <Text style={styles.upcomingTitle}>
                      {t('scheduled_ride_title') || 'Upcoming Ride'}
                    </Text>
                  </View>
                  <View style={styles.upcomingBody}>
                    <View style={styles.upcomingTimeRow}>
                      <Text style={styles.upcomingCountdown}>{scheduledCountdownText}</Text>
                      {scheduledDepartureTime && (
                        <Text style={styles.upcomingDeparture}>🚗 {scheduledDepartureTime}</Text>
                      )}
                    </View>
                    <View style={styles.upcomingRoute}>
                      <View style={styles.upcomingRouteDot} />
                      <Text style={styles.upcomingAddress} numberOfLines={1}>
                        {nextScheduledRide.pickupAddress}
                      </Text>
                    </View>
                    <View style={styles.upcomingRouteLine} />
                    <View style={styles.upcomingRoute}>
                      <View style={[styles.upcomingRouteDot, styles.upcomingRouteDotEnd]} />
                      <Text style={styles.upcomingAddress} numberOfLines={1}>
                        {nextScheduledRide.dropoffAddress}
                      </Text>
                    </View>
                    {(nextScheduledRide.price != null || nextScheduledRide.distanceKm != null) && (
                      <View style={styles.upcomingFooter}>
                        {nextScheduledRide.price != null && (
                          <Text style={styles.upcomingPrice}>~{nextScheduledRide.price} DKK</Text>
                        )}
                        {nextScheduledRide.distanceKm != null && (
                          <Text style={styles.upcomingDistance}>
                            {Math.round(nextScheduledRide.distanceKm * 10) / 10} km
                          </Text>
                        )}
                      </View>
                    )}
                  </View>
                  <View style={styles.upcomingProgressBar}>
                    <View
                      style={[
                        styles.upcomingProgressFill,
                        {
                          width: `${scheduledCountdownSeconds > 0 ? Math.max(2, Math.min(100, 100 - (scheduledCountdownSeconds / (60 * 60)) * 100)) : 0}%`,
                        },
                      ]}
                    />
                  </View>
                </>
              ) : (
                <View style={styles.upcomingEmpty}>
                  <Text style={styles.upcomingEmptyIcon}>📋</Text>
                  <Text style={styles.upcomingEmptyText}>
                    {t('no_upcoming_rides') || 'No upcoming rides'}
                  </Text>
                </View>
              )}
            </View>

            {/* ── Recent Rides ── */}
            <LastRidesList
              rides={recentRides.map((r) => ({
                id: r.id,
                startTime: r.createdAt || r.pickupTime || undefined,
                from: r.pickupAddress || r.startName || 'Unknown',
                to: r.dropoffAddress || r.stopAddress || r.endName || 'Unknown',
                price: r.price ?? r.fare ?? undefined,
                status: r.status,
              }))}
              isDarkMode={isDarkMode}
            />
          </ScrollView>

          <EndKMModal
            visible={showEndKMModal}
            endKM={endKM}
            onChangeKM={setEndKM}
            onCancel={() => {
              setSuppressShiftWarning(false);
              setShowEndKMModal(false);
              setEndKM('');
            }}
            onConfirm={handleEndShift}
          />

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
                {activeRide.riderName ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: '700',
                        color: isDarkMode ? '#f1f5f9' : '#0f172a',
                      }}
                    >
                      👤 {t('rider')}: {activeRide.riderName}
                    </Text>
                  </View>
                ) : null}
                <View style={styles.pickupInfoRow}>
                  <View style={styles.pickupInfoCard}>
                    <Text style={styles.pickupInfoLabel}>
                      {activeRide.paymentMethod === 'meter' || activeRide.paymentMethod === 'cash'
                        ? t('approximate_price')
                        : t('price')}
                    </Text>
                    {activeRide.paymentMethod === 'meter' || activeRide.paymentMethod === 'cash' ? (
                      <>
                        <Text
                          style={[
                            styles.pickupInfoValue,
                            styles.pickupInfoValueAccent,
                            { color: '#f59e0b' },
                          ]}
                        >
                          ~{activeRide.price} DKK
                        </Text>
                        <Text
                          style={[
                            styles.pickupInfoLabel,
                            { fontSize: 11, marginTop: 2, color: '#f59e0b' },
                          ]}
                        >
                          {t('meter_runs_on_meter')}
                        </Text>
                      </>
                    ) : (
                      <Text style={[styles.pickupInfoValue, styles.pickupInfoValueAccent]}>
                        {activeRide.price} DKK
                      </Text>
                    )}
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
                {!!activeRide.stopAddress && (
                  <View style={styles.stopAddressCard}>
                    <View style={styles.stopAddressHeader}>
                      <View style={styles.stopDot} />
                      <Text style={styles.stopAddressLabel}>{t('stop')}</Text>
                    </View>
                    <Text style={styles.stopAddressValue} numberOfLines={2} ellipsizeMode="tail">
                      {activeRide.stopAddress}
                    </Text>
                  </View>
                )}
                {activeRide.vehicleTypeName ? (
                  <View style={styles.rideTypeBadge}>
                    <Text style={styles.rideTypeBadgeText}>{activeRide.vehicleTypeName}</Text>
                  </View>
                ) : null}
                <View style={styles.pickupActions}>
                  <View style={styles.pickupActionRow}>
                    <TouchableOpacity
                      style={[styles.pickupNavButton, styles.pickupActionButton]}
                      onPress={() =>
                        handleNav(
                          `${currentLocation?.latitude},${currentLocation?.longitude}`,
                          activeRide.pickupAddress,
                        )
                      }
                    >
                      <Text style={styles.pickupNavText}>{t('nav')}</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    style={styles.pickupButton}
                    onLongPress={handlePickupConfirm}
                    delayLongPress={1500}
                    disabled={isPickupLoading}
                  >
                    {isPickupLoading ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <ActivityIndicator size="small" color="#fff" />
                        <Text style={[styles.pickupButtonText, { marginLeft: 10 }]}>
                          {t('pickup_in_progress')}
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.pickupButtonText}>{t('hold_to_pickup')}</Text>
                    )}
                  </TouchableOpacity>
                  {showCancelText && cancelCountdown > 0 && (
                    <Text style={styles.cancelOnText}>
                      {t('cancel_on')}: {Math.floor(cancelCountdown / 60)}:
                      {(cancelCountdown % 60).toString().padStart(2, '0')}
                    </Text>
                  )}
                  <TouchableOpacity
                    style={styles.cancelRideLink}
                    onPress={openCancelModal}
                    disabled={isPickupLoading}
                  >
                    <Text style={styles.cancelRideLinkText}>{t('cancel_ride')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          <StopModal
            visible={showStopModal && !!activeRide}
            activeRide={activeRide}
            currentLocation={currentLocation}
            isContinueLoading={isContinueLoading}
            onNav={handleNav}
            onContinueTrip={handleContinueTrip}
          />

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
                    <TouchableOpacity
                      onPress={closeCancelModal}
                      style={styles.cancelModalCloseButton}
                    >
                      <Text style={styles.cancelModalCloseText}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <ScrollView
                  style={styles.cancelModalScroll}
                  contentContainerStyle={styles.cancelModalScrollContent}
                  showsVerticalScrollIndicator={false}
                >
                  {/* Step 1: Select Reason */}
                  {cancelStep === 'reason' && (
                    <View style={styles.cancelStepContainer}>
                      <Text style={styles.cancelModalSubtitle}>{t('cancel_ride_subtitle')}</Text>

                      {cancelMode === 'early' && (
                        <View style={styles.cancelEarlyInfo}>
                          <Text style={styles.cancelEarlyInfoText}>
                            {t('cancel_ride_early_info')}
                          </Text>
                        </View>
                      )}

                      {/* Reason Options */}
                      <View style={styles.cancelReasonsList}>
                        {(cancelMode === 'early'
                          ? [
                              { key: 'car_problem', icon: '🔧', color: '#fd7e14' },
                              { key: 'price_not_suitable', icon: '💲', color: '#6f42c1' },
                              { key: 'forced_to_go', icon: '🚶', color: '#6c757d' },
                            ]
                          : [
                              { key: 'passenger_no_show', icon: '👤', color: '#dc3545' },
                              { key: 'car_problem', icon: '🚗', color: '#fd7e14' },
                              { key: 'traffic_issue', icon: '🚦', color: '#ffc107' },
                              { key: 'wrong_address', icon: '📍', color: '#6f42c1' },
                              { key: 'emergency', icon: '🆘', color: '#dc3545' },
                              { key: 'other_reason', icon: '📝', color: '#6c757d' },
                            ]
                        ).map((reason) => (
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
                      <Text style={styles.cancelConfirmMessage}>
                        {t('cancel_ride_confirm_message')}
                      </Text>

                      {/* Selected Reason Display */}
                      <View style={styles.cancelSelectedReason}>
                        <Text style={styles.cancelSelectedReasonLabel}>
                          {t('cancel_ride_select_reason')}
                        </Text>
                        <Text style={styles.cancelSelectedReasonValue}>
                          {t(selectedCancelReason || '')}
                        </Text>
                      </View>

                      {/* Action Buttons */}
                      <View style={styles.cancelConfirmButtons}>
                        <TouchableOpacity
                          style={styles.cancelGoBackButton}
                          onPress={goBackToReason}
                        >
                          <Text style={styles.cancelGoBackButtonText}>
                            {t('cancel_ride_go_back')}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.cancelConfirmButton}
                          onPress={confirmCancelRide}
                        >
                          <Text style={styles.cancelConfirmButtonText}>
                            {t('cancel_ride_confirm')}
                          </Text>
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
                        <Text style={styles.cancelSuccessTitle}>
                          {cancelMode === 'early'
                            ? t('cancel_ride_early_success')
                            : t('cancel_ride_success')}
                        </Text>
                        <Text style={styles.cancelSuccessMessage}>
                          {cancelMode === 'early'
                            ? t('cancel_ride_early_success_message')
                            : t('cancel_ride_success_message')}
                        </Text>
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
                </ScrollView>
              </View>
            </View>
          )}

          <DropoffModal
            visible={showDropoffModal && !!activeRide}
            activeRide={activeRide}
            currentLocation={currentLocation}
            isDropoffLoading={isDropoffLoading}
            onNav={handleNav}
            onDropoff={handleDropoffConfirm}
          />

          {/* Ride Offer Modal */}
          {rideOffer && (
            <View style={styles.rideOfferModal}>
              <View style={styles.rideOfferSheet}>
                <View style={styles.rideOfferHeader}>
                  <Text
                    style={[styles.rideOfferTitle, isScheduledOffer && styles.scheduledOfferTitle]}
                  >
                    {isScheduledOffer ? t('scheduled_ride_title') : t('ride_offer_title')}
                  </Text>
                  <View style={styles.rideOfferPill}>
                    <Text style={styles.rideOfferPillText}>#{rideOffer.rideId}</Text>
                  </View>
                </View>

                {isScheduledOffer && scheduledOfferTime && (
                  <View style={styles.scheduledOfferTimeRow}>
                    <Text style={styles.scheduledOfferTimeLabel}>
                      {t('scheduled_ride_time_label')}
                    </Text>
                    <Text style={styles.scheduledOfferTimeValue}>{scheduledOfferTime}</Text>
                  </View>
                )}

                {pickupEtaMinutes !== null && (
                  <View style={styles.rideOfferEtaBanner}>
                    <Text style={styles.rideOfferEtaBannerText}>
                      🚗 {t('ride_offer_eta_to_pickup')}: {formatMinutesHuman(pickupEtaMinutes)}
                    </Text>
                  </View>
                )}

                <View style={styles.rideOfferMetaRow}>
                  <View style={styles.rideOfferMetaItem}>
                    <Text style={styles.rideOfferMetaLabel}>
                      {rideOffer.rideData.paymentMethod === 'meter' ||
                      rideOffer.rideData.paymentMethod === 'cash'
                        ? t('approximate_price')
                        : t('price')}
                    </Text>
                    {rideOffer.rideData.paymentMethod === 'meter' ||
                    rideOffer.rideData.paymentMethod === 'cash' ? (
                      <>
                        <Text style={[styles.rideOfferMetaValue, { color: '#f59e0b' }]}>
                          ~{rideOffer.rideData.price} DKK
                        </Text>
                        <Text
                          style={[
                            styles.rideOfferMetaLabel,
                            { fontSize: 11, marginTop: 2, color: '#f59e0b' },
                          ]}
                        >
                          {t('meter_runs_on_meter')}
                        </Text>
                      </>
                    ) : (
                      <Text style={styles.rideOfferMetaValue}>{rideOffer.rideData.price} DKK</Text>
                    )}
                  </View>
                  <View style={styles.rideOfferMetaItem}>
                    <Text style={styles.rideOfferMetaLabel}>{t('distance')}</Text>
                    <Text style={styles.rideOfferMetaValue}>
                      {rideOffer.rideData.distanceKm} km
                    </Text>
                  </View>
                  {rideEtaMinutes !== null && (
                    <View style={styles.rideOfferMetaItem}>
                      <Text style={styles.rideOfferMetaLabel}>{t('ride_offer_eta_trip')}</Text>
                      <Text style={styles.rideOfferMetaValueHighlight}>
                        {formatMinutesHuman(rideEtaMinutes)}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.rideOfferAddressBlock}>
                  {rideOffer?.rideData?.riderName ? (
                    <View style={styles.rideOfferAddressRow}>
                      <Text style={styles.rideOfferAddressLabel}>{t('rider')}</Text>
                      <Text style={styles.rideOfferAddressValue} numberOfLines={1}>
                        {rideOffer.rideData.riderName}
                      </Text>
                    </View>
                  ) : null}
                  <View style={styles.rideOfferAddressRow}>
                    <Text style={styles.rideOfferAddressLabel}>{t('from')}</Text>
                    <Text style={styles.rideOfferAddressValue} numberOfLines={2}>
                      {rideOffer.rideData.pickupAddress}
                    </Text>
                  </View>
                  {rideOffer.rideData.stopAddress && (
                    <View style={styles.rideOfferAddressRow}>
                      <Text style={styles.rideOfferAddressLabel}>{t('stop')}</Text>
                      <Text style={styles.rideOfferAddressValue} numberOfLines={2}>
                        {rideOffer.rideData.stopAddress}
                      </Text>
                    </View>
                  )}
                  <View style={styles.rideOfferAddressRow}>
                    <Text style={styles.rideOfferAddressLabel}>{t('to')}</Text>
                    <Text style={styles.rideOfferAddressValue} numberOfLines={2}>
                      {rideOffer.rideData.dropoffAddress}
                    </Text>
                  </View>
                </View>

                <View style={styles.rideOfferCountdownRow}>
                  <View style={styles.rideOfferCountdownTrack}>
                    <View
                      style={[styles.rideOfferCountdownFill, { width: `${offerProgress * 100}%` }]}
                    />
                  </View>
                  <Text style={styles.rideOfferCountdownText}>
                    {t('ride_offer_time_left', { seconds: offerCountdown })}
                  </Text>
                </View>

                <View style={styles.rideOfferButtons}>
                  <TouchableOpacity
                    style={[styles.rideOfferButton, styles.acceptButton, styles.rideOfferPrimary]}
                    onPress={async () => {
                      acceptRide(rideOffer.rideId);
                      setRideOffer(null);
                      setOfferCountdown(0);
                      stopRideOfferSound().then(() => {
                        devLog('Ride offer sound stopped after accept');
                      });
                      if (offerTimeout) {
                        clearInterval(offerTimeout);
                        setOfferTimeout(null);
                      }
                      await loadDriverStatus();
                      loadUpcomingRides().catch(() => {});
                    }}
                  >
                    <Text style={styles.acceptButtonText}>
                      {isScheduledOffer ? t('yes') : t('ride_offer_accept')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.rideOfferButton, styles.rejectButton, styles.rideOfferSecondary]}
                    onPress={async () => {
                      rejectRide(rideOffer.rideId);
                      setRideOffer(null);
                      setOfferCountdown(0);
                      await stopRideOfferSound();
                      if (offerTimeout) {
                        clearInterval(offerTimeout);
                        setOfferTimeout(null);
                      }
                    }}
                  >
                    <Text style={[styles.rejectButtonText, styles.rideOfferSecondaryText]}>
                      {isScheduledOffer ? t('no') : t('ride_offer_reject')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Open Proposal Modal (relaxed-preference question) */}
          {rideProposal && (
            <View style={styles.rideOfferModal}>
              <View style={styles.rideProposalSheet}>
                <View style={styles.rideOfferHeader}>
                  <Text style={styles.rideProposalTitle}>{t('ride_proposal_title')}</Text>
                  <View style={styles.rideOfferPill}>
                    <Text style={styles.rideOfferPillText}>#{rideProposal.rideId}</Text>
                  </View>
                </View>

                <Text style={styles.rideProposalQuestion}>{t('ride_proposal_question')}</Text>

                <View style={styles.rideProposalDistanceRow}>
                  <Text style={styles.rideProposalDistanceLabel}>
                    {t('ride_proposal_distance')}
                  </Text>
                  <Text style={styles.rideProposalDistanceValue}>
                    {Math.round((Number(rideProposal?.distanceKm) || 0) * 10) / 10} km
                    {Number.isFinite(Number(rideProposal?.etaMinutes)) &&
                    Number(rideProposal?.etaMinutes) > 0
                      ? ` (~${Math.round(Number(rideProposal.etaMinutes))} min)`
                      : ''}
                  </Text>
                </View>

                <View style={styles.rideProposalRoute}>
                  <Text style={styles.rideProposalAddress} numberOfLines={1}>
                    {rideProposal?.rideData?.pickupAddress}
                  </Text>
                  <Text style={styles.rideProposalAddress} numberOfLines={1}>
                    {rideProposal?.rideData?.dropoffAddress}
                  </Text>
                  <Text style={styles.rideProposalPrice}>~{rideProposal?.rideData?.price} DKK</Text>
                </View>

                <View style={styles.rideOfferCountdownRow}>
                  <View style={styles.rideOfferCountdownTrack}>
                    <View
                      style={[
                        styles.rideOfferCountdownFill,
                        {
                          width: `${
                            (proposalTotalSeconds > 0
                              ? Math.max(0, Math.min(1, proposalCountdown / proposalTotalSeconds))
                              : 0) * 100
                          }%`,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.rideOfferCountdownText}>
                    {t('ride_proposal_time_left', { seconds: proposalCountdown })}
                  </Text>
                </View>

                <View style={styles.rideOfferButtons}>
                  <TouchableOpacity
                    style={[styles.rideOfferButton, styles.acceptButton, styles.rideOfferPrimary]}
                    onPress={async () => {
                      acceptRide(rideProposal.rideId);
                      rideProposalRef.current = null;
                      setRideProposal(null);
                      setProposalCountdown(0);
                      stopRideOfferSound().then(() => {});
                      if (proposalTimeoutRef.current) {
                        clearInterval(proposalTimeoutRef.current);
                        proposalTimeoutRef.current = null;
                      }
                      await loadDriverStatus();
                      loadUpcomingRides().catch(() => {});
                    }}
                  >
                    <Text style={styles.acceptButtonText}>{t('yes')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.rideOfferButton, styles.rejectButton, styles.rideOfferSecondary]}
                    onPress={async () => {
                      rejectRide(rideProposal.rideId);
                      rideProposalRef.current = null;
                      setRideProposal(null);
                      setProposalCountdown(0);
                      await stopRideOfferSound();
                      if (proposalTimeoutRef.current) {
                        clearInterval(proposalTimeoutRef.current);
                        proposalTimeoutRef.current = null;
                      }
                    }}
                  >
                    <Text style={[styles.rejectButtonText, styles.rideOfferSecondaryText]}>
                      {t('no')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Chain Ride Offer Modal (next ride after current finishes) */}
          {chainOffer && (
            <View style={styles.rideOfferModal}>
              <View style={styles.rideProposalSheet}>
                <View style={styles.rideOfferHeader}>
                  <Text style={styles.rideProposalTitle}>{t('chain_ride_title')}</Text>
                  <View style={styles.rideOfferPill}>
                    <Text style={styles.rideOfferPillText}>#{chainOffer.rideId}</Text>
                  </View>
                </View>

                <Text style={styles.rideProposalQuestion}>{t('chain_ride_subtitle')}</Text>

                <View style={styles.rideProposalDistanceRow}>
                  <Text style={styles.rideProposalDistanceLabel}>{t('chain_ride_remaining')}</Text>
                  <Text style={styles.rideProposalDistanceValue}>
                    {Math.round(Number(chainOffer?.remainingMinutes) || 0)} min
                  </Text>
                </View>

                <View style={styles.rideProposalRoute}>
                  <Text style={styles.rideProposalAddress} numberOfLines={1}>
                    {chainOffer?.rideData?.pickupAddress}
                  </Text>
                  <Text style={styles.rideProposalAddress} numberOfLines={1}>
                    {chainOffer?.rideData?.dropoffAddress}
                  </Text>
                  <Text style={styles.rideProposalPrice}>~{chainOffer?.rideData?.price} DKK</Text>
                  <Text style={styles.rideProposalAddress}>
                    {t('chain_ride_distance')}:{' '}
                    {Math.round((Number(chainOffer?.pickupDistanceKm) || 0) * 10) / 10} km (~
                    {Math.round(Number(chainOffer?.pickupEtaMinutes) || 0)} min)
                  </Text>
                </View>

                <View style={styles.rideOfferCountdownRow}>
                  <View style={styles.rideOfferCountdownTrack}>
                    <View
                      style={[
                        styles.rideOfferCountdownFill,
                        {
                          width: `${(chainTotalSeconds > 0 ? Math.max(0, Math.min(1, chainCountdown / chainTotalSeconds)) : 0) * 100}%`,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.rideOfferCountdownText}>
                    {t('ride_proposal_time_left', { seconds: chainCountdown })}
                  </Text>
                </View>

                <View style={styles.rideOfferButtons}>
                  <TouchableOpacity
                    style={[styles.rideOfferButton, styles.acceptButton, styles.rideOfferPrimary]}
                    onPress={async () => {
                      acceptChainRide(chainOffer.rideId);
                      chainOfferRef.current = null;
                      setChainOffer(null);
                      setChainCountdown(0);
                      stopRideOfferSound().then(() => {});
                      if (chainTimeoutRef.current) {
                        clearInterval(chainTimeoutRef.current);
                        chainTimeoutRef.current = null;
                      }
                      await loadDriverStatus();
                      loadUpcomingRides().catch(() => {});
                    }}
                  >
                    <Text style={styles.acceptButtonText}>{t('yes')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.rideOfferButton, styles.rejectButton, styles.rideOfferSecondary]}
                    onPress={async () => {
                      rejectRide(chainOffer.rideId);
                      chainOfferRef.current = null;
                      setChainOffer(null);
                      setChainCountdown(0);
                      await stopRideOfferSound();
                      if (chainTimeoutRef.current) {
                        clearInterval(chainTimeoutRef.current);
                        chainTimeoutRef.current = null;
                      }
                    }}
                  >
                    <Text style={[styles.rejectButtonText, styles.rideOfferSecondaryText]}>
                      {t('no')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          <ShiftWarningModal
            visible={showShiftWarning}
            onEndShift={() => {
              setSuppressShiftWarning(true);
              setShowShiftWarning(false);
              setShowEndKMModal(true);
            }}
            onDismiss={() => setShowShiftWarning(false)}
          />

          <RidePreferencesModal
            visible={showRidePreferences && !showShiftWarning}
            token={authState.token || ''}
            onSave={() => {
              setHasRidePreferences(true);
              setShowRidePreferences(false);
              if (authState.token) {
                toggleDriverBusy(false, authState.token).catch(() => {});
                setDriverBusy(false);
                toggleDriverOnline(true, authState.token)
                  .then((res) => {
                    if (res.success) {
                      setDriverOnline(true);
                      startLocationTracking();
                      if (res.schedule) {
                        setScheduleEligibility(res.schedule);
                        setScheduleReasonMessage(res.schedule?.reasonMessage || '');
                      }
                    }
                  })
                  .catch(() => {});
              }
            }}
            onCancel={() => {
              if (hasRidePreferences) {
                setShowRidePreferences(false);
                if (authState.token) {
                  toggleDriverBusy(false, authState.token).catch(() => {});
                  setDriverBusy(false);
                  toggleDriverOnline(true, authState.token)
                    .then((res) => {
                      if (res.success) {
                        setDriverOnline(true);
                        startLocationTracking();
                        if (res.schedule) {
                          setScheduleEligibility(res.schedule);
                          setScheduleReasonMessage(res.schedule?.reasonMessage || '');
                        }
                      }
                    })
                    .catch(() => {});
                }
              } else {
                Alert.alert(t('error'), t('ride_preferences_required'));
              }
            }}
          />

          {/* Floating Go Button */}
          {!driverOnline && (
            <TouchableOpacity style={styles.floatingGoButton} onPress={handleToggleOnline}>
              <Animated.Text style={[styles.floatingGoButtonText, { opacity: textOpacityAnim }]}>
                {t('go')}
              </Animated.Text>
            </TouchableOpacity>
          )}

          {!driverOnline &&
            scheduleEligibility &&
            scheduleEligibility.eligible === false &&
            !!scheduleReasonMessage && (
              <View
                style={[
                  styles.scheduleHintBar,
                  floatingBottoms.scheduleHintBottom != null && {
                    bottom: floatingBottoms.scheduleHintBottom,
                  },
                ]}
              >
                <Text style={styles.scheduleHintText}>{scheduleReasonMessage}</Text>
              </View>
            )}

          {driverOnline && restrictedOffers && (
            <View
              style={[
                styles.scheduleHintBar,
                { backgroundColor: '#b91c1c' },
                floatingBottoms.scheduleHintBottom != null && {
                  bottom: floatingBottoms.scheduleHintBottom,
                },
              ]}
            >
              <Text style={styles.scheduleHintText}>
                {t('restricted_offers_active')}
                {restrictedOffersUntil ? ` (${restrictedOffersUntil.toLocaleTimeString()})` : ''}
              </Text>
            </View>
          )}

          {driverOnline && !activeRide && smartAlerts.length > 0 && (
            <View
              style={[
                styles.smartAlertsContainer,
                floatingBottoms.smartAlertsBottom != null && {
                  bottom: floatingBottoms.smartAlertsBottom,
                },
              ]}
            >
              <Text style={styles.smartAlertsTitle}>{t('smart_alerts_title')}</Text>
              {smartAlerts.map((alert) => {
                const accent =
                  alert.severity === 'high'
                    ? '#dc2626'
                    : alert.severity === 'medium'
                      ? '#d97706'
                      : '#0ea5e9';

                const lightBackground =
                  alert.severity === 'high'
                    ? 'rgba(254, 226, 226, 0.95)'
                    : alert.severity === 'medium'
                      ? 'rgba(255, 247, 237, 0.95)'
                      : 'rgba(239, 246, 255, 0.95)';

                return (
                  <View
                    key={alert.id}
                    style={[
                      styles.smartAlertCard,
                      {
                        borderColor: accent,
                        backgroundColor: isDarkMode ? 'rgba(15,23,42,0.94)' : lightBackground,
                      },
                    ]}
                  >
                    <Text style={styles.smartAlertIcon}>{alert.icon}</Text>
                    <View style={styles.smartAlertTextWrap}>
                      <Text style={[styles.smartAlertHeading, { color: accent }]}>
                        {t(alert.titleKey)}
                      </Text>
                      <Text style={styles.smartAlertBody}>
                        {t(alert.bodyKey, alert.values || {})}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Searching for Trips Card / Restricted Notice */}
          {driverOnline && !driverBusy && !activeRide && restrictedOffers ? (
            <View
              style={[
                styles.searchingBar,
                floatingBottoms.searchingBottom != null && {
                  bottom: floatingBottoms.searchingBottom,
                },
              ]}
            >
              <Text style={[styles.searchingLetter, { color: '#ef4444', fontSize: 22 }]}>🚫</Text>
              <Text style={[styles.searchingSubText, { color: '#ef4444', fontWeight: '600' }]}>
                {t('restricted_offers_active')}
              </Text>
              {restrictedOffersUntil ? (
                <Text style={[styles.searchingSubText, { fontSize: 12, marginTop: 4 }]}>
                  ({restrictedOffersUntil.toLocaleTimeString()})
                </Text>
              ) : null}
            </View>
          ) : (
            <SearchingCard
              visible={driverOnline && !driverBusy && !activeRide && !restrictedOffers}
              letterAnimValues={letterAnimValues}
              dot1Anim={dot1Anim}
              dot2Anim={dot2Anim}
              dot3Anim={dot3Anim}
              bottomOffset={
                floatingBottoms.searchingBottom != null ? floatingBottoms.searchingBottom - 20 : 0
              }
            />
          )}
        </>
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
        fiveStarCount={authState.user?.fiveStarCount || 0}
        onRatingPress={() => {
          setShowStatusExpanded(false);
          setTimeout(() => setShowRatingInfo(true), 300);
        }}
      />

      {/* Rating Info Modal */}
      <RatingInfoModal
        visible={showRatingInfo}
        onClose={() => setShowRatingInfo(false)}
        rating={authState.user?.rating || 5.0}
        fiveStarCount={authState.user?.fiveStarCount || 0}
      />
    </View>
  );
}
