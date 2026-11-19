# Quick Start Guide

Get the Terminal Emulator running in 5 minutes.

## Prerequisites

- Node.js 20+
- Linux/macOS (Windows: use WSL2)

## 1. Clone & Install

```bash
# Navigate to project
cd /home/morteza/Projects/terminal

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install
```

## 2. Start Development Servers

**Terminal 1 - Backend:**
```bash
cd /home/morteza/Projects/terminal/backend
npm run dev
```

Output:
```
[PTY] WebSocket server ready on /api/pty
🚀 Server running in development mode
📡 Listening on port 3000
🔗 Health check: http://localhost:3000/api/health
🔗 API base: http://localhost:3000/api
🔌 PTY WebSocket: ws://localhost:3000/api/pty
```

**Terminal 2 - Frontend:**
```bash
cd /home/morteza/Projects/terminal/frontend
npm run dev
```

Output:
```
VITE v8.3.8  ready in 275 ms
➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

## 3. Open in Browser

Navigate to **http://localhost:5173**

You should see a terminal with a working shell prompt!

## 4. Test It

Try these commands in the terminal:

```bash
# Basic commands
ls -la
pwd
whoami

# System info
uname -a
df -h
free -h

# Process management
htop
ps aux

# Network
ping google.com
curl -I https://github.com

# Editor (if installed)
vim test.txt
nano test.txt
```

## 5. Key Features to Test

| Feature | How to Test |
|---------|-------------|
| **Colors** | `ls --color=auto` or `ls -la` |
| **Resize** | Drag browser window corners |
| **Copy/Paste** | Select text → Ctrl+Shift+C, click → Ctrl+Shift+V |
| **Links** | Ctrl+Click on URLs in output |
| **Reconnect** | Disable network → wait → re-enable |
| **Multiple tabs** | Open http://localhost:5173 in new tabs |

## Project Structure

```
terminal/
├── backend/           # Node.js + Express + WebSocket
│   ├── src/
│   │   ├── index.ts   # Entry point
│   │   ├── app.ts     # Express app
│   │   └── pty/
│   │       └── ptyServer.ts  # PTY WebSocket server
│   └── package.json
│
├── frontend/          # React + Vite + xterm.js
│   ├── src/
│   │   ├── App.tsx
│   │   └── components/terminal/
│   │       └── Terminal.tsx  # Terminal component
│   └── package.json
│
└── docs/              # Documentation
```

## Common Commands

```bash
# Backend
cd backend
npm run dev      # Start with hot reload
npm run build    # TypeScript compile
npm run start    # Production start
npm run lint     # Check code style
npm run format   # Format code

# Frontend
cd frontend
npm run dev      # Start Vite dev server
npm run build    # Production build
npm run preview  # Preview production build
npm run lint     # Check code style
npm run format   # Format code
```

## Troubleshooting

### Port 3000 Already in Use
```bash
# Kill existing process
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 npm run dev
```

### Frontend Can't Connect to Backend
1. Check backend is running: `curl http://localhost:3000/api/health`
2. Check `VITE_API_HOST` in `frontend/.env`
3. Check browser console for WebSocket errors

### Terminal Shows Garbled Text
- Ensure terminal theme matches (dark theme default)
- Check font supports box-drawing characters

### Windows Users
Use WSL2:
```bash
wsl -d Ubuntu
cd /mnt/c/Projects/terminal
# Then follow normal steps
```

## Next Steps

- Read [Development Guide](DEVELOPMENT.md) for contributing
- Read [Deployment Guide](DEPLOYMENT.md) for production
- Read [API Reference](API_REFERENCE.md) for integration
- Read [Terminal Component Docs](TERMINAL_COMPONENT.md) for customization