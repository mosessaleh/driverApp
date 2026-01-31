import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Dimensions,
  Animated,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { useSettings } from '../src/context/SettingsContext';
import { Input } from '../src/components/Input';
import { Button } from '../src/components/Button';
import { Loading } from '../src/components/Loading';
import { colors, typography, spacing, shadows, getThemeColors } from '../src/theme';
import { Ionicons } from '@expo/vector-icons';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [startKM, setStartKM] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login, authState } = useAuth();
  const { isDarkMode } = useSettings();
  const router = useRouter();
  const themeColors = getThemeColors(isDarkMode);

  // Animation values
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(50)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    // Entrance animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();

    const checkAndRedirect = async () => {
      if (!authState.isLoading && authState.user && authState.token) {
        try {
          const { getDriverStatus } = await import('../src/services/api');
          const status = await getDriverStatus(authState.token);
          if (status.hasActiveShift) {
            router.replace('/dashboard');
          }
        } catch (error) {
          console.error('Error checking driver status:', error);
        }
      }
    };
    checkAndRedirect();
  }, [authState, router]);

  const handleLogin = async () => {
    if (!username || !password || !startKM) {
      Alert.alert('Error', 'Please enter username, password, and start KM');
      return;
    }
    const startKMNum = parseFloat(startKM);
    if (isNaN(startKMNum)) {
      Alert.alert('Error', 'Start KM must be a valid number');
      return;
    }
    setLoading(true);
    try {
      await login(username, password, startKMNum);
      router.replace('/dashboard');
    } catch (error) {
      Alert.alert('Login Failed', (error as Error).message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.neutral.background }]}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={themeColors.neutral.background}
      />
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Background Gradient Effect */}
          <View style={styles.backgroundEffect}>
            <View style={[styles.circle1, { backgroundColor: colors.primary[100] }]} />
            <View style={[styles.circle2, { backgroundColor: colors.success[100] }]} />
          </View>

          <Animated.View
            style={[
              styles.content,
              {
                opacity: fadeAnim,
                transform: [
                  { translateY: slideAnim },
                  { scale: scaleAnim },
                ],
              },
            ]}
          >
            {/* Login Form Card with Logo */}
            <View
              style={[
                styles.formCard,
                {
                  backgroundColor: themeColors.neutral.surface,
                  ...shadows.lg,
                },
              ]}
            >
              {/* Logo overlapping top of card */}
              <View style={styles.logoContainer}>
                <Image
                  source={require('../assets/logo.png')}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>


              <Input
                placeholder="Enter your username"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                icon="person-outline"
                isDarkMode={isDarkMode}
              />

              <Input
                placeholder="Enter your password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                icon="lock-closed-outline"
                iconRight={showPassword ? 'eye-off' : 'eye'}
                onIconRightPress={() => setShowPassword(!showPassword)}
                isDarkMode={isDarkMode}
              />

              <Input
                placeholder="Enter vehicle odometer reading"
                value={startKM}
                onChangeText={setStartKM}
                keyboardType="numeric"
                icon="speedometer-outline"
                isDarkMode={isDarkMode}
              />

              <Button
                title={loading ? 'Signing in...' : 'Start Shift'}
                onPress={handleLogin}
                loading={loading}
                disabled={loading}
                size="large"
                fullWidth
                isDarkMode={isDarkMode}
                style={{ marginTop: spacing[4] }}
              />
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={[styles.footerText, { color: themeColors.neutral.textSecondary }]}>
                © 2024 TrafikTaxa. All rights reserved.
              </Text>
              <View style={styles.versionContainer}>
                <Text style={[styles.versionText, { color: themeColors.neutral.textTertiary }]}>
                  v1.0.0
                </Text>
              </View>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[8],
  },
  backgroundEffect: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  circle1: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    top: -100,
    right: -100,
    opacity: 0.5,
  },
  circle2: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    bottom: 100,
    left: -80,
    opacity: 0.3,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -50,
    marginBottom: spacing[2],
    alignSelf: 'center',
  },
  logo: {
    width: 200,
    height: 100,
  },
  formCard: {
    borderRadius: 24,
    padding: spacing[8],
    paddingTop: 60,
    marginBottom: spacing[6],
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    fontSize: typography.sizes.sm,
    marginBottom: spacing[2],
  },
  versionContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: 12,
  },
  versionText: {
    fontSize: typography.sizes.xs,
    fontWeight: '500',
  },
});
