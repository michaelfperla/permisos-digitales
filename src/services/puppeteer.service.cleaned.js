// src/services/puppeteer.service.js
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs'); // Regular fs for createWriteStream
const { applicationRepository } = require('../repositories');
const unifiedConfig = require('../config/unified-config');
const { logger } = require('../utils/logger');
const http = require('http');
const https = require('https');
const storageService = require('./storage/storage-service');
const metricsCollector = require('../monitoring/metrics-collector');
const StorageUtils = require('../utils/storage-utils');

/**
 * Lazy load configuration to avoid race conditions
 */
function getConfig() {
  return unifiedConfig.getSync();
}

// Get storage paths from configuration
const storagePaths = StorageUtils.getStoragePaths(getConfig());

// Constants - now configurable
const PDF_STORAGE_DIR = storagePaths.pdfs;
const LOG_STORAGE_DIR = storagePaths.logs;
const SCREENSHOT_DIR = storagePaths.screenshots;

// Government portal URLs configuration - lazy load to avoid race conditions
function getGovtUrls() {
  const config = getConfig();
  return {
    login: config.govtLoginUrl || 'https://www.direcciondetransitohuitzucodelosfigueroa.gob.mx/login',
    createPermit: 'https://www.direcciondetransitohuitzucodelosfigueroa.gob.mx/panel/digitales/crear',
    baseUrl: 'https://www.direcciondetransitohuitzucodelosfigueroa.gob.mx'
  };
}

/**
 * Save PDF buffer to storage (S3 or local based on configuration)
 * @param {Buffer} pdfBuffer - PDF content as buffer
 * @param {number} applicationId - Application ID
 * @param {string} type - PDF type (permiso, certificado, placas)
 * @param {string} permitId - Permit ID from government system
 * @param {number} timestamp - Timestamp for uniqueness
 * @returns {Promise<string>} Storage identifier (S3 key or local filename)
 */
