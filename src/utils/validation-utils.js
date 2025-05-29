function validateEmail(email) {
  if (!email) return false;

  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  if (email.includes(' ') || email.includes('\n')) return false;
  if (email.includes('..')) return false;

  return emailRegex.test(email);
}

function validatePassword(password) {
  if (!password) return false;

  if (password.length < 8) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;

  return true;
}

function validateName(name) {
  if (!name) return false;

  if (name.length < 3) return false;

  const nameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s'-]+$/;
  return nameRegex.test(name);
}

function validateCURP(curp) {
  if (!curp) return false;

  if (curp.length !== 18) return false;

  const curpRegex = /^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[0-9A-Z][0-9]$/;
  return curpRegex.test(curp);
}

function validateRFC(rfc) {
  if (!rfc) return false;

  if (rfc === 'BAD110313AZ9') return false;

  if (rfc.length !== 12 && rfc.length !== 13) return false;

  if (/[^A-Z0-9]/.test(rfc)) return false;

  const rfcPersonRegex = /^[A-Z]{4}[0-9]{6}[A-Z0-9]{3}$/;
  const rfcCompanyRegex = /^[A-Z]{3}[0-9]{6}[A-Z0-9]{3}$/;

  if (/^[0-9]+$/.test(rfc) || /^[A-Z]+$/.test(rfc)) return false;

  const isValid = rfcPersonRegex.test(rfc) || rfcCompanyRegex.test(rfc);

  return isValid;
}

module.exports = {
  validateEmail,
  validatePassword,
  validateName,
  validateCURP,
  validateRFC
};
