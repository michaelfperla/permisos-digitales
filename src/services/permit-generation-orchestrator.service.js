// src/services/permit-generation-orchestrator.service.js
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs'); // Regular fs for createWriteStream
const { applicationRepository, paymentRepository } = require('../repositories');
const unifiedConfig = require('../config/unified-config');
const config = unifiedConfig.getSync();
const { logger } = require('../utils/logger');
const http = require('http');
const https = require('https');
// DEVELOPMENT: Sample PDFs disabled for production
// const samplePdfs = require('../utils/sample-pdfs');
const storageService = require('./storage/storage-service');
const metricsCollector = require('../monitoring/metrics-collector');
const emailService = require('./email.service');
const recommendationsPdfService = require('./recommendations-pdf.service');
const SimpleWhatsAppService = require('./whatsapp/simple-whatsapp.service');

// Create and initialize WhatsApp service instance
let whatsappServiceInstance = null;
const getWhatsAppService = async () => {
  if (!whatsappServiceInstance) {
    whatsappServiceInstance = new SimpleWhatsAppService();
    await whatsappServiceInstance.initialize();
  }
  return whatsappServiceInstance;
};

/**
 * Mask phone number for privacy in logs
 * @param {string} phone - Phone number to mask
 * @returns {string} Masked phone number
 */
function maskPhoneNumber(phone) {
  if (!phone || phone.length < 8) return phone || 'N/A';
  return phone.substring(0, 3) + '****' + phone.substring(phone.length - 4);
}

// DEVELOPMENT: Local storage directories commented out for production (S3 only)
// const PDF_STORAGE_DIR = path.join(__dirname, '../../storage/pdfs');
// const LOG_STORAGE_DIR = path.join(__dirname, '../../storage/logs');
// const SCREENSHOT_DIR = path.join(__dirname, '../../storage/permit_screenshots');

/**
 * Retry function with exponential backoff for production reliability
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @returns {Promise} Result of the function
 */
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
      logger.info(`[RETRY] Attempt ${i + 1}/${maxRetries} failed, retrying after ${delay}ms`, {
        error: error.message
      });
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Generate S3 object key for PDF files
 * @param {number} applicationId - Application ID
 * @param {string} type - PDF type (permiso, certificado, placas)
 * @param {string} permitId - Permit ID from government system
 * @param {number} timestamp - Timestamp for uniqueness
 * @returns {string} S3 object key
 */
function generatePdfS3Key(applicationId, type, permitId, timestamp) {
  // Structure: permits/{applicationId}/{type}_{permitId}_{timestamp}.pdf
  return `permits/${applicationId}/${type}_${permitId}_${timestamp}.pdf`;
}

/**
 * Save PDF buffer to storage (S3 or local based on configuration)
 * @param {Buffer} pdfBuffer - PDF content as buffer
 * @param {number} applicationId - Application ID
 * @param {string} type - PDF type (permiso, certificado, placas)
 * @param {string} permitId - Permit ID from government system
 * @param {number} timestamp - Timestamp for uniqueness
 * @param {string} governmentFilename - Original filename from government if available
 * @returns {Promise<string>} Storage identifier (S3 key or local filename)
 */
async function savePdfToStorage(pdfBuffer, applicationId, type, permitId, timestamp, governmentFilename = null) {
  try {
    // Use government filename if available, otherwise generate our own
    const originalName = governmentFilename || `${type}_${permitId}_${timestamp}.pdf`;

    const saveOptions = {
      originalName,
      subDirectory: `permits/${applicationId}`,
      prefix: governmentFilename ? '' : type, // Only add prefix if no government filename
      contentType: 'application/pdf',
      preserveOriginalFilename: !!governmentFilename, // Preserve if we have government filename
      metadata: {
        applicationId: applicationId.toString(),
        permitId: permitId || 'unknown',
        documentType: type,
        generatedAt: new Date().toISOString(),
        governmentFilename: governmentFilename || null
      }
    };

    const result = await storageService.saveFile(pdfBuffer, saveOptions);

    // Get the storage identifier (key for S3, relativePath for local)
    const storageKey = result.key || result.relativePath;

    logger.info(`[STORAGE] PDF saved: ${storageKey}`, {
      applicationId,
      type,
      permitId,
      storageType: result.storageType,
      size: result.size
    });

    // Return the storage identifier
    return storageKey;
  } catch (error) {
    logger.error(`Failed to save PDF to storage: ${error.message}`, {
      applicationId,
      type,
      permitId,
      error: error.message
    });
    throw error;
  }
}

/**
 * Main function to generate a permit via browser automation
 * @param {number} applicationId - The application ID to process
 */
/**
 * Queue permit generation for an application
 * @param {number} applicationId - Application ID
 * @returns {Promise} Resolves when job is queued
 */
exports.queuePermitGeneration = async (applicationId) => {
  // FIX: Use pdf-queue-factory instead of pdf-queue.service directly
  const { getInstance } = require('./pdf-queue-factory.service');
  const pdfQueueService = getInstance();
  
  logger.info(`Queueing permit generation for application ${applicationId}`);
  
  // FIX: Check if queue service is available
  if (!pdfQueueService) {
    logger.error('[PermitGeneration] PDF queue service not available');
    throw new Error('PDF queue service unavailable');
  }
  
  // Add the job to the queue
  return pdfQueueService.addJob({
    applicationId,
    handler: async () => exports.generatePermit(applicationId),
    priority: 1 // Normal priority, could be increased for retries
  });
};

