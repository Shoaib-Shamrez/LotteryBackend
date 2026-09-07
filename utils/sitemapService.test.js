import { getDynamicSitemap } from './sitemapService.js';
import assert from 'assert';

// Mock a minimal DB pool returning empty posts for simplicity
const mockPool = {
  query: async () => ({ rows: [] })
};

(async () => {
  const { xml } = await getDynamicSitemap({ pool: mockPool, baseUrl: 'https://nylotteryresults.com' });
  // Ensure the XML contains the canonical base URL and no localhost entries
  assert(xml.includes('https://nylotteryresults.com/'), 'Canonical URL missing');
  assert(!xml.includes('localhost'), 'Unexpected localhost URL');
  console.log('✅ sitemapService test passed');
})();
