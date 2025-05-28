#!/usr/bin/env node

/**
 * Comprehensive Code Audit Script
 * 
 * This script performs automated analysis to identify:
 * - Dead code and unused files
 * - Unused dependencies
 * - Deprecated features
 * - Unused CSS classes
 * - Unused routes and API endpoints
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function section(title) {
  log(`\n${'='.repeat(60)}`, 'cyan');
  log(`${title}`, 'bold');
  log(`${'='.repeat(60)}`, 'cyan');
}

function subsection(title) {
  log(`\n${'-'.repeat(40)}`, 'blue');
  log(`${title}`, 'blue');
  log(`${'-'.repeat(40)}`, 'blue');
}

async function runCommand(command, cwd = process.cwd()) {
  try {
    const output = execSync(command, { 
      cwd, 
      encoding: 'utf8',
      stdio: 'pipe'
    });
    return output.trim();
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

function findFiles(dir, pattern, exclude = []) {
  const files = [];
  
  function walk(currentDir) {
    const items = fs.readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        if (!exclude.some(ex => fullPath.includes(ex))) {
          walk(fullPath);
        }
      } else if (pattern.test(item)) {
        files.push(fullPath);
      }
    }
  }
  
  walk(dir);
  return files;
}

function searchInFiles(files, searchPattern) {
  const results = [];
  
  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      const matches = content.match(searchPattern);
      if (matches) {
        results.push({
          file,
          matches: matches.length,
          lines: content.split('\n').map((line, index) => ({
            number: index + 1,
            content: line,
            hasMatch: searchPattern.test(line)
          })).filter(line => line.hasMatch)
        });
      }
    } catch (error) {
      // Skip files that can't be read
    }
  }
  
  return results;
}

async function analyzeUnusedDependencies() {
  section('DEPENDENCY ANALYSIS');
  
  // Frontend dependencies
  subsection('Frontend Dependencies');
  log('Analyzing frontend dependencies...', 'yellow');
  
  const frontendDepcheck = await runCommand('npx depcheck --json', './frontend');
  try {
    const frontendResults = JSON.parse(frontendDepcheck);
    
    if (frontendResults.dependencies && frontendResults.dependencies.length > 0) {
      log('Unused dependencies:', 'red');
      frontendResults.dependencies.forEach(dep => log(`  - ${dep}`, 'red'));
    } else {
      log('No unused dependencies found', 'green');
    }
    
    if (frontendResults.devDependencies && frontendResults.devDependencies.length > 0) {
      log('Unused devDependencies:', 'yellow');
      frontendResults.devDependencies.forEach(dep => log(`  - ${dep}`, 'yellow'));
    }
  } catch (error) {
    log(`Error parsing frontend depcheck results: ${error.message}`, 'red');
  }
  
  // Backend dependencies
  subsection('Backend Dependencies');
  log('Analyzing backend dependencies...', 'yellow');
  
  const backendDepcheck = await runCommand('npx depcheck --json');
  try {
    const backendResults = JSON.parse(backendDepcheck);
    
    if (backendResults.dependencies && backendResults.dependencies.length > 0) {
      log('Unused dependencies:', 'red');
      backendResults.dependencies.forEach(dep => log(`  - ${dep}`, 'red'));
    } else {
      log('No unused dependencies found', 'green');
    }
  } catch (error) {
    log(`Error parsing backend depcheck results: ${error.message}`, 'red');
  }
}

async function analyzeDeprecatedFeatures() {
  section('DEPRECATED FEATURES ANALYSIS');
  
  const deprecatedFeatures = [
    'HeroPermitCard',
    'PermitsOverview', 
    'TodaysFocus',
    'GuidanceCenter',
    'Mis Documentos',
    'payment_verification_log',
    'payment_proof_uploaded_at',
    '@chakra-ui',
    '@emotion'
  ];
  
  const searchDirs = ['frontend/src', 'src'];
  
  for (const feature of deprecatedFeatures) {
    subsection(`Searching for: ${feature}`);
    
    for (const dir of searchDirs) {
      if (fs.existsSync(dir)) {
        const files = findFiles(dir, /\.(js|jsx|ts|tsx|css|sql)$/, ['node_modules', 'dist', 'build']);
        const results = searchInFiles(files, new RegExp(feature, 'gi'));
        
        if (results.length > 0) {
          log(`Found ${results.length} files with references to ${feature}:`, 'red');
          results.forEach(result => {
            log(`  ${result.file} (${result.matches} matches)`, 'yellow');
            result.lines.slice(0, 3).forEach(line => {
              log(`    Line ${line.number}: ${line.content.trim()}`, 'gray');
            });
          });
        } else {
          log(`No references to ${feature} found in ${dir}`, 'green');
        }
      }
    }
  }
}

async function analyzeUnusedFiles() {
  section('UNUSED FILES ANALYSIS');
  
  // Frontend unused exports
  subsection('Frontend Unused Exports');
  log('Analyzing unused TypeScript exports...', 'yellow');
  
  const unusedExports = await runCommand('npx ts-unused-exports tsconfig.json --excludePathsFromReport="test;spec;stories"', './frontend');
  if (unusedExports.includes('Error')) {
    log('ts-unused-exports not available or error occurred', 'yellow');
  } else {
    log(unusedExports || 'No unused exports found', unusedExports ? 'red' : 'green');
  }
  
  // Check for unimported files
  subsection('Unimported Files');
  log('Checking for unimported files...', 'yellow');
  
  const unimported = await runCommand('npx unimported', './frontend');
  if (unimported.includes('Error')) {
    log('unimported tool not available or error occurred', 'yellow');
  } else {
    log(unimported || 'No unimported files found', unimported ? 'red' : 'green');
  }
}

async function analyzeUnusedCSS() {
  section('CSS ANALYSIS');
  
  subsection('Deprecated CSS Files');
  const deprecatedCSSFiles = [
    'frontend/src/styles/mobile-touch-targets.css'
  ];
  
  for (const file of deprecatedCSSFiles) {
    if (fs.existsSync(file)) {
      log(`Found deprecated CSS file: ${file}`, 'red');
      
      // Check if it's still imported
      const frontendFiles = findFiles('frontend/src', /\.(js|jsx|ts|tsx)$/, ['node_modules']);
      const imports = searchInFiles(frontendFiles, new RegExp(path.basename(file), 'g'));
      
      if (imports.length > 0) {
        log(`  Still imported in ${imports.length} files`, 'yellow');
        imports.forEach(imp => log(`    ${imp.file}`, 'yellow'));
      } else {
        log(`  Not imported anywhere - safe to remove`, 'green');
      }
    } else {
      log(`Deprecated CSS file already removed: ${file}`, 'green');
    }
  }
  
  subsection('CSS Modules Usage');
  log('Analyzing CSS modules usage...', 'yellow');
  
  const cssModules = findFiles('frontend/src', /\.module\.css$/, ['node_modules']);
  const jsFiles = findFiles('frontend/src', /\.(js|jsx|ts|tsx)$/, ['node_modules']);
  
  for (const cssFile of cssModules) {
    const moduleName = path.basename(cssFile, '.module.css');
    const importPattern = new RegExp(`from.*${moduleName}.*module\.css`, 'g');
    const imports = searchInFiles(jsFiles, importPattern);
    
    if (imports.length === 0) {
      log(`Potentially unused CSS module: ${cssFile}`, 'yellow');
    }
  }
}

async function main() {
  log('Starting Comprehensive Code Audit...', 'bold');
  log(`Audit started at: ${new Date().toISOString()}`, 'cyan');
  
  try {
    await analyzeUnusedDependencies();
    await analyzeDeprecatedFeatures();
    await analyzeUnusedFiles();
    await analyzeUnusedCSS();
    
    section('AUDIT COMPLETE');
    log('Code audit completed successfully!', 'green');
    log('Review the results above and take appropriate action.', 'cyan');
    
  } catch (error) {
    log(`Audit failed with error: ${error.message}`, 'red');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  analyzeUnusedDependencies,
  analyzeDeprecatedFeatures,
  analyzeUnusedFiles,
  analyzeUnusedCSS
};
