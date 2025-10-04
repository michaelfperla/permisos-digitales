# WhatsApp Bot Navigation System

## Overview

The WhatsApp bot now includes a comprehensive navigation and state management system that provides:
- Universal navigation commands that work from any state
- Navigation history with back/forward functionality
- Breadcrumb tracking for user context
- State preservation when navigating between sections
- Smart link detection and handling
- Text-based navigation for the entire UI

## Key Components

### 1. Navigation Manager (`src/services/whatsapp/navigation-manager.js`)

The navigation manager handles:
- Navigation history per user (up to 50 entries)
- State preservation and restoration
- Command parsing
- Link extraction
- Breadcrumb generation
- Automatic cleanup of inactive users (24-hour timeout)

### 2. Updated WhatsApp Service (`src/services/whatsapp/simple-whatsapp.service.js`)

Integration includes:
- Universal command handling before state processing
- Navigation context in all user interactions
- State preservation during form filling
- Fixed privacy URL: `https://permisosdigitales.com.mx/politica-de-privacidad`

## Universal Navigation Commands

Users can use these commands at any time, regardless of their current state:

### Basic Navigation
- **Home/Menu**: `menu`, `inicio`, `home`
- **Back**: `atrás`, `regresar`, `back`, `volver`
- **Forward**: `adelante`, `siguiente`, `forward`
- **Exit**: `salir`, `exit`, `cancelar`

### Function Commands
- **Help**: `ayuda`, `help`, `?`
- **Status**: `estado`, `status`
- **Privacy**: `privacidad`, `privacy`
- **Commands**: `comandos` (shows all available commands)

### Command Prefixes
Commands can be prefixed with `/`, `!`, or `#`:
- `/menu`
- `!ayuda`
- `#estado`

## Navigation States

The system tracks these navigation states:
- `MAIN_MENU` - Main menu
- `PRIVACY_MENU` - Privacy options menu
- `NEW_APPLICATION` - Starting a new permit application
- `FORM_FILLING` - Filling out the permit form
- `CONFIRMATION` - Confirming entered data
- `PAYMENT_METHOD` - Selecting payment method
- `STATUS_CHECK` - Checking application status

## Features

### 1. Navigation History
- Users can navigate back and forward through their interaction history
- History is maintained per user with a maximum of 50 entries
- Older entries are automatically removed to maintain performance

### 2. State Preservation
- Form data is preserved when navigating away
- Users can return to exactly where they left off
- Preserved states are cleared after 24 hours of inactivity

### 3. Breadcrumbs
- Shows user's current location in the navigation hierarchy
- Example: `📍 Menú Principal > Nueva Solicitud > Llenando Formulario`
- Helps users understand where they are in the process

### 4. Link Handling
- Automatically detects URLs in messages
- Provides appropriate responses for:
  - Privacy policy links
  - Permisos Digitales website links
  - External links
- Supports multiple URL formats (with/without protocol)

### 5. Navigation Context
- Each message includes available navigation commands
- Example:
  ```
  💡 Comandos: ↩️ "atrás" | 🏠 "menu" | ❓ "ayuda"
  ```

## User Experience Improvements

### 1. Seamless Navigation
- Users can jump to any major section with simple text commands
- No need to navigate through multiple menus
- Quick access to help and status from anywhere

### 2. Error Recovery
- If users get stuck, they can always use `menu` to start over
- Navigation commands take priority over state processing
- Clear feedback when navigation isn't possible (e.g., no back history)

### 3. Form Filling Enhancement
- Shows progress: "Paso X de Y"
- Users can navigate away and return to continue
- Form data is preserved during navigation
- Can go back to previous fields without losing data

### 4. Help Context
- Navigation help is always available with `ayuda`
- Shows current location after displaying help
- Context-sensitive help based on current state

## Implementation Details

### Message Processing Flow
1. Rate limit check
2. Input sanitization
3. **Navigation command parsing (NEW)**
4. **Universal command handling (NEW)**
5. **Link detection and handling (NEW)**
6. Greeting detection
7. State-based processing

### Navigation Command Priority
Navigation commands are processed before any other logic, ensuring they always work regardless of the bot's current state.

### State Restoration
When navigating back to a previous state:
1. Navigation entry is retrieved from history
2. Preserved state data is restored if available
3. Appropriate handler is called based on state type
4. User sees exactly what they would have seen originally

## Testing

A test script is provided at `/test-navigation.js` that validates:
- Navigation push/pop operations
- Breadcrumb generation
- Command parsing
- Link extraction
- State preservation
- Navigation context formatting

Run with: `node test-navigation.js`

## Security Considerations

- All navigation data is stored in memory (not persisted to disk)
- User navigation history is automatically cleaned up after 24 hours
- State data is isolated per user
- No sensitive data is logged in navigation history

## Future Enhancements

Potential improvements:
1. Voice command navigation ("envía audio diciendo 'menú'")
2. Quick action shortcuts (e.g., "permit" goes directly to new application)
3. Navigation analytics to improve UX
4. Persistent navigation history in Redis for multi-server deployments
5. Custom breadcrumb formatting per state