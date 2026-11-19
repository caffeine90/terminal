# Deployment Guide

## Overview

This guide covers deploying the Terminal Emulator to production environments.

## Architecture for Production

```
                    ┌─────────────────────┐
                    │   Load Balancer     │
                    │   (Nginx/Cloudflare)│
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
         ┌─────────┐     ┌─────────┐     ┌─────────┐
         │ Frontend│     │ Frontend│     │ Frontend│
         │  (Nginx)│     │  (Nginx)│     │  (Nginx)│
         └────┬────┘     └────┬────┘     └────┬────┘
              │               │               │
              └───────────────┼───────────────┘
                              ▼
                       ┌───────────────┐
                       │   Backend     │
                       │  (Node.js)    │
                       │  Cluster Mode │
                       └───────┬───────┘
                               │
                    ┌──────────┴──────────┐
                    ▼                     ▼
              ┌─────────┐           ┌─────────┐
              │  PTY    │           │  PTY    │
              │ Session │    ...    │ Session │
              └─────────┘           └─────────┘
```

## Prerequisites

### Server Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 2 vCPU | 4+ vCPU |
| RAM | 2 GB | 8+ GB |
| Disk | 10 GB | 50+ GB SSD |
| OS | Ubuntu 22.04+ / Debian 12+ | Same |
| Node.js | 20 LTS | 20 LTS |

### Network

- **Port 80/443**: HTTP/HTTPS (Load Balancer)
- **Port 3000**: Backend API (internal only)
- **Port 5173**: Frontend dev (not used in prod)

### Domain & SSL

