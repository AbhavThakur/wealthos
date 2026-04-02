// Centralized haptic feedback utility
// Usage: haptic() for light tap, haptic('medium') for confirms, haptic('heavy') for deletes

const PATTERNS = {
  light: [15],
  medium: [30],
  heavy: [50],
  success: [20, 50, 30],
  error: [40, 30, 40],
  celebrate: [30, 50, 20, 50, 30],
};

export function haptic(type = "light") {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate(PATTERNS[type] || PATTERNS.light);
  }
}
