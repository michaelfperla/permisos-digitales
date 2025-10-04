/**
 * Phone Number Utilities for Mexican Numbers
 * Handles normalization and variant generation for flexible matching
 */

/**
 * Normalize phone number for storage (always 521 format for Mexican numbers)
 * @param {string} phone - Input phone number in any format
 * @returns {string} Normalized phone number
 */
function normalizePhoneForStorage(phone) {
  if (!phone) return null;
  
  // Remove all non-digits
  const cleaned = phone.toString().replace(/\D/g, '');
  
  // Handle Mexican phone formats
  if (cleaned.length === 10) {
    // Local format: 6641234567 → 5216641234567
    return '521' + cleaned;
  } else if (cleaned.startsWith('52') && cleaned.length === 12) {
    // International without mobile prefix: 526641234567 → 5216641234567
    return '521' + cleaned.substring(2);
  } else if (cleaned.startsWith('521') && cleaned.length === 13) {
    // Already correct: 5216641234567
    return cleaned;
  } else if (cleaned.startsWith('1') && cleaned.length === 11) {
    // Mobile prefix without country: 16641234567 → 5216641234567
    return '52' + cleaned;
  }
  
  // Return as-is for non-Mexican formats
  return cleaned;
}

/**
 * Generate all possible phone variants for database lookups
 * @param {string} phone - Input phone number
 * @returns {string[]} Array of possible phone formats
 */
function getPhoneVariants(phone) {
  if (!phone) return [];
  
  const cleaned = phone.toString().replace(/\D/g, '');
  const variants = new Set();
  
  // Add original cleaned version
  variants.add(cleaned);
  
  // If it looks like a Mexican number, add variants
  if (cleaned.length === 10) {
    // Local number
    variants.add(cleaned);                  // 6641234567
    variants.add('52' + cleaned);          // 526641234567
    variants.add('521' + cleaned);         // 5216641234567
    variants.add('+52' + cleaned);         // +526641234567
    variants.add('+521' + cleaned);        // +5216641234567
  } else if (cleaned.startsWith('52')) {
    const withoutCountry = cleaned.substring(2);
    
    if (cleaned.startsWith('521') && cleaned.length === 13) {
      // Has mobile prefix
      const localNumber = cleaned.substring(3);
      variants.add(localNumber);                    // 6641234567
      variants.add('52' + localNumber);            // 526641234567
      variants.add(cleaned);                        // 5216641234567
      variants.add('+52' + localNumber);           // +526641234567
      variants.add('+' + cleaned);                 // +5216641234567
    } else if (cleaned.length === 12) {
      // No mobile prefix
      variants.add(withoutCountry);                 // 6641234567
      variants.add(cleaned);                        // 526641234567
      variants.add('521' + withoutCountry);        // 5216641234567
      variants.add('+' + cleaned);                 // +526641234567
      variants.add('+521' + withoutCountry);       // +5216641234567
    }
  }
  
  // Also check with common user input patterns
  if (phone.includes('+')) {
    variants.add(phone);
  }
  
  return Array.from(variants);
}

/**
 * Check if phone number appears to be Mexican
 * @param {string} phone - Phone number to check
 * @returns {boolean} True if likely Mexican number
 */
function isMexicanPhone(phone) {
  if (!phone) return false;
  
  const cleaned = phone.toString().replace(/\D/g, '');
  
  // Mexican numbers are 10 digits local or 12-13 with country code
  return (
    cleaned.length === 10 ||
    (cleaned.startsWith('52') && (cleaned.length === 12 || cleaned.length === 13))
  );
}

/**
 * Format phone for display
 * @param {string} phone - Phone number to format
 * @returns {string} Formatted phone for display
 */
function formatPhoneForDisplay(phone) {
  if (!phone) return '';
  
  const cleaned = phone.toString().replace(/\D/g, '');
  
  // Format as Mexican number if applicable
  if (cleaned.startsWith('521') && cleaned.length === 13) {
    const country = cleaned.substring(0, 2);
    const mobile = cleaned.substring(2, 3);
    const area = cleaned.substring(3, 6);
    const first = cleaned.substring(6, 9);
    const second = cleaned.substring(9, 13);
    return `+${country} ${mobile} ${area} ${first} ${second}`;
  } else if (cleaned.startsWith('52') && cleaned.length === 12) {
    const country = cleaned.substring(0, 2);
    const area = cleaned.substring(2, 5);
    const first = cleaned.substring(5, 8);
    const second = cleaned.substring(8, 12);
    return `+${country} ${area} ${first} ${second}`;
  } else if (cleaned.length === 10) {
    const area = cleaned.substring(0, 3);
    const first = cleaned.substring(3, 6);
    const second = cleaned.substring(6, 10);
    return `${area} ${first} ${second}`;
  }
  
  return phone;
}

module.exports = {
  normalizePhoneForStorage,
  getPhoneVariants,
  isMexicanPhone,
  formatPhoneForDisplay
};