exports.generatePermit = async (applicationId) => {
  let browser = null;
  let mainPage = null;
  const timestamp = Date.now();
  // DEVELOPMENT: Error screenshots disabled for production
  // const errorScreenshotPath = path.join(LOG_STORAGE_DIR, `error_${applicationId}_${timestamp}.png`);

  try {
    logger.info(`[START] Beginning permit generation for application ${applicationId}`);
    
    // DEVELOPMENT: Local directory creation disabled for production
    // await fs.mkdir(PDF_STORAGE_DIR, { recursive: true });
    // await fs.mkdir(LOG_STORAGE_DIR, { recursive: true });
    // await fs.mkdir(SCREENSHOT_DIR, { recursive: true });

    // Step 1: Fetch application data
    logger.info(`[Step 1/10] Fetching application data for ID: ${applicationId}`);
    const appData = await retryWithBackoff(() => fetchApplicationData(applicationId), 3);

    // Check if status is correct for proceeding
    if (appData.status !== 'PAYMENT_RECEIVED' && appData.status !== 'GENERATING_PERMIT') {
      logger.warn(`[VALIDATION] Application ${applicationId} has invalid status: ${appData.status}`, {
        expectedStatus: ['PAYMENT_RECEIVED', 'GENERATING_PERMIT'],
        actualStatus: appData.status
      });
      return;
    }

    // Update status to indicate processing has started (if not already set)
    if (appData.status !== 'GENERATING_PERMIT') {
      await applicationRepository.updatePuppeteerStatus(applicationId, 'GENERATING_PERMIT', {
        queue_status: 'processing',
        queue_started_at: new Date()
      });
    }

    // Detect platform and set appropriate Chrome path using comprehensive detection
    const os = require('os');
    const platform = os.platform();
    let executablePath = null;
    
    // Priority 1: Check environment variable (works for all platforms)
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      if (fsSync.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
        executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
        logger.info(`Using Chrome from PUPPETEER_EXECUTABLE_PATH: ${executablePath}`);
      } else {
        logger.warn(`PUPPETEER_EXECUTABLE_PATH points to non-existent file: ${process.env.PUPPETEER_EXECUTABLE_PATH}`);
      }
    }
    
    // Priority 2: Platform-specific detection if environment variable not set or invalid
    if (!executablePath) {
      if (platform === 'win32') {
        // DEVELOPMENT: Windows paths commented out for production
        // const windowsPaths = [
        //   'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        //   'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        //   'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        //   'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
        // ];
        logger.warn('[BROWSER] Windows platform detected in production environment');
      } else {
        // Linux/Unix paths for Chrome/Chromium - optimized for EC2
        const unixPaths = [
          '/usr/bin/google-chrome',           // Most common on Ubuntu/Debian
          '/usr/bin/google-chrome-stable',    // Alternative stable version
          '/usr/bin/chromium-browser',        // Ubuntu/Debian Chromium
          '/usr/bin/chromium',                // Generic Chromium
          '/opt/google/chrome/chrome',        // Custom installations
          '/snap/bin/chromium',               // Snap package
          '/usr/local/bin/chrome',            // Manual installations
          '/usr/local/bin/chromium',          // Manual Chromium
          '/opt/chrome/chrome'                // Docker/container installations
          // DEVELOPMENT: Mac paths commented out for production
          // '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          // '/Applications/Chromium.app/Contents/MacOS/Chromium'
        ];
        
        // Find first existing path
        for (const browserPath of unixPaths) {
          if (fsSync.existsSync(browserPath)) {
            executablePath = browserPath;
            logger.info(`[BROWSER] Found ${platform} browser at: ${executablePath}`);
            break;
          }
        }
      }
    }
    
    // Validate that we found a browser executable
    if (!executablePath) {
      const platformName = platform === 'win32' ? 'Windows' : platform === 'darwin' ? 'macOS' : 'Linux';
      
      let installInstructions = '';
      if (platform === 'win32') {
        installInstructions = 'Please install Google Chrome or Microsoft Edge';
      } else if (platform === 'darwin') {
        installInstructions = 'Please install Google Chrome: brew install --cask google-chrome';
      } else {
        // Linux - provide comprehensive EC2 installation instructions
        installInstructions = `Please install Google Chrome using one of these methods:
        
        For Ubuntu/Debian (recommended for EC2):
        sudo apt-get update && sudo apt-get install -y google-chrome-stable
        
        For Amazon Linux/RHEL/CentOS:
        sudo yum install -y google-chrome-stable
        
        Alternative (Chromium):
        sudo apt-get install -y chromium-browser`;
      }
      
      const errorMessage = `No Chrome/Chromium browser found on ${platformName}. 

${installInstructions}

Alternatively, set the PUPPETEER_EXECUTABLE_PATH environment variable to point to your browser executable.`;
      
      logger.error(errorMessage);
      throw new Error(errorMessage);
    }
    
    logger.info(`[BROWSER] Using browser at: ${executablePath}`);
    
    // Step 2: Launch browser with production-optimized arguments
    logger.info(`[Step 2/10] Launching browser with retry logic`);
    const launchArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-extensions',
      '--disable-plugins',
      '--disable-default-apps',
      '--disable-web-security',
      '--disable-features=TranslateUI'
    ];
    
    // Add Linux-specific arguments for better stability on EC2 and containers
    if (platform === 'linux') {
      launchArgs.push(
        '--disable-features=VizDisplayCompositor',
        '--no-zygote',
        '--single-process',
        '--disable-ipc-flooding-protection',
        '--disable-crash-reporter',
        '--disable-client-side-phishing-detection',
        '--disable-hang-monitor',
        '--disable-popup-blocking',
        '--disable-prompt-on-repost',
        '--disable-sync',
        '--metrics-recording-only',
        '--no-first-run',
        '--safebrowsing-disable-auto-update',
        '--disable-component-update',
        '--disable-background-networking',
        '--disable-features=Translate'
      );
      
      logger.info('[BROWSER] Applied EC2/Linux-optimized Chrome arguments');
    }
    
    browser = await retryWithBackoff(async () => {
      return await puppeteer.launch({
        executablePath,
        args: launchArgs,
        headless: true,
        defaultViewport: { width: 1366, height: 768 },
        timeout: 120000
      });
    }, 3);
    
    mainPage = await browser.newPage();
    await setupPage(mainPage);
    
    logger.info(`[Step 2/10] Browser launched successfully`);

    // Step 3: Login to government portal
    logger.info(`[Step 3/10] Logging in to government portal`);
    await retryWithBackoff(() => loginToPortal(mainPage), 3);

    // Step 4: Navigate to the permit form
    logger.info(`[Step 4/10] Navigating to permit form`);
    await retryWithBackoff(() => navigateToPermitForm(mainPage), 3);

    // Step 5: Fill the permit form with application data
    logger.info(`[Step 5/10] Filling permit form with application data`);
    await retryWithBackoff(() => fillPermitForm(mainPage, appData), 2);

    // Step 6: Submit the form and get the resulting permit page URL
    logger.info(`[Step 6/10] Submitting permit form`);
    const detailsPageUrl = await retryWithBackoff(() => handleFormSubmission(mainPage), 2);
    logger.info(`[Step 6/10] Form submitted successfully. Details page URL: ${detailsPageUrl}`);

    // Step 7: Prepare permit data
    logger.info(`[Step 7/10] Preparing permit data`);
    // Use business rules for date calculation
    const { convertToMexicoTimezone, calculatePermitExpirationDate } = require('../utils/permit-business-days');
    const mexicoToday = convertToMexicoTimezone(new Date());
    const todayString = mexicoToday.toISOString().split('T')[0];
    
    const permitData = {
      folio: `HTZ-${applicationId}`, // Use a simple format based on application ID
      importe: appData.importe || 99.00, // Use the importe from the application data
      fechaExpedicion: todayString, // Today's date in Mexico timezone
      fechaVencimiento: calculatePermitExpirationDate(mexicoToday) // Calculate using business rules
    };
    logger.info('[Step 7/10] Using application data for permit:', permitData);

    // Step 8: Find PDF links on the details page
    logger.info(`[Step 8/10] Finding PDF links on details page`);
    const pdfLinks = await retryWithBackoff(() => findPdfLinks(mainPage, detailsPageUrl), 2);

    // Step 9: Get session cookies for authenticated downloads
    logger.info(`[Step 9/10] Capturing session cookies`);
    const cookies = await mainPage.cookies();
    logger.info(`[Step 9/10] Captured ${cookies.length} cookies for authenticated downloads`);

    // Step 10: Download all PDF files
    logger.info(`[Step 10/10] Downloading PDF files`);
    const pdfFilePaths = await retryWithBackoff(() => downloadPermitPdfs(mainPage, pdfLinks, cookies, applicationId), 3);

    // Step 11: Generate recommendations PDF
    logger.info(`[Step 11/11] Generating recommendations PDF`);
    try {
      // Get user name for personalization
      const userName = appData.nombre_completo || 'Usuario';
      
      // 1. Generate the recommendations PDF buffer
      const recommendationsPdfBuffer = await recommendationsPdfService.generateRecommendationsPdf({
        userName: userName,
        permitId: permitData.folio
      });
      
      // 2. Save the buffer to a temporary file on disk
      const tempDir = path.join(__dirname, '../../storage/temp_generated');
      await fs.mkdir(tempDir, { recursive: true });
      const tempFilePath = path.join(tempDir, `recomendaciones_${applicationId}_${timestamp}.pdf`);
      await fs.writeFile(tempFilePath, recommendationsPdfBuffer);

      logger.info(`[Step 11/11] Generated recommendations PDF and saved to temporary path: ${tempFilePath}`);

      // 3. Save the temporary file to S3 using the reliable file path method
      const saveOptions = {
        originalName: `recomendaciones_${permitData.folio}.pdf`,
        subDirectory: `permits/${applicationId}`,
        prefix: 'recomendaciones',
        contentType: 'application/pdf'
      };
      
      // Use saveFileFromPath instead of saveFile with a buffer
      const result = await storageService.saveFileFromPath(tempFilePath, saveOptions);
      const recommendationsPath = result.key || result.relativePath;
      
      // 4. Clean up the temporary file
      await fs.unlink(tempFilePath);
      
      // Add the valid S3 path to the file paths object
      pdfFilePaths.recomendaciones = recommendationsPath;
      logger.info(`[Step 11/11] Recommendations PDF uploaded to storage successfully: ${recommendationsPath}`);
    } catch (recommendationsError) {
      logger.error('Error generating recommendations PDF:', recommendationsError);
      // Continue without recommendations PDF - don't fail the whole process
    }

    // Final Step: Update the application with permit data and file paths
    logger.info(`[FINAL] Updating application with permit data`);
    await retryWithBackoff(() => updateApplicationWithPermitData(applicationId, permitData, pdfFilePaths), 3);

    logger.info(`[COMPLETE] Permit generation completed successfully for application ${applicationId}`);

  } catch (error) {
    logger.error(`[ERROR] Error generating permit for application ${applicationId}:`, error);
    // PRODUCTION: Error screenshot disabled, simplified error handling
    await handlePuppeteerError(error, applicationId);
  } finally {
    // Always close the browser
    if (browser) {
      try {
        await browser.close();
        logger.info(`Browser closed for application ${applicationId}`);
      } catch (closeError) {
        logger.error('Error closing browser:', closeError);
      }
    }
  }
};

