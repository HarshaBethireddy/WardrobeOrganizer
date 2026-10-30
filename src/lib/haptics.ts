let enabled = true;

export function setHapticsEnabled(v: boolean) {
  enabled = v;
}

/** A short vibration tick on key actions (Android supports the Vibration API). */
export function haptic(pattern: number | number[] = 12) {
  if (!enabled) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* not supported */
  }
}
