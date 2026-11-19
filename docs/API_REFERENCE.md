# API Reference

## Overview

This document describes all APIs exposed by the Terminal Emulator project.

## Base URLs

| Environment | Frontend | Backend |
|-------------|----------|---------|
| Development | http://localhost:5173 | http://localhost:3000 |
| Production | https://yourdomain.com | https://yourdomain.com |

## HTTP API (REST)

### Health Check

**Endpoint:** `GET /api/health`

**Description:** Returns server health status and metadata.

**Response:** `200 OK`

```json
{
  "status": "ok",
  "timestamp": "2026-11-19T03:37:53.563Z",
  "uptime": 13.015767284,
  "environment": "development",
  "version": "1.0.0"
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | Always "ok" if healthy |
| `timestamp` | string | ISO 8601 timestamp |
| `uptime` | number | Server uptime in seconds |
| `environment` | string | NODE_ENV value |
| `version` | string | Package version |

---

### Future Endpoints (Planned)

These endpoints are planned for future versions:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/sessions` | List active PTY sessions (admin) |
| `GET` | `/api/v1/sessions/:id` | Get session details |
| `DELETE` | `/api/v1/sessions/:id` | Terminate session |
| `GET` | `/api/v1/stats` | Server statistics |
| `GET` | `/api/v1/metrics` | Prometheus metrics |

---

## WebSocket API

### Connection

**Endpoint:** `ws://localhost:3000/api/pty` (or `wss://` for HTTPS)

**Protocol:** WebSocket (RFC 6455)

**Upgrade Headers:**
```
GET /api/pty HTTP/1.1
Host: localhost:3000
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Version: 13
Sec-WebSocket-Key: <base64-encoded-random>
```

### Message Types

All messages are JSON objects with a `type` field.

#### Client → Server

##### 1. Input Message

Send keystrokes, paste data, or commands to the PTY.

```json
{
  "type": "input",
  "data": "ls -la\n"
}
```

**Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Must be `"input"` |
| `data` | string | Yes | Raw input data (UTF-8) |

**Examples:**
```json
// Simple command
{"type": "input", "data": "ls\n"}

// With special keys
{"type": "input", "data": "\u0003"}  // Ctrl+C

// Paste
{"type": "input", "data": "echo 'hello world'\n"}

// Tab completion
{"type": "input", "data": "ec\u0009"}  // "ec" + Tab
```

##### 2. Resize Message

Notify backend of terminal size change.

```json
{
  "type": "resize",
  "cols": 120,
  "rows": 40
}
```

**Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Must be `"resize"` |
| `cols` | number | Yes | Terminal width in characters |
| `rows` | number | Yes | Terminal height in rows |

**Valid Ranges:**
- `cols`: 10–500
- `rows`: 5–200

##### 3. Raw Input (Legacy)

For backward compatibility, plain strings are also accepted:

```
ls -la\n
```

This is equivalent to:
```json
{"type": "input", "data": "ls -la\n"}
```

---

#### Server → Client

The server sends raw terminal output as WebSocket frames (binary or text). No JSON wrapper.

**Frame Types:**
- **Text frame:** UTF-8 encoded terminal output
- **Binary frame:** Raw bytes (for non-UTF8 output)

**Content:** ANSI escape sequences + UTF-8 text

**Examples:**
```
// Prompt
"\u001b[0m\u001b[32muser@host\u001b[0m:\u001b[34m~\u001b[0m$ "

// Command output
"file1.txt\nfile2.txt\nfolder/\n"

// Color output (ls --color)
"\u001b[0m\u001b[34mfolder\u001b[0m/\n\u001b[0mfile.txt\n"

// Cursor movement
"\u001b[H\u001b[2J"  // Clear screen, home cursor
```

---

### Connection Lifecycle

```
1. Client connects to ws://host/api/pty
       │
       ▼
2. Server accepts upgrade
       │
       ▼
3. Server spawns PTY (bash)
       │
       ▼
4. Server sends initial prompt
       │
       ▼
5. Bidirectional communication
   ┌─────────────────────────┐
   │ Client: input/resize    │
   │ Server: terminal output │
   └─────────────────────────┘
       │
       ▼
6. Client disconnects OR PTY exits
       │
       ▼
7. Server kills PTY, cleans up
```

---

### Error Handling

#### WebSocket Close Codes

| Code | Meaning | Reason |
|------|---------|--------|
| `1000` | Normal closure | PTY exited cleanly |
| `1001` | Going away | Server shutting down |
| `1006` | Abnormal closure | Network failure |
| `1008` | Policy violation | Invalid message format |
| `1011` | Internal error | PTY spawn/execution error |

#### Close Reason Strings

```
"Process exited with code 0"
"Process exited with code 1"
"Process killed by signal SIGTERM"
"PTY error"
"Server shutting down"
```

---

## Frontend Component API

### TerminalEmulator Props

```typescript
interface TerminalProps {
  className?: string;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
}
```

#### `className`

Additional CSS classes for the container element.

