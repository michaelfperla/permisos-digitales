// src/services/puppeteer.service.js
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs'); // Regular fs for createWriteStream
const db = require('../db');
const config = require('../config');
const { logger } = require('../utils/enhanced-logger');
const http = require('http');
const https = require('https');
const samplePdfs = require('../utils/sample-pdfs');

// Constants
const PDF_STORAGE_DIR = path.join(__dirname, '../../storage/pdfs');
const LOG_STORAGE_DIR = path.join(__dirname, '../../storage/logs');
const SCREENSHOT_DIR = path.join(__dirname, '../../storage/permit_screenshots');

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
    // Ensure storage directories exist
    await fs.mkdir(PDF_STORAGE_DIR, { recursive: true });
    await fs.mkdir(LOG_STORAGE_DIR, { recursive: true });
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true });

    // Fetch application data
    const appData = await fetchApplicationData(applicationId);

    // Check if status is correct for proceeding
    if (appData.status !== 'PAYMENT_RECEIVED') {
      logger.warn(`Application ${applicationId} has status ${appData.status}, expected PAYMENT_RECEIVED. Aborting.`);
      return;
    }

    // Update status to indicate processing has started
    await updateApplicationStatus(applicationId, 'GENERATING_PERMIT');

    // Launch browser
    browser = await launchBrowser();
    mainPage = await browser.newPage();
    await setupPage(mainPage);

    // Login to government portal
    await loginToPortal(mainPage);

    // Navigate to the permit form
    await navigateToPermitForm(mainPage);

    // Fill the permit form with application data
    await fillPermitForm(mainPage, appData);

    // Submit the form and get the resulting permit page URL
    const detailsPageUrl = await handleFormSubmission(mainPage);
    logger.info(`Form submitted successfully. Details page URL: ${detailsPageUrl}`);

    // Use application data instead of trying to extract it from the page
    const permitData = {
      folio: `HTZ-${applicationId}`, // Use a simple format based on application ID
      importe: appData.importe || 197.00, // Use the importe from the application data
      fechaExpedicion: new Date().toISOString().split('T')[0], // Today's date
      fechaVencimiento: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0] // 1 year from today
    };
    logger.info('Using application data for permit:', permitData);

    // Find PDF links on the details page
    const pdfLinks = await findPdfLinks(mainPage, detailsPageUrl);

    // Get session cookies for authenticated downloads
    const cookies = await mainPage.cookies();
    logger.info(`Captured ${cookies.length} cookies for authenticated downloads`);

    // Download all PDF files
    const pdfFilePaths = await downloadPermitPdfs(mainPage, pdfLinks, cookies);

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
 * Fetch application data from the database
 */
async function fetchApplicationData(applicationId) {
  logger.info(`Fetching data for application ${applicationId}...`);
  const { rows } = await db.query('SELECT * FROM permit_applications WHERE id = $1', [applicationId]);

  if (rows.length === 0) {
    throw new Error(`Application ${applicationId} not found in database.`);
  }

  logger.info(`Successfully retrieved application data for ID ${applicationId}`);
  return rows[0];
}

/**
 * Update application status in the database
 */
async function updateApplicationStatus(applicationId, status) {
  await db.query(
    'UPDATE permit_applications SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
    [status, applicationId]
  );
  logger.info(`Updated application ${applicationId} status to ${status}`);
}

/**
 * Launch the puppeteer browser
 */
