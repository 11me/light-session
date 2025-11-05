# Build Instructions

## Development Build

For development, the extension includes debug mode that can be toggled in the popup:

```bash
# Build the extension
npm run build

# The extension/.dev file enables debug mode UI
# This file is already present and should NOT be committed to git
```

## Production Build

For production release, remove the `.dev` file to hide debug options:

```bash
# Remove dev mode marker
rm extension/.dev

# Build the extension
npm run build

# Package for distribution
npm run package
```

The packaged extension will be in `web-ext-artifacts/` directory.

## Development Mode

When `extension/.dev` file exists:
- Debug mode checkbox is visible in the popup
- Allows toggling debug logging in browser console

When `.dev` file is removed (production):
- Debug mode checkbox is hidden from users
- Extension UI is simplified

## Settings

### User-Visible Settings:
- **Extension Enabled**: Toggle trimming on/off
- **Keep Messages**: Number of recent messages to keep (1-100)

### Hidden Settings (Always Active):
- **Preserve System Messages**: Always enabled in code
- **Pause on Scroll Up**: Always enabled in code
- **Debug Mode**: Only visible in development (when .dev file exists)
