/**
 * Recommendations PDF Generation Service
 * Generates a beautifully designed PDF with permit information and safety recommendations
 * This service is separate from Puppeteer and creates static content
 */

const PDFDocument = require('pdfkit');
const { logger } = require('../utils/logger');

class RecommendationsPdfService {
  constructor() {
    this.pageWidth = 612; // Letter size width in points
    this.pageHeight = 792; // Letter size height in points
    this.margin = 45;
    this.contentWidth = this.pageWidth - (2 * this.margin);
    
    // Sophisticated color palette
    this.colors = {
      primary: '#1565C0',      // Professional blue
      primaryDark: '#0D47A1',  // Darker blue for contrast
      accent: '#00ACC1',       // Cyan accent
      success: '#43A047',      // Fresh green
      danger: '#E53935',       // Modern red
      warning: '#FB8C00',      // Vibrant orange
      text: '#263238',         // Almost black
      textLight: '#546E7A',    // Muted text
      background: '#FAFAFA',   // Off-white
      lightGray: '#F5F5F5',    // Light gray
      border: '#E0E0E0'        // Border gray
    };
  }

  /**
   * Generate a recommendations PDF with beautiful design
   */
  async generateRecommendationsPdf(options = {}) {
    try {
      logger.info('Generating recommendations PDF', { permitId: options.permitId });

      return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
          size: 'letter',
          margins: {
            top: this.margin,
            bottom: this.margin,
            left: this.margin,
            right: this.margin
          },
          autoFirstPage: true,
          info: {
            Title: 'Información del Permiso - Permisos Digitales',
            Author: 'Permisos Digitales',
            Subject: 'Información importante sobre su permiso temporal'
          }
        });

        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Single page design with better space distribution
        this._createBalancedLayout(doc, options);

