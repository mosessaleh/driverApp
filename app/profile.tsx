import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert, RefreshControl, Image } from 'react-native';
import { useAuth } from '../src/context/AuthContext';
import { useSettings } from '../src/context/SettingsContext';
import { useRouter } from 'expo-router';
import { getDriverProfile, requestDriverPasswordReset } from '../src/services/api';
import { onRideOffer, offRideOffer } from '../src/services/socket';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../src/components/Card';
import { Button } from '../src/components/Button';
import { Loading } from '../src/components/Loading';
import { colors, spacing, shadows, getThemeColors } from '../src/theme';
import { useTranslation } from '../src/hooks/useTranslation';

export default function ProfileScreen() {
  const { authState } = useAuth();
  const { isDarkMode } = useSettings();
  const router = useRouter();
  const { t, isRTL } = useTranslation();
  const themeColors = getThemeColors(isDarkMode);
  
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadProfile();
    const handleRideOffer = () => {
      router.replace('/dashboard');
    };
    onRideOffer(handleRideOffer);

    return () => {
      offRideOffer();
    };
  }, []);

  const loadProfile = async (showLoading = true) => {
    if (!authState.token || !authState.user?.id) return;

    try {
      if (showLoading) setLoading(true);
      setIsRefreshing(true);
      const response = await getDriverProfile(authState.user.id.toString(), authState.token);
      if (response.ok && response.driver) {
        setProfileData(response.driver);
        setError(null);
      } else {
        setError(t('profile_load_failed'));
      }
    } catch (err) {
      console.error('Error loading profile:', err);
      setError(t('profile_load_failed'));
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const goBack = () => {
    router.back();
  };

  const handleRefresh = () => {
    loadProfile(false);
  };

  const formatPhoneNumber = (phone: string) => {
    if (!phone) return t('not_available');
    return phone.replace(/(\d{3})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4');
  };

  const handleActionPress = async (action: string) => {
    switch (action) {
      case 'change_password':
        if (!profileData?.drEmail) {
          Alert.alert(t('error'), t('profile_email_missing'));
          return;
        }
        try {
          const response = await requestDriverPasswordReset(profileData.drEmail);
          if (response.ok) {
            Alert.alert(t('success'), t('password_reset_success'));
          } else {
            Alert.alert(t('error'), response.error || t('password_reset_failed'));
          }
        } catch (error) {
          console.error('Password reset error:', error);
          Alert.alert(t('error'), t('password_reset_failed_generic'));
        }
        break;
      default:
        break;
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.neutral.background }]}>
        <View style={[styles.header, { backgroundColor: themeColors.neutral.surface }]}>
          <TouchableOpacity style={styles.backButton} onPress={goBack}>
            <Ionicons name="arrow-back" size={24} color={colors.primary[500]} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: themeColors.neutral.text }]}>{t('profile')}</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Loading size="large" isDarkMode={isDarkMode} text={t('profile_loading')} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.neutral.background }]}>
        <View style={[styles.header, { backgroundColor: themeColors.neutral.surface }]}>
          <TouchableOpacity style={styles.backButton} onPress={goBack}>
            <Ionicons name="arrow-back" size={24} color={colors.primary[500]} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: themeColors.neutral.text }]}>{t('profile')}</Text>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color={colors.danger[500]} />
          <Text style={[styles.errorText, { color: colors.danger[500] }]}>{error}</Text>
          <Button
            title={t('retry')}
            onPress={() => loadProfile(true)}
            variant="primary"
            icon="refresh"
            isDarkMode={isDarkMode}
          />
        </View>
      </View>
    );
  }

  const isDriverActive = profileData?.isActive === 1 || profileData?.isActive === true || profileData?.isActive === '1';
  const statusLabel = isDriverActive ? t('driver_active') : t('driver_inactive');
  const statusColors = isDriverActive
    ? { background: colors.success[100], text: colors.success[700], dot: colors.success[500] }
    : { background: colors.warning[100], text: colors.warning[700], dot: colors.warning[500] };
  const hasPhoto = Boolean(profileData?.drPhoto);
  const fullName = [profileData?.drFname, profileData?.drLname].filter(Boolean).join(' ').trim();
  const displayName = fullName || t('not_available');
  const usernameLabel = profileData?.drUsername ? `@${profileData.drUsername}` : t('not_available');
  const driverInitialSource = profileData?.drFname || profileData?.drUsername || '';
  const driverInitial = driverInitialSource ? driverInitialSource.charAt(0).toUpperCase() : '?';

  return (
    <View style={[styles.container, { backgroundColor: themeColors.neutral.background }]}>
      <View style={[styles.header, { backgroundColor: themeColors.neutral.surface, ...shadows.sm }]}>
        <TouchableOpacity style={styles.backButton} onPress={goBack}>
          <Ionicons name="arrow-back" size={24} color={colors.primary[500]} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.neutral.text }]}>{t('profile')}</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh} disabled={isRefreshing}>
          <Ionicons name={isRefreshing ? "refresh-outline" : "refresh"} size={20} color={colors.primary[500]} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Profile Header Card */}
        <Card variant="elevated" isDarkMode={isDarkMode} style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              <View style={[styles.avatar, { backgroundColor: colors.primary[500] }]}>
                {hasPhoto ? (
                  <Image source={{ uri: profileData.drPhoto }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarInitial}>{driverInitial}</Text>
                )}
              </View>
              <View style={[styles.statusBadge, { backgroundColor: statusColors.background }]}>
                <Ionicons name="ellipse" size={10} color={statusColors.dot} />
                <Text style={[styles.statusText, { color: statusColors.text }]}>{statusLabel}</Text>
              </View>
            </View>
            <View style={[styles.profileInfo, isRTL && styles.profileInfoRtl]}>
              <Text style={[styles.profileName, { color: themeColors.neutral.text }]}>
                {displayName}
              </Text>
              <Text style={[styles.profileUsername, { color: themeColors.neutral.textSecondary }]}>
                {usernameLabel}
              </Text>
            </View>
          </View>
        </Card>

        {/* Personal Information */}
        <Card variant="default" isDarkMode={isDarkMode} style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={[styles.iconCircle, { backgroundColor: colors.primary[100] }]}>
              <Ionicons name="person-circle" size={20} color={colors.primary[500]} />
            </View>
            <Text style={[styles.sectionTitle, { color: themeColors.neutral.text }]}>
              {t('personal_info')}
            </Text>
          </View>
          
          <InfoRow
            icon="person-outline"
            label={t('full_name')}
            value={displayName}
            isDarkMode={isDarkMode}
            isRTL={isRTL}
          />
          <InfoRow
            icon="at-outline"
            label={t('username')}
            value={profileData?.drUsername || t('not_available')}
            isDarkMode={isDarkMode}
            isRTL={isRTL}
          />
          <InfoRow
            icon="call-outline"
            label={t('phone')}
            value={formatPhoneNumber(profileData?.drPhone)}
            isDarkMode={isDarkMode}
            isRTL={isRTL}
          />
          <InfoRow
            icon="mail-outline"
            label={t('email')}
            value={profileData?.drEmail || t('not_available')}
            isDarkMode={isDarkMode}
            isRTL={isRTL}
            isLast
          />
        </Card>

        {/* Company Information */}
        <Card variant="default" isDarkMode={isDarkMode} style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={[styles.iconCircle, { backgroundColor: colors.info[100] }]}>
              <Ionicons name="business" size={20} color={colors.info[500]} />
            </View>
            <Text style={[styles.sectionTitle, { color: themeColors.neutral.text }]}>
              {t('company_info')}
            </Text>
          </View>
          
          <InfoRow
            icon="business-outline"
            label={t('company_name')}
            value={profileData?.company?.comName || t('not_available')}
            isDarkMode={isDarkMode}
            isRTL={isRTL}
          />
          <InfoRow
            icon="call-outline"
            label={t('company_phone')}
            value={formatPhoneNumber(profileData?.company?.comPhone)}
            isDarkMode={isDarkMode}
            isRTL={isRTL}
          />
          <InfoRow
            icon="mail-outline"
            label={t('company_email')}
            value={profileData?.company?.comEmail || t('not_available')}
            isDarkMode={isDarkMode}
            isRTL={isRTL}
            isLast
          />
        </Card>

        {/* Vehicle Information */}
        <Card variant="default" isDarkMode={isDarkMode} style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={[styles.iconCircle, { backgroundColor: colors.success[100] }]}>
              <Ionicons name="car-sport" size={20} color={colors.success[500]} />
            </View>
            <Text style={[styles.sectionTitle, { color: themeColors.neutral.text }]}>
              {t('vehicle_info')}
            </Text>
          </View>
          
          <InfoRow
            icon="car-sport-outline"
            label={t('license_plate')}
            value={profileData?.car || t('not_available')}
            isDarkMode={isDarkMode}
            isRTL={isRTL}
            renderValue={() => (
              <LicensePlate
                value={profileData?.car}
                isDarkMode={isDarkMode}
                notAvailableLabel={t('not_available')}
              />
            )}
          />
          <InfoRow
            icon="car-outline"
            label={t('vehicle_type')}
            value={profileData?.vehicle?.vehicleType?.title || t('not_available')}
            isDarkMode={isDarkMode}
            isRTL={isRTL}
          />
          <InfoRow
            icon="people-outline"
            label={t('capacity')}
            value={profileData?.vehicle?.vehicleType?.capacity || t('not_available')}
            isDarkMode={isDarkMode}
            isRTL={isRTL}
            isLast
          />
        </Card>

        {/* Actions */}
        <Card variant="default" isDarkMode={isDarkMode} style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={[styles.iconCircle, { backgroundColor: colors.warning[100] }]}>
              <Ionicons name="settings" size={20} color={colors.warning[500]} />
            </View>
            <Text style={[styles.sectionTitle, { color: themeColors.neutral.text }]}>
              {t('actions')}
            </Text>
          </View>
          
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: themeColors.neutral.surfaceVariant }]}
            onPress={() => handleActionPress('change_password')}
          >
            <Ionicons name="key-outline" size={20} color={colors.primary[500]} />
            <Text style={[styles.actionText, { color: colors.primary[500] }]}>
              {t('change_password')}
            </Text>
            <Ionicons name="chevron-forward" size={20} color={themeColors.neutral.textTertiary} />
          </TouchableOpacity>
        </Card>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

