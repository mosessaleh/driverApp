// For Expo Go on physical device, use your computer's IP address
// Set EXPO_PUBLIC_API_URL in .env file or change this value based on your network
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.0.146:3000'; // Set EXPO_PUBLIC_API_URL in .env

const retry = async (fn: () => Promise<any>, retries = 3, delay = 1000) => {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return retry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
};

export const api = {
  post: async (endpoint: string, data: any, token?: string) => {
    return retry(async () => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        let errorMessage = `API Error ${response.status}: ${response.statusText || errorText}`;
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.message) {
            errorMessage = errorData.message;
          } else if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (e) {
          // If not JSON, use the text as is
        }
        throw new Error(errorMessage);
      }
      return response.json();
    });
  },
  get: async (endpoint: string, token?: string) => {
    return retry(async () => {
      const headers: Record<string, string> = {
        'Cache-Control': 'no-cache',
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'GET',
        headers,
      });
      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }
      return response.json();
    });
  },
  put: async (endpoint: string, data: any, token?: string) => {
    return retry(async () => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        let errorMessage = `API Error ${response.status}: ${response.statusText || errorText}`;
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.message) {
            errorMessage = errorData.message;
          } else if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (e) {
          // If not JSON, use the text as is
        }
        throw new Error(errorMessage);
      }
      return response.json();
    });
  },
  // Add other methods as needed
};

export const loginDriver = async (username: string, password: string, startKM: number) => {
  return api.post('/api/driver/login', { username, password, startKM });
};

export const getAvailableRides = async (token: string) => {
  return api.get('/api/bookings/available', token);
};

export const getRide = async (rideId: string, token: string) => {
  return api.get(`/api/driver/rides/${rideId}`, token);
};

export const acceptRide = async (rideId: string, token: string) => {
  return api.post(`/api/bookings/${rideId}/accept`, {}, token);
};

export const startRide = async (rideId: string, token: string) => {
  return api.post(`/api/bookings/${rideId}/start`, {}, token);
};

export const endRide = async (rideId: string, token: string) => {
  return api.post(`/api/bookings/${rideId}/end`, {}, token);
};

export const toggleDriverOnline = async (online: boolean, token: string) => {
  return api.post('/api/driver/status', { online }, token);
};

export const toggleDriverBusy = async (busy: boolean, token: string) => {
  return api.post('/api/driver/status', { busy, busyMode: busy ? 'manual' : null }, token);
};

export const getDriverStatus = async (token: string) => {
  return api.get('/api/driver/status', token);
};

export const updateDriverLocation = async (latitude: number, longitude: number, token: string, timestamp?: string) => {
  return api.post('/api/driver/location-update', { latitude, longitude, timestamp }, token);
};

export const logoutDriver = async (token: string) => {
  return api.post('/api/auth/logout', {}, token);
};

export const getDriverProfile = async (driverId: string, token: string) => {
  return api.get(`/api/drivers/${driverId}`, token);
};

export const getDriverHistory = async (token: string, startDate?: string, endDate?: string) => {
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  const query = params.toString() ? `?${params.toString()}` : '';
  return api.get(`/api/driver/history${query}`, token);
};

export const endShift = async (endKM: number, token: string) => {
  return api.post('/api/driver/end-shift', { endKM }, token);
};

export const requestDriverPasswordReset = async (email: string) => {
  return api.post('/api/driver/request-reset', { email });
};

export const updatePushToken = async (pushToken: string, token: string) => {
  return api.post('/api/driver/push-token', { pushToken }, token);
};
