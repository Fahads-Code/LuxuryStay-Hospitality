import { createApp } from '../server/src/app.js';
import { connectDB } from '../server/src/config/db.js';

const app = createApp();

// Vercel reuses a warm instance across requests, so connect once and share the
// pending promise. A cold start waits for MongoDB before the first request is
// handed to Express; later requests reuse the open connection.
let connecting = null;
const ready = () => {
  if (!connecting) connecting = connectDB();
  return connecting;
};

export default async function handler(req, res) {
  try {
    await ready();
  } catch (error) {
    console.error('[api] database connection failed:', error.message);
    if (!res.headersSent) {
      res.statusCode = 503;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          message: 'The hotel service is starting up. Please try again in a moment.',
        })
      );
    }
    return;
  }

  return app(req, res);
}
