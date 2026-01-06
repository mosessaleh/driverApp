import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert, RefreshControl } from 'react-native';
import { useAuth } from '../src/context/AuthContext';
import { useRouter } from 'expo-router';
import { getDriverHistory } from '../src/services/api';
import { onRideOffer, offRideOffer } from '../src/services/socket';

export default function HistoryScreen() {
  const { authState } = useAuth();
  const router = useRouter();
  const [rides, setRides] = useState<any[]>([]);
  const [summary, setSummary] = useState({ totalRides: 0, totalAmount: 0 });
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    loadHistory();
    
    // Listen for ride offers to redirect to dashboard
    const handleRideOffer = () => {
      router.replace('/dashboard');
    };
    onRideOffer(handleRideOffer);

    return () => {
      offRideOffer();
    };
  }, []);

  const loadHistory = async (retryCount = 0) => {
    if (!authState.token) return;
    
    setLoading(true);
    try {
      const response = await getDriverHistory(authState.token, parseDate(startDate) || undefined, parseDate(endDate) || undefined);
      if (response.ok && response.rides) {
        setRides(response.rides);
        setSummary(response.summary || { totalRides: 0, totalAmount: 0 });
      } else {
        Alert.alert('Error', 'Failed to load history data');
      }
    } catch (error) {
      console.error('Error loading history:', error);
      if (retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 1000;
        console.log(`Retrying history load in ${delay}ms (attempt ${retryCount + 1}/3)`);
        setTimeout(() => loadHistory(retryCount + 1), delay);
      } else {
        Alert.alert('Error', 'Failed to load history data after multiple attempts');
      }
    } finally {
      setLoading(false);
    }
  };

  const onRefreshData = async () => {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const parseDate = (dateStr: string) => {
    if (!dateStr) return '';
    const [day, month, year] = dateStr.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  };

  const handleFilter = () => {
    loadHistory();
  };

  const handleClearFilter = () => {
    setStartDate('');
    setEndDate('');
    loadHistory();
  };

  const goBack = () => {
    router.back();
  };

  return (
    <View style={styles.container}>
      {/* Header with Back Button */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={goBack}>
          <Text style={styles.backButtonText}>❮</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>History</Text>
      </View>

      {/* Summary Box */}
      <View style={styles.summaryContainer}>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryLabel}>Total Rides</Text>
          <Text style={styles.summaryValue}>{summary.totalRides}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryBox}>
          <Text style={styles.summaryLabel}>Total Amount</Text>
          <Text style={styles.summaryValue}>{summary.totalAmount} DKK</Text>
        </View>
      </View>

      {/* Filter Box */}
      <View style={styles.filterContainer}>
        <Text style={styles.filterTitle}>Filter by Date</Text>
        <View style={styles.filterRow}>
          <View style={styles.filterInputContainer}>
            <Text style={styles.filterLabel}>From</Text>
            <TextInput
              style={styles.filterInput}
              placeholder="DD/MM/YYYY"
              value={startDate}
              onChangeText={setStartDate}
              placeholderTextColor="#999"
            />
          </View>
          <View style={[styles.filterInputContainer, styles.filterInputContainerLast]}>
            <Text style={styles.filterLabel}>To</Text>
            <TextInput
              style={styles.filterInput}
              placeholder="DD/MM/YYYY"
              value={endDate}
              onChangeText={setEndDate}
              placeholderTextColor="#999"
            />
          </View>
        </View>
        <View style={styles.filterButtons}>
          <TouchableOpacity style={styles.filterButton} onPress={handleFilter}>
            <Text style={styles.filterButtonText}>Filter</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.clearButton} onPress={handleClearFilter}>
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Rides List */}
      <ScrollView 
        style={styles.ridesContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefreshData} />
        }
      >
        {loading && rides.length === 0 ? (
          <Text style={styles.loadingText}>Loading history...</Text>
        ) : rides.length === 0 ? (
          <Text style={styles.noDataText}>No rides found for this period</Text>
        ) : (
          rides.map((ride) => (
            <TouchableOpacity 
              key={ride.id} 
              style={styles.rideCard}
              onPress={() => router.push(`/ride-details?id=${ride.id}`)}
            >
              <View style={styles.rideInfo}>
                <Text style={styles.rideId}>#{ride.id}</Text>
                <Text style={styles.rideDate}>{formatDate(ride.createdAt)} • {formatTime(ride.createdAt)}</Text>
                <Text style={styles.rideAddress}>{ride.pickupAddress}</Text>
                <Text style={styles.rideAddress}>{ride.dropoffAddress}</Text>
              </View>
              <View style={styles.rideAmount}>
                <Text style={styles.amountValue}>{ride.price} DKK</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  summaryContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 12,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryBox: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  summaryDivider: {
    width: 1,
    height: 60,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 15,
  },
  filterContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 15,
    borderRadius: 12,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  filterInputContainer: {
    flex: 1,
    marginRight: 10,
  },
  filterInputContainerLast: {
    marginRight: 0,
  },
  filterLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  filterInput: {
    height: 40,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  filterButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  filterButton: {
    backgroundColor: '#007bff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  filterButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  clearButton: {
    backgroundColor: '#6c757d',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  ridesContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: '#666',
  },
  noDataText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: '#666',
  },
  rideCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rideInfo: {
    flex: 1,
  },
  rideId: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  rideDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  rideAddress: {
    fontSize: 14,
    color: '#333',
    marginBottom: 2,
  },
  rideAmount: {
    alignItems: 'flex-end',
  },
  amountValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#28a745',
  },
});