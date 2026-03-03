export interface User {
  id: string;
  name: string;
  car: string;
  vehicleTypeId?: number;
  shiftId?: number;
  shiftStartTime?: string;
  rating?: number;
  schedule?: DriverScheduleSnapshot;
  // Add other user properties as needed
}

export interface DriverScheduleWindow {
  startMinute: number;
  endMinute: number;
  start: string;
  end: string;
  isActive?: boolean;
  confidence?: number;
}

export interface DriverScheduleDayTemplate {
  dayOfWeek: number;
  dayName: string;
  windows: DriverScheduleWindow[];
}

export interface DriverSchedulePreferences {
  maxDailyMinutes: number;
  maxWeeklyMinutes: number;
  minRestMinutes: number;
  lockMinutesBeforeStart: number;
  allowEmergencyOverride: boolean;
}

export interface DriverScheduleSnapshot {
  eligible: boolean;
  reason: string;
  reasonMessage: string;
  checkedAt?: string;
  preferences?: DriverSchedulePreferences;
  todayWindows?: DriverScheduleWindow[];
  activeException?: {
    id: number;
    date: string;
    type: string;
    note?: string | null;
    startMinute?: number | null;
    endMinute?: number | null;
    start?: string | null;
    end?: string | null;
  } | null;
  metrics?: {
    dailyWorkedMinutes?: number;
    weeklyWorkedMinutes?: number;
    restSinceLastShiftMinutes?: number;
    dailyRemainingMinutes?: number;
    weeklyRemainingMinutes?: number;
    restRemainingMinutes?: number;
  } | null;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
}

export interface Booking {
  id: string;
  riderName: string;
  pickupAddress: string;
  stopAddress?: string | null;
  dropoffAddress: string;
  pickupTime: string;
  price: number;
  status: string;
  vehicleType?: {
    title: string;
    capacity: number;
  };
  startLatLon?: { lat: number; lon: number };
  stopLatLon?: { lat: number; lon: number };
  endLatLon?: { lat: number; lon: number };
}

export interface Ride extends Booking {
  passengers: number;
  distanceKm: number;
  durationMin: number;
  paymentStatus: string;
  paymentMethod: string;
  scheduled: boolean;
  explanation?: string;
  startLatLon?: { lat: number; lon: number };
  stopLatLon?: { lat: number; lon: number };
  endLatLon?: { lat: number; lon: number };
  riderPhone?: string;
}

export interface ScheduledPendingOffer {
  rideId: number;
  pickupTime?: string | null;
  expiresAtMs: number;
  timeLeftMs: number;
  rideData: {
    id: number;
    pickupAddress: string;
    dropoffAddress: string;
    stopAddress?: string | null;
    price: number;
    distanceKm: number;
    riderName?: string;
    startLatLon?: { lat: number; lon: number } | null;
    stopLatLon?: { lat: number; lon: number } | null;
    endLatLon?: { lat: number; lon: number } | null;
    vehicleTypeId?: number;
    pickupTime?: string | null;
  };
}

export interface Driver {
  id: string;
  name: string;
  email: string;
  online: boolean;
}
