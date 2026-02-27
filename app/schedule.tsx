import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { useTranslation } from '../src/hooks/useTranslation';
import {
  applyDriverScheduleSuggestions,
  deleteDriverScheduleException,
  getDriverSchedule,
  updateDriverScheduleTemplate,
  upsertDriverScheduleException,
} from '../src/services/api';

type ExceptionType = 'OFF' | 'LEAVE' | 'SICK' | 'CUSTOM' | 'EMERGENCY';

type ScheduleWindow = {
  start?: string;
  end?: string;
  startMinute?: number;
  endMinute?: number;
  isActive?: boolean;
};

type ScheduleDay = {
  dayOfWeek: number;
  dayName?: string;
  windows?: ScheduleWindow[];
};

type SchedulePreferences = {
  maxDailyMinutes?: number;
  maxWeeklyMinutes?: number;
  minRestMinutes?: number;
  lockMinutesBeforeStart?: number;
  allowEmergencyOverride?: boolean;
};

type ScheduleException = {
  id?: number;
  date: string;
  type: string;
  startMinute?: number | null;
  endMinute?: number | null;
  note?: string | null;
};

type ScheduleResponse = {
  ok: boolean;
  template?: ScheduleDay[];
  preferences?: SchedulePreferences;
  exceptions?: ScheduleException[];
  lockStatus?: {
    locked?: boolean;
    reasonMessage?: string;
  } | null;
  eligibility?: {
    reasonMessage?: string;
    eligible?: boolean;
  } | null;
};

type DayDraft = {
  dayOfWeek: number;
  dayName: string;
  enabled: boolean;
  start: string;
  end: string;
};

type PreferencesDraft = {
  maxDailyMinutes: string;
  maxWeeklyMinutes: string;
  minRestMinutes: string;
  lockMinutesBeforeStart: string;
  allowEmergencyOverride: boolean;
};

type ExceptionDraft = {
  date: string;
  type: ExceptionType;
  start: string;
  end: string;
  note: string;
};

const FALLBACK_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const EXCEPTION_TYPES: ExceptionType[] = ['OFF', 'LEAVE', 'SICK', 'CUSTOM', 'EMERGENCY'];
const LEGAL_MAX_DAILY_MINUTES = 11 * 60;

function isHHmm(value: string) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value.trim());
}

