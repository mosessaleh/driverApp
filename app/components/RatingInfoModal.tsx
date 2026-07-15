import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../../src/context/SettingsContext';
import { useTranslation } from '../../src/hooks/useTranslation';
import { colors, shadows, borderRadius, spacing, typography } from '../../src/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  rating: number;
  fiveStarCount: number;
};

export default function RatingInfoModal({ visible, onClose, rating, fiveStarCount }: Props) {
  const { isDarkMode } = useSettings();
  const { t } = useTranslation();
  const styles = React.useMemo(() => getStyles(isDarkMode), [isDarkMode]);

  if (!visible) return null;

  const remainingForBonus = Math.max(0, 5 - fiveStarCount);

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modal}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Ionicons name="star" size={28} color={colors.warning[500]} />
            <Text style={styles.title}>{t('rating_info_title')}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={isDarkMode ? '#94a3b8' : '#64748b'} />
            </TouchableOpacity>
          </View>

          <View style={styles.ratingBanner}>
            <Text style={styles.ratingValue}>{rating.toFixed(2)}</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((i) => (
                <Ionicons
                  key={i}
                  name={i <= Math.round(rating) ? 'star' : 'star-outline'}
                  size={18}
                  color={
                    i <= Math.round(rating)
                      ? colors.warning[500]
                      : isDarkMode
                        ? '#475569'
                        : '#cbd5e1'
                  }
                />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('rating_rules_title')}</Text>

            <View style={styles.ruleRow}>
              <Ionicons name="star" size={18} color={colors.warning[500]} />
              <Text style={styles.ruleText}>{t('rating_rule_5star')}</Text>
            </View>

            <View style={styles.ruleRow}>
              <View style={styles.dot4} />
              <Text style={styles.ruleText}>{t('rating_rule_4star')}</Text>
            </View>

            <View style={styles.ruleRow}>
              <View style={styles.dot23} />
              <Text style={styles.ruleText}>{t('rating_rule_23star')}</Text>
            </View>

            <View style={styles.ruleRow}>
              <View style={styles.dot1} />
              <Text style={styles.ruleText}>{t('rating_rule_1star')}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('rating_bonus_progress')}</Text>
            <View style={styles.progressContainer}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>
                  {remainingForBonus > 0
                    ? t('rating_bonus_remaining').replace('{n}', String(remainingForBonus))
                    : t('rating_bonus_ready')}
                </Text>
                <Text style={styles.progressValue}>{fiveStarCount}/5</Text>
              </View>
              <View style={styles.progressBarBg}>
                <View
                  style={[styles.progressBarFill, { width: `${(fiveStarCount / 5) * 100}%` }]}
                />
              </View>
              {fiveStarCount >= 5 && (
                <Text style={styles.bonusReady}>{t('rating_next_bonus')}</Text>
              )}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('rating_tips_title')}</Text>
            {rating < 4.0 && <Text style={styles.tipText}>{t('rating_tip_low')}</Text>}
            {rating >= 4.0 && rating < 4.5 && (
              <Text style={styles.tipText}>{t('rating_tip_medium')}</Text>
            )}
            {rating >= 4.5 && rating < 4.9 && (
              <Text style={styles.tipText}>{t('rating_tip_high')}</Text>
            )}
            {rating >= 4.9 && <Text style={styles.tipText}>{t('rating_tip_excellent')}</Text>}
          </View>
        </ScrollView>

        <TouchableOpacity style={styles.okButton} onPress={onClose}>
          <Text style={styles.okButtonText}>{t('ok')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const getStyles = (isDarkMode: boolean) =>
  StyleSheet.create({
    modalOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 2500,
    },
    modal: {
      backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
      borderRadius: 16,
      padding: 20,
      width: '90%',
      maxWidth: 420,
      maxHeight: '85%',
      ...shadows['2xl'],
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
      gap: 10,
    },
    title: {
      flex: 1,
      fontSize: typography.sizes.lg,
      fontWeight: typography.weight.bold as any,
      color: isDarkMode ? '#f1f5f9' : '#0f172a',
    },
    closeBtn: {
      padding: 4,
    },
    ratingBanner: {
      backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc',
      borderRadius: 12,
      padding: 20,
      alignItems: 'center',
      marginBottom: 16,
      borderWidth: 1,
      borderColor: isDarkMode ? '#334155' : '#e2e8f0',
    },
    ratingValue: {
      fontSize: 40,
      fontWeight: typography.weight.bold as any,
      color: isDarkMode ? '#f1f5f9' : '#0f172a',
    },
    starsRow: {
      flexDirection: 'row',
      marginTop: 8,
      gap: 4,
    },
    section: {
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: typography.sizes.md,
      fontWeight: typography.weight.semibold as any,
      color: isDarkMode ? '#f1f5f9' : '#0f172a',
      marginBottom: 10,
    },
    ruleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
      gap: 10,
      paddingLeft: 4,
    },
    dot4: {
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: isDarkMode ? '#475569' : '#94a3b8',
    },
    dot23: {
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: colors.warning[500],
    },
    dot1: {
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: colors.danger[500],
    },
    ruleText: {
      flex: 1,
      fontSize: typography.sizes.sm,
      color: isDarkMode ? '#cbd5e1' : '#475569',
      lineHeight: 20,
    },
    progressContainer: {
      backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc',
      borderRadius: 10,
      padding: 14,
      borderWidth: 1,
      borderColor: isDarkMode ? '#334155' : '#e2e8f0',
    },
    progressHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    progressLabel: {
      fontSize: typography.sizes.sm,
      color: isDarkMode ? '#cbd5e1' : '#475569',
    },
    progressValue: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weight.bold as any,
      color: isDarkMode ? '#f1f5f9' : '#0f172a',
    },
    progressBarBg: {
      height: 8,
      backgroundColor: isDarkMode ? '#334155' : '#e2e8f0',
      borderRadius: 4,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: '100%',
      backgroundColor: colors.warning[500],
      borderRadius: 4,
    },
    bonusReady: {
      marginTop: 8,
      fontSize: typography.sizes.sm,
      color: colors.success[500],
      fontWeight: typography.weight.semibold as any,
    },
    tipText: {
      fontSize: typography.sizes.sm,
      color: isDarkMode ? '#cbd5e1' : '#475569',
      lineHeight: 20,
    },
    okButton: {
      backgroundColor: colors.primary[500],
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 4,
    },
    okButtonText: {
      color: '#fff',
      fontSize: typography.sizes.md,
      fontWeight: typography.weight.semibold as any,
    },
  });
