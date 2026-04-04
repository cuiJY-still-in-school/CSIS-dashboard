/**
 * Dashboard Event System
 * 
 * Handles event registration and dispatching between dashboard UI and mods.
 * Provides safe execution environment for mod event handlers.
 */

module.exports = class EventSystem {
  constructor(logger) {
    // Ensure logger has all required methods
    this.logger = {
      info: logger.info || ((...args) => console.log(...args)),
      warn: logger.warn || logger.info || ((...args) => console.warn(...args)),
      error: logger.error || logger.info || ((...args) => console.error(...args)),
      debug: logger.debug || logger.info || ((...args) => console.debug(...args))
    };
    this.events = new Map(); // eventId -> { handler, modName, metadata }
    this.eventQueue = [];
    this.processing = false;
  }

  /**
   * Register an event handler
   * @param {string} eventId - Unique event identifier
   * @param {Function} handler - Event handler function
   * @param {Object} metadata - Additional metadata (modName, componentId, etc.)
   */
  registerEvent(eventId, handler, metadata = {}) {
    if (typeof handler !== 'function') {
      throw new Error('Handler must be a function');
    }

    this.events.set(eventId, {
      handler,
      modName: metadata.modName || 'unknown',
      componentId: metadata.componentId || 'unknown',
      createdAt: new Date().toISOString(),
      lastTriggered: null,
      metadata
    });

    if (typeof this.logger.debug === 'function') {
      this.logger.debug(`Event registered: ${eventId} (mod: ${metadata.modName || 'unknown'})`);
    }
    return eventId;
  }

  /**
   * Unregister an event handler
   */
  unregisterEvent(eventId) {
    const existed = this.events.delete(eventId);
    if (existed) {
      if (typeof this.logger.debug === 'function') {
        this.logger.debug(`Event unregistered: ${eventId}`);
      }
    }
    return existed;
  }

  /**
   * Unregister all events for a specific mod or component
   */
  unregisterEventsFor(modName = null, componentId = null) {
    let count = 0;
    
    for (const [eventId, event] of this.events.entries()) {
      if ((modName && event.modName === modName) || 
          (componentId && event.componentId === componentId)) {
        this.events.delete(eventId);
        count++;
      }
    }
    
    if (count > 0) {
      if (typeof this.logger.debug === 'function') {
        this.logger.debug(`Unregistered ${count} events for ${modName || componentId}`);
      }
    }
    
    return count;
  }

  /**
   * Trigger an event
   * @param {string} eventId - Event identifier
   * @param {any} data - Event data
   * @param {Object} context - Additional context
   */
  async triggerEvent(eventId, data = {}, context = {}) {
    const event = this.events.get(eventId);
    
    if (!event) {
      this.logger.warn(`Event not found: ${eventId}`);
      return {
        success: false,
        error: 'Event not found',
        eventId
      };
    }

    // Update last triggered timestamp
    event.lastTriggered = new Date().toISOString();
    
    try {
      if (typeof this.logger.debug === 'function') {
        this.logger.debug(`Triggering event: ${eventId} (mod: ${event.modName})`);
      }
      
      // Execute handler with safe context
      const result = await event.handler(data, {
        eventId,
        modName: event.modName,
        componentId: event.componentId,
        timestamp: new Date().toISOString(),
        ...context
      });

      return {
        success: true,
        result,
        eventId,
        modName: event.modName
      };
    } catch (error) {
      this.logger.error(`Event handler error for ${eventId}:`, error.message);
      
      return {
        success: false,
        error: error.message,
        eventId,
        modName: event.modName
      };
    }
  }

  /**
   * Get event information
   */
  getEvent(eventId) {
    const event = this.events.get(eventId);
    if (!event) return null;
    
    return {
      eventId,
      modName: event.modName,
      componentId: event.componentId,
      createdAt: event.createdAt,
      lastTriggered: event.lastTriggered,
      metadata: event.metadata
    };
  }

  /**
   * Get all events (for debugging/admin)
   */
  getAllEvents() {
    const result = [];
    for (const [eventId, event] of this.events.entries()) {
      result.push({
        eventId,
        modName: event.modName,
        componentId: event.componentId,
        createdAt: event.createdAt,
        lastTriggered: event.lastTriggered
      });
    }
    return result;
  }

  /**
   * Get events for a specific mod
   */
  getEventsForMod(modName) {
    return this.getAllEvents().filter(event => event.modName === modName);
  }

  /**
   * Clear all events
   */
  clearAllEvents() {
    const count = this.events.size;
    this.events.clear();
    if (typeof this.logger.debug === 'function') {
      this.logger.debug(`Cleared all ${count} events`);
    }
    return count;
  }

  /**
   * Queue an event for async processing
   */
  queueEvent(eventId, data = {}) {
    this.eventQueue.push({ eventId, data, timestamp: new Date().toISOString() });
    
    // Process queue if not already processing
    if (!this.processing) {
      this.processEventQueue();
    }
    
    return this.eventQueue.length;
  }

  /**
   * Process queued events
   */
  async processEventQueue() {
    if (this.processing || this.eventQueue.length === 0) return;
    
    this.processing = true;
    
    try {
      while (this.eventQueue.length > 0) {
        const { eventId, data, timestamp } = this.eventQueue.shift();
        
        try {
          await this.triggerEvent(eventId, data, { queued: true, queueTimestamp: timestamp });
        } catch (error) {
          this.logger.error(`Failed to process queued event ${eventId}:`, error.message);
        }
      }
    } finally {
      this.processing = false;
    }
  }

  /**
   * Create an event wrapper for UI components
   */
  createEventHandler(eventId) {
    return async (eventData) => {
      return await this.triggerEvent(eventId, eventData);
    };
  }

  /**
   * Create a simple event handler that logs to console
   */
  createLoggingEventHandler(message, modName = 'system') {
    const eventId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.registerEvent(eventId, (data, context) => {
      this.logger.info(`[${modName}] ${message}:`, data);
      return { logged: true, data, context };
    }, { modName });
    
    return eventId;
  }
};