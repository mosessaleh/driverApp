import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuth } from '../src/context/AuthContext';
import { getRide, startRide, endRide, updateDriverLocation } from '../src/services/api';
import { Ride } from '../src/types';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { getSocket } from '../src/services/socket';
import { watchLocation } from '../src/services/location';

export default function ActiveRideScreen() {
  const { authState } = useAuth();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [ride, setRide] = useState<Ride | null>(null);
  const [rideStatus, setRideStatus] = useState('');

  useEffect(() => {
    if (authState.token && id) {
      fetchRide();
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
        if (data.rideId === id) {
          setRideStatus(data.status);
          fetchRide();
        }
      };
      socket.on('ride-update', handleRideUpdate);
      return () => {
        socket.off('ride-update', handleRideUpdate);
      };
    }
  }, [id]);

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
      </View>
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
});