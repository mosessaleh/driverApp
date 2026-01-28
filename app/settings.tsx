import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../src/context/AuthContext';
import { useSettings } from '../src/context/SettingsContext';
import { useTranslation } from '../src/hooks/useTranslation';

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
    backgroundColor: isDarkMode ? '#0f0f0f' : '#ffffff',
  },
  header: {
    backgroundColor: isDarkMode ? 'rgba(40,40,40,0.9)' : 'rgba(255,255,255,0.9)',
    padding: 25,
    borderBottomWidth: 1,
    borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: isDarkMode ? '#fff' : '#333',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  section: {
    backgroundColor: isDarkMode ? 'rgba(40,40,40,0.9)' : 'rgba(255,255,255,0.9)',
    marginTop: 15,
    padding: 25,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: isDarkMode ? '#fff' : '#333',
    marginBottom: 20,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
  },
  settingLabel: {
    fontSize: 16,
    color: isDarkMode ? '#fff' : '#333',
    flex: 1,
    fontWeight: '500',
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
    const { settings, updateSetting, isDarkMode, isRTL } = useSettings();
    const { t, changeLanguage } = useTranslation();


  const styles = getSettingsStyles(isDarkMode);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('settings')}</Text>
      </View>

      {/* Notification Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('notification_settings')}</Text>

        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>{t('new_ride_notifications')}</Text>
          <Switch
            value={settings.notifications.rideOffers}
            onValueChange={(value) => updateSetting('notifications', 'rideOffers', value)}
          />
        </View>

        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>{t('message_notifications')}</Text>
          <Switch
            value={settings.notifications.chatMessages}
            onValueChange={(value) => updateSetting('notifications', 'chatMessages', value)}
          />
        </View>

        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>{t('ride_update_notifications')}</Text>
          <Switch
            value={settings.notifications.rideUpdates}
            onValueChange={(value) => updateSetting('notifications', 'rideUpdates', value)}
          />
        </View>

        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>{t('vibration')}</Text>
          <Switch
            value={settings.notifications.vibration}
            onValueChange={(value) => updateSetting('notifications', 'vibration', value)}
          />
        </View>
      </View>

      {/* Sound Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('sound_settings')}</Text>

        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>{t('message_sound')}</Text>
          <Switch
            value={settings.sound.messageSound}
            onValueChange={(value) => updateSetting('sound', 'messageSound', value)}
          />
        </View>

        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>{t('pickup_dropoff_sound')}</Text>
          <Switch
            value={settings.sound.pickupDropoffSound}
            onValueChange={(value) => updateSetting('sound', 'pickupDropoffSound', value)}
          />
        </View>
      </View>

      {/* Appearance Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('appearance_settings')}</Text>

        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>{t('dark_mode')}</Text>
          <Switch
            value={settings.appearance.darkMode}
            onValueChange={(value) => updateSetting('appearance', 'darkMode', value)}
          />
        </View>

        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>{t('language')}</Text>
          <View style={styles.languageOptions}>
            <TouchableOpacity
              style={[styles.languageButton, settings.appearance.language === 'en' && styles.selectedLanguage]}
              onPress={() => {
                updateSetting('appearance', 'language', 'en');
                changeLanguage('en');
              }}
            >
              <Text style={styles.languageText}>English</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.languageButton, settings.appearance.language === 'ar' && styles.selectedLanguage]}
              onPress={() => {
                updateSetting('appearance', 'language', 'ar');
                changeLanguage('ar');
              }}
            >
              <Text style={styles.languageText}>العربية</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.languageButton, settings.appearance.language === 'da' && styles.selectedLanguage]}
              onPress={() => {
                updateSetting('appearance', 'language', 'da');
                changeLanguage('da');
              }}
            >
              <Text style={styles.languageText}>Dansk</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* General Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('general_settings')}</Text>

        <TouchableOpacity style={styles.settingItem} onPress={() => Alert.alert(t('clear_cache'), 'Cache cleared successfully')}>
          <Text style={styles.settingLabel}>{t('clear_cache')}</Text>
          <Text style={{ color: '#007bff' }}></Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingItem} onPress={() => Alert.alert(t('report_issue'), 'This feature will be implemented soon')}>
          <Text style={styles.settingLabel}>{t('report_issue')}</Text>
          <Text style={{ color: '#007bff' }}></Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingItem} onPress={() => Alert.alert(t('contact_support'), 'This feature will be implemented soon')}>
          <Text style={styles.settingLabel}>{t('contact_support')}</Text>
          <Text style={{ color: '#007bff' }}></Text>
        </TouchableOpacity>

        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>{t('app_version')}</Text>
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
