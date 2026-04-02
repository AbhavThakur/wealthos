// WebAuthn biometric authentication utility
// Uses platform authenticator (Face ID, Touch ID, fingerprint, Windows Hello)

const CREDENTIAL_KEY = "wealthos-biometric-cred";

export function isBiometricSupported() {
  return (
    !!window.PublicKeyCredential &&
    typeof window.PublicKeyCredential
      .isUserVerifyingPlatformAuthenticatorAvailable === "function"
  );
}

export async function isBiometricAvailable() {
  if (!isBiometricSupported()) return false;
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export function isBiometricEnrolled() {
  return !!localStorage.getItem(CREDENTIAL_KEY);
}

function getStoredCredential() {
  try {
    return JSON.parse(localStorage.getItem(CREDENTIAL_KEY));
  } catch {
    return null;
  }
}

// Convert base64url to ArrayBuffer
function base64urlToBuffer(base64url) {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4;
  const padded = pad ? base64 + "=".repeat(4 - pad) : base64;
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

// Convert ArrayBuffer to base64url
function bufferToBase64url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Enroll biometric — creates a credential bound to this device.
 * Returns true if successful.
 */
export async function enrollBiometric() {
  if (!(await isBiometricAvailable())) return false;

  const userId = new Uint8Array(16);
  crypto.getRandomValues(userId);

  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);

  try {
    const credential = await navigator.credentials.create({
      publicKey: {
        rp: { name: "WealthOS", id: window.location.hostname },
        user: {
          id: userId,
          name: "wealthos-user",
          displayName: "WealthOS Household",
        },
        challenge,
        pubKeyCredParams: [
          { type: "public-key", alg: -7 }, // ES256
          { type: "public-key", alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
          residentKey: "preferred",
        },
        timeout: 60000,
        attestation: "none",
      },
    });

    // Store credential ID for future authentication
    const stored = {
      id: bufferToBase64url(credential.rawId),
      type: credential.type,
    };
    localStorage.setItem(CREDENTIAL_KEY, JSON.stringify(stored));
    return true;
  } catch {
    return false;
  }
}

/**
 * Authenticate with biometric — verifies the user owns the enrolled credential.
 * Returns true if authentication succeeded.
 */
export async function authenticateBiometric() {
  const stored = getStoredCredential();
  if (!stored) return false;

  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);

  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        rpId: window.location.hostname,
        allowCredentials: [
          {
            type: "public-key",
            id: base64urlToBuffer(stored.id),
            transports: ["internal"],
          },
        ],
        userVerification: "required",
        timeout: 60000,
      },
    });

    // If we got here without throwing, the platform authenticator verified the user
    return !!assertion;
  } catch {
    return false;
  }
}

/**
 * Remove biometric enrollment.
 */
export function removeBiometric() {
  localStorage.removeItem(CREDENTIAL_KEY);
}
