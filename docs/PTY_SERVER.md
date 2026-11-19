# PTY WebSocket Server Documentation

## Overview

The PTY WebSocket Server (`backend/src/pty/ptyServer.ts`) is the core backend component that bridges WebSocket connections to actual pseudo-terminals (PTYs) running system shells (bash, zsh, fish, etc.).

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      HTTP Server (Express)                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  Upgrade Handler                         │   │
│  │  GET /api/pty → WebSocket Upgrade                        │   │
│  └────────────────────────────┬────────────────────────────┘   │
└───────────────────────────────┼────────────────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
            ┌─────────────┐           ┌─────────────┐
            │  WebSocket  │           │  WebSocket  │
            │  Server     │           │  Server     │
            │  (ws)       │           │  (ws)       │
            └──────┬──────┘           └──────┬──────┘
                   │                         │
         ┌─────────┴─────────┐       ┌───────┴───────┐
         ▼                   ▼       ▼               ▼
    ┌─────────┐         ┌─────────┐             ┌─────────┐
    │  PTY 1  │         │  PTY 2  │      ...    │  PTY N  │
    │ (bash)  │         │ (zsh)   │             │ (fish)  │
    └─────────┘         └─────────┘             └─────────┘
```

## Key Components

### 1. Session Management

Each WebSocket connection gets a unique session with its own PTY:

```typescript
interface PtyConnection {
  pty: IPty;           // node-pty instance
  ws: WebSocket;       // WebSocket connection
}

const connections = new Map<string, PtyConnection>();
```

**Session Lifecycle:**
1. WebSocket upgrade request received
2. Generate unique session ID
3. Spawn PTY with `node-pty`
4. Store in `connections` Map
5. Bridge data bidirectionally
6. Cleanup on disconnect/error

### 2. PTY Spawning

```typescript
function createPtySession(cols: number, rows: number): IPty {
  const shell = getShell();  // process.env.SHELL || '/bin/bash'
  const cwd = process.env.HOME || process.cwd();

  return spawn(shell, [], {
    name: 'xterm-256color',
    cols,
    rows,
    cwd,
    env: {
      ...process.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      FORCE_COLOR: '1',
    },
  });
}
```

**Environment Variables Set:**
| Variable | Value | Purpose |
|----------|-------|---------|
| `TERM` | `xterm-256color` | Terminal type for 256-color support |
| `COLORTERM` | `truecolor` | Indicates truecolor (24-bit) support |
| `FORCE_COLOR` | `1` | Forces color output in tools like `ls`, `grep` |

### 3. Data Flow

```
Frontend (xterm.js)                    Backend (node-pty)
┌─────────────────┐                    ┌─────────────────┐
│ term.onData()   │                    │ pty.onData()    │
│     │           │                    │     │           │
│     ▼           │                    │     ▼           │
│ ws.send()  ─────┼───────────────────►│  stdout/stderr  │
│                 │   WebSocket        │     │           │
│ ws.onmessage()  │◄───────────────────┼─────┘           │
│     │           │   (binary/text)    │ pty.write()     │
│     ▼           │                    │     ▲           │
│ term.write()    │                    │ stdin           │
└─────────────────┘                    └─────────────────┘
```

### 4. Message Protocol

#### Client → Server

**Structured (JSON):**
```typescript
// Input (keystrokes, paste)
{ type: 'input', data: 'ls -la\n' }

