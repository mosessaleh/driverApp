import { Redirect } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Loading } from '../src/components/Loading';
import { useTranslation } from '../src/hooks/useTranslation';

export default function Index() {
  const { authState } = useAuth();
  const { t } = useTranslation();

  if (authState.isLoading) {
    return <Loading fullScreen text={t('loading')} />;
  }

  if (authState.user && authState.token) {
    return <Redirect href="/dashboard" />;
  }

  return <Redirect href="/login" />;
}
