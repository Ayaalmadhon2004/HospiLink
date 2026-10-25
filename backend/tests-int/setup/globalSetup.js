// Runs once before the integration suite: applies every migration to the throwaway database (exactly what production does).
const { execFileSync } = require('child_process');
const path = require('path');
const { requireThrowawayDb } = require('./guard');

module.exports = async () => {
  const url = requireThrowawayDb();
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: path.resolve(__dirname, '../..'),
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  });
};
