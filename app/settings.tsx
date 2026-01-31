import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity, StatusBar } from 'react-native';
import { useAuth } from '../src/context/AuthContext';
import { useSettings } from '../src/context/SettingsContext';
import { useTranslation } from '../src/hooks/useTranslation';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../src/components/Card';
import { Button } from '../src/components/Button';
import { colors, spacing, shadows, getThemeColors, borderRadius } from '../src/theme';

interface SettingItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  value?: boolean;
  onValueChange?: (value: boolean) => void;
  onPress?: () => void;
  showArrow?: boolean;
  isDarkMode: boolean;
  iconColor?: string;
  iconBgColor?: string;
  isLast?: boolean;
}

const SettingItem: React.FC<SettingItemProps> = ({
  icon,
  title,
  subtitle,
  value,
  onValueChange,
  onPress,
  showArrow = false,
  isDarkMode,
  iconColor = colors.primary[500],
  iconBgColor = colors.primary[100],
  isLast = false,
}) => {
  const themeColors = getThemeColors(isDarkMode);
  
  const content = (
    <View style={[styles.settingItem, !isLast && { borderBottomColor: themeColors.neutral.border, borderBottomWidth: 1 }]}>
      <View style={[styles.iconContainer, { backgroundColor: iconBgColor }]}>
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>
      <View style={styles.settingContent}>
        <Text style={[styles.settingTitle, { color: themeColors.neutral.text }]}>
          {title}
        </Text>
        {subtitle && (
          <Text style={[styles.settingSubtitle, { color: themeColors.neutral.textSecondary }]}>
            {subtitle}
          </Text>
        )}
      </View>
      {onValueChange !== undefined && (
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: themeColors.neutral.border, true: colors.primary[500] }}
          thumbColor={value ? '#fff' : '#f4f3f4'}
        />
      )}
      {showArrow && (
        <Ionicons name="chevron-forward" size={20} color={themeColors.neutral.textTertiary} />
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

export default function SettingsScreen() {
  const { settings, updateSetting, isDarkMode } = useSettings();
  const { t, changeLanguage } = useTranslation();
  const { logout } = useAuth();
  const router = useRouter();
  const themeColors = getThemeColors(isDarkMode);
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  const handleLanguageChange = (lang: 'en' | 'ar' | 'da') => {
    updateSetting('appearance', 'language', lang);
    changeLanguage(lang);
    setShowLanguageSelector(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.neutral.background }]}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={themeColors.neutral.background}
      />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: themeColors.neutral.surface, ...shadows.sm }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.primary[500]} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.neutral.text }]}>
          {t('settings')}
        </Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Notifications Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: themeColors.neutral.textSecondary }]}>
            {t('notification_settings')}
          </Text>
          <Card variant="default" isDarkMode={isDarkMode} padding="none">
            <SettingItem
              icon="notifications-outline"
              title={t('new_ride_notifications')}
              subtitle="Get notified about new ride requests"
              value={settings.notifications.rideOffers}
              onValueChange={(value) => updateSetting('notifications', 'rideOffers', value)}
              isDarkMode={isDarkMode}
              iconColor={colors.info[500]}
              iconBgColor={colors.info[100]}
            />
            <SettingItem
              icon="chatbubble-outline"
              title={t('message_notifications')}
              subtitle="Notifications for passenger messages"
              value={settings.notifications.chatMessages}
              onValueChange={(value) => updateSetting('notifications', 'chatMessages', value)}
              isDarkMode={isDarkMode}
              iconColor={colors.success[500]}
              iconBgColor={colors.success[100]}
            />
            <SettingItem
              icon="refresh-outline"
              title={t('ride_update_notifications')}
              subtitle="Updates about ride status changes"
              value={settings.notifications.rideUpdates}
              onValueChange={(value) => updateSetting('notifications', 'rideUpdates', value)}
              isDarkMode={isDarkMode}
              iconColor={colors.warning[500]}
              iconBgColor={colors.warning[100]}
            />
            <SettingItem
              icon="phone-portrait-outline"
              title={t('vibration')}
              subtitle="Vibrate on notifications"
              value={settings.notifications.vibration}
              onValueChange={(value) => updateSetting('notifications', 'vibration', value)}
              isDarkMode={isDarkMode}
              iconColor={colors.primary[500]}
              iconBgColor={colors.primary[100]}
              isLast
            />
          </Card>
        </View>

        {/* Sound Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: themeColors.neutral.textSecondary }]}>
            {t('sound_settings')}
          </Text>
          <Card variant="default" isDarkMode={isDarkMode} padding="none">
            <SettingItem
              icon="musical-note-outline"
              title={t('message_sound')}
              subtitle="Play sound for new messages"
              value={settings.sound.messageSound}
              onValueChange={(value) => updateSetting('sound', 'messageSound', value)}
              isDarkMode={isDarkMode}
              iconColor={colors.success[500]}
              iconBgColor={colors.success[100]}
            />
            <SettingItem
              icon="car-outline"
              title={t('pickup_dropoff_sound')}
              subtitle="Sounds for pickup and dropoff"
              value={settings.sound.pickupDropoffSound}
              onValueChange={(value) => updateSetting('sound', 'pickupDropoffSound', value)}
              isDarkMode={isDarkMode}
              iconColor={colors.info[500]}
              iconBgColor={colors.info[100]}
              isLast
            />
          </Card>
        </View>

        {/* Appearance Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: themeColors.neutral.textSecondary }]}>
            {t('appearance_settings')}
          </Text>
          <Card variant="default" isDarkMode={isDarkMode} padding="none">
            <SettingItem
              icon={isDarkMode ? "moon" : "sunny"}
              title={t('dark_mode')}
              subtitle="Use dark theme"
              value={settings.appearance.darkMode}
              onValueChange={(value) => updateSetting('appearance', 'darkMode', value)}
              isDarkMode={isDarkMode}
              iconColor={colors.primary[500]}
              iconBgColor={colors.primary[100]}
            />
            <SettingItem
              icon="language-outline"
              title={t('language')}
              subtitle={settings.appearance.language === 'en' ? 'English' : settings.appearance.language === 'ar' ? 'العربية' : 'Dansk'}
              onPress={() => setShowLanguageSelector(!showLanguageSelector)}
              showArrow
              isDarkMode={isDarkMode}
              iconColor={colors.warning[500]}
              iconBgColor={colors.warning[100]}
              isLast
            />
            
            {/* Language Selector */}
            {showLanguageSelector && (
              <View style={[styles.languageSelector, { backgroundColor: themeColors.neutral.surfaceVariant }]}>
                {[
                  { code: 'en', label: 'English', flag: '🇬🇧' },
                  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
                  { code: 'da', label: 'Dansk', flag: '🇩🇰' },
                ].map((lang) => (
                  <TouchableOpacity
                    key={lang.code}
                    style={[
                      styles.languageOption,
                      settings.appearance.language === lang.code && { backgroundColor: colors.primary[100] },
                    ]}
                    onPress={() => handleLanguageChange(lang.code as 'en' | 'ar' | 'da')}
                  >
                    <Text style={styles.languageFlag}>{lang.flag}</Text>
                    <Text style={[styles.languageLabel, { color: themeColors.neutral.text }]}>
                      {lang.label}
                    </Text>
                    {settings.appearance.language === lang.code && (
                      <Ionicons name="checkmark" size={20} color={colors.primary[500]} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </Card>
        </View>

        {/* General Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: themeColors.neutral.textSecondary }]}>
            {t('general_settings')}
          </Text>
          <Card variant="default" isDarkMode={isDarkMode} padding="none">
            <SettingItem
              icon="trash-outline"
              title={t('clear_cache')}
              subtitle="Free up storage space"
              onPress={() => {}}
              showArrow
              isDarkMode={isDarkMode}
              iconColor={colors.danger[500]}
              iconBgColor={colors.danger[100]}
            />
            <SettingItem
              icon="bug-outline"
              title={t('report_issue')}
              subtitle="Report a bug or problem"
              onPress={() => {}}
              showArrow
              isDarkMode={isDarkMode}
              iconColor={colors.warning[500]}
              iconBgColor={colors.warning[100]}
            />
            <SettingItem
              icon="help-circle-outline"
              title={t('contact_support')}
              subtitle="Get help from our team"
              onPress={() => {}}
              showArrow
              isDarkMode={isDarkMode}
              iconColor={colors.info[500]}
              iconBgColor={colors.info[100]}
            />
            <SettingItem
              icon="information-circle-outline"
              title={t('app_version')}
              subtitle={settings.general.appVersion}
              isDarkMode={isDarkMode}
              iconColor={colors.success[500]}
              iconBgColor={colors.success[100]}
              isLast
            />
          </Card>
        </View>

        {/* Logout Button */}
        <View style={styles.logoutSection}>
          <Button
            title="Logout"
            onPress={handleLogout}
            variant="danger"
            size="large"
            fullWidth
            icon="log-out-outline"
            isDarkMode={isDarkMode}
          />
        </View>

        {/* Copyright */}
        <Text style={[styles.copyright, { color: themeColors.neutral.textTertiary }]}>
          © 2024 TrafikTaxa. All rights reserved.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingTop: spacing[12],
    paddingBottom: spacing[4],
  },
  backButton: {
    padding: spacing[2],
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    marginTop: spacing[6],
    paddingHorizontal: spacing[5],
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing[3],
    marginLeft: spacing[2],
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[5],
    borderBottomWidth: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[4],
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 13,
  },
  languageSelector: {
    marginHorizontal: spacing[5],
    marginBottom: spacing[4],
    borderRadius: borderRadius.lg,
    padding: spacing[3],
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: borderRadius.md,
  },
  languageFlag: {
    fontSize: 20,
    marginRight: spacing[3],
  },
  languageLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  logoutSection: {
    marginTop: spacing[8],
    paddingHorizontal: spacing[5],
  },
  copyright: {
    textAlign: 'center',
    fontSize: 12,
    marginTop: spacing[6],
    marginBottom: spacing[10],
  },
});
