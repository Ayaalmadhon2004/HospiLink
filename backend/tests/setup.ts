// تشغيل قبل كل ملفات التيست: قيم بيئة وهمية حتى ملفات الـ config ما تنهار
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret';
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test_db';
process.env.NODE_ENV = 'test';
process.env.TWO_FACTOR_ENC_KEY = process.env.TWO_FACTOR_ENC_KEY || Buffer.alloc(32, 7).toString('base64');
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'silent';
