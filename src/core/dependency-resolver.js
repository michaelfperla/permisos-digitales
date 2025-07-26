/**
 * Permisos Digitales Dependency Resolver
 * 
 * Resolves service initialization order based on dependencies
 * Provides topological sorting for dependency injection
 */

const { logger } = require('../utils/logger');

class PermisosDependencyResolver {
  constructor() {
    this.maxDepth = 10; // Maximum dependency depth to prevent infinite loops
  }

  /**
   * Resolve initialization order for services based on dependencies
   * @param {Map} services - Map of service definitions
   * @returns {string[]} Array of service names in initialization order
   */
  resolveInitializationOrder(services) {
    const serviceArray = Array.from(services.values());
    const sorted = this.topologicalSort(serviceArray);
    
    logger.debug('[DependencyResolver] Resolved initialization order:', {
      order: sorted.map(s => s.name || s),
      totalServices: sorted.length
    });
    
    return sorted.map(s => s.name || s);
  }

  /**
   * Perform topological sort on services
   * @param {Array} services - Array of service definitions
   * @returns {Array} Sorted array of services
   */
  topologicalSort(services) {
    const visited = new Set();
    const visiting = new Set();
    const result = [];

    const visit = (service) => {
      const serviceName = service.name || service;
      
      if (visited.has(serviceName)) {
        return;
      }
      
      if (visiting.has(serviceName)) {
        throw new Error(`Circular dependency detected involving service: ${serviceName}`);
      }

      visiting.add(serviceName);

      // Visit dependencies first
      const dependencies = service.dependencies || [];
      for (const depName of dependencies) {
        const depService = services.find(s => (s.name || s) === depName);
        if (depService) {
          visit(depService);
        } else {
          logger.warn(`[DependencyResolver] Dependency ${depName} not found for service ${serviceName}`);
        }
      }

      visiting.delete(serviceName);
      visited.add(serviceName);
      result.push(service);
    };

    // Sort by priority first (lower number = higher priority)
    const sortedByPriority = services.sort((a, b) => {
      const priorityA = a.priority || 100;
      const priorityB = b.priority || 100;
      return priorityA - priorityB;
    });

    // Visit all services
    for (const service of sortedByPriority) {
      visit(service);
    }

    return result;
  }

  /**
   * Validate that dependencies exist and don't create circular references
   * @param {string} serviceName - Name of the service to validate
   * @param {Array} dependencies - Array of dependency names
   * @param {Map} allServices - Map of all registered services
   */
  validateDependencies(serviceName, dependencies, allServices) {
    // Check for self-dependency
    if (dependencies.includes(serviceName)) {
      throw new Error(`Service ${serviceName} cannot depend on itself`);
    }

    // Check that all dependencies exist or will exist
    for (const depName of dependencies) {
      if (!allServices.has(depName)) {
        logger.warn(`[DependencyResolver] Dependency ${depName} for service ${serviceName} is not registered`);
      }
    }

    // Check for circular dependencies
    this.checkCircularDependencies(serviceName, dependencies, allServices);
  }

  /**
   * Check for circular dependencies
   * @private
   */
  checkCircularDependencies(serviceName, dependencies, allServices, visited = new Set(), depth = 0) {
    if (depth > this.maxDepth) {
      throw new Error(`Maximum dependency depth exceeded for service ${serviceName}`);
    }

    if (visited.has(serviceName)) {
      throw new Error(`Circular dependency detected: ${Array.from(visited).join(' -> ')} -> ${serviceName}`);
    }

    visited.add(serviceName);

    for (const depName of dependencies) {
      const depService = allServices.get(depName);
      if (depService && depService.dependencies) {
        this.checkCircularDependencies(depName, depService.dependencies, allServices, new Set(visited), depth + 1);
      }
    }

    visited.delete(serviceName);
  }

  /**
   * Get dependency graph for visualization/debugging
   * @param {Map} services - Map of service definitions
   * @returns {Object} Dependency graph
   */
  getDependencyGraph(services) {
    const graph = {};
    
    for (const [name, service] of services) {
      graph[name] = {
        dependencies: service.dependencies || [],
        dependents: []
      };
    }

    // Add dependents (reverse dependencies)
    for (const [name, service] of services) {
      for (const depName of service.dependencies || []) {
        if (graph[depName]) {
          graph[depName].dependents.push(name);
        }
      }
    }

    return graph;
  }
}

module.exports = PermisosDependencyResolver;