import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { useAuth } from '../src/context/AuthContext';
import { useRouter } from 'expo-router';
import { getAnalytics } from '../src/services/api';
import { onRideOffer, offRideOffer } from '../src/services/socket';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function AnalyticsScreen() {
  const { authState } = useAuth();
  const router = useRouter();
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');

  useEffect(() => {
    loadAnalytics();

    // Listen for ride offers to redirect to dashboard
    const handleRideOffer = () => {
      router.replace('/dashboard');
    };
    onRideOffer(handleRideOffer);

    return () => {
      offRideOffer();
    };
  }, [period]);

  const loadAnalytics = async () => {
    if (!authState.token) return;

    try {
      setLoading(true);
      const response = await getAnalytics(authState.token, period);
      console.log('Analytics response:', response);
      if (response.ok && response.data) {
        setAnalytics(response.data);
      } else {
        console.error('Analytics API error:', response);
        setAnalytics(null);
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
      setAnalytics(null);
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    router.back();
  };

  const chartConfig = {
    backgroundColor: '#ffffff',
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(0, 123, 255, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '6',
      strokeWidth: '2',
      stroke: '#007bff',
    },
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={goBack}>
            <Ionicons name="arrow-back" size={24} color="#007bff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Analytics</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007bff" />
          <Text style={styles.loadingText}>Loading analytics...</Text>
        </View>
      </View>
    );
  }

  if (!analytics) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={goBack}>
            <Ionicons name="arrow-back" size={24} color="#007bff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Analytics</Text>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="analytics" size={48} color="#dc3545" />
          <Text style={styles.errorText}>Failed to load analytics</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadAnalytics}>
            <Ionicons name="refresh" size={20} color="#fff" />
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Ensure we have valid data structure
  if (!analytics.summary || !analytics.charts || !analytics.insights) {
    console.error('Invalid analytics data structure:', analytics);
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={goBack}>
            <Ionicons name="arrow-back" size={24} color="#007bff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Analytics</Text>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="analytics" size={48} color="#dc3545" />
          <Text style={styles.errorText}>Invalid data received</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadAnalytics}>
            <Ionicons name="refresh" size={20} color="#fff" />
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const { summary, charts, insights } = analytics;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={goBack}>
          <Ionicons name="arrow-back" size={24} color="#007bff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Analytics</Text>
      </View>

      {/* Period Selector */}
      <View style={styles.periodSelector}>
        {['day', 'week', 'month'].map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.periodButton, period === p && styles.activePeriod]}
            onPress={() => setPeriod(p)}
          >
            <Text style={[styles.periodText, period === p && styles.activePeriodText]}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Summary Cards */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryCard}>
            <Ionicons name="car" size={24} color="#28a745" />
            <Text style={styles.summaryValue}>{summary.totalRides}</Text>
            <Text style={styles.summaryLabel}>Total Rides</Text>
          </View>
          <View style={styles.summaryCard}>
            <Ionicons name="cash" size={24} color="#007bff" />
            <Text style={styles.summaryValue}>{summary.totalEarnings} DKK</Text>
            <Text style={styles.summaryLabel}>Earnings</Text>
          </View>
          <View style={styles.summaryCard}>
            <Ionicons name="star" size={24} color="#ffc107" />
            <Text style={styles.summaryValue}>{summary.averageRating}</Text>
            <Text style={styles.summaryLabel}>Rating</Text>
          </View>
        </View>

        {/* Daily Earnings Chart */}
        {charts.daily && charts.daily.length > 0 && (
          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>Daily Earnings</Text>
            <LineChart
              data={{
                labels: charts.daily.map((d: any) => d.date.slice(-2)), // Last 2 chars of date
                datasets: [{
                  data: charts.daily.map((d: any) => d.earnings),
                }],
              }}
              width={width - 40}
              height={220}
              chartConfig={chartConfig}
              bezier
              style={styles.chart}
            />
          </View>
        )}

        {/* Hourly Distribution */}
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>Rides by Hour</Text>
          <BarChart
            data={{
              labels: charts.hourly.slice(0, 12).map((h: any) => h.hour), // First 12 hours
              datasets: [{
                data: charts.hourly.slice(0, 12).map((h: any) => h.rides),
              }],
            }}
            width={width - 40}
            height={220}
            yAxisLabel=""
            yAxisSuffix=""
            chartConfig={chartConfig}
            style={styles.chart}
            showValuesOnTopOfBars
          />
        </View>

        {/* Insights */}
        <View style={styles.insightsContainer}>
          <Text style={styles.sectionTitle}>Insights</Text>

          {insights.peakHours.length > 0 && (
            <View style={styles.insightCard}>
              <Ionicons name="time" size={20} color="#007bff" />
              <View style={styles.insightContent}>
                <Text style={styles.insightTitle}>Peak Hours</Text>
                <Text style={styles.insightText}>
                  {insights.peakHours.slice(0, 3).map((h: any) => h.hour).join(', ')}
                </Text>
              </View>
            </View>
          )}

          {insights.topPickupAreas.length > 0 && (
            <View style={styles.insightCard}>
              <Ionicons name="location" size={20} color="#28a745" />
              <View style={styles.insightContent}>
                <Text style={styles.insightTitle}>Top Areas</Text>
                <Text style={styles.insightText}>
                  {insights.topPickupAreas.slice(0, 3).map((a: any) => a.area).join(', ')}
                </Text>
              </View>
            </View>
          )}

          {insights.busiestDay && (
            <View style={styles.insightCard}>
              <Ionicons name="calendar" size={20} color="#ffc107" />
              <View style={styles.insightContent}>
                <Text style={styles.insightTitle}>Busiest Day</Text>
                <Text style={styles.insightText}>{insights.busiestDay.date}</Text>
              </View>
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
    paddingTop: 50,
    paddingBottom: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#212529',
    marginLeft: 20,
    flex: 1,
  },
  refreshButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 8,
    padding: 5,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  activePeriod: {
    backgroundColor: '#007bff',
  },
  periodText: {
    fontSize: 14,
    color: '#6c757d',
    fontWeight: '500',
  },
  activePeriodText: {
    color: '#fff',
  },
  scrollContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginHorizontal: 5,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212529',
    marginTop: 8,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6c757d',
    marginTop: 4,
  },
  chartContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 15,
    textAlign: 'center',
  },
  chart: {
    borderRadius: 8,
  },
  insightsContainer: {
    marginTop: 20,
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 15,
  },
  insightCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  insightContent: {
    marginLeft: 15,
    flex: 1,
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#212529',
  },
  insightText: {
    fontSize: 12,
    color: '#6c757d',
    marginTop: 2,
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
    borderRadius: 8,
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});