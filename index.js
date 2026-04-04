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
    
    // Initialize core systems
    const componentRegistry = new Map();
    const layoutManager = {
      layout: {},
      save: function(layout) {
        this.layout = { ...this.layout, ...layout };
        // TODO: Persist to file
        logger.info('Layout saved');
      },
      load: function() {
        return this.layout;
      }
    };
    
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
          
          // Layout
          layout: {
            x: options.x || 0,
            y: options.y || 0,
            width: options.width || 4,
            height: options.height || 3,
            minWidth: options.minWidth || 2,
            minHeight: options.minHeight || 2,
            resizable: options.resizable !== false,
            draggable: options.draggable !== false
          },
          
          // Metadata
          metadata: options.metadata || {}
        };
        
        // Store component
        componentRegistry.set(componentId, component);
        
        logger.info(`Component registered: ${modName}`);
        
        // Return controller for updates
        return {
          updateConfigure: (updates) => {
            const comp = componentRegistry.get(componentId);
            if (comp) {
              comp.configure = { ...comp.configure, ...updates };
            }
          },
          
          updateMain: (updates) => {
            const comp = componentRegistry.get(componentId);
            if (comp) {
              comp.main = { ...comp.main, ...updates };
            }
          },
          
          updateLayout: (updates) => {
            const comp = componentRegistry.get(componentId);
            if (comp) {
              comp.layout = { ...comp.layout, ...updates };
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
                   const layout = JSON.parse(body);
                   layoutManager.save(layout);
                   res.writeHead(200, { 'Content-Type': 'application/json' });
                   res.end(JSON.stringify({ success: true }));
                 } catch (error) {
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
               endpoints: ['/api/components', '/api/layout', '/api/events', '/api/events/trigger', '/dashboard']
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
      grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
      gap: 20px;
      margin-bottom: 40px;
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
      <div class="drag-hint">Drag components to reposition (coming soon)</div>
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
    
    // Component rendering helper (simple)
    function renderComponent(comp) {
      if (comp.eventId && comp.type === 'Button') {
        const { label = 'Button', variant = 'primary', disabled = false } = comp.props || {};
        const variantClass = variant === 'primary' ? 'dashboard-btn-primary' : variant === 'secondary' ? 'dashboard-btn-secondary' : 'dashboard-btn-danger';
        return \`
          <button class="dashboard-btn \${variantClass}" data-event-id="\${comp.eventId}" \${disabled ? 'disabled' : ''}>
            \${label}
          </button>
        \`;
      }
      // Fallback to prop display
      return Object.entries(comp.props || {}).map(([key, val]) => \`
        <div style="display: flex; justify-content: space-between; padding: 2px 0;">
          <span style="color: #94a3b8;">\${key}:</span>
          <span style="font-family: monospace;">\${formatValue(val)}</span>
        </div>
      \`).join('');
    }
    
    // Attach event listeners to interactive components
    function attachEventListeners() {
      // Button clicks
      document.querySelectorAll('[data-event-id]').forEach(button => {
        button.addEventListener('click', async (event) => {
          const eventId = button.getAttribute('data-event-id');
          if (!eventId) return;
          
          // Disable button temporarily
          const originalText = button.textContent;
          button.disabled = true;
          button.textContent = 'Processing...';
          
          try {
            const response = await fetch('/api/events/trigger', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ eventId, data: {} })
            });
            
            const result = await response.json();
            console.log('Event triggered:', result);
            
            // Show notification
            const notification = document.createElement('div');
            notification.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #22c55e; color: white; padding: 12px 20px; border-radius: 8px; z-index: 1000;';
            notification.textContent = result.success ? 'Event executed successfully' : 'Event failed';
            document.body.appendChild(notification);
            setTimeout(() => notification.remove(), 3000);
            
          } catch (error) {
            console.error('Failed to trigger event:', error);
          } finally {
            button.disabled = false;
            button.textContent = originalText;
          }
        });
      });
    }
    
    // Render components to the grid
    function renderComponents(components) {
      const grid = document.getElementById('components-grid');
      
      if (components.length === 0) {
        grid.innerHTML = '<div class="placeholder">No components registered yet. Install and enable mods to see them here.</div>';
        return;
      }
      
      grid.innerHTML = components.map(component => \`
        <div class="component" data-mod="\${component.id}" draggable="true" id="component-\${component.id}">
          <div class="component-header">
            <div class="component-icon">\${component.icon}</div>
            <div class="component-title">\${component.displayName}</div>
            <div style="font-size: 12px; color: #64748b; margin-left: auto;">⋮⋮</div>
          </div>
          
          <div class="panel-section">
            <div class="configure-panel">
              <div class="panel-title">Configure</div>
              <div class="panel-content">
                \${renderPanelContent(component.configure)}
              </div>
            </div>
            
            <div class="main-panel">
              <div class="panel-title">Main</div>
              <div class="panel-content">
                \${renderPanelContent(component.main)}
              </div>
            </div>
          </div>
        </div>
      \`).join('');
      
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
        return \`
          <div style="display: flex; flex-direction: column; gap: 12px;">
            \${panel.components.map((comp, index) => \`
              <div style="background: rgba(100, 116, 139, 0.2); padding: 12px; border-radius: 6px; border-left: 3px solid #60a5fa;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                  <span style="font-weight: 600; color: #94a3b8;">\${comp.type || 'Component'}</span>
                  \${comp.eventId ? '<span style="font-size: 12px; color: #64748b; background: rgba(100, 116, 139, 0.3); padding: 2px 6px; border-radius: 4px;">Interactive</span>' : ''}
                  <span style="font-size: 12px; color: #64748b; background: rgba(100, 116, 139, 0.3); padding: 2px 6px; border-radius: 4px;">
                    React
                  </span>
                </div>
                <div style="font-size: 14px; color: #cbd5e1;">
                  \${renderComponent(comp)}
                </div>
              </div>
            \`).join('')}
            <div style="font-size: 12px; color: #64748b; text-align: center; padding: 8px;">
              React components ready (UI coming soon)
            </div>
          </div>
        \`;
      }
      
      // Fallback to data object
      if (panel.data && Object.keys(panel.data).length > 0) {
        const entries = Object.entries(panel.data);
        return \`
          <div style="display: flex; flex-direction: column; gap: 8px;">
            \${entries.map(([key, value]) => \`
              <div style="display: flex; justify-content: space-between; padding: 4px 0;">
                <span style="color: #94a3b8;">\${key}:</span>
                <span style="font-family: monospace;">\${formatValue(value)}</span>
              </div>
            \`).join('')}
          </div>
        \`;
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
          
          // Get drop position (simplified - just log for now)
          const rect = grid.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          
          console.log('Dropped component:', componentId, 'at', x, y);
          
          // In a real implementation, update layout and save to server
          // For now, just show a notification
          const notification = document.createElement('div');
          notification.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #22c55e; color: white; padding: 12px 20px; border-radius: 8px; z-index: 1000;';
          notification.textContent = \`Moved \${componentId}\`;
          document.body.appendChild(notification);
          
          setTimeout(() => notification.remove(), 2000);
          
          // Save layout to server (simplified)
          try {
            await fetch('/api/layout/save', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                componentId,
                position: { x, y },
                timestamp: new Date().toISOString()
              })
            });
          } catch (error) {
            console.error('Failed to save layout:', error);
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