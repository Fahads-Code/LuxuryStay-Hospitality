import { createApp } from './app.js';
import { connectDB, disconnectDB, dbInfo } from './config/db.js';
import { env } from './config/env.js';
import { User } from './models/User.js';

const start = async () => {
  try {
    await connectDB();

    const userCount = await User.estimatedDocumentCount();
    if (userCount === 0) {
      console.log('[setup] No accounts yet — open the app to create the administrator account.');
    }

    const app = createApp();
    const server = app.listen(env.port, () => {
      const memory = dbInfo().memory ? ' (in-memory MongoDB)' : '';
      console.log('');
      console.log('  ╔════════════════════════════════════════════════╗');
      console.log('  ║          HOTEL MANAGEMENT SYSTEM               ║');
      console.log('  ╚════════════════════════════════════════════════╝');
      console.log(`  API ready at  http://localhost:${env.port}/api${memory}`);
      console.log(`  Health check  http://localhost:${env.port}/api/health`);
      console.log(`  Frontend      http://localhost:5173`);
      console.log('');
    });

    const shutdown = async (signal) => {
      console.log(`\n[server] ${signal} received. Shutting down...`);
      server.close(async () => {
        await disconnectDB();
        process.exit(0);
      });
      setTimeout(() => process.exit(1), 8000).unref();
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    console.error('[server] Failed to start:', error);
    process.exit(1);
  }
};

start();
