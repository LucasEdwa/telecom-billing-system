import { createPool, PoolOptions } from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const dbHost = process.env.DB_HOST || 'localhost';
const isCloudSql = dbHost.startsWith('/cloudsql/');

console.log('Database connection details:', {
  host: isCloudSql ? '(Cloud SQL socket)' : dbHost,
  user: process.env.DB_USERNAME,
  database: process.env.DB_DATABASE,
  port: process.env.DB_PORT
});

const poolOptions: PoolOptions = {
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

if (isCloudSql) {
  poolOptions.socketPath = dbHost;
} else {
  poolOptions.host = dbHost;
  poolOptions.port = Number(process.env.DB_PORT) || 3306;
}

export const pool = createPool(poolOptions);

