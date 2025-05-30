const crypto = require('crypto');
const { promisify } = require('util');
const bcrypt = require('bcrypt');

const pbkdf2 = promisify(crypto.pbkdf2);

const KEY_LENGTH = 64;
const DIGEST = 'sha512';

async function hashPassword(password) {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
}

async function verifyPassword(password, hashedPassword) {
  if (!password || !hashedPassword) {
    console.debug('[Password Utils] Invalid inputs for password verification: password or hashedPassword is empty');
    return false;
  }

  try {
    if (hashedPassword.startsWith('$2b$')) {
      console.debug('[Password Utils] Verifying password using bcrypt');
      const startTime = Date.now();
      const result = await bcrypt.compare(password, hashedPassword);
      const duration = Date.now() - startTime;
      console.debug(`[Password Utils] bcrypt comparison completed in ${duration}ms, result: ${result}`);
      return result;
    }

    console.debug('[Password Utils] Verifying password using PBKDF2');
    const [iterations, salt, storedHash] = hashedPassword.split(':');

    if (!iterations || !salt || !storedHash) {
      console.warn('[Password Utils] Invalid PBKDF2 hash format: missing components');
      return false;
    }

    const iterCount = parseInt(iterations, 10);
    if (isNaN(iterCount)) {
      console.warn('[Password Utils] Invalid PBKDF2 hash format: iterations is not a number');
      return false;
    }

    console.debug(`[Password Utils] PBKDF2 using ${iterCount} iterations`);

    let saltBuffer;
    try {
      saltBuffer = Buffer.from(salt, 'hex');
    } catch (bufferError) {
      console.warn('[Password Utils] Invalid PBKDF2 hash format: salt is not valid hex', bufferError);
      return false;
    }

    console.debug('[Password Utils] Computing PBKDF2 hash');
    const startTime = Date.now();
    const hash = await pbkdf2(
      password,
      saltBuffer,
      iterCount,
      KEY_LENGTH,
      DIGEST
    );
    const duration = Date.now() - startTime;
    console.debug(`[Password Utils] PBKDF2 hash computed in ${duration}ms`);

    const computedHash = hash.toString('hex');
    const matches = computedHash === storedHash;
    console.debug(`[Password Utils] PBKDF2 hash comparison result: ${matches}`);
    return matches;
  } catch (error) {
    console.error('[Password Utils] Error verifying password:', error);
    return false;
  }
}

module.exports = {
  hashPassword,
  verifyPassword
};
