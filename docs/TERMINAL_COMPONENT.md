# TerminalEmulator Component Documentation

## Overview

`TerminalEmulator` is a React component that provides a fully-functional Linux terminal in the browser. It uses **xterm.js** (the terminal engine behind VS Code) for rendering and communicates with a backend PTY server via WebSocket.

## Installation

```bash
# Already included in frontend package.json
npm install @xterm/xterm @xterm/addon-fit @xterm/addon-web-links @xterm/addon-clipboard
```

## Usage

```tsx
import { TerminalEmulator } from '@/components/terminal';

function MyTerminalPage() {
  return (
    <div className="h-[600px] w-full">
      <TerminalEmulator
        className="border rounded-lg"
        onConnect={() => console.log('Terminal connected')}
        onDisconnect={() => console.log('Terminal disconnected')}
        onError={(err) => console.error('Terminal error:', err)}
      />
    </div>
  );
}
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `className` | `string` | No | Additional CSS classes for the container |
| `onConnect` | `() => void` | No | Callback when WebSocket connects |
| `onDisconnect` | `() => void` | No | Callback when WebSocket disconnects |
| `onError` | `(error: Error) => void` | No | Callback on connection error |

## Features

### Core Terminal (xterm.js)
- Full ANSI escape sequence support
- 256-color / truecolor support
- Unicode/wide character support
- Scrollback buffer (10,000 lines by default)
- Block/bar/underline cursor styles

### Addons
| Addon | Purpose |
|-------|---------|
| `FitAddon` | Automatically resizes terminal to fill container |
| `WebLinksAddon` | Makes URLs, file paths, commands clickable (Ctrl+Click) |
| `ClipboardAddon` | Enables copy/paste (Ctrl+Shift+C/V, right-click menu) |

### Connection Management
- **Auto-connect** on mount
- **Auto-reconnect** on disconnect (3 second delay)
- **Connection status indicator** (green/red dot in top-right)
- **Error banner** on connection failure

### Resize Handling
- `ResizeObserver` detects container size changes
- `window.resize` event listener for fullscreen changes
- Sends `resize` message to backend to update PTY dimensions

## Architecture

```
TerminalEmulator Component
├── State
│   ├── isConnected: boolean
│   ├── connectionError: string | null
│   └── refs: termRef, fitAddonRef, wsRef, reconnectTimeoutRef
│
├── Effects
│   ├── Terminal Initialization (mount)
│   │   ├── Create Terminal instance
│   │   ├── Load addons (Fit, WebLinks, Clipboard)
│   │   ├── Open terminal in container
│   │   ├── Setup onData → sendInput
│   │   └── Start WebSocket connection
│   │
│   ├── Resize Handling
│   │   ├── ResizeObserver on container
│   │   ├── window.resize listener
│   │   └── fitAddon.fit() → term.resize() → backend resize
│   │
│   └── Cleanup (unmount)
│       ├── Remove listeners
│       ├── Disconnect WebSocket
│       └── term.dispose()
│
└── Callbacks
    ├── sendInput(data) → ws.send({type: 'input', data})
    ├── resize(cols, rows) → ws.send({type: 'resize', cols, rows})
    ├── connect() → new WebSocket(wsUrl)
    └── disconnect() → ws.close()
```

## WebSocket Protocol

### Connection URL
```
ws://localhost:3000/api/pty   (development)
wss://yourdomain.com/api/pty  (production)
```

Constructed from `VITE_API_HOST` environment variable.

### Messages (Client → Server)

**Input:**
```json
{ "type": "input", "data": "ls -la\n" }
```

**Resize:**
```json
{ "type": "resize", "cols": 120, "rows": 40 }
```

**Raw (legacy):** Plain string sent directly to PTY stdin.

### Messages (Server → Client)

Raw terminal output as binary or text WebSocket frames (ANSI escape sequences).

## Customization

### Theme

Modify the `theme` object in `Terminal.tsx`:

```typescript
const term = new Terminal({
  theme: {
    background: '#0d0d0d',
    foreground: '#e0e0e0',
    cursor: '#ffffff',
    cursorAccent: '#0d0d0d',
    selection: '#ffffff40',
    // ANSI colors (16)
    black: '#1a1a1a',
    red: '#ff6b6b',
    green: '#69db7c',
    yellow: '#ffd76b',
    blue: '#6bc4ff',
    magenta: '#c792ea',
    cyan: '#6bdfff',
    white: '#e0e0e0',
    // Bright variants (16)
    brightBlack: '#4a4a4a',
    brightRed: '#ff8787',
    brightGreen: '#85ff92',
    brightYellow: '#fff085',
    brightBlue: '#85dcff',
    brightMagenta: '#d9a9ff',
    brightCyan: '#85ffff',
    brightWhite: '#ffffff',
  },
});
```

### Font

```typescript
fontFamily: '"JetBrains Mono", "Fira Code", "Monaco", "Consolas", monospace',
fontSize: 14,
lineHeight: 1.2,
letterSpacing: 0,
fontWeight: 'normal',
fontWeightBold: '600',
```

### Behavior Options

```typescript
cursorBlink: true,
cursorStyle: 'block',        // 'block' | 'bar' | 'underline'
scrollback: 10000,           // Lines of scrollback
tabStopWidth: 4,             // Tab width in spaces
screenReaderMode: false,     // Accessibility
allowProposedApi: true,      // Experimental APIs
```

## CSS Styling

The component renders a container `div` with xterm.js creating a `<canvas>` inside.

### Default Classes
```css
.terminal-container {
  @apply relative w-full h-full min-h-[400px] rounded-lg border bg-black;
  @apply focus-within:ring-2 focus-within:ring-blue-500/50;
  @apply font-mono antialiased;
}
```

### Custom Styling
```tsx
<TerminalEmulator
  className="h-[800px] border-gray-700 shadow-xl"
