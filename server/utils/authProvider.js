/**
 * Resolve auth_method from a verified Firebase ID token.
 */
export function resolveAuthMethod(decodedToken) {
  const provider =
    decodedToken.firebase?.sign_in_provider ||
    decodedToken.sign_in_provider ||
    null;

  switch (provider) {
    case 'google.com':
      return 'google';
    case 'apple.com':
      return 'apple';
    case 'phone':
      return 'phone';
    case 'password':
    case 'custom':
      return decodedToken.email ? 'email' : 'phone';
    default:
      return decodedToken.email ? 'email' : 'phone';
  }
}

/**
 * Parse first/last name from Firebase token display name.
 */
export function parseDisplayName(decodedToken) {
  const name = (decodedToken.name || '').trim();
  if (!name) {
    return { firstName: 'User', lastName: '' };
  }

  const parts = name.split(/\s+/);
  return {
    firstName: parts[0] || 'User',
    lastName: parts.slice(1).join(' ') || '',
  };
}

/**
 * Human-readable label for stored auth_method values.
 */
export function formatAuthMethod(authMethod) {
  switch (authMethod) {
    case 'google':
      return 'Google';
    case 'apple':
      return 'Apple';
    case 'email':
    case 'firebase':
      return 'Email';
    case 'phone':
      return 'Phone';
    case 'local':
      return 'Email';
    default:
      return 'your original method';
  }
}

/**
 * Suggested login action for duplicate-email errors.
 */
export function duplicateEmailMessage(authMethod) {
  return `An account with this email already exists. Please sign in with ${formatAuthMethod(authMethod)}.`;
}
