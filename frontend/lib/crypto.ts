import CryptoJS from 'crypto-js';

/**
 * Encrypts a message's plain text content using AES-256 with the conversationId as the secret key.
 */
export function encryptMessage(text: string, conversationId: string): string {
  if (!text) return '';
  try {
    return CryptoJS.AES.encrypt(text, conversationId).toString();
  } catch (e) {
    console.error('Encryption failed:', e);
    return text;
  }
}

/**
 * Decrypts a message's ciphertext content using AES-256 with the conversationId as the secret key.
 * If the content is not ciphertext (e.g. system logs, media placeholders, or unencrypted history),
 * it returns the original string as-is.
 */
export function decryptMessage(ciphertext: string, conversationId: string): string {
  if (!ciphertext) return '';
  // Check if it's already special markers that shouldn't be decrypted
  if (
    ciphertext.startsWith('🚫') ||
    ciphertext.startsWith('📷') ||
    ciphertext.startsWith('📎')
  ) {
    return ciphertext;
  }
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, conversationId);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    // If decrypted string is empty, it means decryption failed (or string was not encrypted)
    return decrypted || ciphertext;
  } catch (e) {
    return ciphertext;
  }
}
