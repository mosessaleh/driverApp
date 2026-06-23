import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSettings } from '../../src/context/SettingsContext';
import { useTranslation } from '../../src/hooks/useTranslation';

type Props = {
  visible: boolean;
  onEndShift: () => void;
  onDismiss: () => void;
};

export default function ShiftWarningModal({ visible, onEndShift, onDismiss }: Props) {
  const { isDarkMode } = useSettings();
  const { t } = useTranslation();
  const styles = React.useMemo(() => getStyles(isDarkMode), [isDarkMode]);

  if (!visible) return null;

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.shiftWarningModal}>
        <Text style={styles.shiftWarningTitle}>{t('shift_duration_warning_title')}</Text>
        <Text style={styles.shiftWarningMessage}>{t('shift_duration_warning_message_1')}</Text>
        <Text style={styles.shiftWarningMessage}>{t('shift_duration_warning_message_2')}</Text>
        <View style={styles.shiftWarningButtons}>
          <TouchableOpacity style={[styles.shiftWarningButton, styles.shiftEndShiftButton]} onPress={onEndShift}>
            <Text style={styles.endShiftButtonText}>{t('end_shift_now')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.shiftWarningButton, styles.laterButton]} onPress={onDismiss}>
            <Text style={styles.laterButtonText}>{t('remind_me_later')}</Text>
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
    zIndex: 2000,
  },
  shiftWarningModal: {
    backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 12,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(148,163,184,0.2)' : '#e2e8f0',
  },
  shiftWarningTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#dc3545',
    marginBottom: 12,
    textAlign: 'center',
  },
  shiftWarningMessage: {
    fontSize: 14,
    color: isDarkMode ? '#94a3b8' : '#475569',
    marginBottom: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  shiftWarningButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 8,
  },
  shiftWarningButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  shiftEndShiftButton: {
    backgroundColor: '#dc3545',
  },
  endShiftButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  laterButton: {
    backgroundColor: isDarkMode ? 'rgba(148,163,184,0.2)' : '#e2e8f0',
  },
  laterButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: isDarkMode ? '#cbd5e1' : '#475569',
  },
});
