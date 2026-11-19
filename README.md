# Terminal Emulator

A full-stack Linux terminal emulator running in the browser, built with React, xterm.js, Node.js, and WebSockets.

## Overview

This project provides a real Linux terminal experience in the browser. The frontend uses **xterm.js** (the same terminal engine powering VS Code) to render a fully-featured terminal, while the backend spawns actual pseudo-terminals (PTYs) running your system shell (bash, zsh, fish, etc.) and communicates via WebSocket.

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Browser (React + xterm.js)                  │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ TerminalEmulator Component                                  │   │
│  │ - xterm.js core (terminal rendering)                        │   │
│  │ - FitAddon (auto-resize to container)                       │   │
│  │ - WebLinksAddon (clickable URLs)                            │   │
│  │ - ClipboardAddon (copy/paste)                               │   │
│  └──────────────────────────────┬──────────────────────────────┘   │
│                                 │ WebSocket                         │
└─────────────────────────────────┼───────────────────────────────────┘
                                  │ ws://localhost:3000/api/pty
┌─────────────────────────────────┼───────────────────────────────────┐
│                      Backend (Node.js + Express + ws)               │
│  ┌──────────────────────────────┴──────────────────────────────┐   │
│  │ PTY WebSocket Server                                        │   │
│  │ - node-pty (spawns real PTY with bash/zsh/fish)            │   │
│  │ - Session management (multiple concurrent terminals)        │   │
│  │ - Resize handling (SIGWINCH)                                │   │
│  │ - Graceful shutdown                                         │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

  How it works

  This is a client–server setup — the frontend does not run a terminal itself. It's a React + xterm.js UI that connects over
  WebSocket to the backend, which spawns a real PTY (pseudo-terminal) running your Linux shell (/bin/bash or $SHELL).

  - Backend (/home/morteza/Projects/terminal/backend): Express + ws + node-pty. Listens on port 3000 (configurable via PORT).
    WebSocket endpoint: ws://<host>:3000/api/pty.
  - Frontend (/home/morteza/Projects/terminal/frontend): Vite + React + xterm.js. Connects to the backend WebSocket, sends
    keystrokes, renders terminal output. Configured via VITE_API_HOST.

  Steps to run on any Linux machine

  1. Prerequisites on the target machine

  You need Node.js ≥ 26 (check backend/package.json "engines": {"node": ">=26.0.0"}).

  # Check node version
  node --version
  # If needed, install Node 26+ (e.g. via nvm)
  nvm install 26
  nvm use 26

  2. Copy the project to the machine

  Copy the whole repo (or just backend/ and frontend/) to the target Linux box:

  scp -r /home/morteza/Projects/terminal user@<linux-machine>:~/

  3. Backend setup

  cd ~/terminal/backend

  # Install dependencies
  npm install

  # Configure (optional) — create .env from example
  cp .env.example .env
  # Edit PORT, CORS_ORIGIN, etc. if needed

  # Start the backend (dev mode with auto-reload)
  npm run dev
  # or for production:
  # npm start

  The backend will print something like:
  🚀 Server running in development mode
  📡 Listening on port 3000
  🔌 PTY WebSocket: ws://localhost:3000/api/pty

  4. Frontend setup

  cd ~/terminal/frontend

  # Install dependencies
  npm install

  # Point the frontend at your backend
  # Edit .env: VITE_API_HOST=<backend-host>:3000
  # For local machine: VITE_API_HOST=localhost:3000
  # For remote access: VITE_API_HOST=<your-linux-machine-ip-or-domain>:3000

  # Build for production
  npm run build

  This produces static files in frontend/dist/.

  5. Serve the frontend

  You can serve dist/ with any static server. Quick options:

  # Option A: vite preview (good for testing)
  npm run preview

  # Option B: serve with npx serve
  npx serve -s dist -l 5173

  # Option C: serve with nginx/apache (production)

  6. Open in browser

  Navigate to http://<linux-machine-ip-or-domain>:5173 (or whatever port you serve the frontend on).

  The header shows the WebSocket URL (ws://localhost:3000/api/pty by default). If you're accessing from another machine, make sure
  VITE_API_HOST points to the backend's reachable host, not localhost.

  Important notes

  ┌─────────────────┬─────────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │  Consideration  │                                                 Details                                                 │
  ├─────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Real shell      │ The backend spawns process.env.SHELL || '/bin/bash', so you get a genuine Linux terminal — ls, cd, ssh, │
  │                 │  vim, etc. all work.                                                                                    │
  ├─────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ CORS            │ Backend corsOrigin defaults to http://localhost:5173. If serving the frontend elsewhere, set            │
  │                 │ CORS_ORIGIN in backend .env to match.                                                                   │
  ├─────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Firewall        │ Make sure ports 3000 (backend API/WebSocket) and 5173 (frontend) are open if accessing from another     │
  │                 │ machine.                                                                                                │
  ├─────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ PTY vs SSH      │ This is not an SSH replacement — it's a web-based terminal emulator connected to a local shell on the   │
  │                 │ machine where the backend runs.                                                                         │
  ├─────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Environment     │ Frontend reads VITE_API_HOST at build time, so rebuild (npm run build) after changing it.               │
  │ vars            │                                                                                                         │
  └─────────────────┴─────────────────────────────────────────────────────────────────────────────────────────────────────────┘

  Quick one-liner summary

  # Backend
  cd backend && npm install && npm run dev

  # Frontend (in another terminal)
  cd frontend && echo "VITE_API_HOST=localhost:3000" > .env && npm install && npm run build && npm run preview

  Then open http://localhost:5173 in your browser.



## Features

- **Real PTY** — Not a simulation; spawns actual `bash`/`zsh`/`fish` processes
- **Full terminal emulation** — Colors, cursor, scrolling, escape sequences
- **Auto-reconnect** — Automatically reconnects on network interruption
- **Responsive resize** — Terminal resizes with browser window
- **Copy/Paste** — Native clipboard integration
- **Clickable links** — URLs, file paths, commands become clickable
- **Multiple sessions** — Each browser tab gets its own isolated shell
- **Dark theme** — Optimized terminal color scheme
- **Connection status** — Visual indicator (green/red dot)

## Quick Start

### Prerequisites

- Node.js 20+
- npm or pnpm
- Linux/macOS (for PTY support; Windows requires WSL2)

### Installation

```bash
# Clone/navigate to project
cd /home/morteza/Projects/terminal

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install
```

### Development

```bash
# Terminal 1: Start backend (port 3000)
cd backend && npm run dev

# Terminal 2: Start frontend (port 5173)
cd frontend && npm run dev
```

Open **http://localhost:5173** in your browser.

### Production Build

```bash
# Build frontend
cd frontend && npm run build

# Build backend (TypeScript compilation)
cd ../backend && npx tsc

# Run production
cd backend && npm start
```

## Project Structure

```
terminal/
├── backend/                          # Node.js/Express backend
│   ├── src/
│   │   ├── index.ts                  # Entry point, HTTP + WebSocket server
│   │   ├── app.ts                    # Express app configuration
│   │   ├── config/index.ts           # Environment configuration
│   │   ├── middleware/               # Express middleware
│   │   │   ├── requestId.ts          # Request ID tracking
│   │   │   └── errorHandler.ts       # Error handling
│   │   ├── routes/                   # API routes
│   │   │   ├── index.ts              # Route registry
│   │   │   └── health.ts             # Health check endpoint
│   │   └── pty/
│   │       └── ptyServer.ts          # WebSocket PTY server (core)
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env                          # PORT=3000, CORS_ORIGIN, etc.
│   └── .env.example
│
├── frontend/                         # React + Vite frontend
│   ├── src/
│   │   ├── main.tsx                  # React entry point
│   │   ├── App.tsx                   # Main app component
│   │   ├── App.css                   # App-specific styles
│   │   ├── index.css                 # Global styles (Tailwind + shadcn)
│   │   ├── components/
│   │   │   ├── terminal/             # Terminal emulator component
│   │   │   │   ├── Terminal.tsx      # Main terminal component
│   │   │   │   └── index.ts          # Exports
│   │   │   └── ui/                   # shadcn/ui components
│   │   ├── hooks/                    # Custom React hooks
│   │   └── lib/utils.ts              # Utility functions (cn)
│   ├── public/
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── .env                          # VITE_API_HOST=localhost:3000
│   └── .env.example
│
└── README.md                         # This file
```

## Architecture Deep Dive

### Backend: PTY WebSocket Server (`backend/src/pty/ptyServer.ts`)

The core of the backend is the PTY server that:

1. **Upgrades HTTP to WebSocket** on `/api/pty` endpoint
2. **Spawns a PTY** using `node-pty` for each connection
3. **Bridges data** between WebSocket and PTY:
   - PTY stdout/stderr → WebSocket messages (binary/text)
   - WebSocket messages → PTY stdin
4. **Handles resize** messages from frontend
5. **Manages lifecycle** — cleanup on disconnect, error handling

```typescript
// Key flow:
WebSocket 'upgrade' → spawn PTY (bash) → bidirectional pipe
                                    ↓
                            PTY.onData → ws.send()
                            ws.onmessage → pty.write()
                            ws.onclose → pty.kill()
```

**Session Management:**
- Each connection gets a unique session ID
- Sessions stored in `Map<string, { pty, ws }>`
- Automatic cleanup on disconnect/error
- Graceful shutdown on SIGTERM/SIGINT

### Frontend: TerminalEmulator (`frontend/src/components/terminal/Terminal.tsx`)

The React component that:

1. **Initializes xterm.js** with FitAddon, WebLinksAddon, ClipboardAddon
2. **Establishes WebSocket** connection to backend
3. **Handles I/O**:
   - `term.onData()` → sends input to backend
   - `ws.onmessage()` → writes to terminal
4. **Manages resize**:
   - `ResizeObserver` + `window.resize` → `fitAddon.fit()` → terminal.resize() → backend resize
5. **Auto-reconnects** on disconnect (3s delay)
6. **Shows connection status** (connected/connecting/disconnected)

## Configuration

### Backend (`.env`)

```bash
# Server
PORT=3000
NODE_ENV=development

# CORS
CORS_ORIGIN=http://localhost:5173

# Logging
LOG_LEVEL=debug
```

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | HTTP/WebSocket server port | `3000` |
| `NODE_ENV` | Environment mode | `development` |
| `CORS_ORIGIN` | Allowed frontend origin | `http://localhost:5173` |
| `LOG_LEVEL` | Log verbosity | `debug` |

### Frontend (`.env`)

```bash
# Backend API host for WebSocket connection
VITE_API_HOST=localhost:3000
```

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_HOST` | Backend host:port | `localhost:3000` |

The WebSocket URL is constructed as:
```
ws://localhost:3000/api/pty     (HTTP)
wss://yourdomain.com/api/pty    (HTTPS)
```

## API Reference

### WebSocket Protocol

**Endpoint:** `ws://localhost:3000/api/pty`

#### Client → Server Messages

| Type | Payload | Description |
|------|---------|-------------|
| `input` | `{ type: 'input', data: string }` | Keystrokes, paste data |
| `resize` | `{ type: 'resize', cols: number, rows: number }` | Terminal resize |

**Raw input** (backward compatibility): Plain string sent directly to PTY stdin.

#### Server → Client Messages

Raw terminal output (ANSI escape sequences, UTF-8 text) as binary or text frames.

### HTTP Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check |

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-11-19T03:37:53.563Z",
  "uptime": 13.015767284,
  "environment": "development",
  "version": "1.0.0"
}
```

## Development Guide

### Adding New Backend Routes

1. Create route file in `backend/src/routes/`
2. Register in `backend/src/routes/index.ts`

```typescript
// backend/src/routes/myFeature.ts
import { Router } from 'express';
const router = Router();
router.get('/', (req, res) => res.json({ message: 'Hello' }));
export default router;

