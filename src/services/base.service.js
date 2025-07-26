/**
 * Base Service Class
 * Provides common functionality for all services
 */

class BaseService {
  constructor(dependencies = {}) {
    this.dependencies = dependencies;
    this.logger = dependencies.logger || console;
    this.initialized = false;
  }

  async initialize() {
    // Override in subclasses
    this.initialized = true;
  }

  async shutdown() {
    // Override in subclasses
    this.initialized = false;
  }

  isInitialized() {
    return this.initialized;
  }

  getDependency(name) {
    if (!this.dependencies[name]) {
      throw new Error(`Missing dependency: ${name}`);
    }
    return this.dependencies[name];
  }

  log(level, message, meta = {}) {
    if (this.logger[level]) {
      this.logger[level](message, meta);
    }
  }
}

module.exports = BaseService;