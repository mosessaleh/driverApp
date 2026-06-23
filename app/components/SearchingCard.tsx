import React from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { useSettings } from '../../src/context/SettingsContext';
import { useTranslation } from '../../src/hooks/useTranslation';

type Props = {
  visible: boolean;
  letterAnimValues: Animated.Value[];
  dot1Anim: Animated.Value;
  dot2Anim: Animated.Value;
  dot3Anim: Animated.Value;
};

export default function SearchingCard({ visible, letterAnimValues, dot1Anim, dot2Anim, dot3Anim }: Props) {
  const { isDarkMode } = useSettings();
  const { t } = useTranslation();
  const searchText = t('searching_trips');
  const searchLetters = React.useMemo(() => Array.from(searchText), [searchText]);
  const styles = React.useMemo(() => getStyles(isDarkMode), [isDarkMode]);

  if (!visible) return null;

  return (
    <View style={styles.searchingBar}>
      <Text style={styles.searchingText}>
        {searchLetters.map((letter, index) => (
          <Animated.Text
            key={`search-letter-${index}`}
            style={[
              styles.searchingLetter,
              { transform: [{ scale: letterAnimValues[index] }] },
            ]}
          >
            {letter === ' ' ? '\u00A0' : letter}
          </Animated.Text>
        ))}
      </Text>
      <Text style={styles.searchingSubText}>{t('searching_subtext')}</Text>

      <View style={styles.searchingProgressRow}>
        <Animated.View style={[styles.searchingProgressDot, { transform: [{ scale: dot1Anim }] }]} />
        <Animated.View style={[styles.searchingProgressDot, { transform: [{ scale: dot2Anim }] }]} />
        <Animated.View style={[styles.searchingProgressDot, { transform: [{ scale: dot3Anim }] }]} />
      </View>
    </View>
  );
}

const getStyles = (isDarkMode: boolean) => StyleSheet.create({
  searchingBar: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(148,163,184,0.2)' : '#e2e8f0',
  },
  searchingText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: isDarkMode ? '#f1f5f9' : '#0f172a',
    marginBottom: 4,
  },
  searchingLetter: {
    color: isDarkMode ? '#f1f5f9' : '#0f172a',
    fontWeight: 'bold',
  },
  searchingSubText: {
    fontSize: 12,
    color: isDarkMode ? '#94a3b8' : '#64748b',
    marginBottom: 12,
  },
  searchingProgressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  searchingProgressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#38bdf8',
  },
});