// Helper Component for Info Rows
interface InfoRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  isDarkMode: boolean;
  isLast?: boolean;
  renderValue?: () => React.ReactNode;
  isRTL?: boolean;
}

const InfoRow: React.FC<InfoRowProps> = ({ icon, label, value, isDarkMode, isLast, renderValue, isRTL }) => {
  const themeColors = getThemeColors(isDarkMode);
  
  return (
    <View
      style={[
        styles.infoRow,
        isRTL && styles.infoRowRtl,
        !isLast && { borderBottomWidth: 1, borderBottomColor: themeColors.neutral.border },
      ]}
    >
      <View style={[styles.infoLeft, isRTL && styles.infoLeftRtl]}>
        <Ionicons name={icon} size={18} color={themeColors.neutral.textSecondary} />
        <Text style={[styles.infoLabel, isRTL && styles.infoLabelRtl, { color: themeColors.neutral.textSecondary }]}>
          {label}
        </Text>
      </View>
      {renderValue ? (
        renderValue()
      ) : (
      <Text style={[styles.infoValue, isRTL && styles.infoValueRtl, { color: themeColors.neutral.text }]} numberOfLines={2}>
        {value}
      </Text>
      )}
    </View>
  );
};

interface LicensePlateProps {
  value?: string;
  isDarkMode: boolean;
  notAvailableLabel: string;
}

