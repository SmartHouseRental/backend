import './config/redis'; // Connect Redis at startup
import http from 'http';
import { Server } from 'socket.io';
import type { AddressInfo } from 'net';
import app from './app';
import { env } from './config/env';
import prisma from './config/database';
import { initMessagingSocket } from './modules/messaging/socket';

const PORT = env.PORT || 3000;

// Create HTTP server from Express app
const httpServer = http.createServer(app);

// Create Socket.io server
export const io = new Server(httpServer, {
  cors: {
    origin: env.ALLOWED_ORIGINS,
    credentials: true,
  },
});

async function bootstrap() {
  try {
    await prisma.$connect();
    console.log('🐘 PostgreSQL connected');
  } catch (err) {
    console.error('PostgreSQL connection failed:', (err as Error).message);
    process.exit(1);
  }

  // Initialize Socket.io for messaging
  initMessagingSocket(io);

  httpServer.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(
        `Port ${PORT} is already in use. Stop the other process or change PORT in .env.`
      );
      process.exit(1);
    }

    console.error('HTTP server failed to start:', error.message);
    process.exit(1);
  });

  httpServer.listen(PORT, () => {
    const address = httpServer.address() as AddressInfo | null;
    const activePort = address?.port ?? PORT;
    console.log(`🚀 Server running on http://localhost:${activePort}`);
    console.log(`📖 Docs available on http://localhost:${activePort}/api-docs`);
  });
}

bootstrap();
