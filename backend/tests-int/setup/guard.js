// Shared by globalSetup (plain node) and env.ts: refuse to touch anything that is not clearly a throwaway database.
const dbNameOf = (url) => {
  try {
    return decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
  } catch {
    return '';
  }
};

const requireThrowawayDb = () => {
  const url = process.env.INT_DATABASE_URL;
  if (!url) {
    throw new Error(
      'INT_DATABASE_URL is not set. Point it at a throwaway PostgreSQL database whose name contains "test" or "e2e", ' +
        'e.g. postgresql://user:pass@localhost:5432/hospilink_inttest'
    );
  }
  const name = dbNameOf(url);
  if (!/(test|e2e)/i.test(name)) {
    throw new Error(`Refusing to run integration tests against database "${name}": its name must contain "test" or "e2e" (the suite TRUNCATEs every table).`);
  }
  return url;
};

module.exports = { requireThrowawayDb, dbNameOf };
