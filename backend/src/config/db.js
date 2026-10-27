import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';
import { env } from './env.js';

let embeddedServer = null;

const cleanupEmbeddedServer = async () => {
  if (embeddedServer) {
    try {
      await embeddedServer.stop();
    } catch {
      // Ignore cleanup error
    }
    embeddedServer = null;
  }
};

process.on('SIGINT', async () => {
  await cleanupEmbeddedServer();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await cleanupEmbeddedServer();
  process.exit(0);
});

export const connectDB = async () => {
  mongoose.set('strictQuery', false);

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  // 1. Try connecting to the configured MONGODB_URI first (e.g. localhost:27017 or Atlas)
  try {
    const conn = await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log(`[Database] MongoDB Connected: ${conn.connection.host}`);

    // Guard: Prevent automatic demo-data seeding in production
    if (env.NODE_ENV !== 'production' && process.env.AUTO_SEED === 'true') {
      try {
        const { User } = await import('../models/User.js');
        const userCount = await User.countDocuments();
        if (userCount === 0) {
          console.log('[Database] Non-production database is empty. Seeding default demo datasets...');
          const { seedDatabase } = await import('../seed/seedData.js');
          await seedDatabase(false);
        }
      } catch (seedErr) {
        console.warn('[Database] Seeding check note:', seedErr.message);
      }
    }

    return conn;
  } catch (err) {
    console.warn(`[Database] Failed to connect to ${env.MONGODB_URI}: ${err.message}`);
    if (env.NODE_ENV === 'production' || env.MONGODB_URI.startsWith('mongodb+srv://')) {
      console.error('[Database] Production/Atlas connection failed. Please check MONGODB_URI, Atlas IP whitelist (0.0.0.0/0), and credentials.');
      throw err;
    }
    console.log(`[Database] Initializing embedded MongoDB fallback...`);
  }

  // 2. Automatically launch embedded MongoDB in non-production environments
  try {
    const { MongoMemoryServer } = await import('mongodb-memory-server');

    const dbPath = path.resolve(process.cwd(), '.mongo-data');
    if (!fs.existsSync(dbPath)) {
      fs.mkdirSync(dbPath, { recursive: true });
    }

    try {
      embeddedServer = await MongoMemoryServer.create({
        instance: {
          port: 27017,
          dbPath,
          dbName: 'aicte_complaints',
        },
      });
    } catch (portErr) {
      console.warn('[Database] Port 27017 unavailable, starting on available port:', portErr.message);
      embeddedServer = await MongoMemoryServer.create({
        instance: {
          dbPath,
          dbName: 'aicte_complaints',
        },
      });
    }

    const uri = embeddedServer.getUri();
    const conn = await mongoose.connect(uri);
    console.log(`[Database] Embedded MongoDB Connected: ${uri}`);

    // Check if database needs seeding
    const { User } = await import('../models/User.js');
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log('[Database] Database is empty. Automatically seeding default users and datasets...');
      const { seedDatabase } = await import('../seed/seedData.js');
      await seedDatabase(false);
    }

    return conn;
  } catch (error) {
    console.error(`[Database] Failed to establish database connection: ${error.message}`);
    process.exit(1);
  }
};

export const disconnectDB = async () => {
  await mongoose.disconnect();
  await cleanupEmbeddedServer();
};

