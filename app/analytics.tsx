import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { useAuth } from '../src/context/AuthContext';
import { useRouter } from 'expo-router';
import { getAnalytics } from '../src/services/api';
import { useTranslation } from '../src/hooks/useTranslation';
import { onRideOffer, offRideOffer } from '../src/services/socket';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { Ionicons } from '@expo/vector-icons';
import { buildRatingRecommendations } from '../src/features/driverIntelligence';

const { width } = Dimensions.get('window');

export default function AnalyticsScreen() {
  const { authState } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();
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
      offRideOffer(handleRideOffer);
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
          <Text style={styles.headerTitle}>{t('analytics_title')}</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007bff" />
          <Text style={styles.loadingText}>{t('analytics_loading')}</Text>
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
          <Text style={styles.headerTitle}>{t('analytics_title')}</Text>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="analytics" size={48} color="#dc3545" />
          <Text style={styles.errorText}>{t('analytics_failed')}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadAnalytics}>
            <Ionicons name="refresh" size={20} color="#fff" />
            <Text style={styles.retryButtonText}>{t('retry')}</Text>
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
          <Text style={styles.headerTitle}>{t('analytics_title')}</Text>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="analytics" size={48} color="#dc3545" />
          <Text style={styles.errorText}>{t('analytics_invalid_data')}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadAnalytics}>
            <Ionicons name="refresh" size={20} color="#fff" />
            <Text style={styles.retryButtonText}>{t('retry')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const { summary, charts, insights } = analytics;
  const averageRating = Number(summary?.averageRating ?? 0);
  const acceptanceRate = Number(summary?.acceptanceRate ?? 0);
  const completionRate = Number(summary?.completionRate ?? 0);
  const peakHours: string[] = Array.isArray(insights?.peakHours)
    ? insights.peakHours.map((entry: any) => entry?.hour).filter((hour: any) => typeof hour === 'string')
    : [];
  const topArea =
    Array.isArray(insights?.topPickupAreas) && insights.topPickupAreas.length > 0
      ? insights.topPickupAreas[0]?.area
      : undefined;

  const ratingRecommendations = buildRatingRecommendations({
    averageRating,
    completionRate,
    acceptanceRate,
    peakHours,
    topArea,
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={goBack}>
          <Ionicons name="arrow-back" size={24} color="#007bff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('analytics_title')}</Text>
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
              {p === 'day' ? t('period_day') : p === 'week' ? t('period_week') : t('period_month')}
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
            <Text style={styles.summaryLabel}>{t('total_rides')}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Ionicons name="cash" size={24} color="#007bff" />
            <Text style={styles.summaryValue}>{summary.totalEarnings} DKK</Text>
            <Text style={styles.summaryLabel}>{t('earnings')}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Ionicons name="star" size={24} color="#ffc107" />
            <Text style={styles.summaryValue}>{summary.averageRating}</Text>
            <Text style={styles.summaryLabel}>{t('rating')}</Text>
          </View>
        </View>

        {/* Driver Rating Center */}
        <View style={styles.ratingCenterCard}>
          <View style={styles.ratingCenterHeader}>
            <View style={styles.ratingCenterIconWrap}>
              <Ionicons name="star-half" size={20} color="#f59e0b" />
            </View>
            <View style={styles.ratingCenterHeaderTextWrap}>
              <Text style={styles.ratingCenterTitle}>{t('rating_center_title')}</Text>
              <Text style={styles.ratingCenterSubtitle}>{t('rating_center_subtitle', { target: '4.8' })}</Text>
            </View>
          </View>

          <View style={styles.ratingMetricsRow}>
            <View style={styles.ratingMetricItem}>
              <Text style={styles.ratingMetricValue}>{averageRating.toFixed(1)}</Text>
              <Text style={styles.ratingMetricLabel}>{t('rating')}</Text>
            </View>
            <View style={styles.ratingMetricItem}>
              <Text style={styles.ratingMetricValue}>{Math.round(acceptanceRate)}%</Text>
              <Text style={styles.ratingMetricLabel}>{t('analytics_acceptance_rate')}</Text>
            </View>
            <View style={styles.ratingMetricItem}>
              <Text style={styles.ratingMetricValue}>{Math.round(completionRate)}%</Text>
              <Text style={styles.ratingMetricLabel}>{t('analytics_completion_rate')}</Text>
            </View>
          </View>

          <Text style={styles.ratingRecommendationsTitle}>{t('rating_recommendations_title')}</Text>
          {ratingRecommendations.map((recommendation, index) => (
            <View key={`rating-recommendation-${recommendation.key}-${index}`} style={styles.ratingRecommendationRow}>
              <Text style={styles.ratingRecommendationIndex}>{index + 1}</Text>
              <Text style={styles.ratingRecommendationText}>{t(recommendation.key, recommendation.values || {})}</Text>
            </View>
          ))}
        </View>

        {/* Daily Earnings Chart */}
        {charts.daily && charts.daily.length > 0 && (
          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>{t('daily_earnings')}</Text>
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
          <Text style={styles.chartTitle}>{t('rides_by_hour')}</Text>
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
          <Text style={styles.sectionTitle}>{t('insights')}</Text>

          {insights.peakHours.length > 0 && (
            <View style={styles.insightCard}>
              <Ionicons name="time" size={20} color="#007bff" />
              <View style={styles.insightContent}>
                <Text style={styles.insightTitle}>{t('peak_hours')}</Text>
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
                <Text style={styles.insightTitle}>{t('top_areas')}</Text>
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
                <Text style={styles.insightTitle}>{t('busiest_day')}</Text>
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
  ratingCenterCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  ratingCenterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  ratingCenterIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  ratingCenterHeaderTextWrap: {
    flex: 1,
  },
  ratingCenterTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  ratingCenterSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: '#6b7280',
  },
  ratingMetricsRow: {
    flexDirection: 'row',
    marginBottom: 14,
    gap: 8,
  },
  ratingMetricItem: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  ratingMetricValue: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  ratingMetricLabel: {
    marginTop: 4,
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    textAlign: 'center',
  },
  ratingRecommendationsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
  },
  ratingRecommendationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 7,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  ratingRecommendationIndex: {
    width: 20,
    fontSize: 12,
    fontWeight: '800',
    color: '#2563eb',
    marginTop: 1,
  },
  ratingRecommendationText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: '#334155',
    fontWeight: '500',
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
