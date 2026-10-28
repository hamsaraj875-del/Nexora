import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authenticate, requirePortal } from './middleware/auth.js';
import { getMe } from './controllers/authController.js';

// Route imports
import dashboardRoutes from './routes/dashboardRoutes.js';
import authRoutes from './routes/authRoutes.js';
import officerRoutes from './routes/officerRoutes.js';
import bureauRoutes from './routes/bureauRoutes.js';
import studentRoutes from './routes/studentRoutes.js';
import mockRoutes from './routes/mockRoutes.js';

const app = express();

// Trust the first proxy (required for Render, Heroku, etc. behind a load balancer)
// Without this, express-rate-limit throws ERR_ERL_UNEXPECTED_X_FORWARDED_FOR
app.set('trust proxy', 1);

// Security HTTP headers
app.use(helmet());

// Cross-Origin Resource Sharing
const configuredOrigin = env.CLIENT_URL ? env.CLIENT_URL.replace(/\/$/, '') : '';
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like health checks, mobile apps, curl)
      if (!origin) return callback(null, true);
      const cleanOrigin = origin.replace(/\/$/, '');
      if (
        !configuredOrigin ||
        cleanOrigin === configuredOrigin ||
        cleanOrigin === 'http://localhost:5173' ||
        cleanOrigin === 'http://localhost:3000' ||
        cleanOrigin.endsWith('.onrender.com')
      ) {
        return callback(null, true);
      }
      return callback(null, cleanOrigin);
    },
    credentials: true,
  })
);

// Rate limiters (skip during automated tests; validate: false prevents ERR_ERL_UNEXPECTED_X_FORWARDED_FOR on reverse proxies)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  skip: () => process.env.NODE_ENV === 'test',
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { success: false, message: 'Too many login attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  skip: () => process.env.NODE_ENV === 'test',
});

app.use('/api', generalLimiter);

// Body parser with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'AICTE Integrated Complaint Monitoring Dashboard Backend',
  });
});

// Authentication & Self endpoints
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth', authRoutes);
app.get('/api/me', authenticate, getMe);

// Dedicated Portal API route groups with portal enforcement
app.use('/api/officer', authenticate, requirePortal('officer'), officerRoutes);
app.use('/api/bureau', authenticate, requirePortal('bureau'), bureauRoutes);
app.use('/api/student', authenticate, requirePortal('student'), studentRoutes);

// Dashboard analytics routes
app.use('/api/dashboard', dashboardRoutes);

// Dedicated Portal API route groups with portal enforcement
//app.use('/api/officer', authenticate, requirePortal('officer'), officerRoutes);
//app.use('/api/bureau', authenticate, requirePortal('bureau'), bureauRoutes);
//app.use('/api/student', authenticate, requirePortal('student'), studentRoutes);

// Mock external sources (used for demo connectors & external portal sync)
app.use('/mock', mockRoutes);

// Central error handler
app.use(errorHandler);

export default app;