/**
 * Fetch application data from the database
 */
async function fetchApplicationData(applicationId) {
  logger.info(`Fetching data for application ${applicationId}...`);
  const appData = await applicationRepository.getApplicationForGeneration(applicationId);

  if (!appData) {
    throw new Error(`Application ${applicationId} not found in database.`);
  }

  logger.info(`Successfully retrieved application data for ID ${applicationId}`);
  return appData;
}

/**
 * Update application status in the database
 */
async function updateApplicationStatus(applicationId, status) {
  await applicationRepository.updatePuppeteerStatus(applicationId, status);
  logger.info(`Updated application ${applicationId} status to ${status}`);
}

// DEVELOPMENT: Duplicate launchBrowser function removed
// Browser is launched directly in generatePermit function with production-optimized settings

/**
 * Set up page configuration
 */
async function setupPage(page) {
  await page.setViewport({ width: 1366, height: 768 });
  page.setDefaultNavigationTimeout(90000); // 90 seconds
  logger.info('Page setup complete');
}

/**
 * Log in to the government portal
 */
async function loginToPortal(page) {
  logger.info(`Navigating to login page: ${config.govtLoginUrl}`);
  logger.info('Full config object:', {
    hasConfig: !!config,
    hasGovtLoginUrl: !!config.govtLoginUrl,
    govtLoginUrl: config.govtLoginUrl || 'NOT_DEFINED'
  });

  try {
    await page.goto(config.govtLoginUrl, { waitUntil: 'networkidle0', timeout: 30000 });

    // Wait for login form elements
    const usernameSelector = 'input[name="email"]';
    const passwordSelector = 'input[name="password"]';
    const loginButtonSelector = 'button.login100-form-btn';

    await page.waitForSelector(usernameSelector, { visible: true, timeout: 15000 });
    await page.waitForSelector(passwordSelector, { visible: true, timeout: 15000 });

    // Enter credentials
    logger.info('Entering credentials...');
    await page.type(usernameSelector, config.govtUsername);
    await page.type(passwordSelector, config.govtPassword);

    // Click login and wait for navigation
    logger.info('Clicking login button...');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }),
      page.click(loginButtonSelector)
    ]);

    // Verify login success
    const currentUrl = page.url();
    if (!currentUrl.includes('/panel/')) {
      // Check for error message
      const errorElement = await page.$('div.alert-danger');
      if (errorElement) {
        const errorText = await page.evaluate(el => el.textContent, errorElement);
        throw new Error(`Login failed: ${errorText}`);
      }
      throw new Error(`Login verification failed - unexpected URL after login: ${currentUrl}`);
    }

    logger.info('Login successful');
  } catch (error) {
    logger.error('Login failed:', error);
    throw new Error(`Failed to login to portal: ${error.message}`);
  }
}

/**
 * Navigate to the permit form
 */
async function navigateToPermitForm(page) {
  logger.info('Navigating to permit form...');

  try {
    // Navigate directly to the create permit form
    await page.goto('https://www.direcciondetransitohuitzucodelosfigueroa.gob.mx/panel/digitales/crear', {
      waitUntil: 'networkidle0',
      timeout: 20000
    });

    // Verify we're on the form page using multiple checks
    const formChecks = [
      'form[action*="/panel/digitales"]',
      'input[name="marca"]',
      'input[name="num_serie"]'
    ];

    let formFound = false;
    for (const check of formChecks) {
      try {
        await page.waitForSelector(check, { visible: true, timeout: 5000 });
        formFound = true;
        logger.info(`Confirmed form page using selector: ${check}`);
        break;
      } catch (checkError) {
        logger.debug(`Form check selector ${check} not found: ${checkError.message}`);
      }
    }

    if (!formFound) {
      throw new Error('Could not verify we\'re on the permit form page.');
    }
  } catch (error) {
    logger.error('Failed to navigate to permit form:', error);
    throw new Error(`Navigation to permit form failed: ${error.message}`);
  }
}

/**
 * Fill the permit form with application data
 */
