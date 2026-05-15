import crypto from 'crypto';

/**
 * Generates a human-readable ID with a prefix and a random alphanumeric string.
 * Example: PAY-X7R2K9
 * 
 * @param prefix The prefix for the ID (e.g., 'PAY', 'USR', 'AUD')
 * @param length The length of the random part (default 6)
 */
export function generateReadableId(prefix: string, length: number = 6): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let randomPart = '';
  const randomBytes = crypto.randomBytes(length);
  
  for (let i = 0; i < length; i++) {
    randomPart += chars[randomBytes[i] % chars.length];
  }
  
  return `${prefix}-${randomPart}`;
}
