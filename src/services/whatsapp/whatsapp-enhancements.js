/**
 * WhatsApp Business API Enhancements
 * This module adds interactive button support and improved UX
 */

class WhatsAppEnhancements {
  /**
   * Send message with interactive buttons
   */
  async sendInteractiveMessage(to, config, whatsappConfig) {
    const normalizedTo = to.startsWith('521') && to.length === 13 ? '52' + to.substring(3) : to;
    
    const requestBody = {
      messaging_product: 'whatsapp',
      to: normalizedTo,
      type: 'interactive',
      interactive: config
    };
    
    const response = await fetch(whatsappConfig.apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${whatsappConfig.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`WhatsApp API error: ${errorData}`);
    }
    
    return response.json();
  }

  /**
   * Create button message for yes/no confirmations
   */
  createButtonMessage(bodyText, buttons) {
    return {
      type: 'button',
      body: { text: bodyText },
      action: {
        buttons: buttons.map((btn, index) => ({
          type: 'reply',
          reply: {
            id: btn.id || `btn_${index}`,
            title: btn.title
          }
        }))
      }
    };
  }

  /**
   * Create list message for menu options
   */
  createListMessage(bodyText, buttonText, sections) {
    return {
      type: 'list',
      body: { text: bodyText },
      action: {
        button: buttonText,
        sections: sections.map((section, sIndex) => ({
          title: section.title,
          rows: section.options.map((option, oIndex) => ({
            id: option.id || `${sIndex}_${oIndex}`,
            title: option.title,
            description: option.description
          }))
        }))
      }
    };
  }

  /**
   * Create welcome menu with interactive buttons
   */
  createWelcomeMenu(isReturningUser = false, userName = '') {
    const greeting = isReturningUser 
      ? `👋 ¡Hola de nuevo${userName ? ' ' + userName : ''}!`
      : '🚗 ¡Bienvenido a Permisos Digitales!';
    
    const bodyText = `${greeting}

Soy tu asistente para obtener tu permiso de importación vehicular. 

💰 Costo: $150 MXN | ⏱️ Listo en 5-10 min

¿Qué deseas hacer hoy?`;

    return this.createListMessage(
      bodyText,
      '📋 Ver opciones',
      [{
        title: 'Servicios disponibles',
        options: [
          {
            id: 'new_permit',
            title: '🆕 Nuevo permiso',
            description: 'Solicitar permiso de importación'
          },
          {
            id: 'check_status',
            title: '📊 Ver estado',
            description: 'Consultar mis solicitudes'
          },
          {
            id: 'pending_payment',
            title: '💳 Pagar',
            description: 'Ver pagos pendientes'
          },
          {
            id: 'my_permits',
            title: '📄 Mis permisos',
            description: 'Ver permisos anteriores'
          },
          {
            id: 'renew',
            title: '🔄 Renovar',
            description: 'Renovar un permiso vencido'
          },
          {
            id: 'help',
            title: '❓ Ayuda',
            description: 'Necesito asistencia'
          }
        ]
      }]
    );
  }

  /**
   * Create confirmation buttons
   */
  createConfirmationButtons(question, yesId = 'yes', noId = 'no') {
    return this.createButtonMessage(question, [
      { id: yesId, title: '✅ Sí' },
      { id: noId, title: '❌ No' }
    ]);
  }

  /**
   * Create field help menu
   */
  createFieldHelpMenu(field, currentValue = null) {
    const options = [
      {
        id: 'example',
        title: '💡 Ver ejemplo',
        description: 'Ejemplo del formato correcto'
      },
      {
        id: 'where_find',
        title: '🔍 Dónde encontrarlo',
        description: 'Te muestro dónde está este dato'
      },
      {
        id: 'skip',
        title: '⏭️ Saltar campo',
        description: 'Continuar sin este dato'
      },
      {
        id: 'go_back',
        title: '↩️ Campo anterior',
        description: 'Regresar al campo anterior'
      }
    ];

    if (currentValue) {
      options.unshift({
        id: 'keep_current',
        title: '✅ Mantener actual',
        description: `Usar: ${currentValue}`
      });
    }

    return this.createListMessage(
      `Necesitas ayuda con: ${field.label}?`,
      '🤝 Opciones de ayuda',
      [{
        title: '¿Qué deseas hacer?',
        options
      }]
    );
  }