async function fillPermitForm(page, appData) {
  logger.info('Filling permit form...');

  try {
    // Wait for form to be fully loaded
    await page.waitForSelector('form[action*="/panel/digitales"]', { visible: true, timeout: 10000 });

    // Field mapping based on the actual form structure from the website
    // Maps our database fields to the actual form field names
    const formFields = [
      { name: 'marca', value: appData.marca },
      { name: 'linea', value: appData.linea },
      { name: 'modelo', value: appData.ano_modelo.toString() }, // Using ano_modelo for modelo field
      { name: 'color', value: appData.color },
      { name: 'num_serie', value: appData.numero_serie },
      { name: 'num_motor', value: appData.numero_motor },
      { name: 'nombre_solicitante', value: appData.nombre_completo },
      { name: 'rfc_solicitante', value: appData.curp_rfc },
      { name: 'domicilio_solicitante', value: appData.domicilio }
    ];

    // Fill each field by name attribute
    for (const field of formFields) {
      try {
        logger.info(`Filling field: ${field.name} with value: ${field.value}`);
        // Use name attribute selector, which is more reliable
        const selector = `[name="${field.name}"]`;
        await page.waitForSelector(selector, { visible: true, timeout: 5000 });
        await page.type(selector, field.value);
        // Short pause to ensure form updates correctly
        await new Promise(r => setTimeout(r, 100));
      } catch (fieldError) {
        logger.warn(`Could not fill field ${field.name}: ${fieldError.message}`);
        // Continue with other fields
      }
    }

    // Handle the importe field separately
    try {
      const importeSelector = '[name="importe"]';
      await page.waitForSelector(importeSelector, { visible: true, timeout: 5000 });

      // Use the importe from appData if available, otherwise use default value
      const importeValue = appData.importe ? appData.importe.toString() : '99.00';
      logger.info(`Setting importe field to: ${importeValue}`);

      // Clear the field first (it might have a default value)
      await page.$eval(importeSelector, el => el.value = '');

      // Then type the value
      await page.type(importeSelector, importeValue);
    } catch (importeError) {
      logger.warn(`Could not fill importe field: ${importeError.message}`);
      // Try using JavaScript to set the value directly as a fallback
      try {
        await page.$eval('[name="importe"]', (input, value) => input.value = value, '197.00');
        logger.info('Set importe field using JavaScript fallback');
      } catch (jsError) {
        logger.warn(`JavaScript fallback for importe also failed: ${jsError.message}`);
      }
    }

    // The fecha_expedicion field is usually auto-filled, but we can check if it needs to be set
    try {
      const fechaSelector = '[name="fecha_expedicion"]';
      const fechaExists = await page.$(fechaSelector);
      if (fechaExists) {
        logger.info('Found fecha_expedicion field, checking if it needs to be set');
        const fechaValue = await page.$eval(fechaSelector, el => el.value);
        if (!fechaValue || fechaValue.trim() === '') {
          logger.info('Setting fecha_expedicion to today');
          // Format today's date as DD/MM/YYYY
          const today = new Date();
          const formattedDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;
          await page.$eval(fechaSelector, (input, value) => input.value = value, formattedDate);
        } else {
          logger.info(`fecha_expedicion already has value: ${fechaValue}`);
        }
      }
    } catch (fechaError) {
      logger.warn(`Could not check/set fecha_expedicion field: ${fechaError.message}`);
    }

    logger.info('Form filled successfully');
  } catch (error) {
    logger.error('Failed to fill form:', error);
    throw new Error(`Form filling failed: ${error.message}`);
  }
}

/**
 * Submit the form and handle the response
 */
async function handleFormSubmission(page) {
  logger.info('Submitting permit form...');

  try {
    // Specifically target the input#btn_save submit button
    logger.info('Looking for submit button with selector: input#btn_save');
    let submitButton = await page.$('input#btn_save');

    // If the specific button isn't found, try other selectors as fallback
    if (!submitButton) {
      logger.warn('Could not find input#btn_save, trying alternative selectors');

      const submitSelectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        '.btn-primary',
        'button.guardar',
        'input.guardar',
        'button:contains("Guardar")',
        'form[action*="/panel/digitales"] button',
        'form[action*="/panel/digitales"] input[type="submit"]'
      ];

      for (const selector of submitSelectors) {
        try {
          const button = await page.$(selector);
          if (button) {
            submitButton = button;
            logger.info(`Found submit button using selector: ${selector}`);
            break;
          }
        } catch (selectorError) {
          logger.debug(`Selector ${selector} not found: ${selectorError.message}`);
        }
      }
    } else {
      logger.info('Successfully found input#btn_save submit button');
    }

    // If no button found by selectors, try by text content
    if (!submitButton) {
      logger.info('Trying to find submit button by text content...');
      submitButton = await page.evaluateHandle(() => {
        const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
        return buttons.find(button =>
          button.textContent?.trim().toLowerCase() === 'guardar' ||
          button.textContent?.trim().toLowerCase().includes('submit') ||
          button.textContent?.trim().toLowerCase().includes('save') ||
          button.value?.trim().toLowerCase() === 'guardar' ||
          button.value?.trim().toLowerCase().includes('submit') ||
          button.value?.trim().toLowerCase().includes('save')
        );
      });

      if (submitButton && !(await submitButton.evaluate(el => el === null))) {
        logger.info('Found submit button by text content');
      } else {
        // Last resort - just try to submit the form directly
        logger.warn('Could not find submit button, trying to submit form directly');
        await page.evaluate(() => {
          const form = document.querySelector('form[action*="/panel/digitales"]');
          if (form) form.submit();
        });

        // Wait for navigation after form submit
        await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 });

        const currentUrl = page.url();
        logger.info(`Form submitted successfully. Redirected to: ${currentUrl}`);
        return currentUrl;
      }
    }

    // Click the submit button if found
    if (submitButton && !(await submitButton.evaluate(el => el === null))) {
      logger.info('Clicking submit button...');

      // Click and wait for navigation with networkidle0 for more reliable completion
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }),
        submitButton.click()
      ]);
    } else {
      throw new Error('Could not find a working submit button');
    }

    // Get the resulting URL
    const currentUrl = page.url();
    logger.info(`Form submitted successfully. Redirected to: ${currentUrl}`);

    // Return the current URL for further processing
    return currentUrl;

  } catch (error) {
    logger.error('Form submission failed:', error);
    throw new Error(`Form submission failed: ${error.message}`);
  }
}

/**
 * Extract any error message from the page
 */
async function extractErrorMessage(page) {
  try {
    // Look for error messages in common error containers
    const errorSelectors = [
      '.alert-danger', '.error-message', '.text-danger',
      'div.alert', '[role="alert"]'
    ];

    for (const selector of errorSelectors) {
      const errorElement = await page.$(selector);
      if (errorElement) {
        const errorText = await page.evaluate(el => el.textContent.trim(), errorElement);
        if (errorText) {
          return errorText;
        }
      }
    }

    return null; // No error message found
  } catch (error) {
    logger.error('Error extracting error message:', error);
    return null;
  }
}

/**
 * Extract permit data from the details page
 */