/>
```

### Connection Indicator Styles
```css
/* Connected: green pulsing dot */
.bg-green-500

/* Connecting: red pulsing dot */
.bg-red-500.animate-pulse
```

## Error Handling

The component handles several error scenarios:

| Scenario | Behavior |
|----------|----------|
| WebSocket connection fails | Shows error banner, retries in 3s |
| WebSocket closes unexpectedly | Auto-reconnects after 3s |
| Backend PTY exits | WebSocket closes with code 1000, reconnects |
| Network interruption | Auto-reconnects when restored |

Error state is exposed via:
- `connectionError` state (shows banner)
- `onError` callback
- Console logs with `[Terminal]` prefix

## Accessibility

- `screenReaderMode: false` (can be enabled for screen readers)
- Focus management: Click container to focus terminal
- Keyboard navigation: All terminal keys work natively
- High contrast theme available via theme customization

## Performance

- **Initial load**: ~200KB gzipped (xterm.js + addons)
- **Memory**: ~5-10MB per terminal instance
- **CPU**: Near zero when idle
- **Resize**: Debounced via ResizeObserver (no manual debounce needed)

## Testing

### Manual Testing Checklist

- [ ] Terminal loads and shows prompt
- [ ] Typing works (commands, arrows, tabs)
- [ ] Colors render correctly (`ls --color`, `htop`)
- [ ] Resize works (drag window, fullscreen)
- [ ] Copy/paste works (Ctrl+Shift+C/V)
- [ ] Links clickable (Ctrl+Click URLs)
- [ ] Disconnect/reconnect (disable network)
- [ ] Multiple tabs = independent shells
- [ ] Special keys work (Ctrl+C, Ctrl+D, Ctrl+L)

### Unit Testing (Jest + React Testing Library)

```tsx
// TerminalEmulator.test.tsx
import { render, screen } from '@testing-library/react';
import { TerminalEmulator } from '@/components/terminal';

test('renders terminal container', () => {
  render(<TerminalEmulator />);
  expect(screen.getByText('Connecting...')).toBeInTheDocument();
});

test('shows connected status', async () => {
  // Mock WebSocket
  global.WebSocket = jest.fn(() => ({
    readyState: 1, // OPEN
    onopen: null,
    onmessage: null,
    onclose: null,
    onerror: null,
    send: jest.fn(),
    close: jest.fn(),
  }));

  render(<TerminalEmulator />);
  // Wait for connection
  await waitFor(() => expect(screen.getByText('Connected')).toBeInTheDocument());
});
```

## Troubleshooting

### Terminal Shows Blank/Black Screen

1. Check container has height: `<div className="h-[400px]">`
2. Verify xterm.css imported: `import '@xterm/xterm/css/xterm.css'`
3. Check browser console for errors

### Input Not Working

1. Verify WebSocket connected (green dot)
2. Check `term.onData` callback registered
3. Verify backend PTY running: `docker exec wireguard wg show` (or check backend logs)

### Resize Not Working

1. Check `FitAddon` loaded: `term.loadAddon(fitAddon)`
2. Verify `fitAddon.fit()` called on mount and resize
3. Check `resize` message sent to backend

### Colors Wrong

1. Verify theme object has all 16 ANSI colors + bright variants
2. Check `TERM=xterm-256color` set in PTY spawn
3. Ensure font supports box-drawing characters

## Migration Guide

### From xterm.js v4 to v5

| v4 | v5 |
|----|----|
| `import { Terminal } from 'xterm'` | `import { Terminal } from '@xterm/xterm'` |
| `import 'xterm/css/xterm.css'` | `import '@xterm/xterm/css/xterm.css'` |
| `Terminal.applyAddon(fitAddon)` | `term.loadAddon(fitAddon)` |

### From Legacy WebSocket API

Old: `ws.send(rawString)`
New: `ws.send(JSON.stringify({ type: 'input', data: rawString }))`

Both supported for backward compatibility.

## API Reference

### TerminalEmulator Props

```typescript
interface TerminalProps {
  className?: string;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
}
```

### Exported Types

```typescript
export interface TerminalProps { ... }
export function TerminalEmulator(props: TerminalProps): JSX.Element
```

### Internal Methods (for advanced use)

```typescript
// Access via ref (not recommended for normal use)
const terminalRef = useRef<TerminalEmulatorRef>(null);

interface TerminalEmulatorRef {
  connect: () => void;
  disconnect: () => void;
  sendInput: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  getTerminal: () => Terminal | null;
}
```

## Related Files

- `frontend/src/components/terminal/Terminal.tsx` — Main component
- `frontend/src/components/terminal/index.ts` — Exports
- `backend/src/pty/ptyServer.ts` — Backend PTY server
- `frontend/.env` — `VITE_API_HOST` configuration