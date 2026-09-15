// tests/draftPromotion.test.js
import assert from 'assert';
import { IngestionSyncEngine } from '../utils/ingestion/sync.js';

const mockDb = { posts: [] };

const mockGet = async (date, category) =>
  mockDb.posts.find(p => p.category === category && p.created_at === date) || null;

const mockCreate = async (title, category, status, drawDate, middayWinnings, eveningWinnings, description, metaTitle, metaDesc) => {
  const id = mockDb.posts.length + 1;
  const post = { id, title, category, status, created_at: drawDate, midday_winnings: middayWinnings, evening_winnings: eveningWinnings, description, meta_title: metaTitle, meta_desc: metaDesc };
  mockDb.posts.push(post);
  return post;
};

const mockUpdate = async (id, data) => {
  const idx = mockDb.posts.findIndex(p => p.id === id);
  if (idx === -1) return null;
  mockDb.posts[idx] = { ...mockDb.posts[idx], ...data };
  return mockDb.posts[idx];
};

const noOp = async () => {};
const noOpPrize = async () => ({ generated: 0, skipped: true });
const noOpLog = async () => null;

function buildEngine(providerResults) {
  const engine = new IngestionSyncEngine({
    getPostByCategoryAndDate: mockGet,
    createPost: mockCreate,
    updatePost: mockUpdate,
    autoGeneratePrizeBreakdowns: noOpPrize,
    triggerLiveSubscriberNotifications: noOp,
    createSyncLog: noOpLog,
    bustSitemapCache: noOp,
  });

  engine.provider = {
    fetchRawResults: async () => providerResults,
    normalize: (_cat, raw) => ({
      drawDate: raw.draw_date.split('T')[0],
      middayWinningNumbers: raw.midday_winning_numbers ? raw.midday_winning_numbers.split(' ') : null,
      eveningWinningNumbers: raw.evening_winning_numbers ? raw.evening_winning_numbers.split(' ') : null,
    }),
  };

  engine.validator = { validate: () => ({ isValid: true }) };
  return engine;
}

(async () => {
  console.log('[TEST] Draft promotion test start');

  const CATEGORY = 'numbers';
  const DRAW_DATE = '2026-10-01';

  const draftPost = {
    id: 1,
    title: 'Numbers Results for October 1, 2026',
    category: CATEGORY,
    status: 'draft',
    created_at: DRAW_DATE,
    midday_winnings: ['01', '02', '03', '04', '05'],
    evening_winnings: null,
    description: 'Draft description',
    meta_title: '',
    meta_desc: '',
  };
  mockDb.posts.push(draftPost);

  const engine1 = buildEngine([{
    draw_date: DRAW_DATE + 'T00:00:00.000',
    midday_winning_numbers: '01 02 03 04 05',
    evening_winning_numbers: '06 07 08 09 10',
  }]);

  const report1 = await engine1.sync(CATEGORY);

  assert.strictEqual(report1.fetched, 1, 'Should have fetched 1 draw');
  assert.strictEqual(report1.updated, 1, 'Engine should have updated post');
  assert.strictEqual(report1.created, 0, 'No new post created');

  const updatedDraft = mockDb.posts.find(p => p.id === 1);
  assert.ok(updatedDraft, 'Draft post must exist');
  assert.deepStrictEqual(updatedDraft.evening_winnings, ['06', '07', '08', '09', '10']);
  assert.strictEqual(updatedDraft.status, 'published', 'Draft must be promoted to published');

  console.log('[PASS] Scenario 1: draft post promoted to published');

  const report2 = await engine1.sync(CATEGORY);
  assert.strictEqual(report2.duplicates, 1);
  assert.strictEqual(report2.updated, 0);
  assert.strictEqual(mockDb.posts.length, 1);
  assert.strictEqual(mockDb.posts[0].status, 'published');

  console.log('[PASS] Scenario 2: second sync is idempotent');

  const NEW_DATE = '2026-10-02';
  const engine3 = buildEngine([{
    draw_date: NEW_DATE + 'T00:00:00.000',
    midday_winning_numbers: '11 12 13 14 15',
    evening_winning_numbers: '16 17 18 19 20',
  }]);

  const report3 = await engine3.sync(CATEGORY);
  assert.strictEqual(report3.created, 1);
  const newPost = mockDb.posts.find(p => p.created_at === NEW_DATE);
  assert.ok(newPost);
  assert.strictEqual(newPost.status, 'published');
  assert.strictEqual(mockDb.posts.length, 2);

  console.log('[PASS] Scenario 3: new draw date creates new published post');
  console.log('[DONE] All draft promotion tests passed.');
})();
