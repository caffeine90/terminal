# API Reference

Base URL: `http://localhost:3000/api`

All responses include a `requestId` for tracing.

## Health Endpoints

### GET /health

Service health check.

**Response:** `200 OK`

```json
{
  "status": "ok",
  "timestamp": "2026-11-19T03:24:13.065Z",
  "uptime": 2.814,
  "environment": "development",
  "version": "1.0.0"
}
```

### GET /ready

Readiness probe (for Kubernetes/load balancers).

**Response:** `200 OK`

```json
{
  "status": "ready",
  "timestamp": "2026-11-19T03:24:13.078Z"
}
```

## Error Responses

All errors follow this format:

```json
{
  "error": {
    "message": "Error description",
    "statusCode": 400,
    "requestId: "uuid",
    "details": {}
  }
}
```

### HTTP Status Codes

| Code | Error Class | Description |
|------|-------------|-------------|
| 400 | `BadRequestError` | Invalid request body/params |
| 401 | `UnauthorizedError` | Missing/invalid authentication |
| 403 | `ForbiddenError` | Insufficient permissions |
| 404 | `NotFoundError` | Resource not found |
| 409 | `ConflictError` | Resource conflict |
| 429 | `TooManyRequestsError` | Rate limited |
| 500 | `InternalServerError` | Server error |
| 503 | `ServiceUnavailableError` | Service temporarily unavailable |

## PTY WebSocket

### Connection

```
WS ws://localhost:3000/api/pty
```

Upgrade headers:
- `Upgrade: websocket`
- `Connection: Upgrade`
- `Sec-WebSocket-Version: 13`
- `Sec-WebSocket-Key: <base64>`

### Message Protocol

#### Client → Server

**Resize Terminal**
```json
{
  "type": "resize",
  "cols": 120,
  "rows": 30
}
```

**Send Input (structured)**
```json
{
  "type": "input",
  "data": "ls -la\n"
}
```

**Send Input (raw - backward compatible)**
```
ls -la\n
```

#### Server → Client

**Terminal Output** (raw ANSI escape sequences)
```
\x1b[2J\x1b[Huser@host:~$ 
```

**Close Frame**
- Code: `1000` (normal) or `1011` (error)
- Reason: `Process exited with code 0`

### Session Lifecycle

1. Client connects to `/api/pty`
2. Server spawns PTY with default shell (80x24)
3. Client sends resize/input messages
4. Server streams PTY output to WebSocket
5. On shell exit → close frame with exit code
6. On client disconnect → PTY killed

### Example Client (JavaScript)

```javascript
const ws = new WebSocket('ws://localhost:3000/api/pty');

ws.onopen = () => {
  // Resize to 120x30
  ws.send(JSON.stringify({ type: 'resize', cols: 120, rows: 30 }));
  
  // Send command
  ws.send(JSON.stringify({ type: 'input', data: 'ls -la\n' }));
};

ws.onmessage = (event) => {
  // Raw terminal output (ANSI)
  console.log(event.data);
};

ws.onclose = (event) => {
  console.log(`Closed: ${event.code} - ${event.reason}`);
};
```

### Example Client (Python)

```python
import asyncio
import websockets
import json

async def terminal():
    async with websockets.connect('ws://localhost:3000/api/pty') as ws:
        # Resize
        await ws.send(json.dumps({'type': 'resize', 'cols': 120, 'rows': 30}))
        
        # Send command
        await ws.send(json.dumps({'type': 'input', 'data': 'ls -la\n'}))
        
        # Receive output
        async for message in ws:
            print(message, end='', flush=True)

asyncio.run(terminal())
```

## Request Headers

### Required/Recommended

| Header | Description |
|--------|-------------|
| `Content-Type: application/json` | For POST/PUT/PATCH bodies |
| `X-Request-ID: <uuid>` | Optional, for tracing |

### Response Headers

| Header | Description |
|--------|-------------|
| `X-Request-ID: <uuid>` | Echoes request ID |

## Rate Limiting

Not implemented yet. Add via middleware (e.g., `express-rate-limit`).

## Versioning

API version not in URL yet. Plan: `/api/v1/` prefix for future versions.

## Authentication

Not implemented. Add JWT/OAuth middleware to `app.ts` before routes.

## CORS

Configured for `CORS_ORIGIN` (default `http://localhost:5173`). Modify in `.env`.