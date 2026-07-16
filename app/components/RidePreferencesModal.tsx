import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSettings } from '../../src/context/SettingsContext';
import { useTranslation } from '../../src/hooks/useTranslation';

type Props = {
  visible: boolean;
  token: string;
  onSave: () => void;
  onCancel: () => void;
};

export default function RidePreferencesModal({ visible, token, onSave, onCancel }: Props) {
  const { isDarkMode } = useSettings();
  const { t } = useTranslation();
  const [minDistance, setMinDistance] = useState('');
  const [minTime, setMinTime] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    import('../../src/services/api').then(({ getRidePreferences }) => {
      getRidePreferences(token)
        .then((res) => {
          if (res?.preferences) {
            setMinDistance(String(res.preferences.minDistanceKm));
            setMinTime(String(res.preferences.minTimeMinutes));
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    });
  }, [visible, token]);

  const handleSave = async () => {
    const distance = parseFloat(minDistance);
    const time = parseInt(minTime, 10);
    if (isNaN(distance) || isNaN(time)) {
      Alert.alert(t('error'), t('ride_preferences_required'));
      return;
    }
    setSaving(true);
    try {
      const { saveRidePreferences } = await import('../../src/services/api');
      await saveRidePreferences(distance, time, token);
      onSave();
    } catch (error) {
      Alert.alert(t('error'), (error as any)?.message || t('error'));
    } finally {
      setSaving(false);
    }
  };

  if (!visible) return null;

  const s = getStyles(isDarkMode);

  return (
    <View style={s.overlay}>
      <View style={s.modal}>
        <Text style={s.title}>{t('ride_preferences_title')}</Text>
        <Text style={s.message}>{t('ride_preferences_message')}</Text>

        {loading ? (
          <ActivityIndicator
            size="large"
            color={isDarkMode ? '#60a5fa' : '#007bff'}
            style={{ marginVertical: 20 }}
          />
        ) : (
          <>
            <Text style={s.label}>{t('ride_preferences_min_distance')}</Text>
            <Text style={s.hint}>{t('ride_preferences_min_distance_hint')}</Text>
            <TextInput
              style={s.input}
              value={minDistance}
              onChangeText={setMinDistance}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={isDarkMode ? '#64748b' : '#94a3b8'}
            />

            <Text style={s.label}>{t('ride_preferences_min_time')}</Text>
            <Text style={s.hint}>{t('ride_preferences_min_time_hint')}</Text>
            <TextInput
              style={s.input}
              value={minTime}
              onChangeText={setMinTime}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={isDarkMode ? '#64748b' : '#94a3b8'}
            />
          </>
        )}

        <View style={s.buttons}>
          <TouchableOpacity style={s.cancelBtn} onPress={onCancel} disabled={saving}>
            <Text style={s.cancelText}>{t('cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={loading || saving}>
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={s.saveText}>{t('ride_preferences_save')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const getStyles = (isDark: boolean) =>
  StyleSheet.create({
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 5000,
      elevation: 5000,
    },
    modal: {
      backgroundColor: isDark ? '#1e293b' : '#fff',
      borderRadius: 16,
      padding: 24,
      width: '90%',
      maxWidth: 400,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(148,163,184,0.2)' : '#e2e8f0',
    },
    title: {
      fontSize: 20,
      fontWeight: 'bold',
      color: isDark ? '#f1f5f9' : '#0f172a',
      marginBottom: 12,
      textAlign: 'center',
    },
    message: {
      fontSize: 14,
      color: isDark ? '#94a3b8' : '#64748b',
      marginBottom: 20,
      textAlign: 'center',
      lineHeight: 20,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: isDark ? '#e2e8f0' : '#334155',
      marginBottom: 4,
    },
    hint: { fontSize: 12, color: isDark ? '#64748b' : '#94a3b8', marginBottom: 8 },
    input: {
      borderWidth: 1,
      borderColor: isDark ? 'rgba(148,163,184,0.3)' : '#cbd5e1',
      borderRadius: 12,
      padding: 14,
      fontSize: 18,
      color: isDark ? '#f1f5f9' : '#0f172a',
      marginBottom: 16,
      textAlign: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc',
    },
    buttons: { flexDirection: 'row', gap: 12 },
    cancelBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(148,163,184,0.2)' : '#e2e8f0',
    },
    cancelText: { fontSize: 16, fontWeight: '600', color: isDark ? '#cbd5e1' : '#475569' },
    saveBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
      backgroundColor: '#007bff',
    },
    saveText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  });
