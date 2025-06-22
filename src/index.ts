import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { User } from './models/User';
import userRoutes from './routes/userRoutes';
import usageRoutes from './routes/usageRoutes';
import billingRoutes from './routes/billingRoutes';
import rateRoutes from './routes/rateRoutes';


dotenv.config();
const app = express();
app.use(express.json());
app.use(cors());

app.use('/users', userRoutes);
app.use('/usage', usageRoutes);
app.use('/billing', billingRoutes);
app.use('/rates', rateRoutes);

app.get('/', (req, res) => {
  res.send('Telecom Billing System API');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  await User.createTableIfNotExists();
  console.log(`Server running on port ${PORT}`);
});
