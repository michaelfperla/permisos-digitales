/**
 * Privacy Configuration
 * Central configuration for privacy and data protection settings
 */

module.exports = {
  // Data retention periods (in days)
  retention: {
    // User data
    activePermit: 365,              // Keep while permit is valid
    expiredPermit: 90,              // After permit expires
    incompleteApplication: 30,      // Abandoned applications
    completedApplication: 90,       // After permit generation
    
    // Communication data
    whatsappMessages: 90,           // Chat history
    emailCommunications: 180,       // Email records
    
    // System data
    auditLogs: 730,                // 2 years for compliance
    accessLogs: 365,               // 1 year
    errorLogs: 90,                 // 3 months
    
    // Payment data
    paymentRecords: 2555,          // 7 years for tax compliance
    failedPayments: 30             // Failed payment attempts
  },
  
  // Data minimization rules
  minimization: {
    // Fields required by permit type
    permitTypes: {
      tourist: {
        required: ['nombre_completo', 'curp', 'email'],
        optional: ['telefono'],
        vehicle: ['marca', 'linea', 'color', 'numero_serie', 'numero_motor', 'ano_modelo']
      },
      resident: {
        required: ['nombre_completo', 'rfc', 'email', 'domicilio'],
        optional: ['telefono'],
        vehicle: ['marca', 'linea', 'color', 'numero_serie', 'numero_motor', 'ano_modelo']
      }
    },
    
    // Maximum field lengths
    fieldLengths: {
      nombre_completo: 100,
      email: 100,
      curp: 18,
      rfc: 13,
      domicilio: 200,
      telefono: 15,
      marca: 50,
      linea: 50,
      color: 30,
      numero_serie: 17,
      numero_motor: 50,
      ano_modelo: 4
    }
  },
  
  // Purpose limitation
  purposes: {
    // Map fields to their purposes
    fieldPurposes: {
      nombre_completo: ['permit_generation', 'identity_verification'],
      curp: ['identity_verification', 'duplicate_prevention'],
      rfc: ['identity_verification', 'tax_compliance'],
      email: ['communication', 'account_access'],
      telefono: ['communication', 'verification'],
      domicilio: ['permit_generation', 'jurisdiction_verification'],
      whatsapp_phone: ['communication', 'bot_interaction']
    },
    
    // Valid purposes for data collection
    validPurposes: [
      'permit_generation',
      'identity_verification',
      'payment_processing',
      'communication',
      'customer_support',
      'legal_compliance',
      'fraud_prevention',
      'system_maintenance'
    ]
  },
  
  // Anonymization rules
  anonymization: {
    // Fields that should be anonymized
    sensitiveFields: [
      'curp',
      'rfc',
      'numero_serie',
      'numero_motor',
      'email',
      'telefono',
      'whatsapp_phone',
      'domicilio'
    ],
    
    // Anonymization methods
    methods: {
      curp: 'mask_except_last_4',
      rfc: 'mask_except_last_4',
      email: 'mask_local_part',
      telefono: 'mask_except_last_4',
      whatsapp_phone: 'mask_except_last_4',
      default: 'full_mask'
    }
  },
  
  // Encryption settings
  encryption: {
    // Fields that must be encrypted at rest
    encryptedFields: [
      'curp',
      'rfc',
      'numero_serie',
      'payment_token',
      'bank_account'
    ],
    
    // Encryption algorithm
    algorithm: 'aes-256-gcm',
    
    // Key rotation period (days)
    keyRotationPeriod: 90
  },
  
  // Consent management
  consent: {
    // Types of consent
    types: [
      'data_processing',
      'marketing_communications',
      'third_party_sharing',
      'cookies_tracking'
    ],
    
    // Consent validity periods (days)
    validity: {
      data_processing: 365,
      marketing_communications: 180,
      third_party_sharing: 365,
      cookies_tracking: 90
    },
    
    // Consent renewal reminders (days before expiry)
    renewalReminder: 30
  },
  
  // Access control
  accessControl: {
    // Roles and their data access permissions
    roles: {
      user: {
        canAccess: ['own_data'],
        cannotAccess: ['other_users', 'system_data']
      },
      support: {
        canAccess: ['user_data', 'application_data'],
        cannotAccess: ['payment_details', 'system_config'],
        requiresReason: true
      },
      admin: {
        canAccess: ['all_data'],
        requiresReason: true,
        requiresAudit: true
      },
      system: {
        canAccess: ['all_data'],
        requiresAudit: true
      }
    }
  },
  
  // Data subject rights
  rights: {
    // Response time limits (days)
    responseTime: {
      access: 30,
      rectification: 30,
      deletion: 30,
      portability: 30,
      objection: 30
    },
    
    // Verification requirements
    verification: {
      requiresEmailConfirmation: true,
      requiresIdentityDocument: false,
      verificationMethods: ['email', 'whatsapp']
    }
  },
  
  // Third-party data sharing
  thirdParties: {
    // Approved data processors
    processors: [
      {
        name: 'Stripe',
        purpose: 'payment_processing',
        dataShared: ['name', 'email', 'payment_amount'],
        location: 'USA',
        privacyShield: true
      },
      {
        name: 'AWS',
        purpose: 'infrastructure',
        dataShared: ['all_data'],
        location: 'USA',
        privacyShield: true
      },
      {
        name: 'Meta (WhatsApp)',
        purpose: 'communication',
        dataShared: ['phone_number', 'messages'],
        location: 'USA',
        privacyShield: true
      }
    ]
  },
  
  // Breach notification
  breach: {
    // Notification time limits (hours)
    notificationTime: {
      authorities: 72,     // 72 hours to authorities
      dataSubjects: 96     // 96 hours to affected users
    },
    
    // Severity thresholds
    severity: {
      high: ['curp', 'rfc', 'payment_data'],
      medium: ['email', 'phone', 'address'],
      low: ['name', 'vehicle_data']
    }
  }
};