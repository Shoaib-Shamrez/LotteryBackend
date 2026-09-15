// tests/dateMismatch.test.js
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
  console.log('[TEST] Date mismatch test start');

  const engine = new IngestionSyncEngine({
    getPostByCategoryAndDate: mockGet,
    createPost: mockCreate,
    updatePost: mockUpdate,
    autoGeneratePrizeBreakdowns: noOpPrize,
    triggerLiveSubscriberNotifications: noOp,
    createSyncLog: noOpLog,
    bustSitemapCache: noOp,
  });

  // Provider returns 2026-10-02, but requested date is 2026-10-01
  engine.provider = {
    fetchRawResults: async () => [{
      draw_date: '2026-10-02T00:00:00.000',
      midday_winning_numbers: '01 02 03 04 05',
      evening_winning_numbers: '06 07 08 09 10',
    }],
    normalize: (_cat, raw) => ({
      drawDate: raw.draw_date.split('T')[0],
      middayWinningNumbers: raw.midday_winning_numbers.split(' '),
      eveningWinningNumbers: raw.evening_winning_numbers.split(' '),
    }),
  };

  engine.validator = { validate: () => ({ isValid: true }) };

  const report = await engine.sync('numbers', '2026-10-01');

  assert.strictEqual(report.created, 0, 'No post created');
  assert.strictEqual(report.updated, 0, 'No post updated');
  assert.strictEqual(report.details.length, 1);
  assert.strictEqual(report.details[0].status, 'date_mismatch', 'Status should be date_mismatch');
  assert.strictEqual(mockDb.posts.length, 0, 'No posts saved to DB');

  console.log('[PASS] Date mismatch verified: no posts created/updated when provider date differs');
})();
