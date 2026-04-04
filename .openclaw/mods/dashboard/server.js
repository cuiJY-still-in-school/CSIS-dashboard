/**
 * Dashboard Web Server
 * 
 * Provides HTTP server for the dashboard UI.
 * Initially HTML-based, but designed to support React later.
 */

const http = require('http');
const fs = require('fs').promises;
const path = require('path');

/**
 * Start the dashboard web server
 */
async function startDashboardServer(options) {
  const {
    port = 3000,
    host = 'localhost',
    componentRegistry,
    layoutManager
  } = options;
  
  const server = http.createServer(async (req, res) => {
    try {
      await handleRequest(req, res, { componentRegistry, layoutManager });
    } catch (error) {
      console.error('Request error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  });
  
  return new Promise((resolve, reject) => {
    server.listen(port, host, (err) => {
      if (err) {
        reject(err);
      } else {
        console.log(`Dashboard server running at http://${host}:${port}`);
        resolve(server);
      }
    });
  });
}

/**
 * Handle HTTP requests
 */
async function handleRequest(req, res, context) {
  const { componentRegistry, layoutManager } = context;
  const url = new URL(req.url, `http://${req.headers.host}`);
  
  // API endpoints
  if (url.pathname === '/api/components') {
    const components = Array.from(componentRegistry.values());
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ components }));
    return;
  }
  
  if (url.pathname === '/api/layout') {
    const layout = layoutManager.load();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ layout }));
    return;
  }
  
  if (url.pathname === '/api/layout/save' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
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
  
  // Static files and dashboard UI
  if (url.pathname === '/' || url.pathname === '/dashboard') {
    const html = await generateDashboardHtml(context);
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
    return;
  }
  
  // 404
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
}

/**
 * Generate dashboard HTML
 */
async function generateDashboardHtml(context) {
  const { componentRegistry } = context;
  const components = Array.from(componentRegistry.values());
  
  // Simple HTML dashboard
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
      <div class="drag-hint">Drag components to reposition</div>
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
    
    // Render components to the grid
    function renderComponents(components) {
      const grid = document.getElementById('components-grid');
      
      if (components.length === 0) {
        grid.innerHTML = '<div class="placeholder">No components registered yet. Install and enable mods to see them here.</div>';
        return;
      }
      
      grid.innerHTML = components.map(component => \`
        <div class="component" data-mod="\${component.id}">
          <div class="component-header">
            <div class="component-icon">\${component.icon}</div>
            <div class="component-title">\${component.displayName}</div>
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
    }
    
    // Render panel content based on type
    function renderPanelContent(panel) {
      if (!panel || !panel.data || Object.keys(panel.data).length === 0) {
        return '<div class="placeholder">No configuration defined</div>';
      }
      
      // Simple rendering of data
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
    
    // Format values for display
    function formatValue(value) {
      if (value === null || value === undefined) return 'null';
      if (typeof value === 'boolean') return value ? '✅ true' : '❌ false';
      if (typeof value === 'object') return JSON.stringify(value);
      return String(value);
    }
    
    // Initialize
    document.addEventListener('DOMContentLoaded', loadComponents);
    
    // Auto-refresh every 30 seconds
    setInterval(loadComponents, 30000);
  </script>
</body>
</html>
  `;
}

module.exports = {
  startDashboardServer
};