- Domain name (e.g., `terminal.yourdomain.com`)
- SSL certificate (Let's Encrypt or cloud provider)

## Deployment Options

### Option 1: Docker Compose (Recommended)

```yaml
# docker-compose.yml
version: '3.8'

services:
  # Reverse proxy with SSL termination
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - ./frontend/dist:/usr/share/nginx/html:ro
    depends_on:
      - backend
    restart: unless-stopped

  # Backend API + PTY Server
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.prod
    environment:
      - NODE_ENV=production
      - PORT=3000
      - CORS_ORIGIN=https://terminal.yourdomain.com
      - LOG_LEVEL=info
    volumes:
      - /lib/modules:/lib/modules:ro  # For PTY kernel module
    cap_add:
      - SYS_ADMIN  # Required for PTY in containers
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '1.0'
    restart: unless-stopped
    # Run multiple replicas for scaling
    # deploy:
    #   replicas: 3

  # Optional: Redis for session scaling
  # redis:
  #   image: redis:alpine
  #   restart: unless-stopped

networks:
  default:
    name: terminal-network
```

**Backend Dockerfile (production):**
```dockerfile
# backend/Dockerfile.prod
FROM node:20-alpine

WORKDIR /app

# Install dependencies for node-pty compilation
RUN apk add --no-cache python3 make g++ linux-headers

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --omit=dev

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Create non-root user
RUN addgroup -g 1000 -S nodejs && \
    adduser -S nodejs -u 1000

# Fix permissions
RUN chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

**Deploy:**
```bash
# Build and start
docker compose -f docker-compose.yml up -d --build

# View logs
docker compose logs -f

# Scale backend (if using sticky sessions for WebSocket)
docker compose up -d --scale backend=3
```

### Option 2: Systemd + Nginx (Traditional VPS)

#### 1. Prepare Server

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Nginx
sudo apt install -y nginx

# Install PM2 for process management
sudo npm install -g pm2

# Create app user
sudo useradd -m -s /bin/bash terminal
sudo usermod -aG sudo terminal
```

#### 2. Deploy Backend

```bash
# Switch to app user
sudo su - terminal

# Clone repo
git clone <your-repo> ~/terminal
cd ~/terminal/backend

# Install dependencies
npm ci --omit=dev

# Build
npm run build

# Create PM2 ecosystem
cat > ecosystem.config.js <<'EOF'
module.exports = {
  apps: [{
    name: 'terminal-backend',
    script: 'dist/index.js',
    cwd: '/home/terminal/terminal/backend',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      CORS_ORIGIN: 'https://terminal.yourdomain.com',
      LOG_LEVEL: 'info'
    },
    instances: 'max',  # Cluster mode
    exec_mode: 'cluster',
    max_memory_restart: '1G',
    error_file: '/home/terminal/logs/backend-error.log',
    out_file: '/home/terminal/logs/backend-out.log',
    log_file: '/home/terminal/logs/backend-combined.log',
    time: true,
    watch: false,
    kill_timeout: 10000,
    wait_ready: true,
    listen_timeout: 10000
  }]
};
EOF

# Create logs directory
mkdir -p ~/logs

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

#### 3. Deploy Frontend

```bash
# Build frontend
cd ~/terminal/frontend
npm ci
npm run build

# Output is in dist/
```

#### 4. Configure Nginx

```nginx
# /etc/nginx/sites-available/terminal
upstream backend {
    least_conn;
    server 127.0.0.1:3000;
    # For multiple PM2 instances:
    # server 127.0.0.1:3001;
    # server 127.0.0.1:3002;
}

server {
    listen 80;
    server_name terminal.yourdomain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name terminal.yourdomain.com;

    # SSL certificates (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/terminal.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/terminal.yourdomain.com/privkey.pem;
    
    # SSL security
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Frontend static files
    root /home/terminal/terminal/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Backend API
    location /api/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket specific
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
        
        # Buffering
        proxy_buffering off;
        proxy_cache off;
    }

    # Health check (no auth)
    location /api/health {
        proxy_pass http://backend;
        access_log off;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy "strict-origin-when-cross-origin";
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/terminal /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Get SSL cert
sudo certbot --nginx -d terminal.yourdomain.com
```

### Option 3: Kubernetes

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: terminal
---
# k8s/backend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: terminal-backend
  namespace: terminal
spec:
  replicas: 3
  selector:
    matchLabels:
      app: terminal-backend
  template:
    metadata:
      labels:
        app: terminal-backend
    spec:
      containers:
      - name: backend
        image: your-registry/terminal-backend:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: CORS_ORIGIN
          value: "https://terminal.yourdomain.com"
        - name: PORT
          value: "3000"
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 10
---
# k8s/backend-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: terminal-backend
  namespace: terminal
spec:
  selector:
    app: terminal-backend
  ports:
  - port: 3000
    targetPort: 3000
  # Session affinity for WebSocket
  sessionAffinity: ClientIP
  sessionAffinityConfig:
    clientIP:
      timeoutSeconds: 10800
---
# k8s/frontend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: terminal-frontend
  namespace: terminal
spec:
  replicas: 2
  selector:
    matchLabels:
      app: terminal-frontend
  template:
    metadata:
      labels:
        app: terminal-frontend
    spec:
      containers:
      - name: frontend
        image: your-registry/terminal-frontend:latest
        ports:
        - containerPort: 80
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "500m"
---
# k8s/frontend-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: terminal-frontend
  namespace: terminal
spec:
  selector:
    app: terminal-frontend
  ports:
  - port: 80
    targetPort: 80
---
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: terminal-ingress
  namespace: terminal
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/websocket-services: terminal-backend
    nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
spec:
  tls:
  - hosts:
    - terminal.yourdomain.com
    secretName: terminal-tls
  rules:
  - host: terminal.yourdomain.com
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: terminal-backend
            port:
              number: 3000
      - path: /
        pathType: Prefix
        backend:
          service:
            name: terminal-frontend
            port:
              number: 80
```

```bash
# Deploy
kubectl apply -f k8s/

# Check status
kubectl get pods -n terminal
kubectl logs -n terminal -l app=terminal-backend
```

## SSL/TLS Configuration

### Let's Encrypt (Certbot)

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d terminal.yourdomain.com

# Auto-renewal (already in cron)
sudo certbot renew --dry-run
```

### Manual Certificate

```nginx
ssl_certificate /etc/nginx/ssl/terminal.crt;
ssl_certificate_key /etc/nginx/ssl/terminal.key;

# Strong SSL config
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
ssl_prefer_server_ciphers off;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;
```

## Security Hardening

### Backend Security

```typescript
// backend/src/app.ts - Add rate limiting
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests'
});

