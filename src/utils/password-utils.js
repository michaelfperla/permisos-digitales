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
    return false;
  }

  try {
    if (hashedPassword.startsWith('$2b$')) {
      const result = await bcrypt.compare(password, hashedPassword);
      return result;
    }

    const [iterations, salt, storedHash] = hashedPassword.split(':');

    if (!iterations || !salt || !storedHash) {
      return false;
    }

    const iterCount = parseInt(iterations, 10);
    if (isNaN(iterCount)) {
      return false;
    }

    let saltBuffer;
    try {
      saltBuffer = Buffer.from(salt, 'hex');
    } catch (bufferError) {
      return false;
    }

    const hash = await pbkdf2(
      password,
      saltBuffer,
      iterCount,
      KEY_LENGTH,
      DIGEST
    );

    const computedHash = hash.toString('hex');
    const matches = computedHash === storedHash;
    return matches;
  } catch (error) {
    return false;
  }
}

module.exports = {
  hashPassword,
  verifyPassword
};