// backend/src/routes/index.ts
import myFeatureRouter from './myFeature.ts';
router.use('/my-feature', myFeatureRouter);
```

### Extending Terminal Component

The `TerminalEmulator` component accepts props:

```typescript
interface TerminalProps {
  className?: string;           // Additional CSS classes
  onConnect?: () => void;       // Called on successful connection
  onDisconnect?: () => void;    // Called on disconnect
  onError?: (error: Error) => void; // Called on connection error
}
```

Usage:
```tsx
<TerminalEmulator
  className="h-[600px]"
  onConnect={() => console.log('Connected!')}
  onDisconnect={() => console.log('Disconnected')}
  onError={(err) => console.error(err)}
/>
```

### Customizing Terminal Theme

Modify the `theme` object in `Terminal.tsx`:

```typescript
theme: {
  background: '#0d0d0d',
  foreground: '#e0e0e0',
  cursor: '#ffffff',
  // ... 16 ANSI colors + bright variants
}
```

### Changing Default Shell

In `ptyServer.ts`, the shell is determined by:

```typescript
function getShell(): string {
  return process.env.SHELL || '/bin/bash';
}
```

Override via environment:
```bash
SHELL=/bin/zsh npm run dev
```

## Troubleshooting

### Port Already in Use

```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 npm run dev
```

### WebSocket Connection Fails

1. Check backend is running: `curl http://localhost:3000/api/health`
2. Verify `VITE_API_HOST` in frontend `.env`
3. Check browser console for WebSocket errors
4. Ensure no firewall blocking port 3000

