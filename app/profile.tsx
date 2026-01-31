import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert, RefreshControl } from 'react-native';
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

export default function ProfileScreen() {
  const { authState } = useAuth();
  const { isDarkMode } = useSettings();
  const router = useRouter();
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
        setError('Failed to load profile data');
      }
    } catch (err) {
      console.error('Error loading profile:', err);
      setError('Failed to load profile data');
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
    if (!phone) return 'N/A';
    return phone.replace(/(\d{3})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4');
  };

  const handleActionPress = async (action: string) => {
    switch (action) {
      case 'change_password':
        if (!profileData?.drEmail) {
          Alert.alert('Error', 'Email not found in profile.');
          return;
        }
        try {
          const response = await requestDriverPasswordReset(profileData.drEmail);
          if (response.ok) {
            Alert.alert('Success', 'Password reset link has been sent to your email.');
          } else {
            Alert.alert('Error', response.error || 'Failed to send reset link.');
          }
        } catch (error) {
          console.error('Password reset error:', error);
          Alert.alert('Error', 'Failed to send reset link. Please try again.');
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
          <Text style={[styles.headerTitle, { color: themeColors.neutral.text }]}>Profile</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Loading size="large" isDarkMode={isDarkMode} text="Loading profile..." />
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
          <Text style={[styles.headerTitle, { color: themeColors.neutral.text }]}>Profile</Text>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color={colors.danger[500]} />
          <Text style={[styles.errorText, { color: colors.danger[500] }]}>{error}</Text>
          <Button
            title="Retry"
            onPress={() => loadProfile(true)}
            variant="primary"
            icon="refresh"
            isDarkMode={isDarkMode}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: themeColors.neutral.background }]}>
      <View style={[styles.header, { backgroundColor: themeColors.neutral.surface, ...shadows.sm }]}>
        <TouchableOpacity style={styles.backButton} onPress={goBack}>
          <Ionicons name="arrow-back" size={24} color={colors.primary[500]} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.neutral.text }]}>Profile</Text>
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
                <Ionicons name="person" size={40} color="#fff" />
              </View>
              <View style={[styles.statusBadge, { backgroundColor: colors.success[100] }]}>
                <Ionicons name="ellipse" size={10} color={colors.success[500]} />
                <Text style={[styles.statusText, { color: colors.success[700] }]}>Active</Text>
              </View>
            </View>
            <View style={styles.profileInfo}>
              <Text style={[styles.profileName, { color: themeColors.neutral.text }]}>
                {profileData?.drFname} {profileData?.drLname}
              </Text>
              <Text style={[styles.profileUsername, { color: themeColors.neutral.textSecondary }]}>
                @{profileData?.drUsername}
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
              Personal Information
            </Text>
          </View>
          
          <InfoRow
            icon="person-outline"
            label="Full Name"
            value={`${profileData?.drFname} ${profileData?.drLname}`}
            isDarkMode={isDarkMode}
          />
          <InfoRow
            icon="at-outline"
            label="Username"
            value={profileData?.drUsername}
            isDarkMode={isDarkMode}
          />
          <InfoRow
            icon="call-outline"
            label="Phone"
            value={formatPhoneNumber(profileData?.drPhone)}
            isDarkMode={isDarkMode}
          />
          <InfoRow
            icon="mail-outline"
            label="Email"
            value={profileData?.drEmail || 'N/A'}
            isDarkMode={isDarkMode}
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
              Company Information
            </Text>
          </View>
          
          <InfoRow
            icon="business-outline"
            label="Company Name"
            value={profileData?.company?.comName || 'N/A'}
            isDarkMode={isDarkMode}
          />
          <InfoRow
            icon="call-outline"
            label="Company Phone"
            value={formatPhoneNumber(profileData?.company?.comPhone)}
            isDarkMode={isDarkMode}
          />
          <InfoRow
            icon="mail-outline"
            label="Company Email"
            value={profileData?.company?.comEmail || 'N/A'}
            isDarkMode={isDarkMode}
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
              Vehicle Information
            </Text>
          </View>
          
          <InfoRow
            icon="car-sport-outline"
            label="License Plate"
            value={profileData?.car || 'N/A'}
            isDarkMode={isDarkMode}
          />
          <InfoRow
            icon="car-outline"
            label="Vehicle Type"
            value={profileData?.vehicle?.vehicleType?.title || 'N/A'}
            isDarkMode={isDarkMode}
          />
          <InfoRow
            icon="people-outline"
            label="Capacity"
            value={profileData?.vehicle?.vehicleType?.capacity || 'N/A'}
            isDarkMode={isDarkMode}
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
              Actions
            </Text>
          </View>
          
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: themeColors.neutral.surfaceVariant }]}
            onPress={() => handleActionPress('change_password')}
          >
            <Ionicons name="key-outline" size={20} color={colors.primary[500]} />
            <Text style={[styles.actionText, { color: colors.primary[500] }]}>
              Change Password
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
}

const InfoRow: React.FC<InfoRowProps> = ({ icon, label, value, isDarkMode, isLast }) => {
  const themeColors = getThemeColors(isDarkMode);
  
  return (
    <View style={[styles.infoRow, !isLast && { borderBottomWidth: 1, borderBottomColor: themeColors.neutral.border }]}>
      <View style={styles.infoLeft}>
        <Ionicons name={icon} size={18} color={themeColors.neutral.textSecondary} />
        <Text style={[styles.infoLabel, { color: themeColors.neutral.textSecondary }]}>
          {label}
        </Text>
      </View>
      <Text style={[styles.infoValue, { color: themeColors.neutral.text }]}>
        {value}
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
    ...shadows.md,
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
  infoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 14,
    marginLeft: spacing[3],
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
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
