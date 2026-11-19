# Development Guide

## Setup

```bash
# Clone and enter
cd terminal/backend

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Start development server
npm run dev
```

Server starts at `http://localhost:3000` with hot reload via `--watch`.

## Project Structure

```
src/
├── index.ts              # Entry point
├── app.ts                # Express setup
├── config/
│   └── index.ts          # Config
├── middleware/
│   ├── errorHandler.ts   # Errors
│   └── requestId.ts      # Request IDs
├── routes/
│   ├── index.ts          # Main router
│   └── health.ts         # Health endpoints
├── pty/
│   └── ptyServer.ts      # WebSocket PTY
├── types/
│   └── express.d.ts      # Type extensions
└── utils/
    └── errors.ts         # Error classes
```

## Adding a REST Endpoint

### 1. Create Route File

```typescript
// src/routes/users.ts
import express from 'express';
import type { Router, Request, Response } from 'express';
import { BadRequestError, NotFoundError } from '../utils/errors.ts';

const router = express.Router();

// GET /api/users
router.get('/', (_req: Request, res: Response) => {
  res.json({ users: [] });
});

// GET /api/users/:id
router.get('/:id', (req: Request, res: Response) => {
  const user = findUser(req.params.id);
  if (!user) throw new NotFoundError('User not found');
  res.json(user);
});

// POST /api/users
router.post('/', (req: Request, res: Response) => {
  const { name, email } = req.body;
  if (!name || !email) throw new BadRequestError('Name and email required');
  const user = createUser(name, email);
  res.status(201).json(user);
});

export default router;
```

### 2. Mount in Main Router

```typescript
// src/routes/index.ts
import userRouter from './users.ts';
// ...
router.use('/users', userRouter);
```

### 3. Test

```bash
curl http://localhost:3000/api/users
curl -X POST http://localhost:3000/api/users -H "Content-Type: application/json" -d '{"name":"John","email":"john@example.com"}'
```

## Using Custom Errors

```typescript
import { 
  BadRequestError, 
  UnauthorizedError, 
  NotFoundError,
  ConflictError 
} from '../utils/errors.ts';

// 400
throw new BadRequestError('Invalid email', { field: 'email' });

// 401
throw new UnauthorizedError('Token expired');

// 404
throw new NotFoundError('User not found');

// 409
throw new ConflictError('Email already registered');
```

Error response format:
```json
{
  "error": {
    "message": "Invalid email",
    "statusCode": 400,
    "requestId": "abc-123",
    "details": { "field": "email" }
  }
}
```

## Request ID Access

```typescript
// In any route handler
router.get('/', (req: Request, res: Response) => {
  console.log(`Request ID: ${req.id}`);
  res.json({ requestId: req.id });
});
```

## Validation with Zod

```typescript
import { z } from 'zod';

const userSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().int().positive().optional()
});

router.post('/', (req: Request, res: Response) => {
  const result = userSchema.safeParse(req.body);
  if (!result.success) {
    throw new BadRequestError('Validation failed', result.error.flatten());
  }
  // result.data is typed
  const user = createUser(result.data);
  res.status(201).json(user);
});
```

## Adding a WebSocket Endpoint

### 1. Create Handler

```typescript
// src/ws/chat.ts
import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';

export function setupChatServer(server: any) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request: IncomingMessage, socket: any, head: Buffer) => {
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    if (url.pathname === '/api/chat') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
    ws.on('message', (data) => {
      // Broadcast to all clients
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(data.toString());
        }
      });
    });
  });
}
```

### 2. Register in index.ts

```typescript
import { setupChatServer } from './ws/chat.ts';
// ...
setupChatServer(server);
```

## Testing

### Manual Testing

```bash
# Health
curl http://localhost:3000/api/health

# 404
curl http://localhost:3000/api/nonexistent

# PTY WebSocket (requires wscat)
npm install -g wscat
wscat -c ws://localhost:3000/api/pty
```

### Writing Tests (Example with Vitest)

```bash
npm install -D vitest @types/supertest supertest
```

```typescript
// tests/health.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.ts';

describe('Health endpoints', () => {
  it('GET /api/health returns ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /api/ready returns ready', async () => {
    const res = await request(app).get('/api/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
  });
});
```

```json
// package.json scripts addition
"test": "vitest run",
"test:watch": "vitest"
```

## Debugging

### VS Code Launch Config

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Terminal Backend",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "node",
      "runtimeArgs": ["--experimental-strip-types", "--watch", "src/index.ts"],
      "cwd": "${workspaceFolder}",
      "console": "integratedTerminal"
    }
  ]
}
```

### Log Levels

Set `LOG_LEVEL=debug` in `.env` for verbose output.

### Inspect PTY Sessions

```typescript
// In ptyServer.ts
import { getActiveSessionsCount } from './pty/ptyServer.ts';

router.get('/api/admin/pty-sessions', (_req, res) => {
  res.json({ activeSessions: getActiveSessionsCount() });
});
```

## Code Style

```bash
# Format
npm run format

# Lint
npm run lint
```

### Prettier Config (`.prettierrc.json`)

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

## TypeScript

- Uses native `--experimental-strip-types` (no `tsc` build)
- Types checked by IDE/editor via `@types/*` packages
- Strict mode enabled implicitly
- Path aliases: `@/*` → `src/*` (if tsconfig existed)

## Git Workflow

```bash
# Feature branch
git checkout -b feature/new-endpoint

# Commit with conventional commits
git commit -m "feat: add user management API"

# Push and PR
git push origin feature/new-endpoint
```

## Common Tasks

### Change Port

```bash
# .env
PORT=4000
```

### Add CORS Origin

```bash
# .env
CORS_ORIGIN=https://your-frontend.com
```

### Enable Production Logging

```bash
# .env
NODE_ENV=production
LOG_LEVEL=info
```

### Add Dependency

```bash
npm install package-name
npm install -D @types/package-name  # if TypeScript types needed
```

## Troubleshooting

### Port Already in Use

```bash
lsof -ti:3000 | xargs kill -9
```

### Module Not Found (TypeScript)

- Check import has `.ts` extension
- Verify file exists at path
- Restart TypeScript server in IDE

### PTY Not Working

- Ensure `node-pty` compiled for platform (native module)
- Check shell exists: `echo $SHELL`
- Verify WebSocket upgrade headers

### Docker Build Fails

- Check `.dockerignore` includes `node_modules`
- Verify `package-lock.json` committed
- Use `docker build --no-cache .`