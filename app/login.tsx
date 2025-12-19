import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Image, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';

const { width: screenWidth } = Dimensions.get('window');

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [startKM, setStartKM] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, authState } = useAuth();
  const router = useRouter();

  useEffect(() => {
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
          // If error, perhaps token invalid, stay in login
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
    console.log('Attempting login with:', username, startKMNum);
    try {
      console.log('Calling login function...');
      await login(username, password, startKMNum);
      console.log('Login successful, navigating to dashboard');
      router.replace('/dashboard');
    } catch (error) {
      console.log('Login failed:', error);
      Alert.alert('Login Failed', (error as Error).message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.logoContainer}>
           <Image
             source={require('../assets/logo.png')}
             style={styles.logo}
             resizeMode="contain"
           />
           <Text style={styles.appName}>Driver App</Text>
         </View>
        <View style={styles.formContainer}>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to continue</Text>
          <TextInput
            style={styles.input}
            placeholder="Username"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            placeholderTextColor="#999"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholderTextColor="#999"
          />
          <TextInput
            style={styles.input}
            placeholder="Start KM"
            value={startKM}
            onChangeText={setStartKM}
            keyboardType="numeric"
            placeholderTextColor="#999"
          />
          <TouchableOpacity style={styles.loginButton} onPress={handleLogin} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginButtonText}>Start Shift</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoBox: {
    width: 220,
    height: 70,
    borderWidth: 2,
    borderColor: '#007bff',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: '#f8f9fa',
  },
  logo: {
    width: 220,
    height: 55,
    marginBottom: 5,
  },
  logoPlaceholder: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  appName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  formContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    color: '#666',
  },
  input: {
    height: 50,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 15,
    paddingHorizontal: 15,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  loginButton: {
    backgroundColor: '#007bff',
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});