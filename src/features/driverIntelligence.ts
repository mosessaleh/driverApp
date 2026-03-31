export type NetworkMode = 'online' | 'offline' | 'syncing';

export type SmartAlert = {
  id: string;
  severity: 'low' | 'medium' | 'high';
  icon: string;
  titleKey: string;
  bodyKey: string;
  values?: Record<string, string | number>;
};

type BuildSmartAlertsParams = {
  networkMode: NetworkMode;
  offlineQueueCount: number;
  nextScheduledRideCountdownMinutes: number | null;
  scheduledEtaMinutes: number | null;
  restrictedOffers: boolean;
};

export const buildSmartAlerts = ({
  networkMode,
  offlineQueueCount,
  nextScheduledRideCountdownMinutes,
  scheduledEtaMinutes,
  restrictedOffers,
}: BuildSmartAlertsParams): SmartAlert[] => {
  const alerts: SmartAlert[] = [];

  if (networkMode === 'offline') {
    alerts.push({
      id: 'offline-mode',
      severity: 'high',
      icon: '📡',
      titleKey: 'smart_alert_offline_title',
      bodyKey: 'smart_alert_offline_body',
      values: { count: offlineQueueCount },
    });
  }

  if (networkMode === 'syncing') {
    alerts.push({
      id: 'syncing-mode',
      severity: 'medium',
      icon: '🔄',
      titleKey: 'smart_alert_syncing_title',
      bodyKey: 'smart_alert_syncing_body',
      values: { count: offlineQueueCount },
    });
  }

  if (restrictedOffers) {
    alerts.push({
      id: 'restricted-offers',
      severity: 'high',
      icon: '⛔',
      titleKey: 'smart_alert_restricted_title',
      bodyKey: 'smart_alert_restricted_body',
    });
  }

  if (
    typeof nextScheduledRideCountdownMinutes === 'number' &&
    typeof scheduledEtaMinutes === 'number' &&
    nextScheduledRideCountdownMinutes > 0 &&
    scheduledEtaMinutes > nextScheduledRideCountdownMinutes
  ) {
    alerts.push({
      id: 'scheduled-risk',
      severity: 'high',
      icon: '⏱️',
      titleKey: 'smart_alert_schedule_risk_title',
      bodyKey: 'smart_alert_schedule_risk_body',
      values: {
        eta: scheduledEtaMinutes,
        left: nextScheduledRideCountdownMinutes,
      },
    });
  }

  const severityWeight = {
    high: 3,
    medium: 2,
    low: 1,
  } as const;

  return alerts
    .sort((a, b) => severityWeight[b.severity] - severityWeight[a.severity])
    .slice(0, 3);
};

export type RatingRecommendation = {
  key: string;
  values?: Record<string, string | number>;
};

type BuildRatingRecommendationsParams = {
  averageRating: number;
  completionRate: number;
  acceptanceRate: number;
  peakHours: string[];
  topArea?: string;
};

export const buildRatingRecommendations = ({
  averageRating,
  completionRate,
  acceptanceRate,
  peakHours,
  topArea,
}: BuildRatingRecommendationsParams): RatingRecommendation[] => {
  const recommendations: RatingRecommendation[] = [];

  if (averageRating < 4.6) {
    recommendations.push({ key: 'rating_tip_punctuality' });
  }

  if (completionRate < 96) {
    recommendations.push({
      key: 'rating_tip_completion',
      values: { rate: Math.max(0, Math.round(completionRate)) },
    });
  }

  if (acceptanceRate < 88) {
    recommendations.push({
      key: 'rating_tip_acceptance',
      values: { rate: Math.max(0, Math.round(acceptanceRate)) },
    });
  }

  if (peakHours.length > 0) {
    recommendations.push({
      key: 'rating_tip_peak_hours',
      values: { hours: peakHours.slice(0, 2).join(', ') },
    });
  }

  if (topArea) {
    recommendations.push({
      key: 'rating_tip_top_area',
      values: { area: topArea },
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({ key: 'rating_tip_excellent' });
  }

  return recommendations.slice(0, 4);
};
