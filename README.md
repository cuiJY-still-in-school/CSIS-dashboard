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

1. **Install dashboard mod**:
   ```bash
   # Copy dashboard directory to ~/.openclaw/mods/
   cp -r /path/to/dashboard ~/.openclaw/mods/
   ```

2. **Install test mod** (example):
   ```bash
   cp -r /path/to/test-mod ~/.openclaw/mods/
   ```

3. **Start OpenClaw with roter**:
   The dashboard will automatically start on port 3000.

4. **Access dashboard**:
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