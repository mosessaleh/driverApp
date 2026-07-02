import { useRef, useCallback } from 'react';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';

const waitFor = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type SoundRef = React.MutableRefObject<Audio.Sound | null>;

const getAudioMode = () => ({
  allowsRecordingIOS: false,
  playsInSilentModeIOS: true,
  staysActiveInBackground: true,
  interruptionModeIOS: InterruptionModeIOS.DuckOthers,
  shouldDuckAndroid: true,
  interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
  playThroughEarpieceAndroid: false,
});

const isAudioFocusException = (error: unknown) => {
  const errorMessage = String((error as { message?: string })?.message || error || '');
  return errorMessage.includes('AudioFocusNotAcquiredException');
};

const safelyUnload = async (sound: Audio.Sound | null, context: string) => {
  if (!sound) return;
  try {
    await sound.stopAsync();
  } catch {
    // noop
  }
  try {
    await sound.unloadAsync();
  } catch (error) {
    console.warn(`Error unloading ${context}:`, error);
  }
};

export function useAudioManager() {
  const isAudioModeReadyRef = useRef(false);
  const rideOfferSoundRef = useRef<Audio.Sound | null>(null);
  const lateWarningSoundRef = useRef<Audio.Sound | null>(null);
  const beepSoundRef = useRef<Audio.Sound | null>(null);

  const ensureAudioMode = useCallback(async () => {
    try {
      await Audio.setAudioModeAsync(getAudioMode());
      isAudioModeReadyRef.current = true;
      return true;
    } catch (error) {
      isAudioModeReadyRef.current = false;
      console.warn('Error setting audio mode:', error);
      return false;
    }
  }, []);

  const runWithAudioFocusRetry = useCallback(
    async (operation: () => Promise<unknown>, context: string, maxAttempts = 3) => {
      let lastError: unknown = null;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          if (!isAudioModeReadyRef.current || attempt > 1) {
            await ensureAudioMode();
          }
          return await operation();
        } catch (error) {
          lastError = error;
          if (!isAudioFocusException(error) || attempt === maxAttempts) {
            throw error;
          }
          const retryDelayMs = 140 * attempt;
          console.warn(
            `[Audio] ${context} failed to acquire focus (attempt ${attempt}/${maxAttempts}), retrying in ${retryDelayMs}ms`,
          );
          await waitFor(retryDelayMs);
        }
      }

      throw lastError;
    },
    [ensureAudioMode],
  );

  const stopBeepSound = useCallback(async () => {
    const beep = beepSoundRef.current;
    if (!beep) return;
    beepSoundRef.current = null;
    await safelyUnload(beep, 'beep sound');
  }, []);

  const playBeep = useCallback(
    async (soundFile: number) => {
      await stopBeepSound();
      try {
        await runWithAudioFocusRetry(async () => {
          const { sound } = await Audio.Sound.createAsync(soundFile, {
            shouldPlay: true,
            volume: 0.85,
          });
          beepSoundRef.current = sound;
          sound.setOnPlaybackStatusUpdate((status) => {
            if (status.isLoaded && status.didJustFinish) {
              beepSoundRef.current = null;
              safelyUnload(sound, 'beep');
            }
          });
        }, 'beep');
      } catch (error) {
        console.warn('Error playing beep:', error);
      }
    },
    [stopBeepSound, runWithAudioFocusRetry],
  );

  const loadAndPlayLooping = useCallback(
    async (soundFile: number, ref: SoundRef, context: string, volume = 1.0) => {
      try {
        await runWithAudioFocusRetry(async () => {
          const { sound } = await Audio.Sound.createAsync(soundFile, {
            isLooping: true,
            shouldPlay: true,
            volume,
          });
          ref.current = sound;
        }, context);
      } catch (error) {
        console.warn(`Error loading ${context}:`, error);
        ref.current = null;
      }
    },
    [runWithAudioFocusRetry],
  );

  const stopLoopingSound = useCallback(
    async (ref: SoundRef, context: string) => {
      const sound = ref.current;
      if (!sound) return;
      ref.current = null;
      await safelyUnload(sound, context);
    },
    [],
  );

  return {
    ensureAudioMode,
    runWithAudioFocusRetry,
    stopBeepSound,
    playBeep,
    loadAndPlayLooping,
    stopLoopingSound,
    rideOfferSoundRef,
    lateWarningSoundRef,
    beepSoundRef,
    isAudioModeReadyRef,
  };
}