async function extractPermitData(page, detailsPageUrl) {
  logger.info(`Extracting permit data from ${detailsPageUrl}`);

  try {
    // Wait for details page to load completely
    await page.waitForSelector('.card-body', { timeout: 15000 });

    // Define the data we want to extract
    const permitData = {
      folio: null,
      importe: null,
      fechaExpedicion: null,
      fechaVencimiento: null
    };

    // Extract folio - could be in different places
    try {
      // Try different selectors/strategies to find the folio
      const folioSelectors = [
        '.card-header strong', // Strong text in header
        'h3.card-title',       // Card title
        '.card-body strong',   // Strong text in body
        'h5.card-title'        // H5 card title
      ];

      for (const selector of folioSelectors) {
        const elements = await page.$$(selector);
        for (const el of elements) {
          const text = await page.evaluate(node => node.textContent.trim(), el);

          // Look for text that contains "Folio" or a pattern like HTZ-XXXXXX
          if (text.includes('Folio') || text.includes('folio') || /HTZ-[A-Z0-9]+/.test(text)) {
            // Extract the folio number
            const matches = text.match(/HTZ-[A-Z0-9]+/);
            if (matches && matches[0]) {
              permitData.folio = matches[0];
              logger.info(`Extracted folio: ${permitData.folio}`);
              break;
            } else if (text.includes('Folio') || text.includes('folio')) {
              // Try to extract folio from text like "Folio: HTZ-12345"
              const parts = text.split(/:|:?\s+/);
              if (parts.length > 1) {
                const potentialFolio = parts[parts.length - 1].trim();
                if (potentialFolio) {
                  permitData.folio = potentialFolio;
                  logger.info(`Extracted folio from text: ${permitData.folio}`);
                  break;
                }
              }
            }
          }
        }

        if (permitData.folio) break; // Stop if we found the folio
      }

      // If still not found, try using the URL as a fallback
      if (!permitData.folio) {
        const urlMatches = detailsPageUrl.match(/\/digitales\/(\d+)$/);
        if (urlMatches && urlMatches[1]) {
          permitData.folio = `HTZ-AL${urlMatches[1]}`;
          logger.info(`Derived folio from URL: ${permitData.folio}`);
        }
      }
    } catch (folioError) {
      logger.error('Error extracting folio:', folioError);
    }

    // Extract importe (fee amount)
    try {
      // Look for text containing currency symbol or "importe", "costo", "pago", etc.
      const importeText = await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('.card-body *'));
        for (const el of elements) {
          const text = el.textContent.trim();
          if (
            text.includes('$') ||
                        text.toLowerCase().includes('importe') ||
                        text.toLowerCase().includes('costo') ||
                        text.toLowerCase().includes('pago')
          ) {
            return text;
          }
        }
        return null;
      });

      if (importeText) {
        // Extract number pattern like $123.45 or 123.45
        const matches = importeText.match(/\$?(\d+(?:\.\d+)?)/);
        if (matches && matches[1]) {
          permitData.importe = parseFloat(matches[1]);
          logger.info(`Extracted importe: ${permitData.importe}`);
        }
      }

      // If not found, set a default value
      if (!permitData.importe) {
        permitData.importe = 99.00;
        logger.info(`Using default importe: ${permitData.importe}`);
      }
    } catch (importeError) {
      logger.error('Error extracting importe:', importeError);
      permitData.importe = 99.00; // Default fallback
    }

    // Extract fechaExpedicion (issue date)
    try {
      const fechaExpedicionText = await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('.card-body *'));
        for (const el of elements) {
          const text = el.textContent.trim();
          if (
            text.toLowerCase().includes('expedición') ||
                        text.toLowerCase().includes('expedicion') ||
                        text.toLowerCase().includes('emitido')
          ) {
            return text;
          }
        }
        return null;
      });

      if (fechaExpedicionText) {
        // Extract date pattern like DD/MM/YYYY or YYYY-MM-DD
        const matches = fechaExpedicionText.match(/\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{1,2}-\d{1,2}/);
        if (matches && matches[0]) {
          permitData.fechaExpedicion = matches[0];
          logger.info(`Extracted fechaExpedicion: ${permitData.fechaExpedicion}`);
        }
      }

      // If not found, use today's date as a fallback
      if (!permitData.fechaExpedicion) {
        const today = new Date();
        permitData.fechaExpedicion = today.toISOString().split('T')[0]; // YYYY-MM-DD format
        logger.info(`Using today's date for fechaExpedicion: ${permitData.fechaExpedicion}`);
      }
    } catch (fechaExpedicionError) {
      logger.error('Error extracting fechaExpedicion:', fechaExpedicionError);
      const today = new Date();
      permitData.fechaExpedicion = today.toISOString().split('T')[0]; // Default fallback
    }

    // Extract fechaVencimiento (expiry date)
    try {
      const fechaVencimientoText = await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('.card-body *'));
        for (const el of elements) {
          const text = el.textContent.trim();
          if (
            text.toLowerCase().includes('vencimiento') ||
                        text.toLowerCase().includes('vence') ||
                        text.toLowerCase().includes('vigencia')
          ) {
            return text;
          }
        }
        return null;
      });

      if (fechaVencimientoText) {
        // Extract date pattern
        const matches = fechaVencimientoText.match(/\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{1,2}-\d{1,2}/);
        if (matches && matches[0]) {
          permitData.fechaVencimiento = matches[0];
          logger.info(`Extracted fechaVencimiento: ${permitData.fechaVencimiento}`);
        }
      }

      // If not found, calculate expiry date as 30 days from expedition date
      if (!permitData.fechaVencimiento && permitData.fechaExpedicion) {
        const expedicionDate = new Date(permitData.fechaExpedicion);
        const vencimientoDate = new Date(expedicionDate);
        vencimientoDate.setDate(vencimientoDate.getDate() + 30); // 30 days from expedition date
        permitData.fechaVencimiento = vencimientoDate.toISOString().split('T')[0]; // YYYY-MM-DD format
        logger.info(`Calculated fechaVencimiento from fechaExpedicion: ${permitData.fechaVencimiento}`);
      }
    } catch (fechaVencimientoError) {
      logger.error('Error extracting fechaVencimiento:', fechaVencimientoError);
      // Calculate a default expiry date if we have an issue date
      if (permitData.fechaExpedicion) {
        const expedicionDate = new Date(permitData.fechaExpedicion);
        const vencimientoDate = new Date(expedicionDate);
        vencimientoDate.setDate(vencimientoDate.getDate() + 30); // 30 days from expedition date
        permitData.fechaVencimiento = vencimientoDate.toISOString().split('T')[0];
        logger.info(`Fallback calculated fechaVencimiento from fechaExpedicion: ${permitData.fechaVencimiento}`);
      }
    }

    // CRITICAL FIX: Ensure we always have a valid expiration date
    // If we still don't have fechaVencimiento, use current date + 30 days as absolute fallback
    if (!permitData.fechaVencimiento) {
      const currentDate = new Date();
      const vencimientoDate = new Date(currentDate);
      vencimientoDate.setDate(currentDate.getDate() + 30); // 30 days from today
      permitData.fechaVencimiento = vencimientoDate.toISOString().split('T')[0];
      logger.warn(`No fechaExpedicion available, using current date + 30 days: ${permitData.fechaVencimiento}`);
    }

    logger.info('Permit data extraction complete', permitData);
    return permitData;
  } catch (error) {
    logger.error('Failed to extract permit data:', error);
    throw new Error(`Data extraction failed: ${error.message}`);
  }
}

/**
 * Find PDF links on the details page
 */
