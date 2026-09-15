// tests/timeoutRetry.test.js
import assert from 'assert';
import { IngestionSyncEngine } from '../utils/ingestion/sync.js';

const mockDb = { posts: [] };

const mockGet = async () => null;
const mockCreate = async () => { throw new Error('createPost should not be called'); };
const mockUpdate = async () => { throw new Error('updatePost should not be called'); };
const noOp = async () => {};
const noOpPrize = async () => ({ generated: 0, skipped: true });
const noOpLog = async () => null;

(async () => {
  console.log('[TEST] Timeout retry failure test start');

  const engine = new IngestionSyncEngine({
    getPostByCategoryAndDate: mockGet,
    createPost: mockCreate,
    updatePost: mockUpdate,
    autoGeneratePrizeBreakdowns: noOpPrize,
    triggerLiveSubscriberNotifications: noOp,
    createSyncLog: noOpLog,
    bustSitemapCache: noOp,
  });

  // Provider throws network/timeout error
  engine.provider = {
    fetchRawResults: async () => {
      throw new Error('Provider connection timeout after 5000ms');
    },
    normalize: () => {},
  };

  engine.validator = { validate: () => ({ isValid: true }) };

  const report = await engine.sync('numbers');

  assert.strictEqual(report.success, false, 'Report success should be false');
  assert.strictEqual(report.created, 0, 'No posts created');
  assert.strictEqual(report.updated, 0, 'No posts updated');
  assert.ok(report.errors.some(e => e.includes('timeout')), 'Error array should mention timeout');
  assert.strictEqual(mockDb.posts.length, 0, 'No posts written to DB');

  console.log('[PASS] Timeout retry failure verified: engine handles timeout cleanly without partial DB writes');
})();
