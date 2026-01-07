import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
    language: 'ar',
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

interface SettingsContextType {
  settings: Settings;
  updateSetting: (category: keyof Settings, key: string, value: any) => void;
  isDarkMode: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

interface SettingsProviderProps {
  children: ReactNode;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({ children }) => {
  const [settings, setSettings] = useState<Settings>(defaultSettings);

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

  const isDarkMode = settings.appearance.darkMode;

  return (
    <SettingsContext.Provider value={{ settings, updateSetting, isDarkMode }}>
      {children}
    </SettingsContext.Provider>
  );
};