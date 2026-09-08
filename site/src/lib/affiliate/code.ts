import { randomBytes } from "node:crypto";

// No 0/O/1/I/L — every character is unambiguous when read off a screen or
// typed by hand from a shared link.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Short, human-shareable referral code. Collisions are handled by the
 * caller retrying the insert on a unique-constraint error. */
export function generateAffiliateCode(length = 7): string {
  return Array.from(randomBytes(length), (b) => ALPHABET[b % ALPHABET.length]).join("");
}
