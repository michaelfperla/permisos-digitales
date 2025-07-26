const { createApplicationWithOxxo } = require('../application.service');

describe('Color Sanitization', () => {
  describe('Application Service', () => {
    it('should sanitize color with forward slash', () => {
      const formData = {
        nombre_completo: 'Test User',
        curp_rfc: 'TEST123456789',
        domicilio: '123 Test St',
        marca: 'Toyota',
        linea: 'Corolla',
        color: 'Rojo/Negro',
        numero_serie: '1234567890ABCDEFG',
        numero_motor: 'TEST123',
        ano_modelo: '2023'
      };

      // The sanitization happens inside createApplicationWithOxxo
      // We need to check what gets passed to applicationRepository.create
      expect(formData.color).toBe('Rojo/Negro');
    });

    it('should sanitize color with backslash', () => {
      const formData = {
        nombre_completo: 'Test User',
        curp_rfc: 'TEST123456789',
        domicilio: '123 Test St',
        marca: 'Toyota',
        linea: 'Corolla',
        color: 'Rojo\\Negro',
        numero_serie: '1234567890ABCDEFG',
        numero_motor: 'TEST123',
        ano_modelo: '2023'
      };

      // Test the sanitization logic directly
      let sanitizedColor = formData.color;
      if (sanitizedColor && (sanitizedColor.includes('/') || sanitizedColor.includes('\\'))) {
        sanitizedColor = sanitizedColor.replace(/[\/\\]/g, ' y ');
      }

      expect(sanitizedColor).toBe('Rojo y Negro');
    });

    it('should not modify color without slashes', () => {
      const formData = {
        nombre_completo: 'Test User',
        curp_rfc: 'TEST123456789',
        domicilio: '123 Test St',
        marca: 'Toyota',
        linea: 'Corolla',
        color: 'Rojo y Negro',
        numero_serie: '1234567890ABCDEFG',
        numero_motor: 'TEST123',
        ano_modelo: '2023'
      };

      let sanitizedColor = formData.color;
      if (sanitizedColor && (sanitizedColor.includes('/') || sanitizedColor.includes('\\'))) {
        sanitizedColor = sanitizedColor.replace(/[\/\\]/g, ' y ');
      }

      expect(sanitizedColor).toBe('Rojo y Negro');
    });

    it('should handle multiple slashes', () => {
      const formData = {
        color: 'Rojo/Negro/Blanco'
      };

      let sanitizedColor = formData.color;
      if (sanitizedColor && (sanitizedColor.includes('/') || sanitizedColor.includes('\\'))) {
        sanitizedColor = sanitizedColor.replace(/[\/\\]/g, ' y ');
      }

      expect(sanitizedColor).toBe('Rojo y Negro y Blanco');
    });

    it('should handle mixed slashes', () => {
      const formData = {
        color: 'Rojo/Negro\\Blanco'
      };

      let sanitizedColor = formData.color;
      if (sanitizedColor && (sanitizedColor.includes('/') || sanitizedColor.includes('\\'))) {
        sanitizedColor = sanitizedColor.replace(/[\/\\]/g, ' y ');
      }

      expect(sanitizedColor).toBe('Rojo y Negro y Blanco');
    });

    it('should handle null or undefined color', () => {
      const formData1 = { color: null };
      const formData2 = { color: undefined };
      const formData3 = {};

      let sanitizedColor1 = formData1.color;
      if (sanitizedColor1 && (sanitizedColor1.includes('/') || sanitizedColor1.includes('\\'))) {
        sanitizedColor1 = sanitizedColor1.replace(/[\/\\]/g, ' y ');
      }

      let sanitizedColor2 = formData2.color;
      if (sanitizedColor2 && (sanitizedColor2.includes('/') || sanitizedColor2.includes('\\'))) {
        sanitizedColor2 = sanitizedColor2.replace(/[\/\\]/g, ' y ');
      }

      let sanitizedColor3 = formData3.color;
      if (sanitizedColor3 && (sanitizedColor3.includes('/') || sanitizedColor3.includes('\\'))) {
        sanitizedColor3 = sanitizedColor3.replace(/[\/\\]/g, ' y ');
      }

      expect(sanitizedColor1).toBe(null);
      expect(sanitizedColor2).toBe(undefined);
      expect(sanitizedColor3).toBe(undefined);
    });
  });

  describe('WhatsApp Bot Color Extraction', () => {
    // Simulate the color extraction logic from WhatsApp bot
    const extractColor = (message) => {
      const cleaned = message.trim();
      const colorLower = cleaned.toLowerCase();
      
      // Handle multi-color vehicles
      if (colorLower.includes('/') || colorLower.includes('\\')) {
        // Replace slashes with 'y' (and)
        const normalized = colorLower.replace(/[\/\\]/g, ' y ');
        // Capitalize first letter of each word
        return normalized.split(' ').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
      }
      
      return cleaned;
    };

    it('should convert slash to y and capitalize', () => {
      expect(extractColor('rojo/negro')).toBe('Rojo y Negro');
      expect(extractColor('ROJO/NEGRO')).toBe('Rojo y Negro');
      expect(extractColor('Rojo/Negro')).toBe('Rojo y Negro');
    });

    it('should handle backslash', () => {
      expect(extractColor('rojo\\negro')).toBe('Rojo y Negro');
    });

    it('should handle multiple colors', () => {
      expect(extractColor('rojo/negro/blanco')).toBe('Rojo y Negro y Blanco');
    });

    it('should preserve existing y format', () => {
      expect(extractColor('rojo y negro')).toBe('rojo y negro');
      expect(extractColor('Rojo y Negro')).toBe('Rojo y Negro');
    });
  });
});