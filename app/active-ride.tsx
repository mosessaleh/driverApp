import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { useAuth } from '../src/context/AuthContext';
import { getRide, startRide, endRide, updateDriverLocation } from '../src/services/api';
import { Ride } from '../src/types';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { getSocket, onDriverStatusUpdate, offDriverStatusUpdate } from '../src/services/socket';
import { watchLocation } from '../src/services/location';

export default function ActiveRideScreen() {
  const { authState } = useAuth();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [ride, setRide] = useState<Ride | null>(null);
  const [rideStatus, setRideStatus] = useState('');
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [showChat, setShowChat] = useState(false);

  useEffect(() => {
    if (authState.token && id) {
      // Polling every 5 seconds
      const pollingInterval = setInterval(() => {
        fetchRide();
      }, 5000);
      return () => clearInterval(pollingInterval);
    }
  }, [authState.token, id]);

  useEffect(() => {
    if (rideStatus === 'IN_PROGRESS' && authState.token) {
      const stopWatching = watchLocation(
        async (location) => {
          try {
            await updateDriverLocation(
              location.coords.latitude,
              location.coords.longitude,
              authState.token!
            );
          } catch (error) {
            console.error('Error updating location:', error);
          }
        },
        (error) => {
          console.error('Location error:', error);
        }
      );
      return stopWatching;
    }
  }, [rideStatus, authState.token]);

  useEffect(() => {
    const socket = getSocket();
    if (socket) {
      const handleRideUpdate = (data: any) => {
        if (data.rideId === id && data.status !== rideStatus) {
          setRideStatus(data.status);
        }
      };
      socket.on('ride-update', handleRideUpdate);

      const handleDriverStatusUpdate = (data: any) => {
        // Removed fetchRide to stop API calls
      };
      onDriverStatusUpdate(handleDriverStatusUpdate);

      // Chat functionality
      socket.emit('joinChat', { bookingId: id });
      const handleNewMessage = (data: any) => {
        setChatMessages(prev => [...prev, data]);
      };
      socket.on('newMessage', handleNewMessage);

      return () => {
        socket.off('ride-update', handleRideUpdate);
        offDriverStatusUpdate();
        socket.off('newMessage', handleNewMessage);
      };
    }
  }, [id, rideStatus]);

  const fetchRide = async () => {
    if (!authState.token || !id) return;
    try {
      const res = await getRide(id as string, authState.token);
      if (res.success) {
        setRide(res.data);
        setRideStatus(res.data.status);
      }
    } catch (e) {
      console.error('Error fetching ride:', e);
    }
  };

  const handleStartRide = async () => {
    if (!authState.token || !id) return;
    try {
      const res = await startRide(id as string, authState.token);
      if (res.success) {
        setRideStatus('IN_PROGRESS');
      }
    } catch (e) {
      console.error('Error starting ride:', e);
    }
  };

  const handleEndRide = async () => {
    if (!authState.token || !id) return;
    try {
      const res = await endRide(id as string, authState.token);
      if (res.success) {
        router.push('/dashboard');
      }
    } catch (e) {
      console.error('Error ending ride:', e);
    }
  };

  const sendMessage = () => {
    const socket = getSocket();
    if (socket && chatInput.trim()) {
      socket.emit('sendMessage', {
        bookingId: id,
        message: chatInput.trim(),
        sender: 'driver'
      });
      setChatMessages(prev => [...prev, {
        message: chatInput.trim(),
        sender: 'driver',
        timestamp: new Date().toISOString()
      }]);
      setChatInput('');
    }
  };

  if (!ride) {
    return (
      <View style={styles.container}>
        <Text>Loading ride...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Active Ride</Text>
      <View style={styles.details}>
        <Text>Rider: {ride.riderName}</Text>
        <Text>Pickup: {ride.pickupAddress}</Text>
        <Text>Dropoff: {ride.dropoffAddress}</Text>
        <Text>Price: {ride.price} DKK</Text>
        <Text>Status: {rideStatus}</Text>
      </View>
      <View style={styles.mapPlaceholder}>
        <Text>Map Placeholder</Text>
      </View>
      <View style={styles.buttons}>
        {rideStatus === 'ACCEPTED' && (
          <TouchableOpacity style={styles.button} onPress={handleStartRide}>
            <Text>Start Ride</Text>
          </TouchableOpacity>
        )}
        {rideStatus === 'IN_PROGRESS' && (
          <TouchableOpacity style={styles.button} onPress={handleEndRide}>
            <Text>End Ride</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.chatButton} onPress={() => setShowChat(!showChat)}>
          <Text>{showChat ? 'Hide Chat' : 'Chat with Passenger'}</Text>
        </TouchableOpacity>
      </View>

      {showChat && (
        <View style={styles.chatContainer}>
          <View style={styles.chatMessages}>
            {chatMessages.map((msg, idx) => (
              <View key={idx} style={[styles.message, msg.sender === 'driver' ? styles.myMessage : styles.theirMessage]}>
                <Text style={styles.messageText}>{msg.message}</Text>
              </View>
            ))}
          </View>
          <View style={styles.chatInput}>
            <TextInput
              style={styles.input}
              value={chatInput}
              onChangeText={setChatInput}
              placeholder="Type message..."
              onSubmitEditing={sendMessage}
            />
            <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
              <Text>Send</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      <Link href="/dashboard" style={styles.backLink}>
        <Text>Back to Dashboard</Text>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  details: {
    marginBottom: 20,
  },
  mapPlaceholder: {
    height: 200,
    backgroundColor: '#e9ecef',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  buttons: {
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#007bff',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
  },
  backLink: {
    alignSelf: 'center',
    marginTop: 20,
  },
  chatButton: {
    backgroundColor: '#28a745',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 10,
  },
  chatContainer: {
    height: 200,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    marginTop: 10,
  },
  chatMessages: {
    flex: 1,
    padding: 10,
  },
  message: {
    marginBottom: 10,
    padding: 10,
    borderRadius: 5,
    maxWidth: '80%',
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007bff',
  },
  theirMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#e9ecef',
  },
  messageText: {
    color: '#000',
  },
  chatInput: {
    flexDirection: 'row',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#ccc',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    marginRight: 10,
  },
  sendButton: {
    backgroundColor: '#007bff',
    padding: 10,
    borderRadius: 5,
    justifyContent: 'center',
  },
});