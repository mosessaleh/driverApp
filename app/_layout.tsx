import { Stack } from 'expo-router';
import { AuthProvider } from '../src/context/AuthContext';
import { SettingsProvider } from '../src/context/SettingsContext';

export default function Layout() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <Stack />
      </SettingsProvider>
    </AuthProvider>
  );
}