const LicensePlate: React.FC<LicensePlateProps> = ({ value, isDarkMode, notAvailableLabel }) => {
  const plateValue = value && value.trim().length > 0 ? value.toUpperCase() : notAvailableLabel;

  return (
    <View style={[styles.plateContainer, { backgroundColor: isDarkMode ? '#f8fafc' : '#ffffff' }]}> 
      <View style={styles.plateCountry}>
        <Text style={styles.plateCountryText}>DK</Text>
      </View>
      <Text style={styles.plateText} numberOfLines={1} ellipsizeMode="tail">
        {plateValue}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[5],
    paddingTop: spacing[12],
    paddingBottom: spacing[4],
    ...shadows.sm,
  },
  backButton: {
    padding: spacing[2],
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginLeft: spacing[4],
    flex: 1,
  },
  refreshButton: {
    padding: spacing[2],
  },
  scrollContainer: {
    flex: 1,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[8],
    gap: spacing[4],
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
  },
  profileCard: {
    marginBottom: spacing[5],
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    ...shadows.md,
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    resizeMode: 'cover',
  },
  avatarInitial: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '700',
  },
  statusBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: 12,
    ...shadows.sm,
  },
  statusText: {
    fontSize: 12,
    marginLeft: 4,
    fontWeight: '600',
  },
  profileInfo: {
    marginLeft: spacing[5],
    flex: 1,
  },
  profileInfoRtl: {
    marginLeft: 0,
    marginRight: spacing[5],
    alignItems: 'flex-end',
  },
  profileName: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: spacing[1],
  },
  profileUsername: {
    fontSize: 14,
  },
  sectionCard: {
    marginBottom: spacing[5],
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[4],
  },
  infoRowRtl: {
    flexDirection: 'row-reverse',
  },
  infoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoLeftRtl: {
    flexDirection: 'row-reverse',
  },
  infoLabel: {
    fontSize: 14,
    marginLeft: spacing[3],
  },
  infoLabelRtl: {
    marginLeft: 0,
    marginRight: spacing[3],
    textAlign: 'right',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  infoValueRtl: {
    textAlign: 'left',
  },
  plateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    minWidth: 110,
    ...shadows.sm,
  },
  plateCountry: {
    backgroundColor: '#1d4ed8',
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 6,
    marginRight: 8,
  },
  plateCountryText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  plateText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 2,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[4],
    borderRadius: 12,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: spacing[3],
    flex: 1,
  },
  bottomPadding: {
    height: spacing[10],
  },
});