        // Finalize the PDF
        doc.end();
      });
    } catch (error) {
      logger.error('Error generating recommendations PDF:', error);
      throw error;
    }
  }

  _createBalancedLayout(doc, options) {
    // Modern header
    this._addModernHeader(doc);
    
    // Welcome section
    this._addWelcomeSection(doc, options);
    
    // Critical information card
    this._addCriticalInfoCard(doc);
    
    // Expanded content sections to fill space
    this._addExpandedContentSections(doc);
    
    // Footer with links
    this._addFooterWithLinks(doc);
  }

  _addModernHeader(doc) {
    // Main header background
    doc.rect(0, 0, this.pageWidth, 60)
       .fill(this.colors.primary);
    
    // Accent stripe
    doc.rect(0, 60, this.pageWidth, 3)
       .fill(this.colors.accent);
    
    // Header text
    doc.fontSize(20)
       .font('Helvetica-Bold')
       .fillColor('white')
       .text('PERMISOS DIGITALES', this.margin, 22, {
         characterSpacing: 1
       });
    
    // Move past header
    doc.y = 80;
  }

  _addWelcomeSection(doc, options) {
    // Light background for welcome section
    doc.rect(this.margin - 10, doc.y - 5, this.contentWidth + 20, 60)
       .fill(this.colors.lightGray)
       .fillOpacity(0.5);
    
    doc.fillOpacity(1);
    
    // Personal greeting in smaller text
    doc.fontSize(10)
       .font('Helvetica')
       .fillColor(this.colors.textLight);
    
    const greeting = options.userName ? `Estimado(a) ${options.userName}, f` : 'F';
    doc.text(`${greeting}ue un placer atenderle.`, this.margin, doc.y + 10, {
      width: this.contentWidth,
      align: 'left'
    });
    
    // Reminder message in larger, bold text
    doc.fontSize(13)
       .font('Helvetica-Bold')
       .fillColor(this.colors.text)
       .text('Le recordaremos por correo electrónico antes del vencimiento de su permiso.', this.margin, doc.y + 5, {
         width: this.contentWidth,
         align: 'left'
       });
    
    doc.y += 20;
  }

  _addCriticalInfoCard(doc) {
    const cardY = doc.y;
    const cardHeight = 140; // Increased height to prevent text overlap
    
    // Card shadow effect
    doc.rect(this.margin + 2, cardY + 2, this.contentWidth - 4, cardHeight)
       .fill('#00000010');
    
    // Card background
    doc.rect(this.margin, cardY, this.contentWidth, cardHeight)
       .fill('white')
       .stroke(this.colors.danger);
    
    // Red header bar
    doc.rect(this.margin, cardY, this.contentWidth, 26)
       .fill(this.colors.danger);
    
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .fillColor('white')
       .text('INFORMACIÓN IMPORTANTE', this.margin + 15, cardY + 7);
    
    // Add subtitle below the header
    doc.fontSize(10)
       .font('Helvetica')
       .fillColor(this.colors.text)
       .text('El permiso es para circular sin placas, engomado y tarjeta de circulación.', this.margin + 15, cardY + 32, {
         width: this.contentWidth - 30
       });
    
    // Critical points with more spacing
    const points = [
      'Circule SIN placas, engomado ni tarjeta de circulación',
      'La validez se verifica con código QR o en la página oficial',
      'Si el permiso se daña, reimprímalo mientras esté vigente',
      'Lee con atención los documentos que se te proporcionan, así como los términos y condiciones de uso conoce tus derechos y obligaciones.'
    ];
    
    doc.fontSize(10)
       .font('Helvetica')
       .fillColor(this.colors.text);
    
    let yPos = cardY + 52;
    points.forEach((point, index) => {
      if (index === 3) {
        // Special handling for the terms and conditions point
        doc.text('• Lee con atención los documentos que se te proporcionan, así como los ', this.margin + 15, yPos, {
          width: this.contentWidth - 30,
          continued: true
        });
        doc.fillColor(this.colors.primary)
           .text('términos y condiciones de uso', {
             link: 'https://permisosdigitales.com.mx/terminos',
             underline: true,
             continued: true
           });
        doc.fillColor(this.colors.text)
           .text(' conoce tus derechos y obligaciones.');
        yPos += 30; // Extra space for wrapped text
      } else {
        doc.text(`• ${point}`, this.margin + 15, yPos, {
          width: this.contentWidth - 30
        });
        yPos += 20;
      }
    });
    
    doc.y = cardY + cardHeight + 25;
  }

  _addExpandedContentSections(doc) {
    // Three main sections with better spacing
    
    // 1. Usage Instructions Section
    this._addSectionHeader(doc, 'Instrucciones de Uso', this.colors.primaryDark);
    
    const usageInstructions = [
      { title: 'Impresión:', detail: 'Imprima su permiso a COLOR en tamaño carta' },
      { title: 'Colocación:', detail: 'Coloque en lugar visible del vehículo (parabrisas)' },
      { title: 'Protección:', detail: 'Si es motocicleta, plastifique o enmique el documento' },
      { title: 'Verificación:', detail: 'Escanee el código QR para verificar validez' }
    ];
    
    doc.fontSize(10).font('Helvetica');
    usageInstructions.forEach(item => {
      doc.font('Helvetica-Bold')
         .fillColor(this.colors.text)
         .text(item.title, this.margin + 15, doc.y, { continued: true });
      doc.font('Helvetica')
         .text(` ${item.detail}`);
      doc.moveDown(0.4);
    });
    
    doc.moveDown(1);
    
    // 2. Safety Recommendations Section
    this._addSectionHeader(doc, 'Recomendaciones de Seguridad Vial', this.colors.primaryDark);
    
    // Two-column safety tips
    const startY = doc.y;
    const colWidth = (this.contentWidth - 30) / 2;
    
    const leftTips = [
      '• Mantenga distancia de seguridad',
      '• Use luces direccionales',
      '• No use el celular al conducir',
      '• Respete límites de velocidad',
      '• Revise espejos constantemente',
      '• Usar casco (motociclistas)'
    ];
    
    const rightTips = [
      '• En lluvia, reduzca velocidad',
      '• Descanse cada 2 horas',
      '• Mantenga luces en buen estado',
      '• Use cinturón de seguridad',
      '• Revise presión de llantas',
      '• Tener seguro vehicular vigente',
      '• Tener licencia vigente'
    ];
    
    doc.fontSize(9)
       .fillColor(this.colors.text);
    leftTips.forEach((tip, index) => {
      doc.text(tip, this.margin + 15, startY + (index * 16), { width: colWidth });
    });
    
    rightTips.forEach((tip, index) => {
      doc.text(tip, this.margin + colWidth + 30, startY + (index * 16), { width: colWidth });
    });
    
    doc.y = startY + 120;
    doc.moveDown(1);
    
    // 3. Emergency Numbers Section
    this._addEmergencyNumbersSection(doc);
  }

  _addSectionHeader(doc, title, color) {
    doc.fontSize(13)
       .font('Helvetica-Bold')
       .fillColor(color)
       .text(title, this.margin, doc.y);
    doc.moveDown(0.5);
  }

  _addEmergencyNumbersSection(doc) {
    const boxY = doc.y;
    const boxHeight = 80; // Bigger box
    
    // Emergency box with gradient effect
    doc.rect(this.margin, boxY, this.contentWidth, boxHeight)
       .fill(this.colors.warning)
       .fillOpacity(0.1);
    
    doc.fillOpacity(1);
    
    // Orange left border (thicker)
    doc.rect(this.margin, boxY, 5, boxHeight)
       .fill(this.colors.warning);
    
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .fillColor(this.colors.warning)
       .text('NÚMEROS DE EMERGENCIA', this.margin + 15, boxY + 10);
    
    // Emergency numbers in a nice grid
    const numbers = [
      { service: 'Emergencias General', number: '911' },
      { service: 'Cruz Roja', number: '065' },
      { service: 'Ángeles Verdes', number: '078' },
      { service: 'Policía Federal', number: '088' },
      { service: 'Denuncia Anónima', number: '089' },
      { service: 'Bomberos', number: '068' }
    ];
    
    doc.fontSize(10);
    const numCols = 3;
    const numColWidth = (this.contentWidth - 30) / numCols;
    
    numbers.forEach((item, index) => {
      const col = index % numCols;
      const row = Math.floor(index / numCols);
      const xPos = this.margin + 15 + (col * numColWidth);
      const yPos = boxY + 35 + (row * 20);
      
      doc.font('Helvetica')
         .fillColor(this.colors.text)
         .text(`${item.service}: `, xPos, yPos, { continued: true, width: numColWidth - 10 });
      doc.font('Helvetica-Bold')
         .fillColor(this.colors.danger)
         .text(item.number);
    });
    
    doc.y = boxY + boxHeight + 20;
  }

  _addFooterWithLinks(doc) {
    // Links section
    const linksY = doc.y;
    
    // Light background for links
    doc.rect(this.margin, linksY, this.contentWidth, 60)
       .fill(this.colors.background);
    
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .fillColor(this.colors.primaryDark)
       .text('Enlaces Importantes:', this.margin + 15, linksY + 10);
    
    doc.fontSize(9)
       .font('Helvetica')
       .fillColor(this.colors.text)
       .text('Verificación de permiso: ', this.margin + 15, linksY + 28, { continued: true });
    
    doc.fillColor(this.colors.primary)
       .text('direcciondetransitohuitzucodelosfigueroa.gob.mx/verificar-permiso', {
         link: 'https://www.direcciondetransitohuitzucodelosfigueroa.gob.mx/verificar-permiso',
         underline: true
       });
    
    doc.fillColor(this.colors.text)
       .text('Acceso a su cuenta: ', this.margin + 15, linksY + 44, { continued: true });
    
    doc.fillColor(this.colors.primary)
       .text('permisosdigitales.com.mx', {
         link: 'https://permisosdigitales.com.mx/',
         underline: true
       });
    
    // Footer line and text
    const footerY = this.pageHeight - this.margin - 20;
    
    doc.moveTo(this.margin, footerY - 10)
       .lineTo(this.pageWidth - this.margin, footerY - 10)
       .strokeColor(this.colors.border)
       .lineWidth(0.5)
       .stroke();
    
    doc.fontSize(8)
       .fillColor(this.colors.textLight)
       .text(`Generado el ${new Date().toLocaleDateString('es-MX')} | © Permisos Digitales | Conserve este documento con su permiso`, 
         this.margin, footerY, {
           width: this.contentWidth,
           align: 'center'
         });
  }
}

// Create singleton instance
let instance = null;

function getInstance() {
  if (!instance) {
    instance = new RecommendationsPdfService();
  }
  return instance;
}

module.exports = getInstance();
module.exports.RecommendationsPdfService = RecommendationsPdfService;
module.exports.getInstance = getInstance;