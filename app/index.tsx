import { Redirect } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { useEffect } from 'react';

export default function Index() {
  return <Redirect href="/login" />;
}