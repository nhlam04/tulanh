process.env.TZ ||= 'Asia/Ho_Chi_Minh';

const config = {
  port: Number(process.env.PORT || 5000),
  basePath: process.env.BASE_PATH || '/it4788',
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/?replicaSet=rs0&directConnection=true',
  dbName: process.env.DB_NAME || 'tulanh',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  accessTtlSec: 60 * 60,
  refreshTtlSec: 60 * 60 * 24 * 7,
  codeTtlMs: 24 * 60 * 60 * 1000,
  rateLimitPerMinute: 60,
  pageLimit: 100,
  logRetentionDays: 30,
  reminderHour: 8,
  alertDays: 3,
  bcryptWorkFactor: 10,
};

module.exports = { config };