### Terminal Shows Garbled Text

- Ensure terminal theme colors match terminal capabilities
- Check `TERM=xterm-256color` is set in PTY spawn options
- Verify font supports box-drawing characters (JetBrains Mono included)

### PTY Spawn Fails (Windows)

- Requires WSL2 with default Linux distro
- Run backend inside WSL2: `wsl -d Ubuntu -- cd /mnt/c/.../backend && npm run dev`
- Or use `node-pty` with `cmd.exe` / `powershell.exe` (different API)

### Module Resolution Errors

```bash
# Clear caches
cd frontend && rm -rf node_modules package-lock.json && npm install
cd ../backend && rm -rf node_modules package-lock.json && npm install
```

## Security Considerations

⚠️ **Important:** This gives full shell access to the server!

### For Production Deployment:

1. **Authentication** — Add auth middleware before PTY upgrade
2. **Authorization** — Restrict which users can spawn PTYs
3. **Rate Limiting** — Limit connections per IP/user
4. **Audit Logging** — Log all commands executed
5. **Network Isolation** — Run in container/VM with limited permissions
6. **TLS** — Use `wss://` with valid certificates
7. **Resource Limits** — Limit PTY count, CPU, memory per session

### Example Auth Middleware:

```typescript
// In ptyServer.ts upgrade handler
server.on('upgrade', (request, socket, head) => {
  const token = new URL(request.url, `http://${request.headers.host}`).searchParams.get('token');
  if (!validateToken(token)) {
    socket.destroy();
    return;
  }
  // ... proceed with upgrade
});
```

## Performance

- **Memory per session**: ~2-5 MB (PTY + WebSocket buffers)
- **CPU**: Minimal (idle shell uses ~0% CPU)
- **Latency**: ~1-5ms local, ~50-200ms over internet
- **Max concurrent sessions**: Limited by file descriptors (default ~1024)

### Optimization Tips

1. **Enable compression** — Use `permessage-deflate` WebSocket extension
2. **Limit scrollback** — Reduce `scrollback: 10000` if memory constrained
3. **Connection pooling** — Reuse PTYs for short-lived sessions (advanced)

## Testing

### Manual Testing

```bash
# 1. Start both servers
# 2. Open http://localhost:5173 in multiple tabs
# 3. Verify each gets independent shell
# 4. Test: ls, vim, htop, tmux, ssh
# 5. Resize browser window
# 6. Disconnect network → verify reconnect
```

### Automated Tests (TODO)

```bash
# Backend
cd backend && npm test

