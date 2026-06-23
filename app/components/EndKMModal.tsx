import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useSettings } from '../../src/context/SettingsContext';
import { useTranslation } from '../../src/hooks/useTranslation';

type Props = {
  visible: boolean;
  endKM: string;
  onChangeKM: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function EndKMModal({ visible, endKM, onChangeKM, onCancel, onConfirm }: Props) {
  const { isDarkMode } = useSettings();
  const { t } = useTranslation();
  const styles = React.useMemo(() => getStyles(isDarkMode), [isDarkMode]);

  if (!visible) return null;

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.endShiftMenu}>
        <Text style={styles.endShiftTitle}>{t('end_shift_title')}</Text>
        <Text style={styles.endShiftMessage}>{t('end_shift_message')}</Text>
        <TextInput
          style={styles.kmInput}
          placeholder={t('end_shift_placeholder')}
          value={endKM}
          onChangeText={onChangeKM}
          keyboardType="numeric"
          placeholderTextColor="#999"
        />
        <View style={styles.endShiftButtons}>
          <TouchableOpacity style={[styles.endShiftButton, styles.cancelButton]} onPress={onCancel}>
            <Text style={styles.cancelButtonText}>{t('cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.endShiftButton, styles.confirmButton]} onPress={onConfirm}>
            <Text style={styles.confirmButtonText}>{t('end_shift')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const getStyles = (isDarkMode: boolean) => StyleSheet.create({
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 4000,
    elevation: 4000,
  },
  endShiftMenu: {
    backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 24,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(148,163,184,0.2)' : '#e2e8f0',
  },
  endShiftTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: isDarkMode ? '#f1f5f9' : '#0f172a',
    marginBottom: 12,
    textAlign: 'center',
  },
  endShiftMessage: {
    fontSize: 14,
    color: isDarkMode ? '#94a3b8' : '#64748b',
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 20,
  },
  kmInput: {
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(148,163,184,0.3)' : '#cbd5e1',
    borderRadius: 12,
    padding: 14,
    fontSize: 18,
    color: isDarkMode ? '#f1f5f9' : '#0f172a',
    marginBottom: 20,
    textAlign: 'center',
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#f8fafc',
  },
  endShiftButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  endShiftButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: isDarkMode ? 'rgba(148,163,184,0.2)' : '#e2e8f0',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: isDarkMode ? '#cbd5e1' : '#475569',
  },
  confirmButton: {
    backgroundColor: '#dc3545',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});