app.use('/api/', limiter);

// Add authentication middleware for PTY
app.use('/api/pty', authenticateToken, authorizeTerminalAccess);
```

### Firewall

```bash
# UFW (Ubuntu)
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable

# Or iptables
sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT
sudo iptables -A INPUT -j DROP
```

### Fail2Ban

```bash
sudo apt install fail2ban

# /etc/fail2ban/jail.local
[nginx-http-auth]
enabled = true

[nginx-limit-req]
enabled = true
```

## Monitoring & Logging

### PM2 Monitoring

```bash
# Real-time monitoring
pm2 monit

# Logs
pm2 logs terminal-backend

# Metrics
pm2 list
pm2 show terminal-backend
```

### Application Logs

```bash
# Structured logging (add to backend)
npm install pino pino-pretty

# backend/src/utils/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' 
    ? { target: 'pino-pretty' } 
    : undefined
});

// Usage
logger.info({ sessionId }, 'New PTY session');
logger.error({ err, sessionId }, 'PTY error');
```

### Health Checks

```bash
# Backend health
curl https://terminal.yourdomain.com/api/health

# Response:
{
  "status": "ok",
  "timestamp": "2026-11-19T03:37:53.563Z",
  "uptime": 13.015767284,
  "environment": "production",
  "version": "1.0.0",
  "ptySessions": 5
}
```

### Prometheus Metrics (Optional)

```typescript
// Add prom-client
npm install prom-client

// backend/src/middleware/metrics.ts
import promClient from 'prom-client';

const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'path', 'status']
});

app.use((req, res, next) => {
  res.on('finish', () => {
    httpRequestsTotal.inc({ method: req.method, path: req.path, status: res.statusCode });
  });
  next();
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', promClient.register.contentType);
  res.end(await promClient.register.metrics());
});
```

## Backup & Recovery

### Configuration Backup

```bash
# Backup script
cat > /home/terminal/backup.sh <<'EOF'
#!/bin/bash
BACKUP_DIR="/home/terminal/backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Backup configs
cp -r /home/terminal/terminal/backend/.env "$BACKUP_DIR/"
cp -r /home/terminal/terminal/frontend/.env "$BACKUP_DIR/"
cp /etc/nginx/sites-available/terminal "$BACKUP_DIR/nginx.conf"
pm2 dump > "$BACKUP_DIR/pm2-dump.json"

# Keep last 7 days
find /home/terminal/backups -type d -mtime +7 -exec rm -rf {} \;
EOF

chmod +x /home/terminal/backup.sh

# Cron job (daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * /home/terminal/backup.sh") | crontab -
```

### Disaster Recovery

```bash
# 1. Restore configs
cp /home/terminal/backups/latest/.env ~/terminal/backend/
cp /home/terminal/backups/latest/.env ~/terminal/frontend/
cp /home/terminal/backups/latest/nginx.conf /etc/nginx/sites-available/terminal

# 2. Restore PM2 processes
pm2 resurrect

# 3. Rebuild frontend
cd ~/terminal/frontend && npm run build

# 4. Reload Nginx
sudo nginx -t && sudo systemctl reload nginx
```

## Scaling Considerations

### Horizontal Scaling (Multiple Backend Instances)

**Challenge:** WebSocket connections are sticky — each session must stay on same backend.

**Solutions:**

1. **Nginx IP Hash (Simple):**
```nginx
upstream backend {
    ip_hash;
    server 127.0.0.1:3000;
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
}
```

2. **Redis Session Store (Advanced):**
```typescript
// Store session metadata in Redis
import Redis from 'ioredis';
const redis = new Redis();

pty.onData((data) => {
  // Also publish to Redis for other instances
  redis.publish(`pty:${sessionId}`, data);
});

// Subscribe to other instances' PTY output
redis.subscribe(`pty:${sessionId}`, (err) => {
  redis.on('message', (channel, message) => {
    if (channel === `pty:${sessionId}`) {
      ws.send(message);
    }
  });
});
```

3. **Kubernetes Session Affinity:**
```yaml
# Already shown in k8s/ingress.yaml
sessionAffinity: ClientIP
```

### Resource Limits per Session

```typescript
// Limit PTY resources
const pty = spawn(shell, [], {
  // ... options
});

