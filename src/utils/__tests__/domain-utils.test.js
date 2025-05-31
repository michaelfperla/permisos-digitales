/**
 * Unit Tests for Domain Utilities
 */

const { getCookieDomain, isValidDomain, getPrimaryDomain } = require('../domain-utils');

describe('Domain Utilities', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  describe('getCookieDomain', () => {
    it('should return undefined in development', () => {
      process.env.NODE_ENV = 'development';
      const req = { get: () => 'localhost:3000' };
      expect(getCookieDomain(req)).toBeUndefined();
    });

    it('should return .permisosdigitales.com.mx for .com.mx domain', () => {
      process.env.NODE_ENV = 'production';
      const req = { get: () => 'permisosdigitales.com.mx' };
      expect(getCookieDomain(req)).toBe('.permisosdigitales.com.mx');
    });

    it('should return .permisosdigitales.com for .com domain', () => {
      process.env.NODE_ENV = 'production';
      const req = { get: () => 'permisosdigitales.com' };
      expect(getCookieDomain(req)).toBe('.permisosdigitales.com');
    });

    it('should handle www subdomains correctly', () => {
      process.env.NODE_ENV = 'production';
      const req1 = { get: () => 'www.permisosdigitales.com.mx' };
      const req2 = { get: () => 'www.permisosdigitales.com' };
      
      expect(getCookieDomain(req1)).toBe('.permisosdigitales.com.mx');
      expect(getCookieDomain(req2)).toBe('.permisosdigitales.com');
    });

    it('should fallback to .com.mx for unknown hosts', () => {
      process.env.NODE_ENV = 'production';
      const req = { get: () => 'unknown.domain.com' };
      expect(getCookieDomain(req)).toBe('.permisosdigitales.com.mx');
    });
  });

  describe('isValidDomain', () => {
    it('should return true in development for any domain', () => {
      process.env.NODE_ENV = 'development';
      const req = { get: () => 'localhost:3000' };
      expect(isValidDomain(req)).toBe(true);
    });

    it('should return true for valid domains in production', () => {
      process.env.NODE_ENV = 'production';
      const validDomains = [
        'permisosdigitales.com.mx',
        'www.permisosdigitales.com.mx',
        'permisosdigitales.com',
        'www.permisosdigitales.com',
        'api.permisosdigitales.com.mx'
      ];

      validDomains.forEach(domain => {
        const req = { get: () => domain };
        expect(isValidDomain(req)).toBe(true);
      });
    });

    it('should return false for invalid domains in production', () => {
      process.env.NODE_ENV = 'production';
      const req = { get: () => 'malicious.domain.com' };
      expect(isValidDomain(req)).toBe(false);
    });
  });

  describe('getPrimaryDomain', () => {
    it('should return localhost in development', () => {
      process.env.NODE_ENV = 'development';
      const req = { get: () => 'localhost:3000' };
      expect(getPrimaryDomain(req)).toBe('http://localhost:3002');
    });

    it('should preserve user domain in production', () => {
      process.env.NODE_ENV = 'production';
      
      const req1 = { get: () => 'permisosdigitales.com.mx' };
      const req2 = { get: () => 'permisosdigitales.com' };
      
      expect(getPrimaryDomain(req1)).toBe('https://permisosdigitales.com.mx');
      expect(getPrimaryDomain(req2)).toBe('https://permisosdigitales.com');
    });

    it('should fallback to .com.mx for unknown domains', () => {
      process.env.NODE_ENV = 'production';
      const req = { get: () => 'unknown.domain.com' };
      expect(getPrimaryDomain(req)).toBe('https://permisosdigitales.com.mx');
    });
  });
});
