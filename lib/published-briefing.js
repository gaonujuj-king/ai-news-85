const { readFile } = require('node:fs/promises');
const { join } = require('node:path');

const SOURCE = 'https://raw.githubusercontent.com/gaonujuj-king/ai-news-85/main/docs/data/latest.json';
const CACHE_MS = 5 * 60 * 1000;
const STALE_MS = 36 * 60 * 60 * 1000;

function validate(data) {
  if (!data || !Number.isFinite(Date.parse(data.updatedAt)) || !Array.isArray(data.items) || !data.items.length) {
    throw new Error('Invalid briefing');
  }
  for (const item of data.items) {
    if (!item || typeof item.title !== 'string' || !item.title.trim() || typeof item.url !== 'string' || !/^https?:\/\//i.test(item.url)) {
      throw new Error('Invalid article');
    }
  }
  return data;
}

function createBriefingReader({ fetchImpl = (...args) => fetch(...args), readBackup = async () => JSON.parse(await readFile(join(__dirname, '../docs/data/latest.json'), 'utf8')), now = Date.now } = {}) {
  let cached;
  let fetchedAt = 0;
  let pending;
  const describe = (data, fallback) => ({
    ...data,
    delivery: {
      source: fallback ? 'backup' : 'github-actions',
      stale: now() - Date.parse(data.updatedAt) > STALE_MS,
      fallback
    }
  });

  return async function readBriefing() {
    if (cached && now() - fetchedAt < CACHE_MS) return describe(cached, false);
    if (pending) return pending;
    pending = (async () => {
      try {
        const response = await fetchImpl(SOURCE, {
          cache: 'no-store',
          headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
          signal: AbortSignal.timeout(10000)
        });
        if (!response.ok) throw new Error(`Briefing HTTP ${response.status}`);
        const data = validate(await response.json());
        // Never replace a more recent successful fetch with an older CDN response.
        if (!cached || Date.parse(data.updatedAt) >= Date.parse(cached.updatedAt)) cached = data;
        fetchedAt = now();
        return describe(cached, false);
      } catch {
        const backup = cached || validate(await readBackup());
        return describe(backup, true);
      }
    })();
    try { return await pending; } finally { pending = undefined; }
  };
}

module.exports = { createBriefingReader, publishedBriefing: createBriefingReader() };