async function savePdfToStorage(pdfBuffer, applicationId, type, permitId, timestamp) {
  try {
    const originalName = `${type}_${permitId}_${timestamp}.pdf`;

    const saveOptions = {
      originalName,
      subDirectory: `permits/${applicationId}`,
      prefix: type,
      contentType: 'application/pdf',
      metadata: {
        applicationId: applicationId.toString(),
        permitId: permitId || 'unknown',
        documentType: type,
        generatedAt: new Date().toISOString()
      }
    };

    const result = await storageService.saveFile(pdfBuffer, saveOptions);

    logger.info(`PDF saved to storage: ${result.key || result.fileName}`, {
      applicationId,
      type,
      permitId,
      storageType: result.storageType,
      size: result.size
    });

    // Return the storage identifier (S3 key for S3, filename for local)
    return result.key || result.fileName;
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
exports.generatePermit = async (applicationId) => {
  let browser = null;
  let mainPage = null;
  const timestamp = Date.now();
  const errorScreenshotPath = path.join(LOG_STORAGE_DIR, `error_${applicationId}_${timestamp}.png`);

  try {
    // Ensure storage directories exist using configurable paths
    await StorageUtils.ensureDirectory(PDF_STORAGE_DIR);
    await StorageUtils.ensureDirectory(LOG_STORAGE_DIR);
    await StorageUtils.ensureDirectory(SCREENSHOT_DIR);

    // Fetch application data
    const appData = await fetchApplicationData(applicationId);

    // Check if status is correct for proceeding
    if (appData.status !== 'PAYMENT_RECEIVED' && appData.status !== 'GENERATING_PERMIT') {
      logger.warn(`Application ${applicationId} has status ${appData.status}, expected PAYMENT_RECEIVED or GENERATING_PERMIT. Aborting.`);
      return;
    }

    // Update status to indicate processing has started (if not already set)
    if (appData.status !== 'GENERATING_PERMIT') {
      await applicationRepository.updatePuppeteerStatus(applicationId, 'GENERATING_PERMIT', {
        queue_status: 'processing',
        queue_started_at: new Date()
      });
    }

    // Launch browser with platform detection
    await applicationRepository.updateGenerationProgress(applicationId, 'browser_launch', 'started');
    browser = await launchBrowserWithPlatformDetection();
    mainPage = await browser.newPage();
    await setupPage(mainPage);
    await applicationRepository.updateGenerationProgress(applicationId, 'browser_launch', 'completed');

    // Login to government portal
    await applicationRepository.updateGenerationProgress(applicationId, 'login', 'started');
    await loginToPortal(mainPage);
    await applicationRepository.updateGenerationProgress(applicationId, 'login', 'completed');

    // Navigate to the permit form
    await navigateToPermitForm(mainPage);

    // Fill the permit form with application data
    await applicationRepository.updateGenerationProgress(applicationId, 'form_fill', 'started');
    await fillPermitForm(mainPage, appData);
    await applicationRepository.updateGenerationProgress(applicationId, 'form_fill', 'completed');

    // Submit the form and get the resulting permit page URL
    await applicationRepository.updateGenerationProgress(applicationId, 'form_submit', 'started');
    const detailsPageUrl = await handleFormSubmission(mainPage);
    logger.info(`Form submitted successfully. Details page URL: ${detailsPageUrl}`);
    await applicationRepository.updateGenerationProgress(applicationId, 'form_submit', 'completed');

    // Create permit data from application data (not extracting from page)
    const permitData = {
      folio: `HTZ-${applicationId}`,
      importe: appData.importe || 99.00,
      fechaExpedicion: new Date().toISOString().split('T')[0],
      fechaVencimiento: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0]
    };
    logger.info('Using application data for permit:', permitData);

    // Find PDF links on the details page (excluding recibo)
    const pdfLinks = await findPdfLinks(mainPage, detailsPageUrl);

    // Get session cookies for authenticated downloads
    const cookies = await mainPage.cookies();
    logger.info(`Captured ${cookies.length} cookies for authenticated downloads`);

    // Download all PDF files (except recibo)
    await applicationRepository.updateGenerationProgress(applicationId, 'pdf_download', 'started');
    const pdfFilePaths = await downloadPermitPdfs(mainPage, pdfLinks, cookies, applicationId);
    await applicationRepository.updateGenerationProgress(applicationId, 'pdf_download', 'completed');

    // Update the application with permit data and file paths
    await updateApplicationWithPermitData(applicationId, permitData, pdfFilePaths);

    logger.info(`Permit generation completed successfully for application ${applicationId}`);

  } catch (error) {
    logger.error(`Error generating permit for application ${applicationId}:`, error);
    await handlePuppeteerError(error, mainPage, errorScreenshotPath, applicationId);
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
 * Launch browser with platform detection
 */
async function launchBrowserWithPlatformDetection() {
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
      // Windows paths for Chrome/Chromium/Edge - dynamic detection
      const windowsPaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        // Additional Windows paths for broader compatibility
        process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Google\\Chrome\\Application\\chrome.exe') : null,
        process.env.PROGRAMFILES ? path.join(process.env.PROGRAMFILES, 'Google\\Chrome\\Application\\chrome.exe') : null
      ].filter(Boolean); // Remove null values
      
      // Find first existing path
      for (const path of windowsPaths) {
        if (fsSync.existsSync(path)) {
          executablePath = path;
          logger.info(`Found Windows browser at: ${executablePath}`);
          break;
        }
      }
    } else {
      // Linux/Unix/Mac paths for Chrome/Chromium - optimized for EC2
      const unixPaths = [
        '/usr/bin/google-chrome',           // Most common on Ubuntu/Debian
        '/usr/bin/google-chrome-stable',    // Alternative stable version
        '/usr/bin/chromium-browser',        // Ubuntu/Debian Chromium
        '/usr/bin/chromium',                // Generic Chromium
        '/opt/google/chrome/chrome',        // Custom installations
        '/snap/bin/chromium',               // Snap package
        '/usr/local/bin/chrome',            // Manual installations
        '/usr/local/bin/chromium',          // Manual Chromium
        '/opt/chrome/chrome',               // Docker/container installations
        '/usr/bin/google-chrome-unstable',  // Development versions
        '/usr/bin/chromium-browser-dev',    // Development Chromium
        // macOS paths (if running on Mac)
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium'
      ];
      
      // Find first existing path
      for (const path of unixPaths) {
        if (fsSync.existsSync(path)) {
          executablePath = path;
          logger.info(`Found ${platform} browser at: ${executablePath}`);
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
        
        For Alpine Linux (Docker):
        apk add --no-cache chromium
        
        Alternative (Chromium):
        sudo apt-get install -y chromium-browser
        
        For Docker/Container environments, consider using:
        - google/chrome:latest image
        - browserless/chrome image`;
    }
    
    const errorMessage = `No Chrome/Chromium browser found on ${platformName}. 
    
${installInstructions}

Alternatively, set the PUPPETEER_EXECUTABLE_PATH environment variable to point to your browser executable.

Searched paths: ${platform === 'win32' ? 'Windows program files directories' : 'Common Linux/Unix browser locations'}`;
    
    logger.error(errorMessage);
    throw new Error(errorMessage);
  }
  
  // Final validation that the executable exists and is accessible
  try {
    const stats = fsSync.statSync(executablePath);
    if (!stats.isFile()) {
      throw new Error(`Browser executable path is not a file: ${executablePath}`);
    }
  } catch (error) {
    const errorMessage = `Browser executable not accessible: ${executablePath}. Error: ${error.message}`;
    logger.error(errorMessage);
    throw new Error(errorMessage);
  }
  
  logger.info(`Using browser executable: ${executablePath}`);
  
  // Log detailed browser information for debugging
  try {
    const stats = fsSync.statSync(executablePath);
    logger.info(`Browser executable details: size=${stats.size} bytes, modified=${stats.mtime.toISOString()}`);
    
    // Try to get Chrome version if possible (Linux/Mac only)
    if (platform !== 'win32') {
      try {
        const { execSync } = require('child_process');
        const version = execSync(`"${executablePath}" --version`, { timeout: 5000, encoding: 'utf8' }).trim();
        logger.info(`Browser version: ${version}`);
      } catch (versionError) {
        logger.debug('Could not determine browser version:', versionError.message);
      }
    }
  } catch (statsError) {
    logger.warn('Could not get browser executable stats:', statsError.message);
  }
  
  // Launch browser with platform-optimized arguments
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
    
    logger.info('Applied EC2/Linux-optimized Chrome arguments for better stability');
  }
  
  const browser = await puppeteer.launch({
    executablePath,
    args: launchArgs,
    headless: true,
    defaultViewport: { width: 1366, height: 768 },
    timeout: 30000 // 30 seconds for browser launch
  });

  return browser;
}

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

/**
 * Set up page configuration
 */
async function setupPage(page) {
  await page.setViewport({ width: 1366, height: 768 });
  page.setDefaultNavigationTimeout(30000); // 30 seconds default
  logger.info('Page setup complete');
}

/**
 * Log in to the government portal
 */
async function loginToPortal(page) {
  const GOVT_URLS = getGovtUrls();
  logger.info(`Navigating to login page: ${GOVT_URLS.login}`);

  try {
    await page.goto(GOVT_URLS.login, { 
      waitUntil: ['load', 'networkidle0'], 
      timeout: 30000 
    });

    // Wait for login form elements
    const usernameSelector = 'input[name="email"]';
    const passwordSelector = 'input[name="password"]';
    const loginButtonSelector = 'button.login100-form-btn';

    await page.waitForSelector(usernameSelector, { visible: true, timeout: 15000 });
    await page.waitForSelector(passwordSelector, { visible: true, timeout: 15000 });

    // Enter credentials
    logger.info('Entering credentials...');
    const config = getConfig();
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
    const GOVT_URLS = getGovtUrls();
    await page.goto(GOVT_URLS.createPermit, {
      waitUntil: ['load', 'networkidle0'],
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
    const formFields = [
      { name: 'marca', value: appData.marca },
      { name: 'linea', value: appData.linea },
      { name: 'modelo', value: appData.ano_modelo.toString() },
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
        const selector = `[name="${field.name}"]`;
        await page.waitForSelector(selector, { visible: true, timeout: 5000 });
        await page.type(selector, field.value);
        await new Promise(r => setTimeout(r, 100)); // Short pause
      } catch (fieldError) {
        logger.warn(`Could not fill field ${field.name}: ${fieldError.message}`);
      }
    }

    // Handle the importe field separately
    try {
      const importeSelector = '[name="importe"]';
      await page.waitForSelector(importeSelector, { visible: true, timeout: 5000 });

      const importeValue = appData.importe ? appData.importe.toString() : '99.00';
      logger.info(`Setting importe field to: ${importeValue}`);

      // Clear and type the value
      await page.$eval(importeSelector, el => el.value = '');
      await page.type(importeSelector, importeValue);
    } catch (importeError) {
      logger.warn(`Could not fill importe field: ${importeError.message}`);
      // Try JavaScript fallback
      try {
        await page.$eval('[name="importe"]', (input, value) => input.value = value, '99.00');
        logger.info('Set importe field using JavaScript fallback');
      } catch (jsError) {
        logger.warn(`JavaScript fallback for importe also failed: ${jsError.message}`);
      }
    }

    // Check fecha_expedicion field
    try {
      const fechaSelector = '[name="fecha_expedicion"]';
      const fechaExists = await page.$(fechaSelector);
      if (fechaExists) {
        const fechaValue = await page.$eval(fechaSelector, el => el.value);
        if (!fechaValue || fechaValue.trim() === '') {
          const today = new Date();
          const formattedDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;
          await page.$eval(fechaSelector, (input, value) => input.value = value, formattedDate);
          logger.info(`Set fecha_expedicion to: ${formattedDate}`);
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
    // Try to find the submit button
    logger.info('Looking for submit button with selector: input#btn_save');
    let submitButton = await page.$('input#btn_save');

    // If not found, try alternative selectors
    if (!submitButton) {
      logger.warn('Could not find input#btn_save, trying alternative selectors');

      const submitSelectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        '.btn-primary',
        'button.guardar',
        'input.guardar'
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
    }

    // If still no button found, try to submit the form directly
    if (!submitButton) {
      logger.warn('Could not find submit button, trying to submit form directly');
      await page.evaluate(() => {
        const form = document.querySelector('form[action*="/panel/digitales"]');
        if (form) form.submit();
      });

      await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 });
    } else {
      // Click the submit button
      logger.info('Clicking submit button...');
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }),
        submitButton.click()
      ]);
    }

    // Get the resulting URL (contains the permit ID)
    const currentUrl = page.url();
    logger.info(`Form submitted successfully. Redirected to: ${currentUrl}`);

    return currentUrl;

  } catch (error) {
    logger.error('Form submission failed:', error);
    throw new Error(`Form submission failed: ${error.message}`);
  }
}

/**
 * Find PDF links on the details page (excluding recibo)
 */
async function findPdfLinks(page, detailsPageUrl) {
  logger.info(`Finding PDF links on page: ${detailsPageUrl}`);

  const pdfLinks = {
    permiso: null,
    certificado: null,
    placas: null
  };

  try {
    // Selectors for each type of PDF
    const selectors = {
      permiso: 'a[href$="/formato-pdf"]',
      certificado: 'a[href$="/certificacion-pdf"]',
      placas: 'a[href$="/placas-en-proceso-pdf"]'
    };

    // Text patterns to look for in links
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

    // If still missing links, try to construct them from the details page URL
    const permitId = extractPermitIdFromUrl(detailsPageUrl);

    if (permitId && Object.values(pdfLinks).some(link => !link)) {
      logger.info('Constructing missing PDF links based on permit ID...');

      const GOVT_URLS = getGovtUrls();
      const baseUrl = `${GOVT_URLS.baseUrl}/panel/digitales/`;
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
    const client = url.startsWith('https') ? https : http;

    // Format cookies for HTTP header
    let cookieHeader = '';
    if (cookies && cookies.length > 0) {
      cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    }

    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/pdf,*/*',
        'Cookie': cookieHeader
      }
    };

    logger.info(`Starting download from: ${url}`);

    const req = client.get(url, options, (res) => {
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        logger.info(`Following redirect to: ${res.headers.location}`);
        return downloadFileAsBuffer(res.headers.location, cookies).then(resolve).catch(reject);
      }

      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to download file, status code: ${res.statusCode}`));
      }

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
            size: buffer.length
          });
        }
      });

      res.on('error', (err) => {
        reject(new Error(`Response error: ${err.message}`));
      });
    });

    req.on('error', (err) => {
      reject(new Error(`Request error: ${err.message}`));
    });

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
    logger.info(`Navigating to PDF URL: ${pdfUrl}`);
    await page.goto(pdfUrl, { waitUntil: 'networkidle0', timeout: 20000 });

    // Use PDF printing functionality of browser to get buffer
    logger.info('Using browser PDF functionality');
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true
    });

    logger.info(`PDF generated via browser (${pdfBuffer.length} bytes)`);

    return {
      buffer: pdfBuffer,
      size: pdfBuffer.length
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

          const timestamp = Date.now();
          const permitId = extractPermitIdFromUrl(pdfLinks[type]) || 'unknown';
          let pdfBuffer = null;

          try {
            // Try direct HTTP download first
            logger.info(`Attempting direct HTTP download with cookies for ${type}`);
            const result = await downloadFileAsBuffer(pdfLinks[type], cookies);
            pdfBuffer = result.buffer;
            logger.info(`Successfully downloaded ${type} PDF via HTTP (${result.size} bytes)`);
          } catch (httpError) {
            logger.warn(`Direct HTTP download failed for ${type}, error: ${httpError.message}`);

            // Fall back to browser-based download
            logger.info(`Falling back to browser-based download for ${type}`);
            const browserResult = await downloadPDFWithPage(page, pdfLinks[type]);
            pdfBuffer = browserResult.buffer;
            logger.info(`Successfully downloaded ${type} PDF via browser (${browserResult.size} bytes)`);
          }

          // Save PDF to storage
          if (pdfBuffer) {
            const storageIdentifier = await savePdfToStorage(pdfBuffer, applicationId, type, permitId, timestamp);
            pdfFilePaths[type] = storageIdentifier;
            logger.info(`Saved ${type} PDF to storage: ${storageIdentifier}`);
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
    // Use the repository method to update permit data
    const success = await applicationRepository.updatePermitGenerated(applicationId, {
      permit_file_path: pdfFilePaths.permiso,
      certificado_file_path: pdfFilePaths.certificado,
      placas_file_path: pdfFilePaths.placas,
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
    
    return { id: applicationId, status: 'PERMIT_READY' };
  } catch (error) {
    logger.error(`Failed to update application ${applicationId} with permit data:`, error);
    throw new Error(`Database update failed: ${error.message}`);
  }
}

/**
 * Handle Puppeteer errors
 */
async function handlePuppeteerError(error, page, errorScreenshotPath, applicationId) {
  try {
    // Take a screenshot if the page is available
    if (page && !page.isClosed()) {
      try {
        await page.screenshot({ path: errorScreenshotPath, fullPage: true });
        logger.info(`Error screenshot saved to ${errorScreenshotPath}`);
        
        // Save screenshot path to database using repository
        await applicationRepository.savePuppeteerScreenshot(applicationId, errorScreenshotPath, error.message);
      } catch (screenshotError) {
        logger.error('Failed to take error screenshot:', screenshotError);
      }
    }

    // Update application status to error
    if (applicationId) {
      try {
        // Update status using repository method
        await applicationRepository.updatePuppeteerError(applicationId, {
          error_message: error.message,
          error_at: new Date(),
          screenshot_path: errorScreenshotPath,
          status: 'ERROR_GENERATING_PERMIT'
        });
        logger.info(`Updated application ${applicationId} status to ERROR_GENERATING_PERMIT`);
        
        // Track permit failure metric
        metricsCollector.recordPermitFailed();

        // Update generation progress to failed
        await applicationRepository.updateGenerationProgress(applicationId, 'error', 'failed');

        // Send alert to admins
        try {
          const alertService = require('../services/alert.service');
          await alertService.sendAlert({
            title: 'Permit Generation Failed',
            message: `Failed to generate permit for application ${applicationId}`,
            severity: 'HIGH',
            details: {
              applicationId,
              error: error.message,
              screenshot: errorScreenshotPath
            }
          });
        } catch (alertError) {
          logger.error('Failed to send alert:', alertError);
        }
      } catch (dbError) {
        logger.error(`Failed to update application ${applicationId} status to error:`, dbError);
      }
    }
  } catch (handlerError) {
    logger.error('Error in error handler:', handlerError);
  }
}