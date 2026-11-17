import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { env } from './config/env.js';
import { dbInfo } from './config/db.js';
import { notFound, errorHandler } from './middleware/error.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { addLiveClient, broadcastLiveChange } from './services/liveService.js';
import authRoutes from './routes/authRoutes.js';
import setupRoutes from './routes/setupRoutes.js';
import userRoutes from './routes/userRoutes.js';
import guestRoutes from './routes/guestRoutes.js';
import roomRoutes from './routes/roomRoutes.js';
import roomTypeRoutes from './routes/roomTypeRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import invoiceRoutes from './routes/invoiceRoutes.js';
import serviceRoutes from './routes/serviceRoutes.js';
import housekeepingRoutes from './routes/housekeepingRoutes.js';
import maintenanceRoutes from './routes/maintenanceRoutes.js';
import feedbackRoutes from './routes/feedbackRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import portalRoutes from './routes/portalRoutes.js';
import publicRoutes from './routes/publicRoutes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const createApp = () => {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false,
    })
  );

  const allowedOrigins = env.clientOrigin
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  // Vercel gives every deployment its own preview URL in addition to the
  // stable alias. Accept the project's own vercel.app origins so previews and
  // production aliases work without editing environment variables each time.
  const isVercelPreview = (origin) =>
    /^https:\/\/luxurystay(?:-[a-z0-9-]+)?\.vercel\.app$/i.test(origin || '');

  app.use(
    cors({
      origin(origin, callback) {
        if (
          !origin ||
          allowedOrigins.includes(origin) ||
          isVercelPreview(origin) ||
          env.nodeEnv !== 'production'
        ) {
          return callback(null, true);
        }
        return callback(null, false);
      },
      credentials: true,
    })
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  if (env.nodeEnv !== 'test') {
    app.use(morgan(env.logLevel));
  }

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), database: dbInfo(), time: new Date() });
  });

  app.use('/api', apiLimiter);
  app.get('/api/live', addLiveClient);

  // Tell every connected screen that data changed. This runs before the
  // routers so the listener is attached to every write request.
  app.use('/api', (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    res.on('finish', () => {
      if (res.statusCode < 400) broadcastLiveChange();
    });
    return next();
  });

  app.use('/api/setup', setupRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/guests', guestRoutes);
  app.use('/api/rooms', roomRoutes);
  app.use('/api/room-types', roomTypeRoutes);
  app.use('/api/bookings', bookingRoutes);
  app.use('/api/invoices', invoiceRoutes);
  app.use('/api/services', serviceRoutes);
  app.use('/api/housekeeping', housekeepingRoutes);
  app.use('/api/maintenance', maintenanceRoutes);
  app.use('/api/feedback', feedbackRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/portal', portalRoutes);
  app.use('/api/public', publicRoutes);

  const clientDist = path.resolve(__dirname, '../../client/dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get(/^(?!\/api).*/, (req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  app.use(notFound);
  app.use(errorHandler);

  return app;
};