```tsx
<TerminalEmulator className="h-[600px] border-2 border-blue-500" />
```

#### `onConnect`

Called when WebSocket connection is established.

```tsx
<TerminalEmulator 
  onConnect={() => {
    console.log('Terminal ready');
    analytics.track('terminal_connected');
  }} 
/>
```

#### `onDisconnect`

Called when WebSocket connection closes (intentionally or due to error).

```tsx
<TerminalEmulator 
  onDisconnect={() => {
    console.log('Terminal disconnected');
    showNotification('Terminal disconnected, reconnecting...');
  }} 
/>
```

#### `onError`

Called when a connection error occurs.

```tsx
<TerminalEmulator 
  onError={(error) => {
    console.error('Terminal error:', error);
    sentry.captureException(error);
  }} 
/>
```

---

### TerminalEmulator Ref (Advanced)

Access internal methods via `useRef`:

```tsx
const terminalRef = useRef<TerminalRef>(null);

interface TerminalRef {
  connect: () => void;
  disconnect: () => void;
  sendInput: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  getTerminal: () => Terminal | null;
}

// Usage
<button onClick={() => terminalRef.current?.sendInput('ls\n')}>
  Send ls
</button>
```

---

## Configuration API

### Backend Environment Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `PORT` | number | `3000` | HTTP server port |
| `NODE_ENV` | string | `development` | Environment mode |
| `CORS_ORIGIN` | string | `http://localhost:5173` | Allowed origin for CORS |
| `LOG_LEVEL` | string | `debug` | Log level (debug, info, warn, error) |

### Frontend Environment Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `VITE_API_HOST` | string | `localhost:3000` | Backend host:port for WebSocket |

---

## Error Codes

### HTTP Errors

| Status | Code | Message |
|--------|------|---------|
| 404 | `NOT_FOUND` | Route not found |
| 500 | `INTERNAL_ERROR` | Server error |
| 503 | `SERVICE_UNAVAILABLE` | Server overloaded |

### WebSocket Errors

| Code | Name | Description |
|------|------|-------------|
| `WS_CONNECTION_FAILED` | Connection failed | Could not establish WebSocket |
| `WS_AUTH_FAILED` | Authentication failed | Invalid/missing auth token |
| `WS_PTY_SPAWN_FAILED` | PTY spawn failed | Could not spawn shell process |
| `WS_SESSION_LIMIT` | Session limit reached | Max concurrent sessions exceeded |

---

## Rate Limits

### Current (Development)

No rate limiting in development mode.

### Production (Planned)

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/health` | 60 req/min | 1 minute |
| `/api/pty` (upgrade) | 10 conn/min | 1 minute |
| `/api/pty` (messages) | 1000 msg/min | 1 minute |

---

## Versioning

### API Version

Current version: `1.0.0`

Version is returned in:
- `GET /api/health` → `version` field
- Package.json `version` field

### Breaking Changes

Breaking changes will:
1. Increment major version
2. Be documented in CHANGELOG.md
3. Have migration guide
4. Maintain backward compatibility for 1 minor version

---

## Examples

### Complete WebSocket Session

```javascript
// Client-side example
const ws = new WebSocket('ws://localhost:3000/api/pty');

ws.onopen = () => {
  console.log('Connected to terminal');
  
  // Set initial size
  ws.send(JSON.stringify({ type: 'resize', cols: 80, rows: 24 }));
};

ws.onmessage = (event) => {
  const output = typeof event.data === 'string' 
    ? event.data 
    : new TextDecoder().decode(event.data);
  
  // Render to terminal (using xterm.js or similar)
  terminal.write(output);
};

ws.onclose = (event) => {
  console.log('Disconnected:', event.code, event.reason);
};

// Send command
function sendCommand(cmd) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'input', data: cmd + '\n' }));
  }
}

// Resize
function resize(cols, rows) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'resize', cols, rows }));
  }
}

// Usage
sendCommand('ls -la');
sendCommand('echo "Hello World"');
resize(120, 40);
```

### Health Check Monitoring

```bash
#!/bin/bash
# Health check script for monitoring

HEALTH_URL="https://terminal.yourdomain.com/api/health"
RESPONSE=$(curl -s -f "$HEALTH_URL")

if [ $? -ne 0 ]; then
  echo "HEALTH CHECK FAILED: Cannot reach $HEALTH_URL"
  exit 1
fi

STATUS=$(echo "$RESPONSE" | jq -r '.status')
UPTIME=$(echo "$RESPONSE" | jq -r '.uptime')

if [ "$STATUS" != "ok" ]; then
  echo "HEALTH CHECK FAILED: Status is $STATUS"
  exit 1
fi

echo "HEALTH OK: Uptime ${UPTIME}s"
exit 0
```

---

## Changelog

### v1.0.0 (2026-11-19)
- Initial release
- WebSocket PTY endpoint at `/api/pty`
- Health check at `/api/health`
- TerminalEmulator React component
- xterm.js integration with FitAddon, WebLinksAddon, ClipboardAddon
- Auto-reconnect on disconnect
- Resize handling