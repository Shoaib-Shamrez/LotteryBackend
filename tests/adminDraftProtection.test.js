// tests/adminDraftProtection.test.js
import assert from 'assert';
import { IngestionSyncEngine } from '../utils/ingestion/sync.js';

const mockDb = { posts: [] };

const mockGet = async (date, category) =>
  mockDb.posts.find(p => p.category === category && p.created_at === date) || null;

const mockUpdate = async (id, data) => {
  const idx = mockDb.posts.findIndex(p => p.id === id);
  if (idx === -1) return null;
  mockDb.posts[idx] = { ...mockDb.posts[idx], ...data };
  return mockDb.posts[idx];
};

const noOp = async () => {};
const noOpPrize = async () => ({ generated: 0, skipped: true });
const noOpLog = async () => null;

(async () => {
  console.log('[TEST] Admin draft protection test start');

  const CATEGORY = 'numbers';
  const DRAW_DATE = '2026-10-01';

  // Seed existing draft post with full numbers
  const draftPost = {
    id: 1,
    title: 'Numbers Results for October 1, 2026',
    category: CATEGORY,
    status: 'draft',
    created_at: DRAW_DATE,
    midday_winnings: ['01', '02', '03', '04', '05'],
    evening_winnings: ['06', '07', '08', '09', '10'],
    description: 'Admin created draft',
  };
  mockDb.posts.push(draftPost);

  const engine = new IngestionSyncEngine({
    getPostByCategoryAndDate: mockGet,
    updatePost: mockUpdate,
    autoGeneratePrizeBreakdowns: noOpPrize,
    triggerLiveSubscriberNotifications: noOp,
    createSyncLog: noOpLog,
    bustSitemapCache: noOp,
  });

  engine.provider = {
    fetchRawResults: async () => [{
      draw_date: DRAW_DATE + 'T00:00:00.000',
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

  const report = await engine.sync(CATEGORY);

  assert.strictEqual(report.duplicates, 1, 'Sync with identical numbers should be skipped as duplicate');
  assert.strictEqual(report.updated, 0, 'No post update should happen');
  assert.strictEqual(mockDb.posts[0].status, 'draft', 'Post must remain draft');

  console.log('[PASS] Admin draft protection verified: draft with identical numbers stays draft');
})();
