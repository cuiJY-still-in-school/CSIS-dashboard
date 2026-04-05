/**
 * CSIS Dashboard - GUI framework for OpenClaw mods
 * 
 * Architecture:
 * 1. Dashboard Core: Component registry and layout management
 * 2. Web Server: Serves React-based UI
 * 3. Component API: For mods to register UI components
 * 
 * Each mod provides two panels:
 * - Configure Panel: For configuration values (inputs, selects, etc.)
 * - Main Panel: For state controls (switches, buttons, status)
 */

// Import component library
const components = require('./components.js');
// Import event system
const EventSystem = require('./events.js');

module.exports = {
  /**
   * Initialize dashboard
   */
  async onLoad(context) {
    const { logger, exports, config } = context;
    // Note: context.require is for libraries, not for built-in modules
    // Use global require() for built-ins
    
    logger.info('CSIS Dashboard loading...');
    
    // Initialize file system for layout persistence
    const fs = require('fs');
    const path = require('path');
    
    // Determine layout file path
    // Try to save in user's OpenClaw mods directory first
    const os = require('os');
    const userHome = os.homedir();
    const openclawModsDir = path.join(userHome, '.openclaw', 'mods', 'dashboard');
    const layoutFilePath = path.join(openclawModsDir, 'layout.json');
    
    // Ensure directory exists
    try {
      if (!fs.existsSync(openclawModsDir)) {
        fs.mkdirSync(openclawModsDir, { recursive: true });
        logger.info(`Created dashboard data directory: ${openclawModsDir}`);
      }
    } catch (error) {
      logger.warn(`Failed to create dashboard data directory: ${error.message}`);
    }
    
    // Initialize core systems
    const componentRegistry = new Map();
    const layoutManager = {
      layout: {},
      save: function(layout) {
        this.layout = { ...this.layout, ...layout };
        
        // Persist to file
        try {
          fs.writeFileSync(layoutFilePath, JSON.stringify(this.layout, null, 2));
          logger.info(`Layout saved to: ${layoutFilePath}`);
        } catch (error) {
          logger.error(`Failed to save layout: ${error.message}`);
        }
      },
      load: function() {
        // Try to load from file
        try {
          if (fs.existsSync(layoutFilePath)) {
            const data = fs.readFileSync(layoutFilePath, 'utf8');
            this.layout = JSON.parse(data);
            logger.info(`Layout loaded from: ${layoutFilePath}`);
          }
        } catch (error) {
          logger.warn(`Failed to load layout: ${error.message}`);
          this.layout = {};
        }
        return this.layout;
      }
    };
    
    // Load saved layout on startup
    layoutManager.load();
    
    // Initialize event system
    const eventSystem = new EventSystem({
      info: (...args) => (logger.info || console.log)(...args),
      debug: (...args) => (logger.info || console.log)(...args), // Use info for debug in production
      warn: (...args) => (logger.warn || logger.info || console.warn)(...args),
      error: (...args) => (logger.error || logger.info || console.error)(...args)
    });
    
    // Store active event handlers by component
    const componentEventHandlers = new Map(); // componentId -> [eventId1, eventId2, ...]
    
    // Dashboard API
    const dashboardApi = {
      /**
       * Component library for building UI
       */
      components: components,
      
      /**
       * Register a mod component
       * @param {Object} options Component options
       * @returns {Object} Component controller
       */
      registerComponent(options) {
        const { modName, displayName, icon = '🔄' } = options;
        
        if (!modName) {
          throw new Error('modName is required');
        }
        
        const componentId = modName;
        
        // Create component entry
        const component = {
          id: componentId,
          modName,
          displayName: displayName || modName,
          icon,
          version: '1.0.0',
          
          // Panels
          configure: {
            // Backward compatibility: data object
            data: options.configureData || {},
            // Component configuration (React components)
            components: options.configureComponents || [],
            // Render function (optional)
            render: options.configureRender || null,
            // Schema for validation
            schema: options.configureSchema || {}
          },
          
          main: {
            // Backward compatibility: data object
            data: options.mainData || {},
            // Component configuration (React components)
            components: options.mainComponents || [],
            // Render function (optional)
            render: options.mainRender || null,
            // Schema for validation
            schema: options.mainSchema || {}
          },
          
          // Layout - load from saved layout or use defaults
          layout: (() => {
            const savedLayout = layoutManager.layout[modName];
            return {
              x: savedLayout?.x ?? options.x ?? 0,
              y: savedLayout?.y ?? options.y ?? 0,
              width: savedLayout?.width ?? options.width ?? 4,
              height: savedLayout?.height ?? options.height ?? 3,
              minWidth: savedLayout?.minWidth ?? options.minWidth ?? 2,
              minHeight: savedLayout?.minHeight ?? options.minHeight ?? 2,
              resizable: savedLayout?.resizable ?? options.resizable ?? true,
              draggable: savedLayout?.draggable ?? options.draggable ?? true
            };
          })(),
          
          // Metadata
          metadata: options.metadata || {}
        };
        
        // Store component
        componentRegistry.set(componentId, component);
        
         logger.info(`Component registered: ${modName}`);
         
         // Broadcast addition to SSE clients
         if (dashboardApi.broadcast) {
           dashboardApi.broadcast('component.added', {
             componentId,
             modName,
             displayName: component.displayName,
             icon: component.icon,
             timestamp: new Date().toISOString()
           });
         }
         
         // Return controller for updates
        return {
           updateConfigure: (updates) => {
             const comp = componentRegistry.get(componentId);
             if (comp) {
               comp.configure = { ...comp.configure, ...updates };
               
               // Broadcast update to SSE clients
               if (dashboardApi.broadcast) {
                 dashboardApi.broadcast('component.update.configure', {
                   componentId,
                   modName,
                   updates,
                   timestamp: new Date().toISOString()
                 });
               }
             }
           },
          
           updateMain: (updates) => {
             const comp = componentRegistry.get(componentId);
             if (comp) {
               comp.main = { ...comp.main, ...updates };
               
               // Broadcast update to SSE clients
               if (dashboardApi.broadcast) {
                 dashboardApi.broadcast('component.update.main', {
                   componentId,
                   modName,
                   updates,
                   timestamp: new Date().toISOString()
                 });
               }
             }
           },
          
           updateLayout: (updates) => {
             const comp = componentRegistry.get(componentId);
             if (comp) {
               comp.layout = { ...comp.layout, ...updates };
               
               // Broadcast update to SSE clients
               if (dashboardApi.broadcast) {
                 dashboardApi.broadcast('component.update.layout', {
                   componentId,
                   modName,
                   updates,
                   timestamp: new Date().toISOString()
                 });
               }
             }
           },
          
           remove: () => {
             componentRegistry.delete(componentId);
             
             // Clean up event handlers for this component
             const eventCount = dashboardApi.events.unregisterForComponent(componentId);
             if (eventCount > 0) {
               logger.info(`Cleaned up ${eventCount} event handlers for ${modName}`);
             }
             
             logger.info(`Component removed: ${modName}`);
             
             // Broadcast removal to SSE clients
             if (dashboardApi.broadcast) {
               dashboardApi.broadcast('component.removed', {
                 componentId,
                 modName,
                 timestamp: new Date().toISOString()
               });
             }
           }
        };
      },
      
      /**
       * Get all components
       */
      getComponents() {
        return Array.from(componentRegistry.values());
      },
      
      /**
       * Get component by ID
       */
      getComponent(componentId) {
        return componentRegistry.get(componentId);
      },
      
      /**
       * Save layout
       */
      saveLayout(layout) {
        layoutManager.save(layout);
      },
      
      /**
       * Load layout
       */
      loadLayout() {
        return layoutManager.load();
      },
      
      /**
       * Event System API
       */
      events: {
        /**
         * Register an event handler
         * @param {string} eventId - Unique event identifier
         * @param {Function} handler - Event handler function
         * @param {Object} metadata - Additional metadata
         */
        register: (eventId, handler, metadata = {}) => {
          return eventSystem.registerEvent(eventId, handler, metadata);
        },
        
        /**
         * Register event handler for a specific component
         */
        registerForComponent: (componentId, eventId, handler, metadata = {}) => {
          const eventIdActual = eventSystem.registerEvent(eventId, handler, {
            ...metadata,
            componentId
          });
          
          // Track event for component cleanup
          if (!componentEventHandlers.has(componentId)) {
            componentEventHandlers.set(componentId, []);
          }
          componentEventHandlers.get(componentId).push(eventIdActual);
          
          return eventIdActual;
        },
        
        /**
         * Trigger an event
         */
        trigger: async (eventId, data = {}) => {
          return await eventSystem.triggerEvent(eventId, data);
        },
        
        /**
         * Unregister an event
         */
        unregister: (eventId) => {
          return eventSystem.unregisterEvent(eventId);
        },
        
        /**
         * Unregister all events for a component
         */
        unregisterForComponent: (componentId) => {
          const events = componentEventHandlers.get(componentId) || [];
          let count = 0;
          
          for (const eventId of events) {
            if (eventSystem.unregisterEvent(eventId)) {
              count++;
            }
          }
          
          componentEventHandlers.delete(componentId);
          return count;
        },
        
        /**
         * Get event information
         */
        get: (eventId) => {
          return eventSystem.getEvent(eventId);
        },
        
        /**
         * Get all events (for debugging)
         */
        getAll: () => {
          return eventSystem.getAllEvents();
        },
        
        /**
         * Create a unique event ID
         */
        generateId: (prefix = 'event') => {
          return components.generateEventId ? components.generateEventId(prefix) : 
                 `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }
      },
      
      /**
       * Start web server
       */
      async startServer(options = {}) {
        const port = options.port || config?.serverPort || 3000;
        const host = options.host || 'localhost';
        
        logger.info(`Starting dashboard server on ${host}:${port}`);
        
         try {
           const http = require('http');
           const url = require('url');
           
           // Store SSE clients for real-time updates
           const clients = new Set();
           
           // Broadcast function to send updates to all connected clients
           const broadcast = (event, data) => {
             const message = `data: ${JSON.stringify({ event, data, timestamp: new Date().toISOString() })}\n\n`;
             for (const client of clients) {
               try {
                 client.write(message);
               } catch (error) {
                 logger.warn('Failed to send SSE message:', error.message);
               }
             }
           };
           
           // Expose broadcast function to dashboard API
           dashboardApi.broadcast = broadcast;
           
           const server = http.createServer((req, res) => {
            const parsedUrl = url.parse(req.url, true);
            const pathname = parsedUrl.pathname;
            
            // Set CORS headers
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
            
            if (req.method === 'OPTIONS') {
              res.writeHead(200);
              res.end();
              return;
            }
            
            // API endpoints
            if (pathname === '/api/components') {
              const components = Array.from(componentRegistry.values()).map(comp => ({
                id: comp.id,
                modName: comp.modName,
                displayName: comp.displayName,
                icon: comp.icon,
                version: comp.version,
                configure: comp.configure,
                main: comp.main,
                layout: comp.layout,
                metadata: comp.metadata
              }));
              
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ components }));
              return;
            }
            
            if (pathname === '/api/layout') {
              const layout = layoutManager.load();
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ layout }));
              return;
            }
            
              if (pathname === '/api/layout/save' && req.method === 'POST') {
                let body = '';
                req.on('data', chunk => body += chunk);
                req.on('end', () => {
                  try {
                    const data = JSON.parse(body);
                    
                    if (data.componentId && data.position) {
                      // Update specific component layout
                      const component = componentRegistry.get(data.componentId);
                      if (component) {
                        component.layout = { 
                          ...component.layout, 
                          x: data.position.x || 0,
                          y: data.position.y || 0
                        };
                        
                        // Save entire layout to file
                        const layout = {};
                        for (const [id, comp] of componentRegistry.entries()) {
                          layout[id] = comp.layout;
                        }
                        layoutManager.save(layout);
                        
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ 
                          success: true,
                          componentId: data.componentId,
                          layout: component.layout
                        }));
                      } else {
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Component not found' }));
                      }
                    } else {
                      // Legacy support: save entire layout object
                      layoutManager.save(data);
                      res.writeHead(200, { 'Content-Type': 'application/json' });
                      res.end(JSON.stringify({ success: true }));
                    }
                  } catch (error) {
                    logger.error(`Layout save error: ${error.message}`);
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid JSON' }));
                  }
                });
                return;
              }
             
             // Event API endpoints
             if (pathname === '/api/events/trigger' && req.method === 'POST') {
               let body = '';
               req.on('data', chunk => body += chunk);
               req.on('end', async () => {
                 try {
                   const { eventId, data = {} } = JSON.parse(body);
                   
                   if (!eventId) {
                     res.writeHead(400, { 'Content-Type': 'application/json' });
                     res.end(JSON.stringify({ error: 'eventId is required' }));
                     return;
                   }
                   
                   const result = await eventSystem.triggerEvent(eventId, data);
                   
                   res.writeHead(200, { 'Content-Type': 'application/json' });
                   res.end(JSON.stringify(result));
                 } catch (error) {
                   res.writeHead(400, { 'Content-Type': 'application/json' });
                   res.end(JSON.stringify({ error: error.message }));
                 }
               });
               return;
             }
             
              if (pathname === '/api/events' && req.method === 'GET') {
                const events = eventSystem.getAllEvents();
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ events }));
                return;
              }
              
              // SSE stream for real-time updates
              if (pathname === '/api/events/stream') {
                res.writeHead(200, {
                  'Content-Type': 'text/event-stream',
                  'Cache-Control': 'no-cache',
                  'Connection': 'keep-alive',
                  'Access-Control-Allow-Origin': '*'
                });
                
                // Send initial connection message
                res.write(`data: ${JSON.stringify({ event: 'connected', timestamp: new Date().toISOString() })}\n\n`);
                
                // Add client to set
                clients.add(res);
                
                // Remove client on disconnect
                req.on('close', () => {
                  clients.delete(res);
                });
                
                return;
              }
              
              // Dashboard HTML
            if (pathname === '/' || pathname === '/dashboard') {
              const html = generateDashboardHtml();
              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end(html);
              return;
            }
            
             // Default response
             res.writeHead(200, { 'Content-Type': 'application/json' });
             res.end(JSON.stringify({ 
               message: 'CSIS Dashboard API',
               version: '1.0.0',
               components: Array.from(componentRegistry.values()).length,
                endpoints: ['/api/components', '/api/layout', '/api/events', '/api/events/trigger', '/api/events/stream', '/dashboard']
             }));
          });
          
          return new Promise((resolve, reject) => {
            server.listen(port, host, (err) => {
              if (err) {
                reject(err);
              } else {
                logger.info(`Dashboard server running at http://${host}:${port}`);
                // Store server reference for later cleanup
                dashboardApi._server = server;
                resolve({
                  success: true,
                  url: `http://${host}:${port}`,
                  port
                });
              }
            });
          });
        } catch (error) {
          logger.error(`Failed to start server: ${error.message}`);
          return {
            success: false,
            error: error.message
          };
        }
      },
      
      /**
       * Stop web server
       */
      async stopServer() {
        if (dashboardApi._server) {
          return new Promise((resolve) => {
            dashboardApi._server.close(() => {
              logger.info('Dashboard server stopped');
              dashboardApi._server = null;
              resolve(true);
            });
          });
        }
        logger.info('Dashboard server already stopped');
        return true;
      },
      
      /**
       * Utility: Create React component wrapper
       */
      createReactComponent(componentDef) {
        return {
          type: 'react',
          component: componentDef
        };
      },
      
      /**
       * Utility: Create simple HTML component
       */
      createHtmlComponent(html) {
        return {
          type: 'html',
          content: html
        };
      }
    };
    
    /**
     * Generate dashboard HTML
     */
    function generateDashboardHtml() {
      const components = Array.from(componentRegistry.values());
      
      return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CSIS Dashboard - OpenClaw</title>
  <style>
    :root {
      --bg-primary: #0f172a;
      --bg-secondary: #1e293b;
      --bg-tertiary: #334155;
      --text-primary: #f1f5f9;
      --text-secondary: #94a3b8;
      --accent: #60a5fa;
      --success: #22c55e;
      --border: #475569;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      line-height: 1.6;
    }
    
    .dashboard {
      padding: 20px;
      max-width: 1400px;
      margin: 0 auto;
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--border);
    }
    
    .header h1 {
      font-size: 28px;
      color: var(--accent);
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .status {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 16px;
      background: var(--success);
      border-radius: 20px;
      font-size: 14px;
      font-weight: 500;
    }
    
    .status::before {
      content: '';
      width: 8px;
      height: 8px;
      background: white;
      border-radius: 50%;
    }
    
    .components-grid {
      display: grid;
      grid-template-columns: repeat(12, 1fr);
      grid-auto-rows: minmax(100px, auto);
      gap: 20px;
      margin-bottom: 40px;
      position: relative;
    }
    
    .component {
      background: var(--bg-secondary);
      border-radius: 12px;
      border: 1px solid var(--border);
      overflow: hidden;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    
    .component:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
    }
    
    .component-header {
      padding: 20px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .component-icon {
      font-size: 24px;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--bg-tertiary);
      border-radius: 8px;
    }
    
    .component-title {
      flex: 1;
      font-size: 18px;
      font-weight: 600;
    }
    
    .panel-section {
      padding: 20px;
    }
    
    .panel-title {
      font-size: 14px;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 12px;
      font-weight: 600;
    }
    
    .panel-content {
      background: var(--bg-primary);
      border-radius: 8px;
      padding: 16px;
      min-height: 80px;
    }
    
    .configure-panel {
      margin-bottom: 16px;
    }
    
    .main-panel {
      margin-bottom: 0;
    }
    
    .placeholder {
      color: var(--text-secondary);
      font-style: italic;
      text-align: center;
      padding: 20px;
    }
    
    .controls {
      background: var(--bg-secondary);
      border-radius: 12px;
      padding: 25px;
      margin-top: 30px;
      border: 1px solid var(--border);
    }
    
    .controls h3 {
      margin-bottom: 12px;
      color: var(--accent);
    }
    
    .drag-hint {
      display: inline-block;
      margin-top: 10px;
      padding: 8px 16px;
      background: var(--bg-tertiary);
      border-radius: 6px;
      font-size: 14px;
      color: var(--text-secondary);
    }
    
    @media (max-width: 768px) {
      .components-grid {
        grid-template-columns: 1fr;
      }
      
      .dashboard {
        padding: 15px;
      }
    }
    
    /* Interactive component styles */
    .dashboard-btn {
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.2s;
      font-size: 14px;
    }
    .dashboard-btn-primary {
      background-color: var(--accent);
      color: white;
    }
    .dashboard-btn-primary:hover {
      background-color: #3b82f6;
    }
    .dashboard-btn-secondary {
      background-color: var(--bg-tertiary);
      color: var(--text-primary);
    }
    .dashboard-btn-secondary:hover {
      background-color: #475569;
    }
    .dashboard-btn-danger {
      background-color: #ef4444;
      color: white;
    }
    .dashboard-btn-danger:hover {
      background-color: #dc2626;
    }
    .dashboard-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .dashboard-switch {
      display: flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
    }
    .dashboard-switch input {
      display: none;
    }
    .dashboard-switch-slider {
      width: 36px;
      height: 20px;
      background-color: var(--bg-tertiary);
      border-radius: 20px;
      position: relative;
      transition: background-color 0.2s;
    }
    .dashboard-switch-slider::before {
      content: '';
      position: absolute;
      width: 16px;
      height: 16px;
      background-color: white;
      border-radius: 50%;
      top: 2px;
      left: 2px;
      transition: transform 0.2s;
    }
    .dashboard-switch input:checked + .dashboard-switch-slider {
      background-color: var(--accent);
    }
    .dashboard-switch input:checked + .dashboard-switch-slider::before {
      transform: translateX(16px);
    }
    .dashboard-switch-label {
      color: var(--text-primary);
      font-size: 14px;
    }
    
    .dashboard-input-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .dashboard-input-label {
      font-size: 14px;
      color: var(--text-secondary);
    }
    .dashboard-input {
      padding: 8px 12px;
      background-color: var(--bg-tertiary);
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--text-primary);
      font-size: 14px;
    }
    .dashboard-input:focus {
      outline: none;
      border-color: var(--accent);
    }
    
    .dashboard-select-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .dashboard-select-label {
      font-size: 14px;
      color: var(--text-secondary);
    }
    .dashboard-select {
      padding: 8px 12px;
      background-color: var(--bg-tertiary);
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--text-primary);
      font-size: 14px;
    }
    .dashboard-select:focus {
      outline: none;
      border-color: var(--accent);
    }
    
    /* Table styles */
    .dashboard-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    .dashboard-table th {
      background-color: var(--bg-tertiary);
      color: var(--text-secondary);
      text-align: left;
      padding: 10px 12px;
      font-weight: 600;
      border-bottom: 1px solid var(--border);
    }
    .dashboard-table td {
      padding: 10px 12px;
      border-bottom: 1px solid rgba(100, 116, 139, 0.2);
      color: var(--text-primary);
    }
    .dashboard-table tr:hover {
      background-color: rgba(100, 116, 139, 0.1);
    }
    
    /* Progress bar styles */
    .dashboard-progress {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .dashboard-progress-label {
      font-size: 14px;
      color: var(--text-secondary);
      display: flex;
      justify-content: space-between;
    }
    .dashboard-progress-bar {
      height: 8px;
      background-color: var(--bg-tertiary);
      border-radius: 4px;
      overflow: hidden;
    }
    .dashboard-progress-fill {
      height: 100%;
      background-color: var(--accent);
      border-radius: 4px;
      transition: width 0.3s ease;
    }
    .dashboard-progress-success .dashboard-progress-fill {
      background-color: var(--success);
    }
    .dashboard-progress-warning .dashboard-progress-fill {
      background-color: #f59e0b;
    }
    .dashboard-progress-error .dashboard-progress-fill {
      background-color: #ef4444;
    }
    
    /* Chart container */
    .dashboard-chart {
      background-color: var(--bg-tertiary);
      border-radius: 8px;
      padding: 16px;
      min-height: 200px;
      display: flex;
      flex-direction: column;
    }
    .dashboard-chart-title {
      font-size: 14px;
      color: var(--text-secondary);
      margin-bottom: 12px;
      font-weight: 600;
    }
    .dashboard-chart-container {
      flex: 1;
      position: relative;
    }
    
    /* Card styles */
    .dashboard-card {
      background-color: var(--bg-tertiary);
      border-radius: 8px;
      border: 1px solid var(--border);
      padding: 16px;
    }
    .dashboard-card-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 8px;
    }
    .dashboard-card-content {
      color: var(--text-secondary);
      font-size: 14px;
    }
    .dashboard-card-actions {
      margin-top: 16px;
      display: flex;
      gap: 8px;
    }
    
    /* Status indicator styles */
    .dashboard-status {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 14px;
    }
    .dashboard-status-info {
      background-color: rgba(59, 130, 246, 0.1);
      color: #60a5fa;
      border-left: 3px solid #60a5fa;
    }
    .dashboard-status-success {
      background-color: rgba(34, 197, 94, 0.1);
      color: #22c55e;
      border-left: 3px solid #22c55e;
    }
    .dashboard-status-warning {
      background-color: rgba(245, 158, 11, 0.1);
      color: #f59e0b;
      border-left: 3px solid #f59e0b;
    }
    .dashboard-status-error {
      background-color: rgba(239, 68, 68, 0.1);
      color: #ef4444;
      border-left: 3px solid #ef4444;
    }
    .dashboard-status-icon {
      font-size: 16px;
    }
    
    /* Form styles */
    .dashboard-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .dashboard-form-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
     .dashboard-form-actions {
       display: flex;
       justify-content: flex-end;
       gap: 8px;
       margin-top: 16px;
     }
     
     /* Slider component */
     .dashboard-slider-group {
       display: flex;
       flex-direction: column;
       gap: 8px;
     }
     .dashboard-slider-label {
       font-size: 14px;
       color: var(--text-secondary);
     }
     .dashboard-slider {
       width: 100%;
       height: 6px;
       -webkit-appearance: none;
       appearance: none;
       background: var(--bg-tertiary);
       border-radius: 3px;
       outline: none;
     }
     .dashboard-slider::-webkit-slider-thumb {
       -webkit-appearance: none;
       appearance: none;
       width: 20px;
       height: 20px;
       border-radius: 50%;
       background: var(--accent);
       cursor: pointer;
       border: 2px solid white;
       box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
     }
     .dashboard-slider-value {
       font-size: 14px;
       color: var(--text-secondary);
       text-align: right;
       font-family: monospace;
     }
     
     /* Checkbox component */
     .dashboard-checkbox {
       display: flex;
       align-items: center;
       gap: 8px;
       cursor: pointer;
       user-select: none;
     }
     .dashboard-checkbox input[type="checkbox"] {
       width: 18px;
       height: 18px;
       border-radius: 4px;
       border: 2px solid var(--border);
       background: var(--bg-primary);
       cursor: pointer;
     }
     .dashboard-checkbox input[type="checkbox"]:checked {
       background: var(--accent);
       border-color: var(--accent);
     }
     .dashboard-checkbox-label {
       font-size: 14px;
       color: var(--text-primary);
     }
   </style>
