export interface User {
  id: string;
  name: string;
  car: string;
  shiftId?: number;
  shiftStartTime?: string;
  // Add other user properties as needed
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
  dropoffAddress: string;
  pickupTime: string;
  price: number;
  status: string;
  vehicleType?: {
    title: string;
    capacity: number;
  };
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
}

export interface Driver {
  id: string;
  name: string;
  email: string;
  online: boolean;
}