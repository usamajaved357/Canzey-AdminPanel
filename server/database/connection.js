import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'canzey-app-db',
  waitForConnections: true,
  connectionLimit: 10,
  // Cap queue so hung MySQL can't make every request wait forever
  queueLimit: 30,
  connectTimeout: 10000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  // ⚠️ Return DATETIME columns as plain strings, not JS Date objects.
  // Without this, mysql2 converts to UTC Date objects which shifts times
  // when serialized to JSON (e.g. 05:00 stored → 03:00 returned in UTC-2).
  dateStrings: true,
});

// Fail fast when the pool is stuck waiting for a free connection
const originalGetConnection = pool.getConnection.bind(pool);
pool.getConnection = async function getConnectionWithTimeout() {
  return Promise.race([
    originalGetConnection(),
    new Promise((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              'Database connection timeout — pool may be exhausted. Restart the API server.',
            ),
          ),
        12000,
      ),
    ),
  ]);
};

export default pool;
