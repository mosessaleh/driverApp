import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { onRideOffer, offRideOffer } from '../services/socket';
import type { RideOfferPayload } from '../types/socket';

export function useRideOfferRedirect(
  active: boolean = true,
  targetRoute: string = '/dashboard',
) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;

    const handleRideOffer = (_data: RideOfferPayload) => {
      router.replace(targetRoute as `/${string}`);
    };

    onRideOffer(handleRideOffer);

    return () => {
      offRideOffer(handleRideOffer);
    };
  }, [active, targetRoute, router]);
}
