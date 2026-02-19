import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { useAuth } from '../src/context/AuthContext';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getRide } from '../src/services/api';
import { onRideOffer, offRideOffer } from '../src/services/socket';
import { useTranslation } from '../src/hooks/useTranslation';

export default function RideDetailsScreen() {
  const { authState } = useAuth();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { t } = useTranslation();
  const [ride, setRide] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get ride ID from query parameters
    const rideId = id as string;
    
    if (rideId) {
      loadRideDetails(rideId);
    }
    
    // Listen for ride offers to redirect to dashboard
    const handleRideOffer = () => {
      router.replace('/dashboard');
    };
    onRideOffer(handleRideOffer);

    return () => {
      offRideOffer();
    };
  }, []);

  const loadRideDetails = async (rideId: string) => {
    if (!authState.token) return;
    
    setLoading(true);
    try {
      const response = await getRide(rideId, authState.token);
      if (response.ok && response.data) {
        setRide(response.data);
      } else {
        Alert.alert(t('error'), t('ride_details_load_failed'));
        router.back();
      }
    } catch (error) {
      console.error('Error loading ride details:', error);
      Alert.alert(t('error'), t('ride_details_load_failed'));
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return t('not_available');
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return t('not_available');
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatTime = (dateString?: string | null) => {
    if (!dateString) return t('not_available');
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return t('not_available');
    return date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const goBack = () => {
    router.back();
  };

  const getStatusStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return styles.status_completed;
      case 'pending':
        return styles.status_pending;
      case 'cancelled':
      case 'canceled':
        return styles.status_cancelled;
      default:
        return styles.status_pending;
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={goBack}>
            <Text style={styles.backButtonText}>❮</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('ride_details')}</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>{t('ride_details_loading')}</Text>
        </View>
      </View>
    );
  }

  if (!ride) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={goBack}>
            <Text style={styles.backButtonText}>❮</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('ride_details')}</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{t('ride_not_found')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with Back Button */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={goBack}>
          <Text style={styles.backButtonText}>❮</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('ride_details')}</Text>
      </View>

      {/* Main Ride Card */}
      <ScrollView style={styles.scrollView}>
        {/* Status Badge */}
        <View style={[styles.statusBadge, getStatusStyle(ride.status)]}>
          <Text style={styles.statusText}>{ride.status}</Text>
        </View>

        {/* Ride Summary */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>{t('ride_id_label')}</Text>
              <Text style={styles.summaryValue}>#{ride.id}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>{t('date')}</Text>
              <Text style={styles.summaryValue}>{formatDate(ride.pickupTime || ride.createdAt)}</Text>
            </View>
          </View>
          
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>{t('time')}</Text>
              <Text style={styles.summaryValue}>{formatTime(ride.pickupTime || ride.createdAt)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>{t('distance')}</Text>
              <Text style={styles.summaryValue}>{ride.distanceKm} km</Text>
            </View>
          </View>
        </View>

        {/* Route Information */}
          <View style={styles.routeCard}>
            <Text style={styles.sectionTitle}>{t('route_information')}</Text>
            
            <View style={styles.routeItem}>
              <View style={styles.routeIconContainer}>
                <View style={styles.pickupIcon} />
              </View>
              <View style={styles.routeTextContainer}>
                <Text style={styles.routeLabel}>{t('pickup')}</Text>
                <Text style={styles.routeAddress}>{ride.pickupAddress}</Text>
              </View>
            </View>

            {ride.stopAddress && (
              <>
                <View style={styles.routeDivider} />
                <View style={styles.routeItem}>
                  <View style={styles.routeIconContainer}>
                    <View style={styles.stopIcon} />
                  </View>
                  <View style={styles.routeTextContainer}>
                    <Text style={styles.routeLabel}>{t('stop')}</Text>
                    <Text style={styles.routeAddress}>{ride.stopAddress}</Text>
                  </View>
                </View>
              </>
            )}

            <View style={styles.routeDivider} />
            
            <View style={styles.routeItem}>
              <View style={styles.routeIconContainer}>
                <View style={styles.dropoffIcon} />
              </View>
              <View style={styles.routeTextContainer}>
                <Text style={styles.routeLabel}>{t('dropoff')}</Text>
                <Text style={styles.routeAddress}>{ride.dropoffAddress}</Text>
              </View>
            </View>
          </View>
{/* Vehicle & Payment Info */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>{t('vehicle_type')}</Text>
              <Text style={styles.infoValue}>{ride.vehicleTypeName || ride.vehicleType?.title || t('not_available')}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>{t('payment')}</Text>
              <Text style={styles.infoValue}>{ride.paymentMethod || t('cash')}</Text>
            </View>
          </View>
          
          <View style={styles.amountContainer}>
            <Text style={styles.amountLabel}>{t('total_amount')}</Text>
            <Text style={styles.amountValue}>{ride.price} DKK</Text>
          </View>
        </View>

        {/* Customer Information */}
        {ride.user && (
          <View style={styles.customerCard}>
            <Text style={styles.sectionTitle}>{t('customer_information')}</Text>
            
            <View style={styles.customerInfo}>
              <View style={styles.customerAvatar}>
                <Text style={styles.avatarText}>
                  {ride.user.firstName.charAt(0)}
                </Text>
              </View>
              
              <View style={styles.customerDetails}>
                <Text style={styles.customerName}>{ride.user.firstName}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Additional Details */}
        <View style={styles.detailsCard}>
          <Text style={styles.sectionTitle}>{t('additional_details')}</Text>
          
          {ride.acceptedAt && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('accepted_time')}</Text>
              <Text style={styles.detailValue}>{formatDate(ride.acceptedAt)} • {formatTime(ride.acceptedAt)}</Text>
            </View>
          )}
          
          {ride.pickedAt && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('pickup_time')}</Text>
              <Text style={styles.detailValue}>{formatDate(ride.pickedAt)} • {formatTime(ride.pickedAt)}</Text>
            </View>
          )}
          
          {ride.droppedAt && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('dropoff_time')}</Text>
              <Text style={styles.detailValue}>{formatDate(ride.droppedAt)} • {formatTime(ride.droppedAt)}</Text>
            </View>
          )}
          
          {ride.estimatedTime && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('estimated_time')}</Text>
              <Text style={styles.detailValue}>{ride.estimatedTime} minutes</Text>
            </View>
          )}
          
          {ride.notes && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('notes')}</Text>
              <Text style={styles.detailValue}>{ride.notes}</Text>
            </View>
          )}

          {ride.status?.toLowerCase() === 'canceled' && (ride.cancellationReason || ride.canceledBy) && (
            <View style={styles.cancellationDetails}>
              <Text style={styles.cancellationTitle}>{t('cancellation_details')}</Text>
              {ride.cancellationReason ? (
              <Text style={styles.cancellationText}>{t('cancellation_reason')}: {t(ride.cancellationReason)}</Text>
              ) : null}
              {ride.canceledBy ? (
              <Text style={styles.cancellationText}>{t('canceled_by')}: {t(`canceled_by_${ride.canceledBy}`)}</Text>
              ) : null}
            </View>
          )}
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
    paddingTop: 15,
    paddingBottom: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  backButtonText: {
    fontSize: 18,
    color: '#007bff',
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 20,
  },
  scrollView: {
    flex: 1,
  },
  statusBadge: {
    marginHorizontal: 20,
    marginTop: 15,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  status_completed: {
    backgroundColor: '#d4edda',
    borderColor: '#c3e6cb',
    borderWidth: 1,
  },
  status_pending: {
    backgroundColor: '#fff3cd',
    borderColor: '#ffeaa7',
    borderWidth: 1,
  },
  status_cancelled: {
    backgroundColor: '#f8d7da',
    borderColor: '#f5c6cb',
    borderWidth: 1,
  },
  statusText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#155724',
  },
  summaryCard: {
    marginHorizontal: 20,
    marginTop: 15,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  summaryItem: {
    flex: 1,
    marginRight: 10,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6c757d',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  routeCard: {
    marginHorizontal: 20,
    marginTop: 15,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  routeItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  routeIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e9ecef',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
    marginTop: 2,
  },
  pickupIcon: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#007bff',
  },
  dropoffIcon: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#28a745',
  },
  stopIcon: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#f59e0b',
  },
  routeTextContainer: {
    flex: 1,
  },
  routeLabel: {
    fontSize: 12,
    color: '#6c757d',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  routeAddress: {
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
  },
  routeDivider: {
    height: 1,
    backgroundColor: '#e9ecef',
    marginHorizontal: 55,
    marginBottom: 15,
  },
  infoCard: {
    marginHorizontal: 20,
    marginTop: 15,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  infoItem: {
    flex: 1,
    marginRight: 10,
  },
  infoLabel: {
    fontSize: 12,
    color: '#6c757d',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  amountContainer: {
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    paddingTop: 15,
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: 14,
    color: '#6c757d',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  amountValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#28a745',
  },
  customerCard: {
    marginHorizontal: 20,
    marginTop: 15,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customerAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#007bff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textTransform: 'uppercase',
  },
  customerDetails: {
    flex: 1,
  },
  customerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  customerPhone: {
    fontSize: 14,
    color: '#6c757d',
  },
  detailsCard: {
    marginHorizontal: 20,
    marginTop: 15,
    marginBottom: 30,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f4',
  },
  detailLabel: {
    fontSize: 14,
    color: '#6c757d',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  cancellationDetails: {
    marginTop: 12,
    backgroundColor: '#fff5f5',
    borderColor: '#f5c6cb',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  cancellationTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#a61b1b',
    marginBottom: 6,
  },
  cancellationText: {
    fontSize: 13,
    color: '#a61b1b',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#dc3545',
  },
});
