# Architecture Documentation

## Overview

Terminal Backend is a Node.js 26+ service providing:
1. REST API (Express.js)
2. WebSocket PTY sessions (node-pty + ws)

Runs TypeScript natively via `--experimental-strip-types` — no build step.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Node.js Process                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐    ┌──────────────────────────────────┐  │
│  │   HTTP Server    │    │      WebSocket Server            │  │
│  │   (Express)      │    │      (ws library)                │  │
│  └────────┬─────────┘    └───────────────┬─────────────────┘  │
│           │                               │                    │
│           ▼                               ▼                    │
│  ┌──────────────────┐    ┌──────────────────────────────────┐  │
│  │  Middleware      │    │  PTY Session Manager             │  │
│  │  Chain           │    │  (ptyServer.ts)                  │  │
│  └────────┬─────────┘    └───────────────┬─────────────────┘  │
│           │                               │                    │
│           ▼                               ▼                    │
│  ┌──────────────────┐    ┌──────────────────────────────────┐  │
│  │  Route Handlers  │    │  node-pty Processes              │  │
│  │  (/api/*)        │    │  (one per WebSocket connection)  │  │
│  └──────────────────┘    └──────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Component Details

### Entry Point (`src/index.ts`)

- Creates HTTP server from Express app
- Attaches WebSocket upgrade handler
- Handles graceful shutdown (SIGTERM/SIGINT)
- Sets up uncaught exception/rejection handlers

### Express App (`src/app.ts`)

Middleware chain (order matters):

1. **Helmet** - Security headers (CSP, HSTS, etc.)
2. **CORS** - Cross-origin requests
3. **Body Parsing** - JSON (10MB) + URL-encoded
4. **Request ID** - Generates/extracts `X-Request-ID`
5. **Morgan** - HTTP logging (dev: `dev`, prod: `combined`)
6. **Routes** - Mounted at `/api`
7. **404 Handler** - Unknown routes
8. **Error Handler** - Global error catcher

### Configuration (`src/config/index.ts`)

Centralized env config with defaults:

```typescript
{
  port: 3000,
  nodeEnv: 'development',
  corsOrigin: 'http://localhost:5173',
  logLevel: 'debug'
}
```

### Middleware

#### Request ID (`src/middleware/requestId.ts`)

- Reads `X-Request-ID` header or generates UUID v4
- Attaches to `req.id`
- Included in all error responses

#### Error Handler (`src/middleware/errorHandler.ts`)

Maps errors to HTTP responses:

| Error Type | Status | Handler |
|------------|--------|---------|
| `AppError` subclasses | Custom | Direct mapping |
| `ZodError` | 400 | Validation details |
| `SyntaxError` (JSON) | 400 | "Invalid JSON" |
| Unknown | 500 | "Internal Server Error" |

### Routes (`src/routes/`)

- `index.ts` - Main router, mounts sub-routers
- `health.ts` - `/health`, `/ready`
- Extensible: add `router.use('/path', subRouter)`

### PTY Server (`src/pty/ptyServer.ts`)

Manages WebSocket → PTY bridges.

**Data Structures:**
```typescript
interface PtyConnection {
  pty: IPty;      // node-pty process
  ws: WebSocket;  // Client connection
}

const connections = Map<sessionId, PtyConnection>;
```

**Flow:**

1. HTTP upgrade on `/api/pty` → WebSocket
2. Generate session ID
3. Spawn PTY: `spawn(shell, [], { cols, rows, cwd, env })`
4. Bind events:
   - `pty.onData` → `ws.send(data)`
   - `ws.on('message')` → parse JSON → `pty.resize()` or `pty.write()`
   - `ws.on('close')` → `pty.kill()`
   - `pty.onExit` → `ws.close()`
5. Track in `connections` Map
6. Cleanup on SIGTERM

**Message Protocol:**

| Type | Direction | Payload |
|------|-----------|---------|
| `resize` | Client→Server | `{cols, rows}` |
| `input` | Client→Server | `{data: string}` |
| raw | Client→Server | `string` (legacy) |
| output | Server→Client | `string` (ANSI) |

### Error Classes (`src/utils/errors.ts`)

Hierarchy:
```
AppError (base)
├── BadRequestError (400)
├── UnauthorizedError (401)
├── ForbiddenError (403)
├── NotFoundError (404)
├── ConflictError (409)
├── TooManyRequestsError (429)
├── InternalServerError (500)
└── ServiceUnavailableError (503)
```

All include:
- `statusCode`
- `isOperational: true`
- `details?: unknown`
- Proper prototype chain for `instanceof`

### Type Extensions (`src/types/express.d.ts`)

```typescript
declare global {
  namespace Express {
    interface Request {
      id: string;  // Request ID from middleware
    }
  }
}
```

## Concurrency Model

- **HTTP**: Express handles multiple requests concurrently (event loop)
- **WebSocket**: Each connection = 1 PTY process = 1 OS process
- **Memory**: `connections` Map grows with active sessions
- **Cleanup**: Automatic on disconnect, SIGTERM kills all

## Security Considerations

| Layer | Protection |
|-------|------------|
| HTTP | Helmet headers, CORS whitelist |
| Body | 10MB limit (JSON + URL-encoded) |
| PTY | Shell per session, isolated cwd/env |
| Process | Non-root in Docker (UID 1001) |

## Scaling Limitations

Current architecture is **single-process**:

- PTY processes are children of main Node process
- Memory/CPU limited to one machine
- Session state in memory (Map)

### Horizontal Scaling Options

1. **Sticky Sessions** - Load balancer routes same client to same instance
2. **Redis Pub/Sub** - Broadcast PTY output across instances
3. **Session Manager** - External service tracks sessions
4. **Kubernetes** - Each pod handles subset, use `node-pty` in sidecar

## Adding Features

### New REST Endpoint

1. Create `src/routes/feature.ts`
2. Export router
3. Import in `src/routes/index.ts`: `router.use('/feature', featureRouter)`

### New WebSocket Endpoint

1. Add upgrade path check in `setupPtyServer`
2. Create separate WebSocketServer or handle in same
3. Manage own connection Map

### Authentication

Add middleware in `app.ts` before routes:

```typescript
import { authMiddleware } from './middleware/auth';
app.use('/api', authMiddleware, routes);
```

## Performance Notes

- `--experimental-strip-types` has minimal overhead
- `node-pty` spawns real processes (heavy but accurate)
- Morgan logging: `dev` format in development, `combined` in production
- No request body parsing for WebSocket upgrades

## Monitoring

### Health Checks

- `/api/health` - Liveness (process alive)
- `/api/ready` - Readiness (can serve traffic)

### Metrics to Add

- Active PTY sessions (`getActiveSessionsCount()`)
- HTTP request rate/latency
- WebSocket connection count
- Memory/CPU usage

## Testing Strategy

- Unit: Error classes, config, utilities
- Integration: Express routes (supertest)
- WebSocket: Custom test harness with `ws` client
- E2E: Full PTY session simulation