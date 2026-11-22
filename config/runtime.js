/**
 * Runtime helpers for running TT_TRACKER in production.
 * Everything reads the environment at call time, so it is easy to test.
 */

const crypto = require('crypto');

const WEAK_SECRETS = new Set([
    'your-secure-import-secret',
    'development_secret_change_in_production',
    'replace-with-a-long-random-secret',
    'change-me',
    'changeme',
    'secret'
]);

/**
 * Constant-time comparison of two secrets. Both sides are hashed first so the check takes
 * the same time whatever their lengths. Anything that is not a non-empty string never matches.
 */
function secretsMatch(provided, expected) {
    if (typeof provided !== 'string' || typeof expected !== 'string') return false;
    if (provided.length === 0 || expected.length === 0) return false;
    const a = crypto.createHash('sha256').update(provided).digest();
    const b = crypto.createHash('sha256').update(expected).digest();
    return crypto.timingSafeEqual(a, b);
}

/** Problems worth shouting about at startup when NODE_ENV=production. Empty otherwise. */
function productionWarnings(env = process.env) {
    if (env.NODE_ENV !== 'production') return [];
    const warnings = [];
    const secret = (env.TT_TRACKER_IMPORT_SECRET || '').trim();

    if (!secret) {
        warnings.push('TT_TRACKER_IMPORT_SECRET is not set: FATGS cannot publish timetables to this service.');
    } else if (WEAK_SECRETS.has(secret.toLowerCase()) || secret.length < 16) {
        warnings.push('TT_TRACKER_IMPORT_SECRET looks weak (a sample value or shorter than 16 characters). Use a long random value.');
    }
    if (env.DEV_MODE === 'true') {
        warnings.push('DEV_MODE is true: anyone can simulate a different day of the week. Set DEV_MODE=false in production.');
    }
    return warnings;
}

/**
 * Stops the service in a safe order: stop accepting requests, write the week changes that
 * are still only in memory to MongoDB, then close the database connection. A failure in one
 * step never skips the next. Returns what happened so the caller can log it.
 */
async function runShutdown({ closeServer, flushPending, disconnectDb, log = console }) {
    const result = { flushed: 0, errors: [] };

    try {
        await closeServer();
    } catch (err) {
        result.errors.push(`close server: ${err.message}`);
    }
    try {
        result.flushed = (await flushPending()) || 0;
        log.log(`[Shutdown] Saved ${result.flushed} pending change(s) to MongoDB.`);
    } catch (err) {
        result.errors.push(`flush pending changes: ${err.message}`);
        log.error('[Shutdown] Could not save pending changes:', err.message);
    }
    try {
        await disconnectDb();
    } catch (err) {
        result.errors.push(`disconnect database: ${err.message}`);
    }
    return result;
}

module.exports = { secretsMatch, productionWarnings, runShutdown, WEAK_SECRETS };
