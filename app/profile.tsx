import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Image, Alert, RefreshControl } from 'react-native';
import { useAuth } from '../src/context/AuthContext';
import { useRouter } from 'expo-router';
import { getDriverProfile, requestDriverPasswordReset } from '../src/services/api';
import { onRideOffer, offRideOffer } from '../src/services/socket';
import { Ionicons } from '@expo/vector-icons';

export default function ProfileScreen() {
  const { authState } = useAuth();
  const router = useRouter();
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadProfile();
    // Listen for ride offers to redirect to dashboard
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
    // Format phone number with spaces for better readability
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
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={goBack}>
            <Ionicons name="arrow-back" size={24} color="#007bff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007bff" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={goBack}>
            <Ionicons name="arrow-back" size={24} color="#007bff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#dc3545" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadProfile(true)}>
            <Ionicons name="refresh" size={20} color="#fff" />
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={goBack}>
          <Ionicons name="arrow-back" size={24} color="#007bff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh} disabled={isRefreshing}>
          <Ionicons name={isRefreshing ? "refresh-outline" : "refresh"} size={20} color="#007bff" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false} refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
      }>
        {/* Profile Header with Avatar */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={40} color="#fff" />
            </View>
            <View style={styles.statusBadge}>
              <Ionicons name="ellipse" size={10} color="#28a745" />
              <Text style={styles.statusText}>Active</Text>
            </View>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>
              {profileData?.drFname} {profileData?.drLname}
            </Text>
            <Text style={styles.profileUsername}>@{profileData?.drUsername}</Text>
          </View>
        </View>

        {/* Personal Information Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="person-circle" size={20} color="#007bff" />
            <Text style={styles.sectionTitle}>Personal Information</Text>
          </View>
          <View style={styles.infoContainer}>
            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <Ionicons name="person-outline" size={18} color="#666" />
                <Text style={styles.label}>Full Name</Text>
              </View>
              <Text style={styles.value}>{profileData?.drFname} {profileData?.drLname}</Text>
            </View>
            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <Ionicons name="at-outline" size={18} color="#666" />
                <Text style={styles.label}>Username</Text>
              </View>
              <Text style={styles.value}>{profileData?.drUsername}</Text>
            </View>
            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <Ionicons name="call-outline" size={18} color="#666" />
                <Text style={styles.label}>Phone</Text>
              </View>
              <Text style={styles.value}>{formatPhoneNumber(profileData?.drPhone)}</Text>
            </View>
            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <Ionicons name="mail-outline" size={18} color="#666" />
                <Text style={styles.label}>Email</Text>
              </View>
              <Text style={styles.value}>{profileData?.drEmail || 'N/A'}</Text>
            </View>
          </View>
        </View>

        {/* Company Information Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="business" size={20} color="#007bff" />
            <Text style={styles.sectionTitle}>Company Information</Text>
          </View>
          <View style={styles.infoContainer}>
            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <Ionicons name="business-outline" size={18} color="#666" />
                <Text style={styles.label}>Company Name</Text>
              </View>
              <Text style={styles.value}>{profileData?.company?.comName || 'N/A'}</Text>
            </View>
            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <Ionicons name="call-outline" size={18} color="#666" />
                <Text style={styles.label}>Company Phone</Text>
              </View>
              <Text style={styles.value}>{formatPhoneNumber(profileData?.company?.comPhone)}</Text>
            </View>
            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <Ionicons name="mail-outline" size={18} color="#666" />
                <Text style={styles.label}>Company Email</Text>
              </View>
              <Text style={styles.value}>{profileData?.company?.comEmail || 'N/A'}</Text>
            </View>
          </View>
        </View>

        {/* Vehicle Information Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="car-sport" size={20} color="#007bff" />
            <Text style={styles.sectionTitle}>Vehicle Information</Text>
          </View>
          <View style={styles.infoContainer}>
            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <Ionicons name="car-sport-outline" size={18} color="#666" />
                <Text style={styles.label}>License Plate</Text>
              </View>
              <Text style={styles.value}>{profileData?.car || 'N/A'}</Text>
            </View>
            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <Ionicons name="car-outline" size={18} color="#666" />
                <Text style={styles.label}>Vehicle Type</Text>
              </View>
              <Text style={styles.value}>{profileData?.vehicle?.vehicleType?.title || 'N/A'}</Text>
            </View>
            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <Ionicons name="people-outline" size={18} color="#666" />
                <Text style={styles.label}>Capacity</Text>
              </View>
              <Text style={styles.value}>{profileData?.vehicle?.vehicleType?.capacity || 'N/A'}</Text>
            </View>
          </View>
        </View>

        {/* Additional Actions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="settings" size={20} color="#007bff" />
            <Text style={styles.sectionTitle}>Actions</Text>
          </View>
          <View style={styles.actionsContainer}>
            <TouchableOpacity style={styles.actionButton} onPress={() => handleActionPress('change_password')}>
              <Ionicons name="key-outline" size={20} color="#007bff" />
              <Text style={styles.actionText}>Change Password</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#212529',
    marginLeft: 20,
  },
  refreshButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginLeft: 'auto',
  },
  scrollContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  profileHeader: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#007bff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d4edda',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    color: '#155724',
    marginLeft: 4,
    fontWeight: '500',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 4,
  },
  profileUsername: {
    fontSize: 14,
    color: '#6c757d',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#6c757d',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#dc3545',
    textAlign: 'center',
    marginBottom: 20,
    marginTop: 10,
  },
  retryButton: {
    flexDirection: 'row',
    backgroundColor: '#007bff',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212529',
    marginLeft: 10,
  },
  infoContainer: {
    // Container for info rows
  },
  infoRow: {
    flexDirection: 'column',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f4',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  label: {
    fontSize: 14,
    color: '#6c757d',
    fontWeight: '500',
    marginLeft: 8,
  },
  value: {
    fontSize: 16,
    color: '#212529',
    fontWeight: '600',
    marginTop: 8,
    marginLeft: 26,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  actionsContainer: {
    flexDirection: 'column',
  },
  actionText: {
    fontSize: 16,
    color: '#007bff',
    fontWeight: '600',
    marginLeft: 12,
  },
});