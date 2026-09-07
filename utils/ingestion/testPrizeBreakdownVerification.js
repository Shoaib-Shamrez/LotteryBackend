// Auto-generated tests for prize breakdown verification (ESM)
import assert from 'assert';
import { PRIZE_STRUCTURES, generateTierRows, autoGeneratePrizeBreakdowns } from '../prizeBreakdownService.js';
import * as prizeBreakModel from '../../models/prizeBreakModel.js';

// Simple mock functions
let mockGetByPost = async () => ({ prizes: [] });
let mockAddBatch = async () => ({ inserted: 0 });

// Override model functions with mocks
prizeBreakModel.getPrizeBreakdownsByPost = async (...args) => mockGetByPost(...args);
prizeBreakModel.addPrizeBreakdownsBatch = async (...args) => mockAddBatch(...args);

function verifyPrizeAmounts() {
  const expected = {
    numbers: [500, 160, 80],
    win4: [5000, 1198, 800],
    take5: [null, 500, 25, 1],
    lotto: [null, 1000, 50, 25, 1],
    powerball: [null, 1000000, 50000, 100, 100, 7, 4, 4],
    megamillions: [null, 1000000, 10000, 500, 200, 10, 10, 4, 2]
  };
  for (const cat of Object.keys(expected)) {
    const tiers = PRIZE_STRUCTURES[cat];
    assert.strictEqual(tiers.length, expected[cat].length, `Tier count mismatch for ${cat}`);
    tiers.forEach((t, i) => {
      assert.strictEqual(t.prize_amount, expected[cat][i], `Prize amount mismatch for ${cat} tier ${t.label}`);
    });
  }
  console.log('✅ Prize amounts verified');
}

function testGenerateTierRows() {
  const rows = generateTierRows({ category: 'numbers', sessions: ['midday'] });
  assert.strictEqual(rows.length, 3, 'Numbers should generate 3 rows');
  assert.strictEqual(rows[0].prize_amount, 500);
  console.log('✅ generateTierRows works for numbers');
}

async function testAutoGenerateIdempotency() {
  const postId = 12345;
  const post = {};
  // First run: no existing rows
  mockGetByPost = async () => ({ prizes: [] });
  mockAddBatch = async () => ({ inserted: 3 });
  const result1 = await autoGeneratePrizeBreakdowns({ postId, category: 'numbers', post });
  assert.strictEqual(result1.generated, 3, 'First generation should insert rows');

  // Second run: rows already exist
  mockGetByPost = async () => ({ prizes: [{}, {}, {}] });
  const result2 = await autoGeneratePrizeBreakdowns({ postId, category: 'numbers', post });
  assert.strictEqual(result2.generated, 0, 'Second generation should skip insertion');
  console.log('✅ autoGeneratePrizeBreakdowns idempotent');
}

(async () => {
  try {
    verifyPrizeAmounts();
    testGenerateTierRows();
    await testAutoGenerateIdempotency();
    console.log('All prize breakdown tests passed');
    process.exit(0);
  } catch (e) {
    console.error('Test failure:', e);
    process.exit(1);
  }
})();
