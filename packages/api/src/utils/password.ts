/**
 * Password hashing utilities using Argon2id
 *
 * Uses OWASP-recommended settings for Argon2id:
 * - Memory: 64 MiB (65536 KiB)
 * - Iterations: 3
 * - Parallelism: 4
 * - Salt length: 16 bytes (auto-generated)
 * - Hash length: 32 bytes
 *
 * @see https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
 */

import * as argon2 from 'argon2';

// OWASP recommended parameters for Argon2id
const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 65536, // 64 MiB
  timeCost: 3, // 3 iterations
  parallelism: 4, // 4 parallel threads
  hashLength: 32, // 32 bytes output
};

/**
 * Hashes a password using Argon2id with OWASP-recommended settings.
 *
 * @param password - The plain text password to hash
 * @returns The hashed password string (includes algorithm params and salt)
 *
 * @example
 * const hash = await hashPassword('mySecurePassword123');
 * // Returns something like: $argon2id$v=19$m=65536,t=3,p=4$...
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS);
}

/**
 * Verifies a password against its Argon2id hash.
 *
 * @param hash - The stored password hash
 * @param password - The plain text password to verify
 * @returns True if the password matches, false otherwise
 *
 * @example
 * const isValid = await verifyPassword(storedHash, 'mySecurePassword123');
 */
export async function verifyPassword(
  hash: string,
  password: string
): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    // Return false for any verification errors (malformed hash, etc.)
    return false;
  }
}

/**
 * Checks if a password hash needs to be rehashed.
 * This is useful when upgrading security parameters.
 *
 * @param hash - The stored password hash
 * @returns True if the hash should be updated with new parameters
 */
export async function needsRehash(hash: string): Promise<boolean> {
  try {
    return argon2.needsRehash(hash, ARGON2_OPTIONS);
  } catch {
    // If we can't check, assume it needs rehashing
    return true;
  }
}