</head>
<body>
  <div class="dashboard">
    <div class="header">
      <h1>🦞 CSIS Dashboard</h1>
      <div class="status">Online</div>
    </div>
    
    <div id="components-grid" class="components-grid">
      <!-- Components will be loaded here -->
    </div>
    
    <div class="controls">
      <h3>Dashboard Controls</h3>
      <p>Each mod has two panels: <strong>Configure</strong> (for values) and <strong>Main</strong> (for switches/state).</p>
      <div class="drag-hint">Drag components to reposition them on the grid</div>
    </div>
  </div>
  
  <script>
    // Load components from API
    async function loadComponents() {
      try {
        const response = await fetch('/api/components');
        const data = await response.json();
        renderComponents(data.components);
      } catch (error) {
        console.error('Failed to load components:', error);
        document.getElementById('components-grid').innerHTML = 
          '<div class="placeholder">Failed to load components. Check console for details.</div>';
      }
     }
     
     // Connect to SSE stream for real-time updates
     function connectSSE() {
       const eventSource = new EventSource('/api/events/stream');
       
       eventSource.onopen = () => {
         console.log('SSE connected');
       };
       
       eventSource.onerror = (error) => {
         console.error('SSE error:', error);
         // Attempt reconnect after delay
         setTimeout(connectSSE, 5000);
       };
       
       eventSource.onmessage = (event) => {
         try {
           const data = JSON.parse(event.data);
           console.log('SSE event:', data.event);
           
           // Handle different event types
           switch (data.event) {
             case 'component.added':
             case 'component.update.configure':
             case 'component.update.main':
             case 'component.update.layout':
             case 'component.removed':
               // Reload components to reflect changes
               loadComponents();
               break;
             
             case 'connected':
               console.log('SSE stream connected');
               break;
             
             default:
               console.log('Unknown SSE event:', data.event);
           }
         } catch (error) {
           console.error('Failed to parse SSE message:', error);
         }
       };
       
        // Store event source for cleanup
        window._dashboardSSE = eventSource;
        
        // Clean up on page unload
        window.addEventListener('beforeunload', () => {
          if (window._dashboardSSE) {
            window._dashboardSSE.close();
          }
        });
     }
     
     // Component rendering helper (simple)
    function renderComponent(comp) {
      const props = comp.props || {};
      const eventId = comp.eventId;
      
      // Button component
      if (comp.type === 'Button') {
        const { label = 'Button', variant = 'primary', disabled = false } = props;
        const variantClass = variant === 'primary' ? 'dashboard-btn-primary' : variant === 'secondary' ? 'dashboard-btn-secondary' : 'dashboard-btn-danger';
         return '<button class="dashboard-btn ' + variantClass + '" data-event-id="' + (eventId || '') + '" data-component-type="Button"' + (disabled ? ' disabled' : '') + '>' + label + '</button>';
      }
      
      // Switch component
      if (comp.type === 'Switch') {
        const { label = '', checked = false, disabled = false } = props;
         return '<label class="dashboard-switch" data-component-type="Switch">' +
                '<input type="checkbox"' + (checked ? ' checked' : '') + (disabled ? ' disabled' : '') + ' data-event-id="' + (eventId || '') + '">' +
                '<span class="dashboard-switch-slider"></span>' +
                (label ? '<span class="dashboard-switch-label">' + label + '</span>' : '') +
                '</label>';
      }
      
      // Input component
      if (comp.type === 'Input') {
        const { label = '', value = '', type = 'text', placeholder = '', disabled = false } = props;
         return '<div class="dashboard-input-group" data-component-type="Input">' +
                (label ? '<div class="dashboard-input-label">' + label + '</div>' : '') +
                '<input class="dashboard-input" type="' + type + '" value="' + value + '" placeholder="' + placeholder + '"' +
                (disabled ? ' disabled' : '') + ' data-event-id="' + (eventId || '') + '">' +
                '</div>';
      }
      
      // Select component
      if (comp.type === 'Select') {
        const { label = '', value = '', options = [], disabled = false } = props;
         const optionsHtml = options.map(opt => {
           return '<option value="' + opt.value + '"' + (opt.value === value ? ' selected' : '') + '>' +
                  (opt.label || opt.value) + '</option>';
         }).join('');
         return '<div class="dashboard-select-group" data-component-type="Select">' +
                (label ? '<div class="dashboard-select-label">' + label + '</div>' : '') +
                '<select class="dashboard-select"' + (disabled ? ' disabled' : '') + ' data-event-id="' + (eventId || '') + '">' +
                optionsHtml +
                '</select></div>';
      }
      
      // Text component
      if (comp.type === 'Text') {
        const { content = '', variant = 'body', align = 'left' } = props;
        const tagName = variant === 'heading' ? 'h3' : variant === 'subheading' ? 'h4' : 'div';
         const style = 'text-align: ' + align + '; color: var(--text-primary); margin: 8px 0;';
         return '<' + tagName + ' style="' + style + '" data-component-type="Text">' + content + '</' + tagName + '>';
      }
      
      // Status component
      if (comp.type === 'Status') {
        const { status = 'info', message = '', showIcon = true } = props;
         const statusClass = 'dashboard-status dashboard-status-' + status;
         const icon = showIcon ? {
           info: 'ℹ️',
           success: '✅',
           warning: '⚠️',
           error: '❌'
         }[status] || 'ℹ️' : '';
         return '<div class="' + statusClass + '" data-component-type="Status">' +
                (icon ? '<span class="dashboard-status-icon">' + icon + '</span>' : '') +
                '<span>' + message + '</span></div>';
      }
      
      // Progress component
      if (comp.type === 'Progress') {
        const { label = '', value = 0, max = 100, variant = 'default' } = props;
        const percentage = Math.max(0, Math.min(100, (value / max) * 100));
         const progressClass = 'dashboard-progress' + (variant !== 'default' ? ' dashboard-progress-' + variant : '');
         return '<div class="' + progressClass + '" data-component-type="Progress">' +
                '<div class="dashboard-progress-label">' +
                '<span>' + label + '</span>' +
                '<span>' + Math.round(percentage) + '%</span>' +
                '</div>' +
                '<div class="dashboard-progress-bar">' +
                '<div class="dashboard-progress-fill" style="width: ' + percentage + '%"></div>' +
                '</div>' +
                '</div>';
       }
       
       // Slider component
       if (comp.type === 'Slider') {
         const { label = '', value = 0, min = 0, max = 100, step = 1, disabled = false } = props;
          return '<div class="dashboard-slider-group" data-component-type="Slider">' +
                 (label ? '<div class="dashboard-slider-label">' + label + '</div>' : '') +
                 '<input class="dashboard-slider" type="range" ' +
                 'min="' + min + '" max="' + max + '" step="' + step + '" value="' + value + '"' +
                 (disabled ? ' disabled' : '') + ' data-event-id="' + (eventId || '') + '">' +
                 '<div class="dashboard-slider-value">' + value + '</div>' +
                 '</div>';
       }
       
       // Checkbox component
       if (comp.type === 'Checkbox') {
         const { label = '', checked = false, disabled = false } = props;
          return '<label class="dashboard-checkbox" data-component-type="Checkbox">' +
                 '<input type="checkbox"' + (checked ? ' checked' : '') + (disabled ? ' disabled' : '') + ' data-event-id="' + (eventId || '') + '">' +
                 (label ? '<span class="dashboard-checkbox-label">' + label + '</span>' : '') +
                 '</label>';
       }
       
       // Table component
      if (comp.type === 'Table') {
        const { columns = [], data = [], pagination = false, pageSize = 10 } = props;
        const displayData = pagination ? data.slice(0, pageSize) : data;
        return \`
          <div class="dashboard-table-container" data-component-type="Table">
            <table class="dashboard-table">
              <thead>
                <tr>
                  \${columns.map(col => \`<th>\${col}</th>\`).join('')}
                </tr>
              </thead>
              <tbody>
                \${displayData.map((row, i) => \`
                  <tr>
                    \${columns.map(col => \`<td>\${formatValue(row[col])}</td>\`).join('')}
                  </tr>
                \`).join('')}
              </tbody>
            </table>
            \${pagination && data.length > pageSize ? \`
              <div style="margin-top: 12px; text-align: center; color: var(--text-secondary); font-size: 14px;">
                Showing \${pageSize} of \${data.length} rows
              </div>
            \` : ''}
          </div>
        \`;
      }
      
      // Card component
      if (comp.type === 'Card') {
        const { title = '', content = '', actions = [] } = props;
        return \`
          <div class="dashboard-card" data-component-type="Card">
            \${title ? '<div class="dashboard-card-title">' + title + '</div>' : ''}
            \${content ? '<div class="dashboard-card-content">' + content + '</div>' : ''}
            \${actions.length > 0 ? \`
              <div class="dashboard-card-actions">
                \${actions.map(action => \`
                  <button class="dashboard-btn dashboard-btn-secondary" data-event-id="\${action.eventId || ''}">
                    \${action.label || 'Action'}
                  </button>
                \`).join('')}
              </div>
            \` : ''}
          </div>
        \`;
      }
      
      // Chart component (simple visualization)
      if (comp.type === 'Chart') {
        const { type = 'bar', data = {}, options = {} } = props;
        const chartId = \`chart_\${Date.now()}_\${Math.random().toString(36).substr(2, 9)}\`;
        return \`
          <div class="dashboard-chart" data-component-type="Chart" data-chart-type="\${type}" id="\${chartId}">
            <div class="dashboard-chart-title">\${type.charAt(0).toUpperCase() + type.slice(1)} Chart</div>
            <div class="dashboard-chart-container">
              <!-- Chart will be rendered here -->
              <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-secondary);">
                Chart: \${type} (data preview)
              </div>
            </div>
          </div>
        \`;
      }
      
      // Fallback: display all props
      return Object.entries(props).map(([key, val]) => \`
        <div style="display: flex; justify-content: space-between; padding: 2px 0;">
          <span style="color: #94a3b8;">\${key}:</span>
          <span style="font-family: monospace;">\${formatValue(val)}</span>
        </div>
      \`).join('');
    }
    
    // Attach event listeners to interactive components
    function attachEventListeners() {
      // Button clicks
      document.querySelectorAll('[data-component-type="Button"][data-event-id]').forEach(button => {
        button.addEventListener('click', async (event) => {
          const eventId = button.getAttribute('data-event-id');
          if (!eventId) return;
          
          // Disable button temporarily
          const originalText = button.textContent;
          button.disabled = true;
          button.textContent = 'Processing...';
          
          await triggerEvent(eventId, {});
          
          button.disabled = false;
          button.textContent = originalText;
        });
      });
      
      // Switch toggle events
      document.querySelectorAll('[data-component-type="Switch"] input[data-event-id]').forEach(switchInput => {
        switchInput.addEventListener('change', async (event) => {
          const eventId = switchInput.getAttribute('data-event-id');
          if (!eventId) return;
          
          await triggerEvent(eventId, { checked: switchInput.checked });
        });
      });
      
      // Input change events (with debounce)
      document.querySelectorAll('[data-component-type="Input"] input[data-event-id]').forEach(input => {
        let timeoutId;
        input.addEventListener('input', (event) => {
          clearTimeout(timeoutId);
          timeoutId = setTimeout(async () => {
            const eventId = input.getAttribute('data-event-id');
            if (!eventId) return;
            
            await triggerEvent(eventId, { value: input.value, type: input.type });
          }, 300); // Debounce 300ms
        });
      });
      
      // Select change events
      document.querySelectorAll('[data-component-type="Select"] select[data-event-id]').forEach(select => {
        select.addEventListener('change', async (event) => {
          const eventId = select.getAttribute('data-event-id');
          if (!eventId) return;
          
          await triggerEvent(eventId, { value: select.value, selectedIndex: select.selectedIndex });
        });
      });
      
      // Card action buttons
      document.querySelectorAll('[data-component-type="Card"] [data-event-id]').forEach(button => {
        button.addEventListener('click', async (event) => {
          const eventId = button.getAttribute('data-event-id');
          if (!eventId) return;
          
          const originalText = button.textContent;
          button.disabled = true;
          button.textContent = 'Processing...';
          
          await triggerEvent(eventId, {});
          
          button.disabled = false;
          button.textContent = originalText;
        });
      });
    }
    
    // Helper function to trigger events
    async function triggerEvent(eventId, data) {
      try {
        const response = await fetch('/api/events/trigger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventId, data })
        });
        
        const result = await response.json();
        console.log('Event triggered:', result);
        
        // Show notification
        const notification = document.createElement('div');
        notification.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #22c55e; color: white; padding: 12px 20px; border-radius: 8px; z-index: 1000;';
        notification.textContent = result.success ? 'Event executed successfully' : 'Event failed: ' + (result.error || 'Unknown error');
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
        
        return result;
      } catch (error) {
        console.error('Failed to trigger event:', error);
        
        // Show error notification
        const notification = document.createElement('div');
        notification.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #ef4444; color: white; padding: 12px 20px; border-radius: 8px; z-index: 1000;';
        notification.textContent = 'Failed to trigger event: ' + error.message;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
        
        throw error;
      }
    }
    
    // Render components to the grid
    function renderComponents(components) {
      const grid = document.getElementById('components-grid');
      
      if (components.length === 0) {
        grid.innerHTML = '<div class="placeholder">No components registered yet. Install and enable mods to see them here.</div>';
        return;
      }
      
      grid.innerHTML = components.map(component => {
        // Get layout with defaults
        const layout = component.layout || {};
        const x = Math.max(0, Math.min(11, layout.x || 0)); // 0-based column index (0-11)
        const y = Math.max(0, layout.y || 0); // 0-based row index
        const width = Math.max(1, Math.min(12 - x, layout.width || 4)); // columns span (1-12)
        const height = Math.max(1, layout.height || 3); // rows span
        
        // Calculate grid position (CSS grid is 1-indexed)
        const gridColumnStart = x + 1;
        const gridColumnEnd = gridColumnStart + width;
        const gridRowStart = y + 1;
        const gridRowEnd = gridRowStart + height;
        
        return [
          '<div class="component" data-mod="' + component.id + '" draggable="true" id="component-' + component.id + '" ',
          '      style="grid-column: ' + gridColumnStart + ' / ' + gridColumnEnd + '; grid-row: ' + gridRowStart + ' / ' + gridRowEnd + ';">',
          '  <div class="component-header">',
          '    <div class="component-icon">' + component.icon + '</div>',
          '    <div class="component-title">' + component.displayName + '</div>',
          '    <div style="font-size: 12px; color: #64748b; margin-left: auto;">⋮⋮</div>',
          '  </div>',
          '  ',
          '  <div class="panel-section">',
          '    <div class="configure-panel">',
          '      <div class="panel-title">Configure</div>',
          '      <div class="panel-content">',
          '        ' + renderPanelContent(component.configure),
          '      </div>',
          '    </div>',
          '    ',
          '    <div class="main-panel">',
          '      <div class="panel-title">Main</div>',
          '      <div class="panel-content">',
          '        ' + renderPanelContent(component.main),
          '      </div>',
          '    </div>',
          '  </div>',
          '</div>'
         ].join('\n');
      }).join('');
      
      attachEventListeners();
      
      // Add drag event listeners
      components.forEach(component => {
        const elem = document.getElementById('component-' + component.id);
        if (elem) {
          elem.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', component.id);
            e.dataTransfer.effectAllowed = 'move';
            elem.style.opacity = '0.5';
          });
          
          elem.addEventListener('dragend', () => {
            elem.style.opacity = '1';
          });
        }
      });
    }
    
    // Render panel content based on type
    function renderPanelContent(panel) {
      if (!panel) {
        return '<div class="placeholder">No configuration defined</div>';
      }
      
      // Check for React components first
      if (panel.components && panel.components.length > 0) {
        const componentsHtml = panel.components.map(comp => {
          return '<div style="background: rgba(100, 116, 139, 0.2); padding: 12px; border-radius: 6px; border-left: 3px solid #60a5fa;">' +
                 '<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">' +
                 '<span style="font-weight: 600; color: #94a3b8;">' + (comp.type || 'Component') + '</span>' +
                 (comp.eventId ? '<span style="font-size: 12px; color: #64748b; background: rgba(100, 116, 139, 0.3); padding: 2px 6px; border-radius: 4px;">Interactive</span>' : '') +
                 '<span style="font-size: 12px; color: #64748b; background: rgba(100, 116, 139, 0.3); padding: 2px 6px; border-radius: 4px;">React</span>' +
                 '</div>' +
                 '<div style="font-size: 14px; color: #cbd5e1;">' +
                 renderComponent(comp) +
                 '</div>' +
                 '</div>';
        }).join('');
        return '<div style="display: flex; flex-direction: column; gap: 12px;">' +
               componentsHtml +
               '<div style="font-size: 12px; color: #64748b; text-align: center; padding: 8px;">React components ready (UI coming soon)</div>' +
               '</div>';
      }
      
      // Fallback to data object
      if (panel.data && Object.keys(panel.data).length > 0) {
        const entries = Object.entries(panel.data);
        const entriesHtml = entries.map(([key, value]) => {
          return '<div style="display: flex; justify-content: space-between; padding: 4px 0;">' +
                 '<span style="color: #94a3b8;">' + key + ':</span>' +
                 '<span style="font-family: monospace;">' + formatValue(value) + '</span>' +
                 '</div>';
        }).join('');
        return '<div style="display: flex; flex-direction: column; gap: 8px;">' + entriesHtml + '</div>';
      }
      
      return '<div class="placeholder">No configuration defined</div>';
    }
    
    // Format values for display
    function formatValue(value) {
      if (value === null || value === undefined) return 'null';
      if (typeof value === 'boolean') return value ? '✅ true' : '❌ false';
      if (typeof value === 'object') return JSON.stringify(value);
      return String(value);
    }
    
    // Initialize
     document.addEventListener('DOMContentLoaded', () => {
       loadComponents();
       connectSSE();
       
       // Setup grid drop zone
      const grid = document.getElementById('components-grid');
      if (grid) {
        grid.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          grid.style.backgroundColor = 'rgba(100, 116, 139, 0.1)';
        });
        
        grid.addEventListener('dragleave', () => {
          grid.style.backgroundColor = '';
        });
        
        grid.addEventListener('drop', async (e) => {
          e.preventDefault();
          grid.style.backgroundColor = '';
          
          const componentId = e.dataTransfer.getData('text/plain');
          if (!componentId) return;
          
          // Get drop position
          const rect = grid.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          
          // Calculate grid position (12-column grid)
          // Each column is approximately (grid width - gaps) / 12
          const gridWidth = rect.width;
          const gridHeight = rect.height;
          const gap = 20; // From CSS
          const totalGaps = 11 * gap; // 11 gaps between 12 columns
          const columnWidth = (gridWidth - totalGaps) / 12;
          
          // Estimate row height (minmax(100px, auto) + gap)
          const rowHeight = 120; // Approximate: 100px min height + 20px gap
          
          // Calculate column index (0-based)
          const columnIndex = Math.floor(x / (columnWidth + gap));
          const clampedColumn = Math.max(0, Math.min(11, columnIndex));
          
          // Calculate row index (0-based)
          const rowIndex = Math.floor(y / rowHeight);
          const clampedRow = Math.max(0, rowIndex);
          
          // Get component element and update its position
          const componentElem = document.getElementById('component-' + componentId);
          if (componentElem) {
            // Get current grid position
            const currentColumnStyle = componentElem.style.gridColumn;
            const currentRowStyle = componentElem.style.gridRow;
            
            // Parse column position
            const columnMatch = currentColumnStyle.match(/(\d+)\s*\/\s*(\d+)/);
            let span = 4; // default width
            
            if (columnMatch) {
              const start = parseInt(columnMatch[1]);
              const end = parseInt(columnMatch[2]);
              span = end - start;
            }
            
            // Parse current row position
            let rowStart = 1; // default
            let rowSpan = 3; // default height
            
            if (currentRowStyle) {
              const rowMatch = currentRowStyle.match(/(\d+)\s*\/\s*(\d+)/);
              if (rowMatch) {
                rowStart = parseInt(rowMatch[1]);
                const rowEnd = parseInt(rowMatch[2]);
                rowSpan = rowEnd - rowStart;
              }
            }
            
            // Update both column and row
            const newColumnStart = clampedColumn + 1;
            const newColumnEnd = newColumnStart + span;
            const newRowStart = clampedRow + 1;
            const newRowEnd = newRowStart + rowSpan;
            
            componentElem.style.gridColumn = \`\${newColumnStart} / \${newColumnEnd}\`;
            componentElem.style.gridRow = \`\${newRowStart} / \${newRowEnd}\`;
            
            // Show notification
            const notification = document.createElement('div');
            notification.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #22c55e; color: white; padding: 12px 20px; border-radius: 8px; z-index: 1000;';
            notification.textContent = \`Moved \${componentId} to column \${newColumnStart}, row \${newRowStart}\`;
            document.body.appendChild(notification);
            
            setTimeout(() => notification.remove(), 2000);
            
            // Save layout to server
            try {
              const response = await fetch('/api/layout/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  componentId,
                  position: { x: clampedColumn, y: clampedRow },
                  timestamp: new Date().toISOString()
                })
              });
              
              const result = await response.json();
              if (!result.success) {
                console.error('Failed to save layout:', result.error);
              }
            } catch (error) {
              console.error('Failed to save layout:', error);
            }
          }
        });
      }
    });
    
    // Auto-refresh every 30 seconds
    setInterval(loadComponents, 30000);
  </script>
</body>
</html>
      `;
    }
    
    // Export the dashboard API
    exports.dashboard = dashboardApi;
    
    logger.info('CSIS Dashboard API ready');
    
    // Auto-start server if configured
    if (config?.autoStartServer !== false) {
      setTimeout(async () => {
        try {
          const result = await dashboardApi.startServer();
          if (result.success) {
            logger.info(`Dashboard available at: ${result.url}`);
          }
        } catch (error) {
          logger.error(`Failed to auto-start server: ${error.message}`);
        }
      }, 1000);
    }
  },
  
  /**
   * Cleanup on unload
   */
  async onUnload(context) {
    const { logger } = context;
    logger.info('CSIS Dashboard unloading...');
    
    // Stop server if running
    if (dashboardApi && dashboardApi.stopServer) {
      await dashboardApi.stopServer();
    }
  },
  
  /**
   * Gateway start hook
   */
  async onGatewayStart(context) {
    const { logger } = context;
    logger.info('OpenClaw gateway started - dashboard ready');
  }
};