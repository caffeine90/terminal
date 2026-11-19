# Development Guide

## Getting Started

### Prerequisites

- **Node.js 20+** (LTS recommended)
- **npm 10+** or **pnpm 9+**
- **Git**
- **Linux/macOS** (Windows requires WSL2 for PTY support)

### Initial Setup

```bash
# Clone repository
git clone <repo-url>
cd terminal

# Install all dependencies
cd backend && npm install
cd ../frontend && npm install

# Verify installation
cd ../backend && npm run lint
cd ../frontend && npm run lint
```

## Project Structure

```
terminal/
├── backend/                 # Node.js/Express API + PTY Server
│   ├── src/
│   │   ├── index.ts         # Entry point
│   │   ├── app.ts           # Express app
│   │   ├── config/          # Configuration
│   │   ├── middleware/      # Express middleware
│   │   ├── routes/          # API routes
│   │   └── pty/             # PTY WebSocket server
│   ├── package.json
│   ├── tsconfig.json
│   └── .env
│
├── frontend/                # React + Vite SPA
│   ├── src/
│   │   ├── main.tsx         # Entry point
│   │   ├── App.tsx          # Root component
│   │   ├── components/
│   │   │   ├── terminal/    # Terminal emulator
│   │   │   └── ui/          # shadcn/ui components
│   │   ├── hooks/           # Custom hooks
│   │   └── lib/             # Utilities
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── .env
│
├── docs/                    # Documentation
│   ├── TERMINAL_COMPONENT.md
│   ├── PTY_SERVER.md
│   ├── DEVELOPMENT.md
│   └── DEPLOYMENT.md
│
└── README.md
```

## Development Workflow

### Running Locally

```bash
# Terminal 1: Backend (port 3000)
cd backend
npm run dev

# Terminal 2: Frontend (port 5173)
cd frontend
npm run dev
```

Open http://localhost:5173

### Available Scripts

#### Backend
```bash
npm run dev      # Start with hot reload (--watch)
npm run start    # Production start
npm run lint     # Run ESLint
npm run format   # Format with Prettier
```

#### Frontend
```bash
npm run dev      # Start Vite dev server
npm run build    # Production build (TypeScript + Vite)
npm run lint     # Run oxlint
npm run format   # Format with Prettier
npm run preview  # Preview production build
```

## Code Style

### TypeScript Configuration

Both projects use strict TypeScript:

```json
// Shared strict settings
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "exactOptionalPropertyTypes": true,
  "noImplicitReturns": true,
  "noFallthroughCasesInSwitch": true
}
```

### Linting

**Backend:** ESLint with TypeScript parser
```bash
cd backend && npm run lint
```

**Frontend:** oxlint (fast, Rust-based)
```bash
cd frontend && npm run lint
```

### Formatting

**Both:** Prettier with Tailwind plugin
```bash
npm run format          # Write changes
npm run format:check    # Check only (CI)
```

### Import Organization

```typescript
// 1. External imports
import express from 'express';
import { WebSocketServer } from 'ws';

// 2. Internal imports (absolute paths via tsconfig paths)
import { config } from '@/config/index.ts';
import { setupPtyServer } from '@/pty/ptyServer.ts';

// 3. Relative imports
import './local-file.ts';
```

## Adding Features

### New Backend Route

1. **Create route file:**
```typescript
// backend/src/routes/users.ts
import { Router } from 'express';
import { z } from 'zod';

const router = Router();

const userSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

router.get('/', (req, res) => {
  res.json({ users: [] });
});

router.post('/', (req, res) => {
  const result = userSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.flatten() });
  }
  res.status(201).json({ user: result.data });
});

export default router;
```

2. **Register in router:**
```typescript
// backend/src/routes/index.ts
import usersRouter from './users.ts';

router.use('/users', usersRouter);
```

3. **Add validation middleware (optional):**
```typescript
// backend/src/middleware/validate.ts
import { Request, Response, NextFunction } from 'express';
import { AnyZodObject } from 'zod';

export const validate = (schema: AnyZodObject) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({ body: req.body, query: req.query, params: req.params });
      next();
    } catch (error) {
      next(error);
    }
  };
```

### New Frontend Component

1. **Create component:**
```tsx
// frontend/src/components/my-component/MyComponent.tsx
import { cn } from '@/lib/utils';

interface MyComponentProps {
  className?: string;
  title: string;
}

export function MyComponent({ className, title }: MyComponentProps) {
  return (
    <div className={cn('p-4 rounded-lg bg-card', className)}>
      <h2 className="text-xl font-semibold">{title}</h2>
    </div>
  );
}
```

2. **Export:**
```typescript
// frontend/src/components/my-component/index.ts
export { MyComponent } from './MyComponent';
export type { MyComponentProps } from './MyComponent';
```

3. **Use in App:**
```tsx
// frontend/src/App.tsx
import { MyComponent } from '@/components/my-component';

function App() {
  return <MyComponent title="Hello" />;
}
```

### Extending Terminal

The `TerminalEmulator` component is extensible via props:

```tsx
<TerminalEmulator
  className="h-[600px]"
  onConnect={() => analytics.track('terminal_connected')}
  onDisconnect={() => analytics.track('terminal_disconnected')}
  onError={(err) => sentry.captureException(err)}
/>
```

To add features, modify `Terminal.tsx`:
- **Custom keybindings:** Add `term.onKey()` handlers
- **Custom commands:** Intercept input in `sendInput()`
- **UI additions:** Add toolbar, tabs, status bar in render

