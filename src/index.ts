import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { User } from './models/User';
import userRoutes from './routes/userRoutes';
import usageRoutes from './routes/usageRoutes';
import billingRoutes from './routes/billingRoutes';
import rateRoutes from './routes/rateRoutes';
import stripeRoutes from './routes/stripeRoutes';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import { 
  generalRateLimit, 
  securityHeaders, 
  sanitizeInput, 
  requestSizeLimit 
} from './middleware/security';

dotenv.config();
const app = express();

// Security middleware (must be first)
app.use(securityHeaders);
app.use(generalRateLimit);
app.use(requestSizeLimit);

// CORS configuration
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'x-request-id']
};
app.use(cors(corsOptions));

// Body parsing with limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Input sanitization
app.use(sanitizeInput);

app.use('/users', userRoutes);
app.use('/usage', usageRoutes);
app.use('/billing', billingRoutes);
app.use('/rates', rateRoutes);
app.use('/stripe', stripeRoutes);


const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Telecom Billing System API',
      version: '1.0.0',
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
  },
  apis: ['./src/routes/*.ts', './src/swagger.ts'],
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get('/', (req, res) => {
  res.send('Telecom Billing System API');
});

// Error handling middleware (must be last)
import { errorHandler, notFound } from './middleware/errorHandler';
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  await User.createTableIfNotExists();
  console.log(`Server running on port ${PORT}`);
});
