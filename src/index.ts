import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { User } from './models/User';
import userRoutes from './routes/userRoutes';
import usageRoutes from './routes/usageRoutes';
import billingRoutes from './routes/billingRoutes';
import rateRoutes from './routes/rateRoutes';
// import stripeRoutes from './routes/stripeRoutes'; // Stripe disabled
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import { 
  generalRateLimit, 
  securityHeaders, 
  sanitizeInput, 
  requestSizeLimit 
} from './middleware/security';

// Error handling middleware (must be last)
import { errorHandler, notFound } from './middleware/errorHandler';
dotenv.config();
const app = express();

// Security middleware (must be first)
app.use(securityHeaders);
app.use(generalRateLimit);
app.use(requestSizeLimit);

// Trust the first proxy to fix rate limit issue
app.set('trust proxy', 1);

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS;
const corsOptions = {
  origin: allowedOrigins === '*' ? true : allowedOrigins?.split(',') || ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'x-request-id']
};
app.use(cors(corsOptions));

// Body parsing with limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Telecom Billing System API',
    version: '1.0.0',
    description: 'A comprehensive telecom billing system with user management, usage tracking, and billing features.',
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
  security: [{ bearerAuth: [] }],
};

const swaggerOptions = {
  definition: swaggerDefinition,
  apis: [
    './src/routes/*.ts',
    './src/swagger.ts',
    './dist/routes/*.js',
    './dist/swagger.js'
  ],
};

// Setup Swagger UI — server URL is injected dynamically from the incoming request
// so it works regardless of the environment (local, minikube, cloud)
app.use('/api-docs', swaggerUi.serve, (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  const dynamicSpec = swaggerJsdoc({
    ...swaggerOptions,
    definition: {
      ...swaggerDefinition,
      servers: [{ url: `${proto}://${host}`, description: 'Current server' }],
    },
  });
  swaggerUi.setup(dynamicSpec)(req, res, next);
});

// Input sanitization (skip for safe routes)
app.use((req, res, next) => {
  if (req.path.startsWith('/api-docs') || 
      req.path === '/health' || 
      req.path === '/' ||
      req.path === '/favicon.ico') {
    return next();
  }
  sanitizeInput(req, res, next);
});

app.use('/users', userRoutes);
app.use('/usage', usageRoutes);
app.use('/billing', billingRoutes);
app.use('/rates', rateRoutes);
// app.use('/stripe', stripeRoutes); // Stripe disabled

app.get('/', (_req, res) => {
  res.redirect('/api-docs');
});

app.get('/health', (_req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0' 
  });
});

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || (process.env.NODE_ENV === 'production' ? 8080 : 3000);
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Swagger docs available at: http://localhost:${PORT}/api-docs`);
  
  // Try to create table, but don't crash if database isn't ready
  try {
    await User.createTableIfNotExists();
    console.log('Database connected and tables ready');
  } catch (error) {
    console.warn('Database not ready yet, app will work without DB for now:', error instanceof Error ? error.message : String(error));
  }
});
