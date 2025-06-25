import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { User } from './models/User';
import userRoutes from './routes/userRoutes';
import usageRoutes from './routes/usageRoutes';
import billingRoutes from './routes/billingRoutes';
import rateRoutes from './routes/rateRoutes';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';


dotenv.config();
const app = express();
app.use(express.json());
app.use(cors());

app.use('/users', userRoutes);
app.use('/usage', usageRoutes);
app.use('/billing', billingRoutes);
app.use('/rates', rateRoutes);


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

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  await User.createTableIfNotExists();
  console.log(`Server running on port ${PORT}`);
});