async function findPdfLinks(page, detailsPageUrl) {
  logger.info(`Finding PDF links on page: ${detailsPageUrl}`);

  const pdfLinks = {
    permiso: null,
    certificado: null,
    placas: null
  };

  try {
    // Different selectors to try for each type of PDF
    const selectors = {
      permiso: 'a[href$="/formato-pdf"]',
      certificado: 'a[href$="/certificacion-pdf"]',
      placas: 'a[href$="/placas-en-proceso-pdf"]'
    };

    // Alternative text patterns to look for in links
    const textPatterns = {
      permiso: ['formato', 'permiso', 'permit', 'digital'],
      certificado: ['certificado', 'certificación', 'certification'],
      placas: ['placas en proceso', 'placas', 'placa', 'proceso', 'plates', 'vehicle']
    };

    // Try to find links using selectors
    for (const type in selectors) {
      try {
        const linkElement = await page.$(selectors[type]);
        if (linkElement) {
          pdfLinks[type] = await page.evaluate(el => el.href, linkElement);
          logger.info(`Found ${type} PDF URL via selector: ${pdfLinks[type]}`);
        }
      } catch (error) {
        logger.debug(`Could not find selector for ${type} PDF link: ${error.message}`);
      }
    }

    // If selectors didn't work, try finding links by text content
    if (Object.values(pdfLinks).some(link => !link)) {
      logger.info('Trying to find PDF links by text content...');

      const links = await page.evaluate(() => {
        const allLinks = Array.from(document.querySelectorAll('a'));
        return allLinks.map(link => ({
          href: link.href,
          text: link.textContent.trim().toLowerCase()
        }));
      });

      for (const type in textPatterns) {
        if (!pdfLinks[type]) {
          for (const link of links) {
            const matchesPattern = textPatterns[type].some(pattern =>
              link.text.includes(pattern) || link.href.includes(pattern)
            );

            if (matchesPattern && link.href.includes('/pdf')) {
              pdfLinks[type] = link.href;
              logger.info(`Found ${type} PDF URL via text pattern: ${pdfLinks[type]}`);
              break;
            }
          }
        }
      }
    }

    // If we still couldn't find some links, try to construct them from the details page URL
    const permitId = extractPermitIdFromUrl(detailsPageUrl);

    if (permitId && Object.values(pdfLinks).some(link => !link)) {
      logger.info('Constructing missing PDF links based on permit ID...');

      const baseUrl = 'https://www.direcciondetransitohuitzucodelosfigueroa.gob.mx/panel/digitales/';
      const urlSuffixes = {
        permiso: '/formato-pdf',
        certificado: '/certificacion-pdf',
        placas: '/placas-en-proceso-pdf'
      };

      for (const type in urlSuffixes) {
        if (!pdfLinks[type]) {
          pdfLinks[type] = `${baseUrl}${permitId}${urlSuffixes[type]}`;
          logger.info(`Constructed ${type} PDF URL: ${pdfLinks[type]}`);
        }
      }
    }

    // Verify we have at least the main permit PDF link
    if (!pdfLinks.permiso) {
      throw new Error('Failed to find or construct the main Permiso PDF URL');
    }

    logger.info('PDF links found:', pdfLinks);
    return pdfLinks;
  } catch (error) {
    logger.error('Failed to find PDF links:', error);
    throw new Error(`PDF link detection failed: ${error.message}`);
  }
}

/**
 * Extract permit ID from URL
 */
function extractPermitIdFromUrl(url) {
  try {
    const matches = url.match(/\/digitales\/(\d+)/);
    return (matches && matches[1]) ? matches[1] : null;
  } catch (error) {
    logger.error('Error extracting permit ID from URL:', error);
    return null;
  }
}

/**
 * Download a file via direct HTTP request with cookies and return as buffer
 */
function downloadFileAsBuffer(url, cookies) {
  return new Promise((resolve, reject) => {
    // Determine if it's http or https
    const client = url.startsWith('https') ? https : http;

    // Format cookies for HTTP header if provided
    let cookieHeader = '';
    if (cookies && cookies.length > 0) {
      cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
      logger.info(`Using cookies: ${cookieHeader}`);
    }

    // Add headers to mimic browser with cookies
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.82 Safari/537.36',
        'Accept': 'application/pdf,*/*',
        'Cookie': cookieHeader
      }
    };

    logger.info(`Starting download from: ${url}`);

    // Create the request
    const req = client.get(url, options, (res) => {
      // Check for redirect
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        logger.info(`Following redirect to: ${res.headers.location}`);
        // Follow the redirect
        return downloadFileAsBuffer(res.headers.location, cookies).then(resolve).catch(reject);
      }

      // Check if the response is successful
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to download file, status code: ${res.statusCode}`));
      }

      // Log response headers for debugging
      logger.debug(`Response headers: ${JSON.stringify(res.headers)}`);

      // Check content type
      const contentType = res.headers['content-type'];
      logger.info(`Content-Type: ${contentType}`);

      // Extract filename from Content-Disposition header if available
      let originalFilename = null;
      const contentDisposition = res.headers['content-disposition'];
      if (contentDisposition) {
        logger.info(`Content-Disposition: ${contentDisposition}`);
        // Parse filename from Content-Disposition header
        // Handles: attachment; filename="example.pdf" or attachment; filename*=UTF-8''example.pdf
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          originalFilename = filenameMatch[1].replace(/['"]/g, '');
          // Handle UTF-8 encoded filenames
          if (originalFilename.includes("UTF-8''")) {
            originalFilename = decodeURIComponent(originalFilename.split("UTF-8''")[1]);
          }
          logger.info(`Extracted original filename from headers: ${originalFilename}`);
        }
      } else {
        logger.warn(`No Content-Disposition header found for ${url}`);
        // Try to extract from URL as fallback
        try {
          const urlParts = url.split('/');
          const lastPart = urlParts[urlParts.length - 1];
          const cleanName = lastPart.split('?')[0];
          if (cleanName && cleanName.endsWith('.pdf')) {
            originalFilename = decodeURIComponent(cleanName);
            logger.info(`Extracted filename from URL as fallback: ${originalFilename}`);
          }
        } catch (e) {
          logger.warn(`Could not extract filename from URL: ${e.message}`);
        }
      }

      // Collect data chunks
      const chunks = [];
      let downloadedBytes = 0;

      res.on('data', (chunk) => {
        chunks.push(chunk);
        downloadedBytes += chunk.length;
      });

      res.on('end', () => {
        logger.info(`Download complete (${downloadedBytes} bytes)`);

        const buffer = Buffer.concat(chunks);
        if (buffer.length === 0) {
          reject(new Error('Downloaded file is empty'));
        } else {
          resolve({
            buffer: buffer,
            size: buffer.length,
            originalFilename: originalFilename
          });
        }
      });

      res.on('error', (err) => {
        reject(new Error(`Response error: ${err.message}`));
      });
    });

    // Handle request errors
    req.on('error', (err) => {
      reject(new Error(`Request error: ${err.message}`));
    });

    // Set timeout
    req.setTimeout(20000, () => {
      req.abort();
      reject(new Error('Request timeout'));
    });
  });
}

/**
 * Download a file via direct HTTP request with cookies (legacy function for backward compatibility)
 */
function downloadFile(url, filePath, cookies) {
  return new Promise((resolve, reject) => {
    // Determine if it's http or https
    const client = url.startsWith('https') ? https : http;

    // Format cookies for HTTP header if provided
    let cookieHeader = '';
    if (cookies && cookies.length > 0) {
      cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
      logger.info(`Using cookies: ${cookieHeader}`);
    }

    // Add headers to mimic browser with cookies
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.82 Safari/537.36',
        'Accept': 'application/pdf,*/*',
        'Cookie': cookieHeader
      }
    };

    logger.info(`Starting download from: ${url}`);

    // Create the request
    const req = client.get(url, options, (res) => {
      // Check for redirect
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        logger.info(`Following redirect to: ${res.headers.location}`);
        // Follow the redirect
        return downloadFile(res.headers.location, filePath, cookies).then(resolve).catch(reject);
      }

      // Check if the response is successful
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to download file, status code: ${res.statusCode}`));
      }

      // Log response headers for debugging
      logger.debug(`Response headers: ${JSON.stringify(res.headers)}`);

      // Check content type
      const contentType = res.headers['content-type'];
      logger.info(`Content-Type: ${contentType}`);

      // Create write stream using regular fs (not promises)
      const fileStream = fsSync.createWriteStream(filePath);

      // Pipe the response to the file
      res.pipe(fileStream);

      // Track downloaded size
      let downloadedBytes = 0;
      res.on('data', (chunk) => {
        downloadedBytes += chunk.length;
      });

      // Handle errors
      fileStream.on('error', (err) => {
        reject(new Error(`Error writing file: ${err.message}`));
      });

      // Handle completion
      fileStream.on('finish', async () => {
        logger.info(`Download complete (${downloadedBytes} bytes)`);

        try {
          const stats = await fs.stat(filePath);
          if (stats.size === 0) {
            reject(new Error('Downloaded file is empty'));
          } else {
            resolve({
              path: filePath,
              size: stats.size
            });
          }
        } catch (err) {
          reject(new Error(`Error checking file stats: ${err.message}`));
        }
      });
    });

    // Handle request errors
    req.on('error', (err) => {
      reject(new Error(`Request error: ${err.message}`));
    });

    // Set timeout
    req.setTimeout(20000, () => {
      req.abort();
      reject(new Error('Request timeout'));
    });
  });
}