function minuteToHHmm(minute?: number | null) {
  if (!Number.isInteger(minute)) return null;
  const safeMinute = Math.max(0, Math.min(1439, Number(minute)));
  const hours = Math.floor(safeMinute / 60);
  const mins = safeMinute % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function hhmmToMinute(value: string) {
  if (!isHHmm(value)) return null;
  const [hourText, minuteText] = value.trim().split(':');
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  return hour * 60 + minute;
}

function windowDurationMinutes(startMinute: number, endMinute: number) {
  if (endMinute > startMinute) return endMinute - startMinute;
  return (1440 - startMinute) + endMinute;
}

function clampEndByMaxDuration(start: string, end: string, maxMinutes: number) {
  const startMinute = hhmmToMinute(start);
  const endMinute = hhmmToMinute(end);
  if (startMinute === null || endMinute === null) return end;

  const duration = windowDurationMinutes(startMinute, endMinute);
  if (duration <= maxMinutes) return end;

  const adjusted = (startMinute + maxMinutes) % 1440;
  return minuteToHHmm(adjusted) || end;
}

function clampStartByMaxDuration(start: string, end: string, maxMinutes: number) {
  const startMinute = hhmmToMinute(start);
  const endMinute = hhmmToMinute(end);
  if (startMinute === null || endMinute === null) return start;

  const duration = windowDurationMinutes(startMinute, endMinute);
  if (duration <= maxMinutes) return start;

  const adjusted = (endMinute - maxMinutes + 1440) % 1440;
  return minuteToHHmm(adjusted) || start;
}

export default function DriverScheduleScreen() {
  const router = useRouter();
  const { authState } = useAuth();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [savingException, setSavingException] = useState(false);
  const [applyingSuggestions, setApplyingSuggestions] = useState(false);

  const [days, setDays] = useState<DayDraft[]>([]);
  const [preferences, setPreferences] = useState<PreferencesDraft>({
    maxDailyMinutes: '600',
    maxWeeklyMinutes: '3360',
    minRestMinutes: '660',
    lockMinutesBeforeStart: '30',
    allowEmergencyOverride: true,
  });
  const [exceptions, setExceptions] = useState<ScheduleException[]>([]);
  const [lockStatus, setLockStatus] = useState<{ locked?: boolean; reasonMessage?: string } | null>(null);
  const [eligibilityMessage, setEligibilityMessage] = useState('');

  const maxDailyMinutes = Math.min(
    LEGAL_MAX_DAILY_MINUTES,
    Math.max(1, Number.parseInt(preferences.maxDailyMinutes || '600', 10) || 600)
  );

  const [exceptionDraft, setExceptionDraft] = useState<ExceptionDraft>({
    date: '',
    type: 'OFF',
    start: '08:00',
    end: '16:00',
    note: '',
  });

  const editingLocked = Boolean(lockStatus?.locked);

  const normalizeTemplate = (template: ScheduleDay[] = []): DayDraft[] => {
    const byDay = new Map<number, ScheduleDay>();
    for (const day of template) {
      if (Number.isInteger(day?.dayOfWeek)) {
        byDay.set(Number(day.dayOfWeek), day);
      }
    }

    return Array.from({ length: 7 }, (_, dayOfWeek) => {
      const row = byDay.get(dayOfWeek);
      const windows = Array.isArray(row?.windows) ? row!.windows! : [];
      const selectedWindow = windows.find((window) => window && window.isActive !== false) || windows[0];

      const start = typeof selectedWindow?.start === 'string'
        ? selectedWindow.start
        : minuteToHHmm(selectedWindow?.startMinute) || '08:00';
      const end = typeof selectedWindow?.end === 'string'
        ? selectedWindow.end
        : minuteToHHmm(selectedWindow?.endMinute) || '16:00';

      return {
        dayOfWeek,
        dayName: row?.dayName || FALLBACK_DAY_NAMES[dayOfWeek],
        enabled: Boolean(selectedWindow),
        start,
        end,
      };
    });
  };

  const applyResponseToState = (response: ScheduleResponse) => {
    setDays(normalizeTemplate(response.template || []));
    setPreferences({
      maxDailyMinutes: String(response.preferences?.maxDailyMinutes ?? 600),
      maxWeeklyMinutes: String(response.preferences?.maxWeeklyMinutes ?? 3360),
      minRestMinutes: String(response.preferences?.minRestMinutes ?? 660),
      lockMinutesBeforeStart: String(response.preferences?.lockMinutesBeforeStart ?? 30),
      allowEmergencyOverride: Boolean(response.preferences?.allowEmergencyOverride ?? true),
    });
    setExceptions(Array.isArray(response.exceptions) ? response.exceptions : []);
    setLockStatus(response.lockStatus || null);
    setEligibilityMessage(response.eligibility?.reasonMessage || '');
  };

  const loadSchedule = async () => {
    if (!authState.token) return;
    try {
      setLoading(true);
      const response = (await getDriverSchedule(authState.token)) as ScheduleResponse;
      if (!response?.ok) {
        throw new Error(t('schedule_load_failed'));
      }
      applyResponseToState(response);
    } catch (error: any) {
      Alert.alert(t('error'), error?.message || t('schedule_load_failed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchedule();
  }, [authState.token]);

  const updateDayDraft = (dayOfWeek: number, patch: Partial<DayDraft>, source: 'start' | 'end' | 'other' = 'other') => {
    setDays((prev) => prev.map((day) => {
      if (day.dayOfWeek !== dayOfWeek) return day;
      let nextDay = { ...day, ...patch };

      if (nextDay.enabled && isHHmm(nextDay.start) && isHHmm(nextDay.end)) {
        if (source === 'start') {
          nextDay = {
            ...nextDay,
            end: clampEndByMaxDuration(nextDay.start, nextDay.end, maxDailyMinutes)
          };
        } else if (source === 'end') {
          nextDay = {
            ...nextDay,
            start: clampStartByMaxDuration(nextDay.start, nextDay.end, maxDailyMinutes)
          };
        } else {
          nextDay = {
            ...nextDay,
            end: clampEndByMaxDuration(nextDay.start, nextDay.end, maxDailyMinutes)
          };
        }
      }

      return nextDay;
    }));
  };

  const handleSaveTemplate = async () => {
    if (!authState.token) return;

    for (const day of days) {
      if (!day.enabled) continue;
      if (!isHHmm(day.start) || !isHHmm(day.end) || day.start === day.end) {
        Alert.alert(t('error'), t('schedule_invalid_time'));
        return;
      }

      const startMinute = hhmmToMinute(day.start);
      const endMinute = hhmmToMinute(day.end);
      if (startMinute === null || endMinute === null) {
        Alert.alert(t('error'), t('schedule_invalid_time'));
        return;
      }

      const duration = windowDurationMinutes(startMinute, endMinute);
      if (duration > maxDailyMinutes) {
        Alert.alert(t('error'), t('schedule_daily_max_exceeded', { hours: Math.floor(maxDailyMinutes / 60) }));
        return;
      }
    }

    try {
      setSavingTemplate(true);
      await updateDriverScheduleTemplate(
        authState.token,
        days.map((day) => ({
          dayOfWeek: day.dayOfWeek,
          windows: day.enabled
            ? [{ start: day.start.trim(), end: day.end.trim(), isActive: true }]
            : [],
        }))
      );
      Alert.alert(t('success'), t('schedule_save_success'));
      await loadSchedule();
    } catch (error: any) {
      Alert.alert(t('error'), error?.message || t('schedule_load_failed'));
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleSaveException = async () => {
    if (!authState.token) return;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(exceptionDraft.date.trim())) {
      Alert.alert(t('error'), t('schedule_invalid_date'));
      return;
    }

    if (exceptionDraft.type === 'CUSTOM') {
      if (!isHHmm(exceptionDraft.start) || !isHHmm(exceptionDraft.end) || exceptionDraft.start === exceptionDraft.end) {
        Alert.alert(t('error'), t('schedule_invalid_time'));
        return;
      }
    }

    try {
      setSavingException(true);
      await upsertDriverScheduleException(authState.token, {
        date: exceptionDraft.date.trim(),
        type: exceptionDraft.type,
        start: exceptionDraft.type === 'CUSTOM' ? exceptionDraft.start.trim() : undefined,
        end: exceptionDraft.type === 'CUSTOM' ? exceptionDraft.end.trim() : undefined,
        note: exceptionDraft.note.trim() || undefined,
      });
      Alert.alert(t('success'), t('schedule_exception_saved'));
      await loadSchedule();
    } catch (error: any) {
      Alert.alert(t('error'), error?.message || t('schedule_load_failed'));
    } finally {
      setSavingException(false);
    }
  };

  const handleDeleteException = (date: string) => {
    if (!authState.token) return;

    Alert.alert(t('schedule_delete_exception'), date, [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('yes'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDriverScheduleException(authState.token!, date);
            Alert.alert(t('success'), t('schedule_exception_deleted'));
            await loadSchedule();
          } catch (error: any) {
            Alert.alert(t('error'), error?.message || t('schedule_load_failed'));
          }
        },
      },
    ]);
  };

  const handleApplySuggestions = async () => {
    if (!authState.token) return;

    try {
      setApplyingSuggestions(true);
      await applyDriverScheduleSuggestions(authState.token, 42);
      Alert.alert(t('success'), t('schedule_suggestions_applied'));
      await loadSchedule();
    } catch (error: any) {
      Alert.alert(t('error'), error?.message || t('schedule_load_failed'));
    } finally {
      setApplyingSuggestions(false);
    }
  };

  const getExceptionTypeLabel = (type: string) => {
    switch (String(type || '').toUpperCase()) {
      case 'OFF':
        return t('schedule_type_off');
      case 'LEAVE':
        return t('schedule_type_leave');
      case 'SICK':
        return t('schedule_type_sick');
      case 'CUSTOM':
        return t('schedule_type_custom');
      case 'EMERGENCY':
        return t('schedule_type_emergency');
      default:
        return type;
    }
  };

  const sortedExceptions = useMemo(
    () => [...exceptions].sort((a, b) => String(a.date).localeCompare(String(b.date))),
    [exceptions]
  );

  const disabled = loading || editingLocked;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>❮</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('work_schedule')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color="#0ea5e9" />
          <Text style={styles.loaderText}>{t('loading')}</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {editingLocked && (
            <View style={[styles.noticeCard, styles.noticeWarning]}>
              <Text style={styles.noticeTitle}>{t('schedule_locked_title')}</Text>
              <Text style={styles.noticeBody}>{lockStatus?.reasonMessage || t('schedule_locked_default')}</Text>
            </View>
          )}

          {!!eligibilityMessage && (
            <View style={styles.noticeCard}>
              <Text style={styles.noticeBody}>{eligibilityMessage}</Text>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('schedule_weekly_template')}</Text>
            {days.map((day) => (
              <View style={styles.dayCard} key={day.dayOfWeek}>
                <View style={styles.dayHeader}>
                  <Text style={styles.dayTitle}>{day.dayName}</Text>
                  <View style={styles.daySwitchWrap}>
                    <Text style={styles.daySwitchLabel}>{t('schedule_day_enabled')}</Text>
                    <Switch
                      value={day.enabled}
                      onValueChange={(value) => updateDayDraft(day.dayOfWeek, { enabled: value })}
                      disabled={disabled}
                      trackColor={{ false: '#cbd5e1', true: '#38bdf8' }}
                      thumbColor={day.enabled ? '#0ea5e9' : '#f8fafc'}
                    />
                  </View>
                </View>

                {day.enabled && (
                  <View style={styles.timeRow}>
                    <View style={styles.timeInputWrap}>
                      <Text style={styles.label}>{t('schedule_start')}</Text>
                      <TextInput
                        style={[styles.input, disabled && styles.inputDisabled]}
                        value={day.start}
                        onChangeText={(text) => updateDayDraft(day.dayOfWeek, { start: text }, 'start')}
                        editable={!disabled}
                        placeholder="08:00"
                        autoCapitalize="none"
                      />
                    </View>
                    <View style={styles.timeInputWrap}>
                      <Text style={styles.label}>{t('schedule_end')}</Text>
                      <TextInput
                        style={[styles.input, disabled && styles.inputDisabled]}
                        value={day.end}
                        onChangeText={(text) => updateDayDraft(day.dayOfWeek, { end: text }, 'end')}
                        editable={!disabled}
                        placeholder="16:00"
                        autoCapitalize="none"
                      />
                    </View>
                  </View>
                )}
              </View>
            ))}

            <TouchableOpacity
              style={[styles.primaryButton, (disabled || savingTemplate) && styles.buttonDisabled]}
              onPress={handleSaveTemplate}
              disabled={disabled || savingTemplate}
            >
              <Text style={styles.primaryButtonText}>
                {savingTemplate ? t('loading') : t('schedule_save_template')}
              </Text>
            </TouchableOpacity>

            <Text style={styles.helperText}>
              {t('schedule_daily_max_hint', { hours: Math.floor(maxDailyMinutes / 60) })}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('schedule_preferences')}</Text>

            <View style={styles.noticeCard}>
              <Text style={styles.noticeBody}>{t('schedule_preferences_admin_only')}</Text>
            </View>

            <View style={styles.readonlyRow}>
              <Text style={styles.readonlyLabel}>{t('schedule_max_daily_minutes')}</Text>
              <Text style={styles.readonlyValue}>{preferences.maxDailyMinutes}</Text>
            </View>
            <View style={styles.readonlyRow}>
              <Text style={styles.readonlyLabel}>{t('schedule_max_weekly_minutes')}</Text>
              <Text style={styles.readonlyValue}>{preferences.maxWeeklyMinutes}</Text>
            </View>
            <View style={styles.readonlyRow}>
              <Text style={styles.readonlyLabel}>{t('schedule_min_rest_minutes')}</Text>
              <Text style={styles.readonlyValue}>{preferences.minRestMinutes}</Text>
            </View>
            <View style={styles.readonlyRow}>
              <Text style={styles.readonlyLabel}>{t('schedule_lock_minutes_before_start')}</Text>
              <Text style={styles.readonlyValue}>{preferences.lockMinutesBeforeStart}</Text>
            </View>
            <View style={styles.readonlyRow}>
              <Text style={styles.readonlyLabel}>{t('schedule_allow_emergency_override')}</Text>
              <Text style={styles.readonlyValue}>{preferences.allowEmergencyOverride ? t('yes') : t('no')}</Text>
            </View>

            <TouchableOpacity
              style={[styles.secondaryButton, (disabled || applyingSuggestions) && styles.buttonDisabled]}
              onPress={handleApplySuggestions}
              disabled={disabled || applyingSuggestions}
            >
              <Text style={styles.secondaryButtonText}>
                {applyingSuggestions ? t('loading') : t('schedule_apply_suggestions')}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('schedule_exceptions')}</Text>

            <View style={styles.inputBlock}>
              <Text style={styles.label}>{t('schedule_date')}</Text>
              <TextInput
                style={[styles.input, disabled && styles.inputDisabled]}
                value={exceptionDraft.date}
                onChangeText={(text) => setExceptionDraft((prev) => ({ ...prev, date: text }))}
                editable={!disabled}
                placeholder="YYYY-MM-DD"
                autoCapitalize="none"
              />
            </View>

            <Text style={styles.label}>{t('schedule_type')}</Text>
            <View style={styles.typeWrap}>
              {EXCEPTION_TYPES.map((type) => {
                const active = exceptionDraft.type === type;
                return (
                  <TouchableOpacity
                    key={type}
                    style={[styles.typeButton, active && styles.typeButtonActive, disabled && styles.buttonDisabled]}
                    onPress={() => setExceptionDraft((prev) => ({ ...prev, type }))}
                    disabled={disabled}
                  >
                    <Text style={[styles.typeText, active && styles.typeTextActive]}>{getExceptionTypeLabel(type)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {exceptionDraft.type === 'CUSTOM' && (
              <View style={styles.timeRow}>
                <View style={styles.timeInputWrap}>
                  <Text style={styles.label}>{t('schedule_start')}</Text>
                  <TextInput
                    style={[styles.input, disabled && styles.inputDisabled]}
                    value={exceptionDraft.start}
                    onChangeText={(text) => setExceptionDraft((prev) => ({ ...prev, start: text }))}
                    editable={!disabled}
                    placeholder="08:00"
                  />
                </View>
                <View style={styles.timeInputWrap}>
                  <Text style={styles.label}>{t('schedule_end')}</Text>
                  <TextInput
                    style={[styles.input, disabled && styles.inputDisabled]}
                    value={exceptionDraft.end}
                    onChangeText={(text) => setExceptionDraft((prev) => ({ ...prev, end: text }))}
                    editable={!disabled}
                    placeholder="16:00"
                  />
                </View>
              </View>
            )}

            <View style={styles.inputBlock}>
              <Text style={styles.label}>{t('schedule_note')}</Text>
              <TextInput
                style={[styles.input, disabled && styles.inputDisabled]}
                value={exceptionDraft.note}
                onChangeText={(text) => setExceptionDraft((prev) => ({ ...prev, note: text }))}
                editable={!disabled}
                placeholder={t('schedule_note')}
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, (disabled || savingException) && styles.buttonDisabled]}
              onPress={handleSaveException}
              disabled={disabled || savingException}
            >
              <Text style={styles.primaryButtonText}>
                {savingException ? t('loading') : t('schedule_save_exception')}
              </Text>
            </TouchableOpacity>

            <View style={styles.exceptionList}>
              {sortedExceptions.length === 0 ? (
                <Text style={styles.emptyText}>{t('schedule_no_exceptions')}</Text>
              ) : (
                sortedExceptions.map((item) => {
                  const customStart = minuteToHHmm(item.startMinute);
                  const customEnd = minuteToHHmm(item.endMinute);
                  const customWindow = String(item.type).toUpperCase() === 'CUSTOM'
                    ? ` ${t('schedule_custom_window')}: ${customStart || '--:--'} - ${customEnd || '--:--'}`
                    : '';

                  return (
                    <View key={`${item.date}-${item.type}`} style={styles.exceptionItem}>
                      <View style={styles.exceptionTextWrap}>
                        <Text style={styles.exceptionTitle}>{item.date}</Text>
                        <Text style={styles.exceptionBody}>
                          {getExceptionTypeLabel(String(item.type).toUpperCase())}
                          {customWindow}
                        </Text>
                        {!!item.note && <Text style={styles.exceptionNote}>{item.note}</Text>}
                      </View>
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => handleDeleteException(item.date)}
                        disabled={disabled}
                      >
                        <Text style={styles.deleteButtonText}>{t('schedule_delete_exception')}</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  backButtonText: {
    fontSize: 20,
    color: '#0ea5e9',
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  headerSpacer: {
    width: 30,
  },
  loaderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loaderText: {
    color: '#475569',
    fontSize: 14,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 28,
    gap: 14,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 10,
  },
  noticeCard: {
    backgroundColor: '#e0f2fe',
    borderColor: '#bae6fd',
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  noticeWarning: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#9a3412',
    marginBottom: 2,
  },
  noticeBody: {
    fontSize: 13,
    color: '#0f172a',
  },
  dayCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    backgroundColor: '#f8fafc',
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  dayTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
  },
  daySwitchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  daySwitchLabel: {
    fontSize: 12,
    color: '#334155',
  },
  timeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  timeInputWrap: {
    flex: 1,
  },
  inputBlock: {
    marginBottom: 10,
  },
  label: {
    fontSize: 13,
    color: '#334155',
    marginBottom: 5,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    color: '#0f172a',
  },
  inputDisabled: {
    backgroundColor: '#f1f5f9',
    color: '#94a3b8',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  readonlyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  readonlyLabel: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
    flex: 1,
  },
  readonlyValue: {
    fontSize: 13,
    color: '#0f172a',
    fontWeight: '700',
    marginLeft: 8,
  },
  primaryButton: {
    backgroundColor: '#0ea5e9',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: '#e0f2fe',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#7dd3fc',
  },
  secondaryButtonText: {
    color: '#075985',
    fontSize: 14,
    fontWeight: '700',
  },
  helperText: {
    marginTop: 8,
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  typeWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  typeButton: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  typeButtonActive: {
    borderColor: '#0ea5e9',
    backgroundColor: '#e0f2fe',
  },
  typeText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
  },
  typeTextActive: {
    color: '#0369a1',
  },
  exceptionList: {
    marginTop: 12,
    gap: 8,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 13,
  },
  exceptionItem: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 10,
    backgroundColor: '#f8fafc',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  exceptionTextWrap: {
    flex: 1,
    gap: 2,
  },
  exceptionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  exceptionBody: {
    fontSize: 13,
    color: '#334155',
  },
  exceptionNote: {
    fontSize: 12,
    color: '#64748b',
  },
  deleteButton: {
    alignSelf: 'center',
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  deleteButtonText: {
    color: '#b91c1c',
    fontSize: 12,
    fontWeight: '700',
  },
});