  /**
   * Create progress update with buttons
   */
  createProgressUpdate(current, total, nextField) {
    const percentage = Math.round((current / total) * 100);
    const progressBar = '▓'.repeat(Math.floor(percentage / 10)) + '░'.repeat(10 - Math.floor(percentage / 10));
    
    return this.createButtonMessage(
      `${progressBar} ${percentage}%
      
📍 Paso ${current} de ${total}

${nextField.prompt}

💡 ¿Necesitas ayuda con este campo?`,
      [
        { id: 'help_field', title: '❓ Ayuda' },
        { id: 'pause', title: '⏸️ Pausar' }
      ]
    );
  }

  /**
   * Create smart error message with options
   */
  createErrorMessage(field, errorType, userInput) {
    let suggestion = '';
    let buttons = [];

    switch (errorType) {
      case 'format':
        suggestion = this.getSuggestionForField(field, userInput);
        buttons = [
          { id: 'see_example', title: '📋 Ver ejemplo' },
          { id: 'get_help', title: '❓ Ayuda' }
        ];
        break;
      
      case 'validation':
        suggestion = 'Verifica que el dato sea correcto.';
        buttons = [
          { id: 'try_again', title: '🔄 Reintentar' },
          { id: 'skip_field', title: '⏭️ Saltar' }
        ];
        break;
    }

    return this.createButtonMessage(
      `❌ ${errorType === 'format' ? 'Formato incorrecto' : 'Dato inválido'}

${suggestion}

Tu respuesta: "${userInput}"

¿Qué deseas hacer?`,
      buttons
    );
  }

  /**
   * Get smart suggestions based on user input
   */
  getSuggestionForField(field, userInput) {
    const suggestions = {
      'nombre_completo': {
        check: (input) => !input.includes(' '),
        message: 'Parece que falta tu apellido. Ejemplo: Juan Pérez González'
      },
      'curp_rfc': {
        check: (input) => input.includes('-') || input.includes(' '),
        message: 'No uses espacios ni guiones. Ejemplo: ABCD123456HDFGHI01'
      },
      'email': {
        check: (input) => !input.includes('@'),
        message: 'Falta el símbolo @. Ejemplo: juan@gmail.com'
      },
      'numero_serie': {
        check: (input) => input.length !== 17,
        message: `El VIN debe tener 17 caracteres. Tu respuesta tiene ${userInput.length}`
      },
      'year': {
        check: (input) => input.length !== 4 || isNaN(input),
        message: 'El año debe ser 4 dígitos. Ejemplo: 2023'
      }
    };

    const suggestion = suggestions[field.key];
    if (suggestion && suggestion.check(userInput)) {
      return suggestion.message;
    }

    return 'Revisa el formato del dato ingresado.';
  }

  /**
   * Create a "for whom" question for returning users
   */
  createForWhomQuestion(userName) {
    return this.createButtonMessage(
      `Hola ${userName}! 👋

¿Para quién es este permiso?`,
      [
        { id: 'for_me', title: '👤 Para mí' },
        { id: 'for_other', title: '👥 Para otra persona' }
      ]
    );
  }

  /**
   * Natural language command processor
   */
  processNaturalCommand(message) {
    const lowerMessage = message.toLowerCase().trim();
    
    // Remove slash if present
    const cleanMessage = lowerMessage.startsWith('/') ? lowerMessage.substring(1) : lowerMessage;
    
    // Extended command mapping
    const commandPatterns = {
      'startOrResumeApplication': [
        'permiso', 'nuevo permiso', 'solicitar', 'quiero un permiso',
        'necesito permiso', 'tramitar', 'empezar', 'iniciar'
      ],
      'checkStatus': [
        'estado', 'status', 'mi solicitud', 'como va', 'consultar',
        'ver estado', 'revisar', 'checar'
      ],
      'getPaymentLinks': [
        'pagar', 'pago', 'link', 'enlace', 'payment', 'tarjeta'
      ],
      'cancelCurrent': [
        'cancelar', 'salir', 'terminar', 'parar', 'detener', 'no quiero'
      ],
      'sendHelp': [
        'ayuda', 'help', 'no entiendo', 'que hago', 'no se', 'explicame',
        '?', 'info', 'informacion'
      ],
      'goBack': [
        'atras', 'regresar', 'anterior', 'volver', 'cambiar'
      ],
      'pause': [
        'pausa', 'pausar', 'guardar', 'despues', 'luego', 'alto'
      ]
    };

    for (const [command, patterns] of Object.entries(commandPatterns)) {
      if (patterns.some(pattern => cleanMessage.includes(pattern))) {
        return command;
      }
    }

    return null;
  }
}

module.exports = WhatsAppEnhancements;