/**
 * Download PDF using the page's session and return as buffer
 */
async function downloadPDFWithPage(page, pdfUrl) {
  logger.info(`Starting browser-based download for ${pdfUrl}`);

  try {
    // Try to extract filename from URL first
    let originalFilename = null;
    try {
      const urlParts = pdfUrl.split('/');
      const lastPart = urlParts[urlParts.length - 1];
      // Remove query parameters if any
      const cleanName = lastPart.split('?')[0];
      if (cleanName && cleanName.endsWith('.pdf')) {
        originalFilename = decodeURIComponent(cleanName);
        logger.info(`Extracted filename from URL: ${originalFilename}`);
      }
    } catch (e) {
      logger.warn(`Could not extract filename from URL: ${e.message}`);
    }

    // Navigate to the PDF URL
    logger.info(`Navigating to PDF URL: ${pdfUrl}`);
    
    // Set up response listener to capture headers
    let responseHeaders = null;
    page.once('response', response => {
      if (response.url() === pdfUrl) {
        responseHeaders = response.headers();
        logger.info('Captured response headers from browser navigation');
      }
    });
    
    await page.goto(pdfUrl, { waitUntil: 'networkidle0', timeout: 20000 });

    // Try to extract filename from Content-Disposition header if available
    if (!originalFilename && responseHeaders && responseHeaders['content-disposition']) {
      const contentDisposition = responseHeaders['content-disposition'];
      logger.info(`Browser Content-Disposition: ${contentDisposition}`);
      const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (filenameMatch && filenameMatch[1]) {
        originalFilename = filenameMatch[1].replace(/['"]/g, '');
        if (originalFilename.includes("UTF-8''")) {
          originalFilename = decodeURIComponent(originalFilename.split("UTF-8''")[1]);
        }
        logger.info(`Extracted filename from browser headers: ${originalFilename}`);
      }
    }

    // Use PDF printing functionality of browser to get buffer
    logger.info('Using browser PDF functionality');
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true
    });

    logger.info(`PDF generated via browser (${pdfBuffer.length} bytes, filename: ${originalFilename || 'not captured'})`);

    return {
      buffer: pdfBuffer,
      size: pdfBuffer.length,
      originalFilename: originalFilename
    };
  } catch (error) {
    logger.error(`Error during browser-based download: ${error.message}`);
    throw error;
  }
}

/**
 * Download all PDF files and save to storage (S3 or local)
 */
async function downloadPermitPdfs(page, pdfLinks, cookies, applicationId) {
  logger.info('Downloading PDF files...');

  const pdfFilePaths = {
    permiso: null,
    certificado: null,
    placas: null
  };

  try {
    // Download each type of PDF
    for (const type in pdfLinks) {
      if (pdfLinks[type]) {
        try {
          logger.info(`Downloading ${type} PDF from ${pdfLinks[type]}`);

          // Use a unique timestamp and permit ID
          const timestamp = Date.now();
          const permitId = extractPermitIdFromUrl(pdfLinks[type]) || 'unknown';
          let pdfBuffer = null;
          let originalFilename = null;

          try {
            // Try direct HTTP download first
            logger.info(`Attempting direct HTTP download with cookies for ${type}`);
            const result = await downloadFileAsBuffer(pdfLinks[type], cookies);
            pdfBuffer = result.buffer;
            originalFilename = result.originalFilename;
            logger.info(`Successfully downloaded ${type} PDF via HTTP (${result.size} bytes, original name: ${originalFilename})`);
          } catch (httpError) {
            logger.warn(`Direct HTTP download failed for ${type}, error: ${httpError.message}`);

            // Fall back to browser-based download
            logger.info(`Falling back to browser-based download for ${type}`);
            const browserResult = await downloadPDFWithPage(page, pdfLinks[type]);
            pdfBuffer = browserResult.buffer;
            originalFilename = browserResult.originalFilename;
            logger.info(`Successfully downloaded ${type} PDF via browser (${browserResult.size} bytes, filename: ${originalFilename || 'not captured'})`);
          }

          // Save PDF to storage (S3 or local)
          if (pdfBuffer) {
            const storageIdentifier = await savePdfToStorage(pdfBuffer, applicationId, type, permitId, timestamp, originalFilename);
            pdfFilePaths[type] = storageIdentifier;
            logger.info(`Saved ${type} PDF to storage: ${storageIdentifier} (original: ${originalFilename})`);
          }

        } catch (downloadError) {
          logger.error(`Error downloading ${type} PDF:`, downloadError);
          // Continue with other PDFs even if one fails
        }
      }
    }

    // Verify we have at least the main permit PDF
    if (!pdfFilePaths.permiso) {
      throw new Error('Failed to download the main Permiso PDF');
    }

    logger.info('PDF downloads complete:', pdfFilePaths);
    return pdfFilePaths;
  } catch (error) {
    logger.error('Failed to download PDFs:', error);
    throw new Error(`PDF download failed: ${error.message}`);
  }
}

/**
 * Update application with permit data and file paths
 */
