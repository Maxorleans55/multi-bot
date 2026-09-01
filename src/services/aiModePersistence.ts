import NodeCache from 'node-cache';
import prisma from '../database/prisma.js';
import { log } from '../utils/logger.js';

/**
 * AI Mode Persistence Service
 *
 * Stores AI mode status (on/off) per-user in the database (User.aiModeEnabled)
 * with node-cache in-memory to avoid DB query overhead on every
 * message check.
 *
 * Pattern: lazy-load from DB on first access, write-through to DB on every
 * change, cache TTL 30 minutes with checkperiod 5 minutes.
 */

const AI_MODE_CACHE = new NodeCache({ stdTTL: 1800, checkperiod: 300 });

let initialized = false;

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Inisialisasi awal — pre-load semua user yang AI mode-nya aktif dari DB.
 * Dipanggil sekali saat bot startup.
 */
export async function initAIModePersistence(): Promise<void> {
  if (initialized) return;

  try {
    const users = await prisma.user.findMany({
      where: { aiModeEnabled: true },
      select: { userId: true },
    });

    for (const user of users) {
      AI_MODE_CACHE.set(user.userId, true);
    }

    initialized = true;
    log.info(`🧠 [AIModePersistence] Loaded ${users.length} users with AI mode enabled from DB`);
  } catch (error) {
    log.error('[AIModePersistence] Failed to initialize:', error as object);
  }
}

/**
 * Cek apakah AI mode aktif untuk user tertentu.
 * First access: ambil dari DB, simpan ke cache.
 * Subsequent: return dari cache (no DB hit).
 */
export async function isAIModeEnabled(userId: string): Promise<boolean> {
  if (!userId) return false;

  // Check cache first
  const cached = AI_MODE_CACHE.get<boolean>(userId);
  if (cached !== undefined) {
    return cached;
  }

  // Not in cache, load from DB
  try {
    const user = await prisma.user.findUnique({
      where: { userId },
      select: { aiModeEnabled: true },
    });

    const enabled = user?.aiModeEnabled ?? false;
    AI_MODE_CACHE.set(userId, enabled);
    return enabled;
  } catch (error) {
    log.debug(`[AIModePersistence] DB lookup failed for ${userId}, defaulting to false`);
    // On error, cache as false briefly (short TTL) so we don't hammer DB
    AI_MODE_CACHE.set(userId, false, 30);
    return false;
  }
}

/**
 * Cek sinkron (cache-only, tanpa DB hit).
 * Gunakan hanya setelah cache dipopulasi (misal via isAIModeEnabled atau init).
 */
export function isAIModeEnabledSync(userId: string): boolean {
  return AI_MODE_CACHE.get<boolean>(userId) ?? false;
}

/**
 * Set AI mode untuk user. Write-through: update DB + cache.
 */
export async function setAIModeEnabled(userId: string, enabled: boolean): Promise<void> {
  if (!userId) return;

  // Update cache immediately
  AI_MODE_CACHE.set(userId, enabled);

  // Persist to DB (fire-and-forget, non-blocking)
  try {
    await prisma.user.upsert({
      where: { userId },
      create: {
        userId,
        aiModeEnabled: enabled,
        status: 'active',
      },
      update: {
        aiModeEnabled: enabled,
      },
    });
  } catch (error) {
    log.error(`[AIModePersistence] Failed to persist AI mode for ${userId}:`, error as object);
  }
}

/**
 * Clear cache untuk user tertentu.
 */
export function clearAIModeCache(userId: string): void {
  AI_MODE_CACHE.del(userId);
}

/**
 * Debug: jumlah user dengan AI mode aktif di cache.
 */
export function getAIModeCacheStats(): { activeCount: number } {
  const keys = AI_MODE_CACHE.keys();
  const activeCount = keys.filter(k => AI_MODE_CACHE.get<boolean>(k) === true).length;
  return { activeCount };
}
