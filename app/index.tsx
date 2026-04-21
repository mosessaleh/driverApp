import { Redirect } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Loading } from '../src/components/Loading';

export default function Index() {
  const { authState } = useAuth();

  if (authState.isLoading) {
    return <Loading fullScreen text="Loading..." />;
  }

  if (authState.user && authState.token) {
    return <Redirect href="/dashboard" />;
  }

  return <Redirect href="/login" />;
}
