# Changelog

All notable changes to this project will be documented in this format.

## [1.0.0] - 2026-11-19

### Added
- Express.js REST API with Helmet, CORS, Morgan
- Native TypeScript execution via `--experimental-strip-types` (Node 26+)
- Health check endpoints (`/api/health`, `/api/ready`)
- Request ID middleware for tracing
- Global error handling with custom error classes
- WebSocket PTY server using `node-pty` + `ws`
- Terminal session management (resize, input, output streaming)
- Graceful shutdown (SIGTERM/SIGINT)
- Docker multi-stage build (production + dev profiles)
- Docker Compose with health checks
- Comprehensive documentation (README, API, Architecture, Deployment, Development)

### Technical Details
- No build step required - runs TypeScript directly
- ES Modules (`"type": "module"`)
- Strict TypeScript configuration
- Non-root Docker user (UID 1001)
- Alpine-based production image (~50MB)