# Frontend
cd frontend && npm test

# E2E
npm run test:e2e
```

## Deployment

### Docker (Recommended)

```dockerfile
# docker-compose.yml
version: '3.8'
services:
  backend:
    build: ./backend
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - CORS_ORIGIN=https://yourdomain.com
    volumes:
      - /lib/modules:/lib/modules:ro
    cap_add:
      - SYS_ADMIN  # Required for PTY in some containers

  frontend:
    build: ./frontend
    ports:
      - "80:80"
    environment:
      - VITE_API_HOST=yourdomain.com
```

### Systemd Service

```ini
# /etc/systemd/system/terminal-backend.service
[Unit]
Description=Terminal Backend
After=network.target

[Service]
Type=simple
User=terminal
WorkingDirectory=/opt/terminal/backend
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```

### Reverse Proxy (Nginx)

```nginx
server {
    listen 443 ssl;
    server_name terminal.yourdomain.com;

    # Frontend
    location / {
        proxy_pass http://localhost:5173;
    }

    # Backend WebSocket
    location /api/pty {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }

    # Backend REST
    location /api/ {
        proxy_pass http://localhost:3000;
    }
}
```

## Dependencies

### Backend
| Package | Version | Purpose |
|---------|---------|---------|
| `express` | ^4.19 | HTTP server |
| `ws` | ^8.x | WebSocket server |
| `node-pty` | ^1.1 | PTY spawning |
| `cors` | ^2.8 | CORS middleware |
| `helmet` | ^7.1 | Security headers |
| `morgan` | ^1.10 | HTTP logging |
| `zod` | ^3.23 | Schema validation |
| `dotenv` | ^16.4 | Environment config |

### Frontend
| Package | Version | Purpose |
|---------|---------|---------|
| `react` | ^19.3 | UI framework |
| `react-dom` | ^19.3 | DOM renderer |
| `@xterm/xterm` | ^5.x | Terminal emulator |
| `@xterm/addon-fit` | ^0.x | Auto-resize |
| `@xterm/addon-web-links` | ^0.x | Clickable links |
| `@xterm/addon-clipboard` | ^0.x | Copy/paste |
| `tailwindcss` | ^4.3 | Styling |
| `@shadcn/react` | ^0.3 | UI components |
| `vite` | ^8.3 | Build tool |
| `typescript` | ^7.0 | Type checking |

## License

MIT License — Feel free to use, modify, and distribute.

## Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## Documentation

| Document | Description |
|----------|-------------|
| [Quick Start](docs/QUICK_START.md) | Get running in 5 minutes |
| [Development Guide](docs/DEVELOPMENT.md) | Contributing, code style, workflows |
| [Deployment Guide](docs/DEPLOYMENT.md) | Docker, systemd, Kubernetes, Nginx |
| [API Reference](docs/API_REFERENCE.md) | HTTP & WebSocket APIs |
| [Terminal Component](docs/TERMINAL_COMPONENT.md) | Frontend component API |
| [PTY Server](docs/PTY_SERVER.md) | Backend PTY server internals |

---

**Built with ❤️ using React, xterm.js, Node.js, and WebSockets**
