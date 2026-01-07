import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../src/context/AuthContext';

interface Settings {
  notifications: {
    rideOffers: boolean;
    chatMessages: boolean;
    rideUpdates: boolean;
    vibration: boolean;
  };
  sound: {
    rideOfferSound: boolean;
    messageSound: boolean;
    pickupDropoffSound: boolean;
    volume: number;
  };
  appearance: {
    darkMode: boolean;
    fontSize: 'small' | 'medium' | 'large';
    language: 'ar' | 'en';
  };
  location: {
    realTimeSharing: boolean;
    accuracy: 'high' | 'medium' | 'low';
    updateInterval: '2s' | '5s' | '10s';
  };
  account: {
    autoLogin: boolean;
    changePassword: boolean;
    updateContact: boolean;
  };
  vehicle: {
    busyModeAuto: boolean;
    shiftStartTime: string;
    shiftEndReminder: boolean;
  };
  general: {
    clearCache: boolean;
    reportIssue: boolean;
    contactSupport: boolean;
    appVersion: string;
  };
}

const defaultSettings: Settings = {
  notifications: {
    rideOffers: true,
    chatMessages: true,
    rideUpdates: true,
    vibration: true,
  },
  sound: {
    rideOfferSound: true,
    messageSound: true,
    pickupDropoffSound: true,
    volume: 0.8,
  },
  appearance: {
    darkMode: false,
    fontSize: 'medium',
    language: 'en',
  },
  location: {
    realTimeSharing: true,
    accuracy: 'high',
    updateInterval: '5s',
  },
  account: {
    autoLogin: false,
    changePassword: false,
    updateContact: false,
  },
  vehicle: {
    busyModeAuto: false,
    shiftStartTime: '08:00',
    shiftEndReminder: true,
  },
  general: {
    clearCache: false,
    reportIssue: false,
    contactSupport: false,
    appVersion: '1.0.0',
  },
};

const getSettingsStyles = (isDarkMode: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: isDarkMode ? '#121212' : '#f5f5f5',
  },
  header: {
    backgroundColor: isDarkMode ? '#333' : '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: isDarkMode ? '#555' : '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: isDarkMode ? '#fff' : '#333',
    textAlign: 'center',
  },
  section: {
    backgroundColor: isDarkMode ? '#333' : '#fff',
    marginTop: 10,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: isDarkMode ? '#fff' : '#333',
    marginBottom: 15,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: isDarkMode ? '#555' : '#f0f0f0',
  },
  settingLabel: {
    fontSize: 16,
    color: isDarkMode ? '#fff' : '#333',
    flex: 1,
  },
  fontSizeOptions: {
    flexDirection: 'row',
    gap: 10,
  },
  fontSizeButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: isDarkMode ? '#555' : '#ddd',
  },
  selectedFontSize: {
    backgroundColor: '#007bff',
    borderColor: '#007bff',
  },
  fontSizeText: {
    fontSize: 14,
    color: isDarkMode ? '#fff' : '#333',
  },
  languageOptions: {
    flexDirection: 'row',
    gap: 10,
  },
  languageButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: isDarkMode ? '#555' : '#ddd',
  },
  selectedLanguage: {
    backgroundColor: '#007bff',
    borderColor: '#007bff',
  },
  languageText: {
    fontSize: 14,
    color: isDarkMode ? '#fff' : '#333',
  },
  logoutButton: {
    backgroundColor: '#dc3545',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  logoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  copyright: {
    padding: 20,
    alignItems: 'center',
  },
  copyrightText: {
    fontSize: 12,
    color: isDarkMode ? '#ccc' : '#666',
    textAlign: 'center',
  },
});

export default function SettingsScreen() {
   const [settings, setSettings] = useState<Settings>(defaultSettings);
   const isDarkMode = settings.appearance.darkMode;

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const savedSettings = await AsyncStorage.getItem('driverSettings');
      if (savedSettings) {
        setSettings({ ...defaultSettings, ...JSON.parse(savedSettings) });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveSettings = async (newSettings: Settings) => {
    try {
      await AsyncStorage.setItem('driverSettings', JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  const updateSetting = (category: keyof Settings, key: string, value: any) => {
    const newSettings = {
      ...settings,
      [category]: {
        ...settings[category],
        [key]: value,
      },
    };
    saveSettings(newSettings);
  };


  const styles = getSettingsStyles(isDarkMode);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      {/* Notification Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notification Settings</Text>

        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>New Ride Notifications</Text>
          <Switch
            value={settings.notifications.rideOffers}
            onValueChange={(value) => updateSetting('notifications', 'rideOffers', value)}
          />
        </View>

        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Message Notifications</Text>
          <Switch
            value={settings.notifications.chatMessages}
            onValueChange={(value) => updateSetting('notifications', 'chatMessages', value)}
          />
        </View>

        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Ride Update Notifications</Text>
          <Switch
            value={settings.notifications.rideUpdates}
            onValueChange={(value) => updateSetting('notifications', 'rideUpdates', value)}
          />
        </View>

        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Vibration</Text>
          <Switch
            value={settings.notifications.vibration}
            onValueChange={(value) => updateSetting('notifications', 'vibration', value)}
          />
        </View>
      </View>

      {/* Sound Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sound Settings</Text>

        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Message Sound</Text>
          <Switch
            value={settings.sound.messageSound}
            onValueChange={(value) => updateSetting('sound', 'messageSound', value)}
          />
        </View>

        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Pickup & Dropoff Sound</Text>
          <Switch
            value={settings.sound.pickupDropoffSound}
            onValueChange={(value) => updateSetting('sound', 'pickupDropoffSound', value)}
          />
        </View>
      </View>

      {/* Appearance Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Appearance Settings</Text>

        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Dark Mode</Text>
          <Switch
            value={settings.appearance.darkMode}
            onValueChange={(value) => updateSetting('appearance', 'darkMode', value)}
          />
        </View>


        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Language</Text>
          <View style={styles.languageOptions}>
            <TouchableOpacity
              style={[styles.languageButton, settings.appearance.language === 'en' && styles.selectedLanguage]}
              onPress={() => updateSetting('appearance', 'language', 'en')}
            >
              <Text style={styles.languageText}>English</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>




      {/* General Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>General Settings</Text>

        <TouchableOpacity style={styles.settingItem} onPress={() => Alert.alert('Clear Cache', 'Cache cleared successfully')}>
          <Text style={styles.settingLabel}>Clear Cache</Text>
          <Text style={{ color: '#007bff' }}></Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingItem} onPress={() => Alert.alert('Report Issue', 'This feature will be implemented soon')}>
          <Text style={styles.settingLabel}>Report Issue</Text>
          <Text style={{ color: '#007bff' }}></Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingItem} onPress={() => Alert.alert('Contact Support', 'This feature will be implemented soon')}>
          <Text style={styles.settingLabel}>Contact Support</Text>
          <Text style={{ color: '#007bff' }}></Text>
        </TouchableOpacity>

        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>App Version</Text>
          <Text style={styles.settingLabel}>{settings.general.appVersion}</Text>
        </View>
      </View>

      {/* Copyright */}
      <View style={styles.copyright}>
        <Text style={styles.copyrightText}>© 2024 TrafikTaxa. All rights reserved.</Text>
      </View>
    </ScrollView>
  );
}
