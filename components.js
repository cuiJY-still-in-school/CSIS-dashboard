/**
 * Dashboard React Components Library
 * 
 * Predefined React components that mods can use in their panels.
 * These components are safe and don't require eval or dynamic code execution.
 */

module.exports = {
  /**
   * Create a component configuration
   */
  createConfig: function(type, props = {}, children = [], eventId = null) {
    const config = {
      type,
      props,
      children: Array.isArray(children) ? children : [children]
    };
    
    // Add event ID if provided (for event handling)
    if (eventId) {
      config.eventId = eventId;
    }
    
    return config;
  },

  /**
   * Generate a unique event ID for component events
   */
  generateEventId: function(prefix = 'event') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },

  /**
   * Button component
   */
  Button: function(props) {
    return this.createConfig('Button', {
      label: props.label || 'Button',
      variant: props.variant || 'primary', // primary, secondary, danger
      size: props.size || 'medium', // small, medium, large
      onClick: props.onClick || null,
      disabled: props.disabled || false
    });
  },

  /**
   * Switch/Toggle component
   */
  Switch: function(props) {
    return this.createConfig('Switch', {
      label: props.label || '',
      checked: props.checked || false,
      onChange: props.onChange || null,
      disabled: props.disabled || false
    });
  },

  /**
   * Input component
   */
  Input: function(props) {
    return this.createConfig('Input', {
      label: props.label || '',
      value: props.value || '',
      type: props.type || 'text', // text, number, password, email
      placeholder: props.placeholder || '',
      onChange: props.onChange || null,
      disabled: props.disabled || false
    });
  },

  /**
   * Select component
   */
  Select: function(props) {
    return this.createConfig('Select', {
      label: props.label || '',
      value: props.value || '',
      options: props.options || [],
      onChange: props.onChange || null,
      disabled: props.disabled || false
    });
  },

  /**
   * Text component
   */
  Text: function(props) {
    return this.createConfig('Text', {
      content: props.content || '',
      variant: props.variant || 'body', // heading, subheading, body, caption
      align: props.align || 'left'
    });
  },

  /**
   * Table component
   */
  Table: function(props) {
    return this.createConfig('Table', {
      columns: props.columns || [],
      data: props.data || [],
      pagination: props.pagination || false,
      pageSize: props.pageSize || 10
    });
  },

  /**
   * Card component
   */
  Card: function(props) {
    return this.createConfig('Card', {
      title: props.title || '',
      content: props.content || '',
      actions: props.actions || []
    });
  },

  /**
   * Form component (container)
   */
  Form: function(props) {
    return this.createConfig('Form', {
      fields: props.fields || [],
      onSubmit: props.onSubmit || null,
      submitLabel: props.submitLabel || 'Submit'
    });
  },

  /**
   * Layout components
   */
  Container: function(props) {
    return this.createConfig('Container', {
      direction: props.direction || 'column', // row, column
      gap: props.gap || 'medium',
      alignItems: props.alignItems || 'stretch',
      children: props.children || []
    });
  },

  /**
   * Status indicator
   */
  Status: function(props) {
    return this.createConfig('Status', {
      status: props.status || 'info', // info, success, warning, error
      message: props.message || '',
      showIcon: props.showIcon !== false
    });
  },

  /**
   * Chart component (simple)
   */
  Chart: function(props) {
    return this.createConfig('Chart', {
      type: props.type || 'bar', // bar, line, pie
      data: props.data || {},
      options: props.options || {}
    });
  }
};