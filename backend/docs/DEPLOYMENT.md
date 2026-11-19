# Deployment Guide

## Prerequisites

- Node.js 26+
- Docker (optional, for containerized deployment)

## Environment Variables

Create `.env` file from `.env.example`:

```bash
cp .env.example .env
```

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3000` | HTTP port |
| `NODE_ENV` | No | `development` | `development` or `production` |
| `CORS_ORIGIN` | No | `http://localhost:5173` | Allowed CORS origin |
| `LOG_LEVEL` | No | `debug` | Log level |

## Local Development

```bash
# Install dependencies
npm install

# Run with hot reload
npm run dev

# Run production mode locally
npm start
```

## Docker Deployment

### Build Image

```bash
docker build -t terminal-backend .
```

### Run Container

```bash
docker run -d \
  --name terminal-backend \
  -p 3000:3000 \
  --env-file .env \
  --restart unless-stopped \
  terminal-backend
```

### Docker Compose (Recommended)

```yaml
# docker-compose.yml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: production
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
    env_file:
      - .env
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://localhost:3000/api/health').then(r => { if (!r.ok) throw new Error('Health check failed') }).catch(() => process.exit(1))"]
      interval: 30s
      timeout: 3s
      start_period: 10s
      retries: 3
```

```bash
# Production
docker compose up -d

# Development (with hot reload)
docker compose --profile dev up

# View logs
docker compose logs -f app

# Stop
docker compose down
```

## Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure `CORS_ORIGIN` to your frontend domain
- [ ] Use reverse proxy (nginx, Traefik, Cloudflare) for TLS
- [ ] Set up log aggregation (stdout/stderr)
- [ ] Configure health checks in orchestrator
- [ ] Set resource limits (CPU/memory)
- [ ] Enable `helmet` headers (already included)
- [ ] Consider rate limiting middleware

## Reverse Proxy (nginx Example)

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}
```

## Kubernetes Deployment

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: terminal-backend
spec:
  replicas: 2
  selector:
    matchLabels:
      app: terminal-backend
  template:
    metadata:
      labels:
        app: terminal-backend
    spec:
      containers:
      - name: app
        image: terminal-backend:latest
        ports:
        - containerPort: 3000
        envFrom:
        - configMapRef:
            name: terminal-backend-config
        - secretRef:
            name: terminal-backend-secrets
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /api/ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: terminal-backend
spec:
  selector:
    app: terminal-backend
  ports:
  - port: 80
    targetPort: 3000
  type: ClusterIP
```

## Health Checks

| Endpoint | Purpose | Expected Response |
|----------|---------|-------------------|
| `GET /api/health` | Liveness | `200 OK` + JSON |
| `GET /api/ready` | Readiness | `200 OK` + JSON |

## Logs

Application logs to stdout/stderr. In production:

```bash
# Docker
docker compose logs -f app

# Kubernetes
kubectl logs -f deployment/terminal-backend

# Structured logging (add to your stack)
# Consider: pino, winston, or bunyan for JSON logs
```

## Scaling Considerations

Current architecture: **single-process, in-memory sessions**

### Vertical Scaling
- Increase container resources
- Single instance handles ~50-100 concurrent PTY sessions

### Horizontal Scaling (Requires Changes)
- Add Redis for session tracking
- Sticky sessions at load balancer
- Or: Run PTY in sidecar containers

## Backup/Recovery

Stateless service - no persistent data to backup.
Configuration via environment variables / ConfigMaps.

## Rollback

```bash
# Docker
docker compose pull
docker compose up -d

# Kubernetes
kubectl rollout undo deployment/terminal-backend
```

## Monitoring

Recommended metrics:
- HTTP request rate / latency / errors
- Active WebSocket connections
- PTY sessions count
- Memory / CPU usage
- Process uptime

Add Prometheus metrics endpoint or use APM (Datadog, New Relic, etc.).