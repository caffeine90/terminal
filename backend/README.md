# Terminal Backend

A TypeScript/Express/Node.js backend for a terminal emulator with WebSocket-based PTY (pseudo-terminal) support. Built for Node.js 26+ using native TypeScript execution (no build step required).

## Features

- **REST API** - Express.js with Helmet, CORS, Morgan logging
- **WebSocket PTY** - Real terminal sessions via `node-pty` + `ws`
- **Native TypeScript** - Runs directly with `node --experimental-strip-types`
- **Health Checks** - `/api/health` and `/api/ready` endpoints
- **Request Tracking** - Unique request IDs for debugging
- **Error Handling** - Consistent error responses with proper HTTP codes
- **Graceful Shutdown** - SIGTERM/SIGINT handling
- **Docker Support** - Multi-stage production image + dev profile

## Quick Start

```bash
# Install dependencies
npm install

# Development (hot reload)
npm run dev

# Production
npm start
```

Server runs at `http://localhost:3000` with:
- API base: `http://localhost:3000/api`
- Health: `http://localhost:3000/api/health`
- PTY WebSocket: `ws://localhost:3000/api/pty`

## Project Structure

```
src/
├── index.ts              # Entry point, server setup, graceful shutdown
├── app.ts                # Express app, middleware, routes
├── config/
│   └── index.ts          # Environment configuration
├── middleware/
│   ├── errorHandler.ts   # Centralized error handling
│   └── requestId.ts      # Request ID generation
├── routes/
│   ├── index.ts          # Main router (mounts at /api)
│   └── health.ts         # Health/ready endpoints
├── pty/
│   └── ptyServer.ts      # WebSocket PTY server
├── types/
│   └── express.d.ts      # Express type extensions
└── utils/
    └── errors.ts         # Custom error classes
```

## API Endpoints

### Health Checks

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Service health status |
| GET | `/api/ready` | Readiness probe |

**Response** (`/api/health`):
```json
{
  "status": "ok",
  "timestamp": "2026-11-19T03:24:13.065Z",
  "uptime": 2.814,
  "environment": "development",
  "version": "1.0.0"
}
```

### PTY WebSocket

Connect to `ws://localhost:3000/api/pty` for a terminal session.

**Client → Server Messages:**
```json
// Resize terminal
{ "type": "resize", "cols": 120, "rows": 30 }

// Send input
{ "type": "input", "data": "ls -la\n" }

// Raw input (backward compatible)
"ls -la\n"
```

**Server → Client Messages:**
- Raw terminal output (ANSI escape sequences)
- Close frame with exit code on process termination

## Configuration

Environment variables (`.env`):

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP server port |
| `NODE_ENV` | `development` | Environment mode |
| `CORS_ORIGIN` | `http://localhost:5173` | CORS allowed origin |
| `LOG_LEVEL` | `debug` | Log level |

## Scripts

```bash
npm run dev      # Development with --watch
npm start        # Production run
npm run lint     # ESLint
npm run format   # Prettier formatting
```

## Docker

```bash
# Production
docker build -t terminal-backend .
docker run -p 3000:3000 --env-file .env terminal-backend

# Or with compose
docker compose up -d

# Development (hot reload)
docker compose --profile dev up
```

### Docker Features

- Multi-stage build (builder → production)
- Non-root user (UID 1001)
- Health check endpoint
- Alpine-based (~50MB)
- Dev profile with volume mounting

## Development

### Adding Routes

1. Create route file in `src/routes/`
2. Import and mount in `src/routes/index.ts`
3. Uses `/api` prefix automatically

### Custom Errors

```typescript
import { BadRequestError, NotFoundError } from './utils/errors';

throw new BadRequestError('Invalid input', { field: 'email' });
throw new NotFoundError('Resource not found');
```

### Request ID

Every request gets a unique `requestId` (from `X-Request-ID` header or generated). Available in:
- Error responses
- Logs
- Request object: `req.id`

## Dependencies

### Production
- `express` - Web framework
- `cors` - CORS middleware
- `helmet` - Security headers
- `morgan` - HTTP logging
- `dotenv` - Environment config
- `zod` - Schema validation
- `ws` - WebSocket server
- `node-pty` - PTY processes

### Development
- `typescript` - Type checking
- `prettier` - Formatting
- `@types/*` - Type definitions

## Architecture

```
┌─────────────────────────────────────┐
│           HTTP Server               │
│         (Express.js)                │
├─────────────────────────────────────┤
│  Middleware Chain                   │
│  • Helmet (security)                │
│  • CORS                             │
│  • Body parsing                     │
│  • Request ID                       │
│  • Morgan (logging)                 │
├─────────────────────────────────────┤
│  Routes                             │
│  • /api/health, /api/ready          │
│  • /api/* (extensible)              │
├─────────────────────────────────────┤
│  Error Handling                     │
│  • 404 Not Found                    │
│  • Global error handler             │
└─────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────┐
│     WebSocket Server (ws)           │
│     Upgrade on /api/pty             │
├─────────────────────────────────────┤
│  PTY Sessions (node-pty)            │
│  • Spawns shell per connection      │
│  • Handles resize, input, output    │
│  • Auto-cleanup on disconnect       │
└─────────────────────────────────────┘
```

## License

MIT