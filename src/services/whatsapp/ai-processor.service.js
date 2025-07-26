/**
 * AI Processor Service
 * Handles natural language understanding and data extraction
 * Uses OpenAI/Claude for intelligent conversation processing
 */

const OpenAI = require('openai');
const { logger } = require('../../utils/logger');

class AIProcessorService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    this.model = process.env.AI_MODEL || 'gpt-4-turbo-preview';
    this.temperature = 0.1; // Low temperature for consistent extraction
  }

  /**
   * Extract permit data from user message
   * @param {string} message - User message
   * @param {Object} context - Current conversation context
   * @returns {Promise<Object>} Extracted data and validation results
   */
  async extractPermitData(message, context) {
    const { state, personalInfo, vehicleInfo, completedFields } = context;
    
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildExtractionPrompt(message, state, personalInfo, vehicleInfo, completedFields);
    
    try {
      const completion = await this.openai.chat.completions.create({
        model: this.model,
        temperature: this.temperature,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        functions: [{
          name: 'extract_permit_data',
          description: 'Extract and validate permit application data',
          parameters: {
            type: 'object',
            properties: {
              extractedFields: {
                type: 'object',
                description: 'Fields extracted from the message',
                properties: {
                  nombre_completo: { type: 'string' },
                  curp_rfc: { type: 'string' },
                  domicilio: { type: 'string' },
                  marca: { type: 'string' },
                  linea: { type: 'string' },
                  color: { type: 'string' },
                  numero_serie: { type: 'string' },
                  numero_motor: { type: 'string' },
                  ano_modelo: { type: 'string' }
                }
              },
              validationErrors: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    field: { type: 'string' },
                    error: { type: 'string' },
                    suggestion: { type: 'string' }
                  }
                }
              },
              confidence: {
                type: 'object',
                description: 'Confidence scores for each extracted field',
                additionalProperties: { type: 'number' }
              },
              userIntent: {
                type: 'string',
                enum: ['providing_info', 'asking_question', 'confirming', 'correcting', 'cancelling', 'other']
              },
              clarificationNeeded: {
                type: 'string',
                description: 'Question to ask user for clarification'
              }
            },
            required: ['extractedFields', 'validationErrors', 'userIntent']
          }
        }],
        function_call: { name: 'extract_permit_data' }
      });
      
      const result = JSON.parse(completion.choices[0].message.function_call.arguments);
      
      // Post-process extracted data
      return this.postProcessExtraction(result);
    } catch (error) {
      logger.error('Error in AI extraction', { error: error.message });
      // Fallback to pattern-based extraction
      return this.fallbackExtraction(message, state);
    }
  }

  /**
   * Generate conversational response
   * @param {Object} context - Conversation context
   * @param {Object} extractionResult - Data extraction result
   * @returns {Promise<string>} Response message
   */
  async generateResponse(context, extractionResult) {
    const { state, completedFields, personalInfo, vehicleInfo } = context;
    const { validationErrors, clarificationNeeded, userIntent } = extractionResult;
    
    // Handle different user intents
    if (userIntent === 'asking_question') {
      return this.handleQuestion(context);
    }
    
    if (userIntent === 'cancelling') {
      return "¿Estás seguro que deseas cancelar tu solicitud? Responde *SÍ* para cancelar o *NO* para continuar.";
    }
    
    // Handle validation errors
    if (validationErrors && validationErrors.length > 0) {
      return this.formatValidationError(validationErrors[0]);
    }
    
    // Handle clarification needed
    if (clarificationNeeded) {
      return clarificationNeeded;
    }
    
    // Generate next question based on state
    return this.getNextQuestion(state, completedFields, personalInfo, vehicleInfo);
  }

  /**
   * Build system prompt for AI
   * @returns {string} System prompt
   */
  buildSystemPrompt() {
    return `Eres un asistente experto en trámites vehiculares de México. Tu tarea es extraer información de permisos de circulación de manera precisa y validarla según las reglas mexicanas.

Reglas de validación:
1. CURP: 18 caracteres alfanuméricos (4 letras + 6 dígitos + 6 caracteres + 2 dígitos)
2. RFC: 12-13 caracteres (personas físicas: 4 letras + 6 dígitos + 3 caracteres, morales: 3 letras + 6 dígitos + 3 caracteres)
3. Número de serie (VIN): 17 caracteres alfanuméricos sin espacios ni guiones
4. Número de motor: Alfanumérico, generalmente 6-20 caracteres
5. Año modelo: 4 dígitos entre 1900 y ${new Date().getFullYear() + 2}

Extrae SOLO la información explícitamente proporcionada. No inventes ni asumas datos.
Si el usuario proporciona "X1X1X1X1" como CURP/RFC, acéptalo como válido (es un placeholder permitido).`;
  }

  /**
   * Build extraction prompt
   */
  buildExtractionPrompt(message, state, personalInfo, vehicleInfo, completedFields) {
    return `Estado actual: ${state}
Campos completados: ${completedFields.join(', ') || 'ninguno'}
Información personal actual: ${JSON.stringify(personalInfo, null, 2)}
Información del vehículo actual: ${JSON.stringify(vehicleInfo, null, 2)}

Mensaje del usuario: "${message}"

Extrae la información relevante del mensaje. Si el usuario está corrigiendo información previa, actualiza los campos correspondientes.`;
  }

  /**
   * Post-process extraction results
   */
  postProcessExtraction(result) {
    const processed = { ...result };
    
    // Clean extracted fields
    if (processed.extractedFields) {
      for (const [field, value] of Object.entries(processed.extractedFields)) {
        if (typeof value === 'string') {
          // Trim whitespace
          processed.extractedFields[field] = value.trim();
          
          // Uppercase for specific fields
          if (['curp_rfc', 'numero_serie', 'numero_motor'].includes(field)) {
            processed.extractedFields[field] = value.toUpperCase().replace(/[\s-\.]/g, '');
          }
          
          // Clean year
          if (field === 'ano_modelo') {
            processed.extractedFields[field] = value.replace(/\D/g, '');
          }
        }
      }
      
      // Remove empty fields
      processed.extractedFields = Object.fromEntries(
        Object.entries(processed.extractedFields).filter(([_, v]) => v && v !== '')
      );
    }
    
    return processed;
  }

  /**
   * Format validation error message
   */
  formatValidationError(error) {
    const messages = {
      curp_rfc: `❌ El CURP/RFC no tiene el formato correcto. Debe tener ${error.field === 'curp' ? '18' : '12-13'} caracteres sin espacios ni guiones.\n\nEjemplo: ${error.field === 'curp' ? 'BADD110313HCMLNS09' : 'XAXX010101000'}`,
      numero_serie: '❌ El número de serie (VIN) debe tener exactamente 17 caracteres alfanuméricos sin espacios.\n\nEjemplo: 1HGCM82633A123456',
      ano_modelo: `❌ El año del modelo debe ser de 4 dígitos entre 1900 y ${new Date().getFullYear() + 2}.\n\nEjemplo: 2023`
    };
    
    return messages[error.field] || `❌ ${error.error}\n\n${error.suggestion || 'Por favor proporciona la información correctamente.'}`;
  }

  /**
   * Get next question based on missing fields
   */
  getNextQuestion(state, completedFields, personalInfo, vehicleInfo) {
    const questions = {
      nombre_completo: "Por favor, dime tu nombre completo como aparece en tu identificación oficial.",
      curp_rfc: "Ahora necesito tu CURP o RFC (sin espacios, puntos o guiones).",
      domicilio: "¿Cuál es tu domicilio completo? (Calle, número, colonia, municipio, estado)",
      marca: "Perfecto. Ahora vamos con los datos del vehículo.\n\n¿Cuál es la marca de tu vehículo?",
      linea: "¿Cuál es la línea o modelo? (por ejemplo: Corolla, Civic, Jetta)",
      color: "¿De qué color es tu vehículo?",
      numero_serie: "Necesito el número de serie (VIN) de tu vehículo. Son 17 caracteres que encuentras en tu tarjeta de circulación.",
      numero_motor: "¿Cuál es el número de motor? También lo encuentras en tu tarjeta de circulación.",
      ano_modelo: "Por último, ¿cuál es el año del modelo de tu vehículo?"
    };
    
    // Find next missing field
    for (const [field, question] of Object.entries(questions)) {
      if (!completedFields.includes(field)) {
        return question;
      }
    }
    
    return "Ya tengo toda la información necesaria. Déjame revisar los datos...";
  }

  /**
   * Handle user questions
   */
  handleQuestion(context) {
    // This would be expanded with common Q&A
    return `Para obtener tu permiso necesitas:
• Nombre completo
• CURP o RFC
• Domicilio
• Datos completos del vehículo

El costo es de $150 MXN y el permiso se genera en 5-10 minutos después del pago.

¿Continuamos con tu solicitud?`;
  }

  /**
   * Fallback pattern-based extraction
   */
  fallbackExtraction(message, state) {
    const extracted = {};
    const upperMessage = message.toUpperCase();
    
    // CURP/RFC pattern
    const curpRfcMatch = upperMessage.match(/[A-Z]{3,4}[0-9]{6}[A-Z0-9]{3,8}/);
    if (curpRfcMatch) {
      extracted.curp_rfc = curpRfcMatch[0];
    }
    
    // VIN pattern
    const vinMatch = upperMessage.match(/[A-Z0-9]{17}/);
    if (vinMatch && !curpRfcMatch) {
      extracted.numero_serie = vinMatch[0];
    }
    
    // Year pattern
    const yearMatch = message.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) {
      extracted.ano_modelo = yearMatch[0];
    }
    
    // Color detection
    const colors = ['blanco', 'negro', 'gris', 'plata', 'rojo', 'azul', 'verde', 'amarillo', 'naranja', 'cafe', 'dorado'];
    const messageWords = message.toLowerCase().split(/\s+/);
    const foundColor = colors.find(color => messageWords.includes(color));
    if (foundColor) {
      extracted.color = foundColor.charAt(0).toUpperCase() + foundColor.slice(1);
    }
    
    return {
      extractedFields: extracted,
      validationErrors: [],
      userIntent: 'providing_info',
      confidence: {}
    };
  }

  /**
   * Validate all fields before submission
   */
  validateCompleteData(personalInfo, vehicleInfo) {
    const errors = [];
    
    // Validate CURP/RFC
    const curpRfc = personalInfo.curp_rfc?.toUpperCase();
    if (!curpRfc || (curpRfc.length !== 18 && curpRfc.length !== 13 && curpRfc !== 'X1X1X1X1X1X1X1')) {
      errors.push({
        field: 'curp_rfc',
        error: 'CURP/RFC inválido',
        value: curpRfc
      });
    }
    
    // Validate VIN
    const vin = vehicleInfo.numero_serie?.toUpperCase();
    if (!vin || vin.length !== 17) {
      errors.push({
        field: 'numero_serie',
        error: 'Número de serie debe tener 17 caracteres',
        value: vin
      });
    }
    
    // Validate year
    const year = parseInt(vehicleInfo.ano_modelo);
    const currentYear = new Date().getFullYear();
    if (!year || year < 1900 || year > currentYear + 2) {
      errors.push({
        field: 'ano_modelo',
        error: 'Año inválido',
        value: vehicleInfo.ano_modelo
      });
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = AIProcessorService;