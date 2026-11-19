import { WebSocketServer, WebSocket } from 'ws';
import { spawn, type IPty } from 'node-pty';
import type { IncomingMessage } from 'http';
import { config, isDevelopment } from '../config/index.ts';

interface PtyConnection {
  pty: IPty;
  ws: WebSocket;
}

const connections = new Map<string, PtyConnection>();

function generateSessionId(): string {
  return Math.random().toString(36).substring(2, 15);
}

function getShell(): string {
  // Use the user's default shell, fallback to bash
  return process.env.SHELL || '/bin/bash';
}

function createPtySession(cols: number, rows: number): IPty {
  const shell = getShell();
  const cwd = process.env.HOME || process.cwd();

  const pty = spawn(shell, [], {
    name: 'xterm-256color',
    cols,
    rows,
    cwd,
    env: {
      ...process.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      FORCE_COLOR: '1',
    },
  });

  return pty;
}

export function setupPtyServer(server: any) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request: IncomingMessage, socket: any, head: Buffer) => {
    const url = new URL(request.url || '', `http://${request.headers.host}`);

    if (url.pathname === '/api/pty') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
    const sessionId = generateSessionId();

    if (isDevelopment) {
      console.log(`[PTY] New connection: ${sessionId}`);
    }

    // Default terminal size
    let cols = 80;
    let rows = 24;

    const pty = createPtySession(cols, rows);

    const connection: PtyConnection = { pty, ws };
    connections.set(sessionId, connection);

    // Send PTY output to WebSocket
    pty.onData((data: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    // Handle PTY exit
    pty.onExit(({ exitCode, signal }) => {
      if (isDevelopment) {
        console.log(`[PTY] Session ${sessionId} exited: code=${exitCode}, signal=${signal}`);
      }
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(1000, `Process exited with code ${exitCode}`);
      }
      connections.delete(sessionId);
    });

    // Handle WebSocket messages (input from client)
    ws.on('message', (data: Buffer | string) => {
      const message = data.toString();

      try {
        const parsed = JSON.parse(message);

        if (parsed.type === 'resize' && parsed.cols && parsed.rows) {
          cols = parsed.cols;
          rows = parsed.rows;
          pty.resize(parsed.cols, parsed.rows);
        } else if (parsed.type === 'input') {
          pty.write(parsed.data);
        }
      } catch {
        // Raw input (for backward compatibility)
        pty.write(message);
      }
    });

    // Handle WebSocket close
    ws.on('close', (code, reason) => {
      if (isDevelopment) {
        console.log(`[PTY] Connection closed: ${sessionId}, code=${code}, reason=${reason}`);
      }
      pty.kill();
      connections.delete(sessionId);
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error(`[PTY] WebSocket error for ${sessionId}:`, error);
      pty.kill();
      connections.delete(sessionId);
    });

    pty.on('error', (error) => {
      console.error(`[PTY] PTY error for ${sessionId}:`, error);
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(1011, 'PTY error');
      }
      connections.delete(sessionId);
    });
  });

  // Cleanup on shutdown
  process.on('SIGTERM', () => {
    connections.forEach(({ pty }) => pty.kill());
    connections.clear();
  });

  if (isDevelopment) {
    console.log('[PTY] WebSocket server ready on /api/pty');
  }

  return wss;
}

export function getActiveSessionsCount(): number {
  return connections.size;
}