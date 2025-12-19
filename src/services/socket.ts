import io, { Socket } from 'socket.io-client';
import { jwtDecode } from 'jwt-decode';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

let socket: Socket | null = null;

export const connectSocket = (token: string): Socket => {
  if (socket) {
    socket.disconnect();
  }
  socket = io(API_BASE_URL, {
    auth: { token },
    transports: ['websocket'],
  });
  socket.on('connect', () => {
    console.log('Connected to socket');
    // Decode token to get driverId
    try {
      const decoded: any = jwtDecode(token);
      const driverId = decoded.driverId;
      socket?.emit('join', { driverId });
      console.log('Joined driver room:', driverId);
    } catch (error) {
      console.error('Error decoding token for socket join:', error);
    }
  });
  socket.on('disconnect', () => {
    console.log('Disconnected from socket');
  });
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const getSocket = (): Socket | null => socket;