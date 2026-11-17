import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { env, isProduction } from './env.js';

let memoryServer = null;
let activeUri = '';

// Without an 'error' listener a dropped Atlas connection can surface as an
// unhandled event and crash the API mid-request. Log it instead and let the
// driver reconnect.
mongoose.connection.on('error', (error) => {
  console.error('[db] connection error:', error.message);
});
mongoose.connection.on('disconnected', () => {
  console.warn('[db] connection lost — the driver will reconnect automatically.');
});
mongoose.connection.on('reconnected', () => {
  console.log('[db] reconnected to MongoDB.');
});

const tryConnect = async (uri) => {
  await mongoose.connect(uri, {
    // The free Atlas tier can need a few seconds on a cold connection; the old
    // 4s limit turned those slow starts into 500s for guests.
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 20000,
    socketTimeoutMS: 45000,
  });
};

/**
 * Connects to MongoDB. During development the app can transparently fall back
 * to an in-memory MongoDB instance so the project runs without a local install.
 */
export const connectDB = async () => {
  if (mongoose.connection.readyState === 1) return mongoose.connection;

  const localUri = 'mongodb://127.0.0.1:27017/luxurystay';
  const primaryUri = env.mongoUri || localUri;

  try {
    await tryConnect(primaryUri);
    activeUri = primaryUri;
    console.log(`[db] Connected to MongoDB at ${primaryUri.replace(/\/\/.*@/, '//***@')}`);
    return mongoose.connection;
  } catch (error) {
    console.warn(`[db] Could not connect to ${primaryUri}: ${error.message}`);
    if (isProduction || !env.useMemoryDb) throw error;
  }

  console.log('[db] Starting in-memory MongoDB (development fallback)...');
  memoryServer = await MongoMemoryServer.create({ instance: { dbName: 'luxurystay' } });
  const uri = memoryServer.getUri('luxurystay');
  await tryConnect(uri);
  activeUri = uri;
  console.log('[db] In-memory MongoDB ready. Data lives only for this session.');
  return mongoose.connection;
};

export const disconnectDB = async () => {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
};

export const dbInfo = () => ({
  uri: activeUri.replace(/\/\/.*@/, '//***@'),
  memory: Boolean(memoryServer),
  readyState: mongoose.connection.readyState,
});