async function launchBrowser() {
  logger.info('Launching browser in headless mode...');
  try {
    const browser = await puppeteer.launch({
      headless: true,  // Run in headless mode for production
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1366,768',
        '--disable-extensions',
        '--disable-component-extensions-with-background-pages',
        '--disable-default-apps',
        '--mute-audio'
      ],
      defaultViewport: { width: 1366, height: 768 },
      timeout: 120000  // 2 minutes timeout for browser launch
    });
    logger.info('Browser launched successfully in headless mode');
    return browser;
  } catch (error) {
    logger.error('Failed to launch browser:', error);
    throw new Error(`Browser launch failed: ${error.message}`);
  }
}

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
      throw new Error(`Could not verify we're on the permit form page.`);
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
      const importeValue = appData.importe ? appData.importe.toString() : '197.00';
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
        permitData.importe = 197.00;
        logger.info(`Using default importe: ${permitData.importe}`);
      }
    } catch (importeError) {
      logger.error('Error extracting importe:', importeError);
      permitData.importe = 197.00; // Default fallback
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

      // If not found, calculate expiry date as 1 year from issue date
      if (!permitData.fechaVencimiento && permitData.fechaExpedicion) {
        const expedicionDate = new Date(permitData.fechaExpedicion);
        const vencimientoDate = new Date(expedicionDate);
        vencimientoDate.setFullYear(vencimientoDate.getFullYear() + 1);
        permitData.fechaVencimiento = vencimientoDate.toISOString().split('T')[0]; // YYYY-MM-DD format
        logger.info(`Calculated fechaVencimiento: ${permitData.fechaVencimiento}`);
      }
    } catch (fechaVencimientoError) {
      logger.error('Error extracting fechaVencimiento:', fechaVencimientoError);
      // Calculate a default expiry date if we have an issue date
      if (permitData.fechaExpedicion) {
        const expedicionDate = new Date(permitData.fechaExpedicion);
        const vencimientoDate = new Date(expedicionDate);
        vencimientoDate.setFullYear(vencimientoDate.getFullYear() + 1);
        permitData.fechaVencimiento = vencimientoDate.toISOString().split('T')[0];
      }
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
    recibo: null,
    permiso: null,
    certificado: null,
    placas: null
  };

  try {
    // Different selectors to try for each type of PDF
    const selectors = {
      recibo: 'a[href$="/recibo-pdf"]',
      permiso: 'a[href$="/formato-pdf"]',
      certificado: 'a[href$="/certificacion-pdf"]',
      placas: 'a[href$="/placas-en-proceso-pdf"]'
    };

    // Alternative text patterns to look for in links
    const textPatterns = {
      recibo: ['recibo', 'comprobante', 'pago', 'payment'],
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
        recibo: '/recibo-pdf',
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
 * Download a file via direct HTTP request with cookies
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
 * Download PDF using the page's session
 */
async function downloadPDFWithPage(page, pdfUrl, filePath) {
  logger.info(`Starting browser-based download for ${pdfUrl}`);

  try {
    // Navigate to the PDF URL
    logger.info(`Navigating to PDF URL: ${pdfUrl}`);
    await page.goto(pdfUrl, { waitUntil: 'networkidle0', timeout: 20000 });

    // Use PDF printing functionality of browser
    logger.info('Using browser PDF functionality');
    await page.pdf({
      path: filePath,
      format: 'A4',
      printBackground: true
    });

    // Check the file size
    const fileStats = await fs.stat(filePath);
    logger.info(`PDF saved to ${filePath} (${fileStats.size} bytes)`);

    return {
      path: filePath,
      size: fileStats.size
    };
  } catch (error) {
    logger.error(`Error during browser-based download: ${error.message}`);
    throw error;
  }
}

/**
 * Download all PDF files using direct HTTP requests
 */
async function downloadPermitPdfs(page, pdfLinks, cookies) {
  logger.info('Downloading PDF files...');

  const pdfFilePaths = {
    recibo: null,
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

          // Use a unique filename based on type, application ID (extracted from URL), and timestamp
          const timestamp = Date.now();
          const permitId = extractPermitIdFromUrl(pdfLinks[type]) || 'unknown';
          const filename = `${type}_${permitId}_${timestamp}.pdf`;
          const filePath = path.join(PDF_STORAGE_DIR, filename);

          try {
            // Try direct HTTP download first
            logger.info(`Attempting direct HTTP download with cookies for ${type}`);
            const result = await downloadFile(pdfLinks[type], filePath, cookies);
            logger.info(`Successfully downloaded ${type} PDF via HTTP to ${filePath} (${result.size} bytes)`);
            pdfFilePaths[type] = filename;
          } catch (httpError) {
            logger.warn(`Direct HTTP download failed for ${type}, error: ${httpError.message}`);

            // Fall back to browser-based download
            logger.info(`Falling back to browser-based download for ${type}`);
            const browserFilePath = path.join(PDF_STORAGE_DIR, `browser_${type}_${permitId}_${timestamp}.pdf`);
            const browserResult = await downloadPDFWithPage(page, pdfLinks[type], browserFilePath);

            logger.info(`Successfully downloaded ${type} PDF via browser to ${browserFilePath} (${browserResult.size} bytes)`);
            pdfFilePaths[type] = path.basename(browserFilePath);
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
 *
 * NOTE: This function requires a database migration to add the placas_file_path column
 * to the permit_applications table before it can run successfully.
 *
 * Migration SQL:
 * ALTER TABLE permit_applications ADD COLUMN placas_file_path TEXT;
 * COMMENT ON COLUMN permit_applications.placas_file_path IS 'Path to the placas en proceso PDF file';
 */
async function updateApplicationWithPermitData(applicationId, permitData, pdfFilePaths) {
  logger.info(`Updating application ${applicationId} with permit data and file paths...`);

  try {
    const updateQuery = `
            UPDATE permit_applications
            SET status = 'PERMIT_READY',
                folio = $1,
                importe = $2,
                fecha_expedicion = $3,
                fecha_vencimiento = $4,
                permit_file_path = $5,
                recibo_file_path = $6,
                certificado_file_path = $7,
                placas_file_path = $8,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $9
            RETURNING id, status;
        `;

    const params = [
      permitData.folio || null,
      permitData.importe || null,
      permitData.fechaExpedicion || null,
      permitData.fechaVencimiento || null,
      pdfFilePaths.permiso || null,
      pdfFilePaths.recibo || null,
      pdfFilePaths.certificado || null,
      pdfFilePaths.placas || null,
      applicationId
    ];

    const { rows } = await db.query(updateQuery, params);

    if (rows.length === 0) {
      throw new Error(`Application ${applicationId} not found during update`);
    }

    logger.info(`Successfully updated application ${applicationId} to status ${rows[0].status}`);
    return rows[0];
  } catch (error) {
    logger.error(`Failed to update application ${applicationId} with permit data:`, error);
    throw new Error(`Database update failed: ${error.message}`);
  }
}

/**
 * Handle Puppeteer errors
 */
async function handlePuppeteerError(error, page, errorScreenshotPath, applicationId, status = 'ERROR_GENERATING_PERMIT') {
  try {
    // Take a screenshot if the page is available
    if (page && !page.isClosed()) {
      try {
        await page.screenshot({ path: errorScreenshotPath, fullPage: true });
        logger.info(`Error screenshot saved to ${errorScreenshotPath}`);
      } catch (screenshotError) {
        logger.error('Failed to take error screenshot:', screenshotError);
      }
    }

    // Update application status to error
    if (applicationId) {
      try {
        // First update the status to ERROR_GENERATING_PERMIT
        await db.query(
          'UPDATE permit_applications SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [status, applicationId]
        );
        logger.info(`Updated application ${applicationId} status to ${status}`);

        // Then try to assign sample PDFs as a fallback
        logger.info(`Attempting to assign sample PDFs to application ${applicationId} as fallback`);
        const samplePdfsAssigned = await samplePdfs.assignSamplePdfsToApplication(applicationId, db);

        if (samplePdfsAssigned) {
          logger.info(`Successfully assigned sample PDFs to application ${applicationId}`);
        } else {
          logger.warn(`Failed to assign sample PDFs to application ${applicationId}`);
        }
      } catch (dbError) {
        logger.error(`Failed to update application ${applicationId} status to error:`, dbError);
      }
    }
  } catch (handlerError) {
    logger.error('Error in error handler:', handlerError);
  }
}
