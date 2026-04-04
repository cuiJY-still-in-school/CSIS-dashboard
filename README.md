# CSIS Dashboard - GUI Framework for OpenClaw Mods

A comprehensive dashboard mod for OpenClaw's roter mod manager. Provides a web-based GUI framework/library that other mods can integrate with.

## Features

- **Web-based Interface**: Dashboard runs on port 3000, accessible via browser
- **Two-Panel System**: Each mod gets "Configure" (values) and "Main" (state controls) panels
- **Drag-and-Drop Layout**: Reposition components with drag-and-drop
- **Component Library**: Predefined UI components (Button, Switch, Input, Select, Slider, Checkbox, etc.)
- **Event System**: Safe event handling between UI and mods
- **Real-time Updates**: Server-Sent Events (SSE) for live component updates
- **Extensible API**: Mods can register their own UI components
- **Layout Persistence**: Component positions saved and restored automatically

## Architecture

```
dashboard/
├── index.js              # Main dashboard implementation
├── components.js         # Component definitions library
├── events.js             # Event system class
├── manifest.json         # Dashboard metadata
├── config/schema.json    # Configuration schema
└── server.js            # Web server module
```

## Quick Start

### Method 1: Install via roter (Recommended)
```bash
# If you're in China and GitHub is blocked, set proxy first:
export https_proxy=socks5://localhost:7897
export http_proxy=socks5://localhost:7897

# Install dashboard from GitHub
roter install github:cuiJY-still-in-school/CSIS-dashboard

# Install test mod (example)
# Note: Test mod is in a separate repository
roter install github:cuiJY-still-in-school/CSIS-dashboard-test-mod
```

### Method 2: Manual Installation

#### Option A: Using git clone
```bash
# Clone the repository
git clone https://github.com/cuiJY-still-in-school/CSIS-dashboard.git
cd CSIS-dashboard

# Copy to OpenClaw mods directory
cp -r . ~/.openclaw/mods/dashboard

# (Optional) Install test mod example
cp -r examples/test-mod ~/.openclaw/mods/test-mod
```

#### Option B: Using curl (no git required)
```bash
# For users in China with proxy (replace 7897 with your proxy port):
export https_proxy=socks5://localhost:7897
export http_proxy=socks5://localhost:7897

# Download dashboard as zip
curl -L -o dashboard.zip https://github.com/cuiJY-still-in-school/CSIS-dashboard/archive/refs/heads/master.zip

# Extract and copy
unzip dashboard.zip
cd CSIS-dashboard-master
cp -r . ~/.openclaw/mods/dashboard

# Cleanup
cd ..
rm -rf dashboard.zip CSIS-dashboard-master

# (Optional) Download and install test mod
curl -L -o test-mod.zip https://github.com/cuiJY-still-in-school/CSIS-dashboard-test-mod/archive/refs/heads/master.zip
unzip test-mod.zip
cd CSIS-dashboard-test-mod-master
cp -r . ~/.openclaw/mods/test-mod
cd ..
rm -rf test-mod.zip CSIS-dashboard-test-mod-master
```

#### Option C: Download individual files
```bash
# For users in China with proxy (replace 7897 with your proxy port):
export https_proxy=socks5://localhost:7897
export http_proxy=socks5://localhost:7897

# Create mod directory
mkdir -p ~/.openclaw/mods/dashboard

# Download essential files
curl -L -o ~/.openclaw/mods/dashboard/manifest.json https://raw.githubusercontent.com/cuiJY-still-in-school/CSIS-dashboard/master/manifest.json
curl -L -o ~/.openclaw/mods/dashboard/index.js https://raw.githubusercontent.com/cuiJY-still-in-school/CSIS-dashboard/master/index.js
curl -L -o ~/.openclaw/mods/dashboard/components.js https://raw.githubusercontent.com/cuiJY-still-in-school/CSIS-dashboard/master/components.js
curl -L -o ~/.openclaw/mods/dashboard/events.js https://raw.githubusercontent.com/cuiJY-still-in-school/CSIS-dashboard/master/events.js
curl -L -o ~/.openclaw/mods/dashboard/server.js https://raw.githubusercontent.com/cuiJY-still-in-school/CSIS-dashboard/master/server.js

# Create config directory
mkdir -p ~/.openclaw/mods/dashboard/config
curl -L -o ~/.openclaw/mods/dashboard/config/schema.json https://raw.githubusercontent.com/cuiJY-still-in-school/CSIS-dashboard/master/config/schema.json
```

