/**
 * Jest configuration for Permisos Digitales
 */
module.exports = {
  // The test environment that will be used for testing
  testEnvironment: 'node',

  // The root directory that Jest should scan for tests and modules
  rootDir: '.',

  // A list of paths to directories that Jest should use to search for files in
  roots: ['<rootDir>/src'],

  // The glob patterns Jest uses to detect test files
  testMatch: [
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js'
  ],

  // An array of regexp pattern strings that are matched against all test paths
  // matched tests are skipped
  testPathIgnorePatterns: [
    '/node_modules/'
  ],

  // An array of regexp pattern strings that are matched against all source file paths
  // matched files will skip transformation
  transformIgnorePatterns: [
    '/node_modules/'
  ],

  // Indicates whether each individual test should be reported during the run
  verbose: true,

  // Automatically clear mock calls and instances between every test
  clearMocks: true,

  // The directory where Jest should output its coverage files
  coverageDirectory: 'coverage',

  // An array of regexp pattern strings used to skip coverage collection
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/tests/',
    '/__tests__/'
  ],

  // Indicates which provider should be used to instrument code for coverage
  coverageProvider: 'v8',

  // A list of reporter names that Jest uses when writing coverage reports
  coverageReporters: [
    'json',
    'text',
    'lcov',
    'clover'
  ],

  // The glob patterns Jest uses to detect coverage files
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/tests/**',
    '!src/__tests__/**',
    '!**/node_modules/**'
  ],

  // Setup files that will be run before each test
  setupFilesAfterEnv: ['<rootDir>/src/tests/setup.js'],

  // A map from regular expressions to module names or to arrays of module names
  // that allow to stub out resources with a single module
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },

  // The maximum amount of workers used to run your tests
  maxWorkers: '50%',

  // An array of regexp pattern strings that are matched against all modules
  // before the module loader will automatically return a mock for them
  modulePathIgnorePatterns: [],

  // Activates notifications for test results
  notify: false,

  // An enum that specifies notification mode
  notifyMode: 'failure-change',

  // A preset that is used as a base for Jest's configuration
  preset: null,

  // Run tests from one or more projects
  projects: null,

  // Use this configuration option to add custom reporters to Jest
  reporters: ['default'],

  // Reset the module registry before running each individual test
  resetModules: false,

  // A path to a custom resolver
  resolver: null,

  // Automatically restore mock state between every test
  restoreMocks: false,

  // A list of paths to modules that run some code to configure or set up the testing framework
  setupFiles: [],

  // The test environment that will be used for testing
  testEnvironment: 'node',

  // Options that will be passed to the testEnvironment
  testEnvironmentOptions: {},

  // This option allows the use of a custom results processor
  testResultsProcessor: null,

  // This option allows use of a custom test runner
  testRunner: 'jest-circus/runner',

  // A map from regular expressions to paths to transformers
  transform: {},

  // An array of regexp pattern strings that are matched against all modules
  // before the module loader will automatically return a mock for them
  unmockedModulePathPatterns: [],

  // Indicates whether each individual test should be reported during the run
  verbose: true,

  // An array of regexp patterns that are matched against all source file paths
  // before re-running tests in watch mode
  watchPathIgnorePatterns: [],

  // Whether to use watchman for file crawling
  watchman: true,
};