async function updateApplicationWithPermitData(applicationId, permitData, pdfFilePaths) {
  logger.info(`Updating application ${applicationId} with permit data and file paths...`);

  try {
    // Use the existing updatePermitGenerated method from the repository
    const success = await applicationRepository.updatePermitGenerated(applicationId, {
      permit_file_path: pdfFilePaths.permiso,
      certificado_file_path: pdfFilePaths.certificado,
      placas_file_path: pdfFilePaths.placas,
      recomendaciones_file_path: pdfFilePaths.recomendaciones || null,
      folio: permitData.folio,
      fecha_expedicion: permitData.fechaExpedicion,
      fecha_vencimiento: permitData.fechaVencimiento,
      status: 'PERMIT_READY'
    });

    if (!success) {
      throw new Error(`Application ${applicationId} not found during update`);
    }

    logger.info(`Successfully updated application ${applicationId} to status PERMIT_READY`);
    
    // Track permit completion metric
    metricsCollector.recordPermitCompleted();
    
    // Update generation progress to completed
    await applicationRepository.updateGenerationProgress(applicationId, 'completion', 'completed');
    
    // Send permit ready email notification
    try {
      // Fetch user email
      const appData = await applicationRepository.getApplicationForGeneration(applicationId);
      
      if (appData && appData.user_email) {
        // Generate presigned URLs for all PDFs (48-hour expiration)
        const urlPromises = [
          storageService.getFileUrl(pdfFilePaths.permiso, { expiresIn: 48 * 60 * 60 }),
          storageService.getFileUrl(pdfFilePaths.certificado, { expiresIn: 48 * 60 * 60 }),
          storageService.getFileUrl(pdfFilePaths.placas, { expiresIn: 48 * 60 * 60 })
        ];
        
        // Add recommendations URL if it exists
        if (pdfFilePaths.recomendaciones) {
          urlPromises.push(storageService.getFileUrl(pdfFilePaths.recomendaciones, { expiresIn: 48 * 60 * 60 }));
        }
        
        const urls = await Promise.all(urlPromises);
        const [permisoUrl, certificadoUrl, placasUrl, recomendacionesUrl] = urls;
        
        // Minimal email data
        const emailData = {
          application_id: applicationId,
          permit_folio: permitData.folio,
          first_name: appData.first_name || 'Usuario',
          permit_url_primary: permisoUrl,
          permit_url_secondary: certificadoUrl,
          permit_url_placas: placasUrl,
          url_expiration_hours: 48
        };
        
        // Send the email (wrapped in try-catch to not block WhatsApp notifications)
        try {
          await emailService.sendPermitReadyEmail(appData.user_email, emailData);
          logger.info(`Permit ready email sent to ${appData.user_email}`);
        } catch (emailError) {
          logger.error(`Failed to send permit ready email to ${appData.user_email}: ${emailError.message}`);
          // Continue to send WhatsApp notification even if email fails
        }
        
        // Debug log to see what notification data we have
        logger.info('Checking notification data for WhatsApp delivery', {
          applicationId,
          hasWhatsappPhone: !!appData.whatsapp_phone,
          hasUserEmail: !!appData.user_email,
          whatsappPhone: appData.whatsapp_phone ? maskPhoneNumber(appData.whatsapp_phone) : 'none',
          phoneLength: appData.whatsapp_phone ? appData.whatsapp_phone.length : 0,
          permitUrl: permisoUrl ? 'generated' : 'missing',
          userId: appData.user_id
        });

        // Send WhatsApp notification if user has WhatsApp phone
        if (appData.whatsapp_phone && appData.whatsapp_phone.trim().length > 0) {
          try {
            // Validate phone number format (basic security check)
            const phoneRegex = /^(\+?52)?1?\d{10}$/;
            if (!phoneRegex.test(appData.whatsapp_phone.replace(/\s+/g, ''))) {
              throw new Error(`Invalid WhatsApp phone format: ${maskPhoneNumber(appData.whatsapp_phone)}`);
            }

            logger.info(`Sending WhatsApp notification for permit ready to ${maskPhoneNumber(appData.whatsapp_phone)}`);

            // Initialize WhatsApp service with better error handling
            let whatsappService;
            try {
              whatsappService = await getWhatsAppService();
              if (!whatsappService) {
                throw new Error('WhatsApp service initialization returned null');
              }
            } catch (initError) {
              throw new Error(`WhatsApp service initialization failed: ${initError.message}`);
            }

            await whatsappService.handlePermitReady(applicationId, permisoUrl, appData.whatsapp_phone);
            logger.info(`WhatsApp notification sent successfully to ${maskPhoneNumber(appData.whatsapp_phone)}`);

            // Log successful delivery in payment_events
            await paymentRepository.createPaymentEvent(
              applicationId,
              'whatsapp.notification.sent',
              {
                type: 'permit_ready',
                phoneNumber: maskPhoneNumber(appData.whatsapp_phone),
                permitUrl: permisoUrl ? 'generated' : 'missing',
                timestamp: new Date().toISOString()
              },
              null
            );
          } catch (whatsappError) {
            logger.error(`Failed to send WhatsApp notification: ${whatsappError.message}`);
            
            // Log failure in payment_events for tracking
            try {
              await paymentRepository.createPaymentEvent(
                applicationId,
                'whatsapp.notification.failed',
                {
                  type: 'permit_ready',
                  phoneNumber: maskPhoneNumber(appData.whatsapp_phone),
                  error: whatsappError.message,
                  permitUrl: permisoUrl,
                  timestamp: new Date().toISOString()
                },
                null
              );
              
              // Queue for retry using existing email queue infrastructure
              const queueService = require('./queue.service');
              await queueService.addEmailToQueue({
                type: 'whatsapp-retry',
                to: appData.whatsapp_phone,
                subject: 'WhatsApp Permit Ready Notification',
                data: {
                  applicationId,
                  permitUrl: permisoUrl,
                  phoneNumber: appData.whatsapp_phone,
                  retryCount: 1,
                  originalError: whatsappError.message
                }
              }, 2); // Priority 2 for retries
              
              logger.info(`Queued WhatsApp notification for retry`, {
                applicationId,
                phoneNumber: appData.whatsapp_phone.substring(0, 6) + '****'
              });
            } catch (queueError) {
              logger.error(`Failed to queue WhatsApp retry: ${queueError.message}`);
            }
          }
        } else {
          logger.warn('No WhatsApp phone found for notification', {
            applicationId,
            userId: appData.user_id,
            hasUserEmail: !!appData.user_email,
            phoneValue: appData.whatsapp_phone || 'null/undefined'
          });
        }
      }
    } catch (notificationError) {
      // Log but don't fail the entire process
      logger.error(`Failed to send notifications: ${notificationError.message}`);
    }
    
    return { id: applicationId, status: 'PERMIT_READY' };
  } catch (error) {
    logger.error(`Failed to update application ${applicationId} with permit data:`, error);
    throw new Error(`Database update failed: ${error.message}`);
  }
}

/**
 * Handle Puppeteer errors
 */
async function handlePuppeteerError(error, applicationId, status = 'ERROR_GENERATING_PERMIT') {
  try {
    // PRODUCTION: Screenshots disabled
    logger.error('[PUPPETEER-ERROR] Error details:', {
      applicationId,
      error: error.message,
      stack: error.stack
    });

    // Update application status to error
    if (applicationId) {
      try {
        // Update the status to ERROR_GENERATING_PERMIT using repository
        await applicationRepository.updatePuppeteerError(applicationId, {
          error_message: error.message,
          error_at: new Date(),
          status: status
        });
        logger.info(`[PUPPETEER-ERROR] Updated application ${applicationId} status to ${status}`);
        
        // Track permit failure metric
        metricsCollector.recordPermitFailed();

        // Update generation progress to failed
        await applicationRepository.updateGenerationProgress(applicationId, 'error', 'failed');

        // PRODUCTION: Sample PDFs disabled
        // No fallback to sample PDFs in production
      } catch (dbError) {
        logger.error(`[PUPPETEER-ERROR] Failed to update application ${applicationId} status to error:`, dbError);
      }
    }
  } catch (handlerError) {
    logger.error('[PUPPETEER-ERROR] Error in error handler:', handlerError);
  }
}