## Debugging

### Backend Debugging

**VS Code launch.json:**
```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Backend",
  "runtimeExecutable": "npm",
  "runtimeArgs": ["run", "dev"],
  "cwd": "${workspaceFolder}/backend",
  "console": "integratedTerminal"
}
```

**Node Inspector:**
```bash
# Start with inspector
cd backend
node --inspect --watch --experimental-strip-types src/index.ts

# Connect Chrome DevTools: chrome://inspect
```

**Logging:**
```typescript
// backend/src/pty/ptyServer.ts
if (isDevelopment) {
  console.log('[PTY] New connection:', sessionId);
  console.log('[PTY] Data:', data.length, 'bytes');
}
```

### Frontend Debugging

**React DevTools:** Install browser extension

**Vite DevTools:** Available at http://localhost:5173/__devtools__

**Console Logging:**
```typescript
// frontend/src/components/terminal/Terminal.tsx
console.log('[Terminal] Connecting to:', wsUrl);
console.log('[Terminal] Connected');
console.log('[Terminal] Disconnected:', code, reason);
```

**Network Tab:** Filter by "WS" to inspect WebSocket frames

## Testing

### Backend Testing

```bash
# Run tests
cd backend && npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

**Test Structure:**
```
backend/
├── src/
│   └── **/*.test.ts
└── jest.config.js
```

### Frontend Testing

```bash
# Run tests
cd frontend && npm test

# UI mode
npm run test:ui

# Coverage
npm run test:coverage
```

**Test Structure:**
```
frontend/
├── src/
│   ├── **/*.test.tsx
│   └── test/
│       └── setup.ts
├── vitest.config.ts
└── playwright.config.ts (E2E)
```

### E2E Testing

```bash
# Install Playwright
cd frontend && npx playwright install

# Run E2E tests
npm run test:e2e
```

## Git Workflow

### Branch Naming

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feature/short-description` | `feature/terminal-tabs` |
| Bugfix | `fix/short-description` | `fix/resize-bug` |
| Refactor | `refactor/short-description` | `refactor/pty-cleanup` |
| Docs | `docs/short-description` | `docs/api-reference` |

### Commit Messages

Follow Conventional Commits:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat` — New feature
- `fix` — Bug fix
- `docs` — Documentation
- `style` — Formatting
- `refactor` — Code restructuring
- `test` — Tests
- `chore` — Maintenance

**Examples:**
```
feat(terminal): add copy/paste support
fix(pty): handle resize race condition
docs(api): add WebSocket protocol reference
refactor(backend): extract middleware to separate files
```

### Pull Request Process

1. Create feature branch from `main`
2. Make changes with tests
3. Run linting and formatting
4. Push branch
5. Create PR with description
6. CI checks pass
7. Code review
8. Squash and merge

## Common Tasks

### Update Dependencies

```bash
# Backend
cd backend
npm outdated
npm update
npm audit fix

# Frontend
cd frontend
npm outdated
npm update
npm audit fix
```

### Add shadcn/ui Component

```bash
cd frontend
npx shadcn@latest add button
npx shadcn@latest add dialog
```

### Database Migrations (Future)

```bash
# When database added
cd backend
npm run db:generate
npm run db:migrate
npm run db:seed
```

## Troubleshooting

### Port Conflicts

```bash
# Find and kill process on port
lsof -ti:3000 | xargs kill -9
lsof -ti:5173 | xargs kill -9
```

### Module Not Found

```bash
# Clear caches and reinstall
cd backend && rm -rf node_modules package-lock.json && npm install
cd frontend && rm -rf node_modules package-lock.json && npm install
```

### TypeScript Errors

```bash
# Restart TypeScript server in VS Code
Cmd+Shift+P > "TypeScript: Restart TS Server"

# Or rebuild
cd backend && npx tsc --noEmit
cd frontend && npx tsc --noEmit
```

### WebSocket Connection Issues

1. Check backend running: `curl http://localhost:3000/api/health`
2. Check `VITE_API_HOST` in frontend `.env`
3. Check browser console for errors
4. Verify no proxy/firewall blocking

## Performance Profiling

### Backend

```bash
# CPU profile
node --prof backend/src/index.ts
node --prof-process isolate-*.log > profile.txt

# Heap snapshot
node --heapsnapshot-signal=SIGUSR2 backend/src/index.ts
kill -USR2 <pid>
```

### Frontend

```bash
# Build with analysis
npm run build -- --mode analyze

# Or use Vite plugin
npm install -D rollup-plugin-visualizer
```

## Environment-Specific Config

### Development (.env)
```bash
# Backend
NODE_ENV=development
PORT=3000
CORS_ORIGIN=http://localhost:5173
LOG_LEVEL=debug

# Frontend
VITE_API_HOST=localhost:3000
```

### Production
```bash
# Backend
NODE_ENV=production
PORT=3000
CORS_ORIGIN=https://yourdomain.com
LOG_LEVEL=info

# Frontend
VITE_API_HOST=yourdomain.com
```

## Useful Resources

- [xterm.js Docs](https://xtermjs.org/docs/)
- [node-pty Docs](https://github.com/microsoft/node-pty)
- [ws Docs](https://github.com/websockets/ws)
- [Express Docs](https://expressjs.com/)
- [Vite Docs](https://vite.dev/)
- [React Docs](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.com/)