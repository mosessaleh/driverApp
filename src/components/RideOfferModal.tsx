import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Dimensions } from 'react-native';
import { Audio } from 'expo-av';
import { Ride } from '../types';

interface RideOfferModalProps {
  visible: boolean;
  ride: Ride | null;
  etaMinutes: number | null;
  onAccept: (rideId: string) => void;
  onDecline: () => void;
}

export default function RideOfferModal({ visible, ride, etaMinutes, onAccept, onDecline }: RideOfferModalProps) {
  const [countdown, setCountdown] = useState(30);
  const [sound, setSound] = useState<Audio.Sound | null>(null);

  useEffect(() => {
    if (visible && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      onDecline();
    }
  }, [visible, countdown, onDecline]);

  useEffect(() => {
    if (visible) {
      setCountdown(30);
      playSound();
    } else {
      stopSound();
    }
  }, [visible]);

  const playSound = async () => {
    try {
      // Set audio mode to play at maximum volume
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });

      const { sound: soundObject } = await Audio.Sound.createAsync(
        require('../../assets/music/rideGetting.mp3'),
        { shouldPlay: true, isLooping: true, volume: 1.0 }
      );
      setSound(soundObject);
      await soundObject.playAsync();
    } catch (error) {
      console.error('Error playing sound:', error);
    }
  };

  const stopSound = async () => {
    if (sound) {
      await sound.unloadAsync();
      setSound(null);
    }
  };

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  if (!ride) return null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <TouchableOpacity style={styles.closeButton} onPress={onDecline}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.etaText}>{etaMinutes} min</Text>
          <Text style={styles.priceText}>{ride.price.toFixed(2)} DKK</Text>
          <TouchableOpacity style={styles.acceptButton} onPress={() => onAccept(ride.id)}>
            <Text style={styles.acceptText}>Accept ({countdown})</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end', // Position at bottom
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modal: {
    backgroundColor: 'white',
    height: Dimensions.get('window').height / 3, // One third of screen
    width: '100%',
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 10,
  },
  closeText: {
    fontSize: 24,
    color: 'red',
  },
  etaText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  priceText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  acceptButton: {
    backgroundColor: 'black',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 5,
    width: '80%',
    alignItems: 'center',
  },
  acceptText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});