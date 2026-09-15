// tests/schedule.test.js
import request from 'supertest';
import express from 'express';
import scheduleSync from '../routes/scheduleSync.js';
import syncRoutes from '../routes/syncRoutes.js';

const app = express();
app.use(express.json());
app.use('/api/sync/schedule', scheduleSync);
app.use('/api/sync', syncRoutes);

process.env.CRON_SECRET = 'test-cron-secret';
process.env.SYNC_SECRET = 'test-sync-secret';

(async () => {
  console.log('[TEST] Schedule route test start');

  // 1. GET with valid CRON_SECRET -> 200
  const resGetCron = await request(app)
    .get('/api/sync/schedule?category=numbers')
    .set({ Authorization: 'Bearer test-cron-secret' });
  console.log('GET valid CRON_SECRET status:', resGetCron.status);

  // 2. GET with SYNC_SECRET -> 401 (CRON_SECRET is strictly required for schedule)
  const resGetSync = await request(app)
    .get('/api/sync/schedule?category=numbers')
    .set({ Authorization: 'Bearer test-sync-secret' });
  console.log('GET SYNC_SECRET status:', resGetSync.status);

  // 3. GET with missing secret -> 401
  const resGetMissing = await request(app).get('/api/sync/schedule');
  console.log('GET missing secret status:', resGetMissing.status);

  // 4. GET with invalid secret -> 401
  const resGetInvalid = await request(app)
    .get('/api/sync/schedule')
    .set({ Authorization: 'Bearer wrong-secret' });
  console.log('GET invalid secret status:', resGetInvalid.status);

  // 5. POST /api/sync/trigger manual endpoint remains functional -> 401 on missing auth
  const resManualNoAuth = await request(app).post('/api/sync/trigger?category=numbers');
  console.log('Manual POST missing auth status:', resManualNoAuth.status);

  // 6. POST /api/sync/trigger with valid SYNC_SECRET -> 200/500 (authenticated)
  const resManualAuth = await request(app)
    .post('/api/sync/trigger?category=numbers')
    .set({ Authorization: 'Bearer test-sync-secret' });
  console.log('Manual POST auth status:', resManualAuth.status);
})();