// Set resource limits (Linux)
pty.process?.setrlimit?.(require('node:resource').RLIMIT_CPU, { soft: 60, hard: 60 });
pty.process?.setrlimit?.(require('node:resource').RLIMIT_AS, { soft: 100 * 1024 * 1024, hard: 100 * 1024 * 1024 });
```

## CI/CD Pipeline

### GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install backend
        run: cd backend && npm ci
      
      - name: Test backend
        run: cd backend && npm test
      
      - name: Lint backend
        run: cd backend && npm run lint
      
      - name: Install frontend
        run: cd frontend && npm ci
      
      - name: Test frontend
        run: cd frontend && npm test
      
      - name: Build frontend
        run: cd frontend && npm run build
      
      - name: Lint frontend
        run: cd frontend && npm run lint

  build-docker:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Build backend image
        run: |
          docker build -t ghcr.io/${{ github.repository }}/backend:${{ github.sha }} ./backend
      
      - name: Build frontend image
        run: |
          docker build -t ghcr.io/${{ github.repository }}/frontend:${{ github.sha }} ./frontend
      
      - name: Push images
        run: |
          echo ${{ secrets.GITHUB_TOKEN }} | docker login ghcr.io -u ${{ github.actor }} --password-stdin
          docker push ghcr.io/${{ github.repository }}/backend:${{ github.sha }}
          docker push ghcr.io/${{ github.repository }}/frontend:${{ github.sha }}

  deploy:
    needs: build-docker
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Deploy to server
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SERVER_SSH_KEY }}
          script: |
            cd /home/terminal/terminal
            docker compose pull
            docker compose up -d --remove-orphans
            docker image prune -f
```

## Troubleshooting Production

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| WebSocket 400 | Nginx not passing upgrade | Add `proxy_set_header Connection "upgrade"` |
| WebSocket 403 | CORS mismatch | Check `CORS_ORIGIN` matches frontend domain |
| PTY spawn fails | Missing kernel module | `modprobe pty` or run container with `--cap-add=SYS_ADMIN` |
| High memory | Too many sessions | Implement session limits + cleanup |
| Slow resize | Buffering | `proxy_buffering off` in Nginx |
| Session drops | No sticky sessions | Use `ip_hash` or session affinity |

### Debug Commands

```bash
# Check backend health
curl -v http://localhost:3000/api/health

# Check WebSocket upgrade
curl -v -H "Upgrade: websocket" -H "Connection: Upgrade" http://localhost:3000/api/pty

# Check Nginx config
sudo nginx -t

# Check PM2 processes
pm2 list
pm2 logs terminal-backend --lines 100

# Check open connections
ss -tulpn | grep :3000

# Check file descriptors
lsof -p $(pgrep -f "node dist/index.js")

# Check system resources
htop
df -h
free -h
```

## Rollback Procedure

```bash
# Docker Compose
docker compose down
docker tag ghcr.io/your-repo/backend:previous ghcr.io/your-repo/backend:latest
docker compose up -d

# PM2
pm2 stop terminal-backend
pm2 delete terminal-backend
# Restore previous version
git checkout previous-tag
npm ci --omit=dev && npm run build
pm2 start ecosystem.config.js

# Kubernetes
kubectl rollout undo deployment/terminal-backend -n terminal
```

## Checklist for Production Launch

- [ ] SSL certificate configured and auto-renewing
- [ ] Domain DNS pointing to server
- [ ] Nginx configured with WebSocket support
- [ ] Backend running with PM2/Docker/K8s
- [ ] Frontend built and served by Nginx
- [ ] CORS origin set to production domain
- [ ] Rate limiting enabled
- [ ] Authentication/authorization implemented
- [ ] Logging configured (structured, rotated)
- [ ] Monitoring/alerting set up
- [ ] Backup strategy implemented
- [ ] Load testing completed
- [ ] Security scan passed
- [ ] Documentation updated
- [ ] Team trained on operations