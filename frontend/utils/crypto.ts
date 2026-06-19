import { Platform } from 'react-native';

const SECRET_KEY = 'taatom_secure_profile_salt_key_2026';
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

/**
 * Pure JS base64 encoder
 */
function base64Encode(input: string): string {
  let output = '';
  let chr1, chr2, chr3, enc1, enc2, enc3, enc4;
  let i = 0;

  while (i < input.length) {
    chr1 = input.charCodeAt(i++);
    chr2 = input.charCodeAt(i++);
    chr3 = input.charCodeAt(i++);

    enc1 = chr1 >> 2;
    enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
    enc3 = isNaN(chr2) ? 64 : ((chr2 & 15) << 2) | (chr3 >> 6);
    enc4 = isNaN(chr3) ? 64 : chr3 & 63;

    output = output +
      CHARS.charAt(enc1) + CHARS.charAt(enc2) +
      CHARS.charAt(enc3) + CHARS.charAt(enc4);
  }

  return output;
}

/**
 * Pure JS base64 decoder
 */
function base64Decode(input: string): string {
  let output = '';
  let chr1, chr2, chr3;
  let enc1, enc2, enc3, enc4;
  let i = 0;

  // Clean input
  const base64 = input.replace(/[^A-Za-z0-9+/=]/g, '');

  while (i < base64.length) {
    enc1 = CHARS.indexOf(base64.charAt(i++));
    enc2 = CHARS.indexOf(base64.charAt(i++));
    enc3 = CHARS.indexOf(base64.charAt(i++));
    enc4 = CHARS.indexOf(base64.charAt(i++));

    chr1 = (enc1 << 2) | (enc2 >> 4);
    chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    chr3 = ((enc3 & 3) << 6) | enc4;

    output = output + String.fromCharCode(chr1);

    if (enc3 !== 64) {
      output = output + String.fromCharCode(chr2);
    }
    if (enc4 !== 64) {
      output = output + String.fromCharCode(chr3);
    }
  }

  return output;
}

/**
 * Encrypts a string using a simple, fast XOR cipher and base64 encoding.
 * Perfect for lightweight mobile AsyncStorage obfuscation.
 */
export const encryptData = (text: string): string => {
  if (!text) return '';
  try {
    let result = '';
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i) ^ SECRET_KEY.charCodeAt(i % SECRET_KEY.length);
      result += String.fromCharCode(charCode);
    }
    
    // Safely encode to base64
    if (Platform.OS === 'web' && typeof btoa === 'function') {
      try {
        return btoa(result);
      } catch {
        return base64Encode(result);
      }
    }
    return base64Encode(result);
  } catch (error) {
    return text;
  }
};

/**
 * Decrypts a string using a simple, fast XOR cipher and base64 decoding.
 */
export const decryptData = (ciphertext: string): string => {
  if (!ciphertext) return '';
  try {
    let decoded = '';
    if (Platform.OS === 'web' && typeof atob === 'function') {
      try {
        decoded = atob(ciphertext);
      } catch {
        decoded = base64Decode(ciphertext);
      }
    } else {
      decoded = base64Decode(ciphertext);
    }
    
    let result = '';
    for (let i = 0; i < decoded.length; i++) {
      const charCode = decoded.charCodeAt(i) ^ SECRET_KEY.charCodeAt(i % SECRET_KEY.length);
      result += String.fromCharCode(charCode);
    }
    return result;
  } catch (error) {
    return ciphertext;
  }
};
