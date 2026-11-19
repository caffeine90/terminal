import app from './app.ts';
import { config } from './config/index.ts';
import { setupPtyServer } from './pty/ptyServer.ts';

const server = app.listen(config.port, () => {
  console.log(`
🚀 Server running in ${config.nodeEnv} mode
📡 Listening on port ${config.port}
🔗 Health check: http://localhost:${config.port}/api/health
🔗 API base: http://localhost:${config.port}/api
🔌 PTY WebSocket: ws://localhost:${config.port}/api/pty
  `.trim());
});

// Setup PTY WebSocket server
setupPtyServer(server);

// Graceful shutdown
const shutdown = (signal: string) => {
  console.log(`\n${signal} received. Shutting down gracefully...`);

  server.close((err) => {
    if (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
    console.log('Server closed. Goodbye!');
    process.exit(0);
  });

  // Force close after 10 seconds
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: unknown) => {
  console.error('Unhandled Rejection:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

export default server;