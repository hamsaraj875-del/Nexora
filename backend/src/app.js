import express from 'express';
import { portalForRole } from './utils/portal.js';
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
import overlapRoutes from './routes/overlapRoutes.js';

const app = express();

app.set('trust proxy', 1);

app.use(helmet());

const configuredOrigin = env.CLIENT_URL
  ? env.CLIENT_URL.replace(/\/$/, '')
  : '';

app.use(
  cors({
    origin: (origin, callback) => {
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
  message: {
    success: false,
    message: 'Too many login attempts. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  skip: () => process.env.NODE_ENV === 'test',
});

app.use('/api', generalLimiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'AICTE Integrated Complaint Monitoring Dashboard Backend',
  });
});

// Authentication
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth', authRoutes);
app.get('/api/me', authenticate, getMe);

// Overlap routes:
// Allow authenticated officer-portal and bureau-portal users.
const requireOverlapPortal = (req, res, next) => {
  const userPortal = portalForRole(req.user.role);
  const tokenPortal = req.tokenPayload?.portal || req.portal;

  const allowedPortals = ['officer', 'bureau'];

  if (
    !allowedPortals.includes(userPortal) ||
    (tokenPortal && !allowedPortals.includes(tokenPortal))
  ) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: Overlap access is restricted to officer and bureau portals.',
    });
  }

  next();
};
// Actual overlap resolution permissions are checked inside the controller.
app.use(
  '/api/officer/overlaps',
  authenticate,
  requireOverlapPortal,
  overlapRoutes
);

// Remaining officer endpoints retain officer-portal restrictions.
app.use(
  '/api/officer',
  authenticate,
  requirePortal('officer'),
  officerRoutes
);

// Bureau endpoints retain bureau-portal restrictions.
app.use(
  '/api/bureau',
  authenticate,
  requirePortal('bureau'),
  bureauRoutes
);

// Student endpoints retain student-portal restrictions.
app.use(
  '/api/student',
  authenticate,
  requirePortal('student'),
  studentRoutes
);

app.use('/api/dashboard', dashboardRoutes);

app.use('/mock', mockRoutes);

app.use(errorHandler);

export default app;