// Resize
{ type: 'resize', cols: 120, rows: 40 }
```

**Raw (legacy/fallback):**
```
ls -la\n
```

#### Server → Client

Raw terminal output (ANSI escape sequences, UTF-8):
```
\u001b[0m\u001b[32muser@host\u001b[0m:\u001b[34m~\u001b[0m$
```

## API Reference

### `setupPtyServer(server: http.Server): WebSocketServer`

Attaches WebSocket upgrade handler to an existing HTTP server.

**Parameters:**
- `server` — Node.js `http.Server` instance (from `app.listen()`)

**Returns:** `WebSocketServer` instance

**Side Effects:**
- Registers `upgrade` event handler on server
- Creates WebSocketServer with `noServer: true`
- Logs startup message in development mode

### `getActiveSessionsCount(): number`

Returns the number of currently active PTY sessions.

```typescript
import { getActiveSessionsCount } from './pty/ptyServer.ts';

console.log(`Active terminals: ${getActiveSessionsCount()}`);
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SHELL` | `/bin/bash` | Default shell to spawn |
| `HOME` | `process.cwd()` | Working directory for PTY |
| `TERM` | `xterm-256color` | Terminal type (set internally) |

### PTY Options

```typescript
spawn(shell, [], {
  name: 'xterm-256color',  // Terminal type
  cols: 80,                // Initial columns
  rows: 24,                // Initial rows
  cwd: '/home/user',       // Working directory
  env: { ... }             // Environment variables
})
```

## Event Handlers

### PTY Events

| Event | Handler | Description |
|-------|---------|-------------|
| `onData` | `data => ws.send(data)` | PTY output → WebSocket |
| `onExit` | `({exitCode, signal}) => ws.close()` | Process exited → close WS |
| `onError` | `error => ws.close(1011)` | PTY error → close WS |

### WebSocket Events

| Event | Handler | Description |
|-------|---------|-------------|
| `onopen` | `() => setConnected(true)` | Connection established |
| `onmessage` | `data => pty.write(data)` | Input → PTY stdin |
| `onclose` | `() => pty.kill()` | Disconnect → kill PTY |
| `onerror` | `error => pty.kill()` | WS error → kill PTY |

## Resize Handling

```typescript
ws.on('message', (data) => {
  const parsed = JSON.parse(data.toString());
  
  if (parsed.type === 'resize' && parsed.cols && parsed.rows) {
    pty.resize(parsed.cols, parsed.rows);
  }
});
```

**Frontend sends resize on:**
- Container resize (ResizeObserver)
- Window resize
- Initial connection

## Error Handling

### Connection Errors

```typescript
ws.on('error', (error) => {
  console.error(`[PTY] WebSocket error for ${sessionId}:`, error);
  pty.kill();
  connections.delete(sessionId);
});
```

### PTY Errors

```typescript
pty.on('error', (error) => {
  console.error(`[PTY] PTY error for ${sessionId}:`, error);
  if (ws.readyState === WebSocket.OPEN) {
    ws.close(1011, 'PTY error');
  }
  connections.delete(sessionId);
});
```

### Process Exit

```typescript
pty.onExit(({ exitCode, signal }) => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.close(1000, `Process exited with code ${exitCode}`);
  }
  connections.delete(sessionId);
});
```

## Graceful Shutdown

```typescript
process.on('SIGTERM', () => {
  connections.forEach(({ pty }) => pty.kill());
  connections.clear();
});
```

On SIGTERM/SIGINT:
1. Kill all active PTYs
2. Clear connections map
3. HTTP server stops accepting connections
4. Existing connections close gracefully

## Security Considerations

⚠️ **Critical:** This provides full shell access to the server!

### Current State (Development)
- No authentication
- No authorization
- No rate limiting
- No command logging
- Runs as current user

### Production Requirements

1. **Authentication**
```typescript
server.on('upgrade', (request, socket, head) => {
  const token = extractToken(request);
  if (!validateToken(token)) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});
```

2. **Authorization**
```typescript
// Check user permissions before spawning PTY
if (!userCanAccessTerminal(user)) {
  ws.close(4003, 'Forbidden');
  return;
}
```

3. **Rate Limiting**
```typescript
const connectionsPerIP = new Map();
server.on('upgrade', (request) => {
  const ip = request.socket.remoteAddress;
  const count = connectionsPerIP.get(ip) || 0;
  if (count > MAX_PER_IP) {
    socket.destroy();
    return;
  }
  connectionsPerIP.set(ip, count + 1);
});
```

4. **Audit Logging**
```typescript
pty.onData((data) => {
  auditLog.log({
    sessionId,
    userId,
    command: data,
    timestamp: new Date()
  });
  ws.send(data);
});
```

5. **Resource Limits**
```typescript
// Limit concurrent sessions
if (connections.size >= MAX_SESSIONS) {
  ws.close(4004, 'Too many sessions');
  return;
}

// Limit PTY lifetime
setTimeout(() => pty.kill(), MAX_SESSION_DURATION);
```

## Testing

### Unit Tests

```typescript
// ptyServer.test.ts
import { createServer } from 'http';
import { WebSocket } from 'ws';
import { setupPtyServer } from './ptyServer';

test('creates PTY on WebSocket connection', async () => {
  const server = createServer();
  setupPtyServer(server);
  
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  
  const ws = new WebSocket(`ws://localhost:${port}/api/pty`);
  
  await new Promise(resolve => ws.onopen = resolve);
  
  // Send input
  ws.send(JSON.stringify({ type: 'input', data: 'echo hello\n' }));
  
  // Receive output
  const output = await new Promise(resolve => {
    ws.onmessage = (e) => resolve(e.data);
  });
  
  expect(output).toContain('hello');
  
  ws.close();
  server.close();
});
```

### Integration Tests

```bash
# 1. Start backend
cd backend && npm run dev

# 2. Test WebSocket with wscat
npm install -g wscat
wscat -c ws://localhost:3000/api/pty

# 3. Send test commands
> {"type":"input","data":"echo test\n"}
< test
> {"type":"resize","cols":100,"rows":30}
< (terminal resized)
```

### Load Testing

```bash
# Install artillery
npm install -g artillery

# Create load test config
cat > load-test.yml <<EOF
config:
  target: "ws://localhost:3000"
  phases:
    - duration: 60
      arrivalRate: 10
scenarios:
  - name: "Terminal session"
    engine: "ws"
    flow:
      - connect:
          url: "/api/pty"
      - send:
          data: '{"type":"input","data":"sleep 10\n"}'
      - wait: 15
      - close
EOF

# Run
artillery run load-test.yml
```

## Monitoring

### Health Check

```typescript
// Add to routes/health.ts
router.get('/pty/stats', (req, res) => {
  res.json({
    activeSessions: getActiveSessionsCount(),
    memoryUsage: process.memoryUsage(),
    uptime: process.uptime()
  });
});
```

### Metrics to Track

| Metric | Alert Threshold |
|--------|-----------------|
| Active sessions | > 1000 |
| Memory per session | > 10 MB |
| PTY spawn failures | > 0 |
| WebSocket errors/min | > 10 |
| Average session duration | N/A |

## Troubleshooting

### PTY Spawn Fails

**Error:** `spawn /bin/bash ENOENT`
```bash
# Check shell exists
ls -la /bin/bash
which bash

# Use full path in code
const shell = '/bin/bash';  // or process.env.SHELL
```

### PTY Spawn Fails (Permission)

**Error:** `spawn /bin/bash EACCES`
```bash
# Check permissions
ls -la /bin/bash
# Should be -rwxr-xr-x

# Run as correct user
sudo -u terminaluser npm run dev
```

### WebSocket Upgrade Fails

**Error:** `WebSocket connection failed`
```bash
# Check server running
curl http://localhost:3000/api/health

# Check port not in use
lsof -i :3000

# Check firewall
sudo ufw status
```

### Resize Not Working

**Symptoms:** Terminal content truncated/wrapped incorrectly
```typescript
// Debug in ptyServer.ts
pty.onData((data) => {
  console.log('[PTY] Output:', data.length, 'bytes');
});

ws.on('message', (data) => {
  console.log('[WS] Received:', data.toString());
});
```

### Memory Leaks

**Symptoms:** Memory grows over time
```typescript
// Check connections map cleanup
setInterval(() => {
  console.log('Active sessions:', connections.size);
  // Should not grow indefinitely
}, 30000);
```

## Performance Tuning

### Node-pty Options

```typescript
spawn(shell, [], {
  name: 'xterm-256color',
  cols: 80,
  rows: 24,
  cwd: process.env.HOME,
  env: { ... },
  // Performance options:
  // encoding: 'utf8',  // Default
  // handleFlowControl: true,  // Default
});
```

### WebSocket Options

```typescript
const wss = new WebSocketServer({
  noServer: true,
  // Performance:
  maxPayload: 16 * 1024 * 1024,  // 16MB max message
  // perMessageDeflate: true,  // Enable compression (CPU tradeoff)
});
```

### System Limits

```bash
# Increase file descriptor limit
ulimit -n 65535

# In systemd service
LimitNOFILE=65535
```

## Related Files

- `backend/src/pty/ptyServer.ts` — Main implementation
- `backend/src/index.ts` — Server setup and integration
- `frontend/src/components/terminal/Terminal.tsx` — Frontend consumer
- `docs/TERMINAL_COMPONENT.md` — Frontend component docs