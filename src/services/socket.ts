import io, { Socket } from 'socket.io-client';

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