### Next Steps
1. **Start OpenClaw with roter**:
   The dashboard will automatically start on port 3000.

2. **Access dashboard**:
   Open http://localhost:3000 in your browser.

## Usage Example

```javascript
// In your mod's index.js
module.exports = {
  async onLoad(context) {
    const dashboard = require('dashboard').dashboard;
    const { components, events } = dashboard;
    
    // Generate event IDs
    const refreshEventId = events.generateId('my-mod-refresh');
    
    // Register event handler
    events.registerForComponent('my-mod', refreshEventId, async (data, context) => {
      context.logger.info('Refresh clicked!', data);
      return { success: true };
    }, { action: 'refresh' });
    
    // Register component with dashboard
    const component = dashboard.registerComponent({
      modName: 'my-mod',
      displayName: 'My Module',
      icon: '🚀',
      
      configureComponents: [
        components.Input({
          label: 'API Key',
          value: '',
          type: 'password',
          onChange: 'update-event-id'
        }),
        components.Slider({
          label: 'Volume',
          value: 50,
          min: 0,
          max: 100,
          step: 1,
          onChange: 'volume-change-event'
        })
      ],
      
      mainComponents: [
        components.Button({
          label: 'Refresh',
          variant: 'primary',
          onClick: refreshEventId
        }),
        components.Switch({
          label: 'Enable Feature',
          checked: true,
          onChange: 'toggle-event-id'
        })
      ]
    });
  }
};
```

## Component Library

Available components:
- **Button**: Clickable buttons with variants (primary, secondary, danger)
- **Switch**: Toggle switches with labels
- **Input**: Text inputs with labels and types (text, password, email, url)
- **Select**: Dropdown select with options
- **Text**: Text display with variants (heading, subheading, body, caption)
- **Status**: Status indicators (info, success, warning, error)
- **Table**: Data tables with pagination
- **Card**: Card containers with title and content
- **Form**: Form containers with fields
- **Chart**: Simple charts (bar, line, pie)
- **Container**: Layout containers (row, column)
- **Slider**: Range sliders with min/max/step values
- **Checkbox**: Checkbox inputs with labels
- **Progress**: Progress bars with labels and percentages

## Event System

The dashboard includes a robust event system:
- Event registration and triggering
- Component-specific event handlers
- Safe execution environment
- Automatic cleanup on mod unload
- Event queuing for async processing

## Real-time Updates

The dashboard supports real-time updates via Server-Sent Events (SSE). Components automatically broadcast updates when modified:

**Event types:**
- `component.added`: New component registered
- `component.update.configure`: Configure panel updated
- `component.update.main`: Main panel updated
- `component.update.layout`: Layout updated
- `component.removed`: Component removed

Connect to `/api/events/stream` to receive live updates in your frontend.

## API Reference

### Dashboard API
The dashboard API is available to mods via `require('dashboard').dashboard`.

#### `dashboard.registerComponent(options)`
Registers a new component with the dashboard.

**Parameters:**
- `options.modName` (string, required): Unique identifier for the mod
- `options.displayName` (string): Display name in dashboard
- `options.icon` (string): Emoji or icon for the component
- `options.configureComponents` (array): Array of component definitions for Configure panel
- `options.mainComponents` (array): Array of component definitions for Main panel
- `options.x`, `options.y` (number): Grid position
- `options.width`, `options.height` (number): Grid size

**Returns:** Component controller object with methods:
- `updateConfigure(updates)`: Update Configure panel
- `updateMain(updates)`: Update Main panel
- `updateLayout(updates)`: Update component layout
- `remove()`: Remove component from dashboard

#### `dashboard.components`
Library of pre-defined UI components (see Component Library above).

#### `dashboard.events`
Event system for handling UI interactions.

**Methods:**
- `registerForComponent(componentId, eventId, handler, metadata)`: Register event handler for a component
- `trigger(eventId, data)`: Trigger an event
- `unregister(eventId)`: Unregister an event
- `generateId(prefix)`: Generate unique event ID

## Development

### Prerequisites
- Node.js >= 20.0.0
- OpenClaw with roter mod manager

### Testing
1. Install dashboard and test-mod
2. Start OpenClaw
3. Access http://localhost:3000
4. Test interactive components (buttons trigger events)

### Project Structure
- `index.js`: Main dashboard logic, component registry, and server
- `components.js`: Component definitions and factory functions
- `events.js`: Event system with registration and triggering
- `server.js`: HTTP server with SSE support
- `manifest.json`: Mod metadata and dependencies

## License

MIT