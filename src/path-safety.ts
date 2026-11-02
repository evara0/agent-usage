import { lstat, realpath } from 'node:fs/promises';
import { resolve } from 'node:path';

/**
 * Windows reports junctions (directory reparse points) as plain directories from
 * lstat/stat, so `isSymbolicLink()` cannot identify them. Compare the resolved
 * path instead; a link that is followed always resolves to a different path.
 */
const samePath = (left: string, right: string): boolean =>
  process.platform === 'win32' ? left.toLowerCase() === right.toLowerCase() : left === right;

/**
 * `realpath` opens a handle per directory component, so one scan would repeat the
 * same checks for every skill file. Results are stable for a single read-only
 * process; the bounded cache keeps a long scan linear.
 */
const CACHE_LIMIT = 4096;
const cache = new Map<string, boolean>();

/** True when the path itself is a symlink, or a junction/mount point directory. */
export async function isLinkComponent(path: string): Promise<boolean> {
  const key = process.platform === 'win32' ? path.toLowerCase() : path;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const answer = await check(path);
  if (cache.size >= CACHE_LIMIT) cache.clear();
  cache.set(key, answer);
  return answer;
}

async function check(path: string): Promise<boolean> {
  const stat = await lstat(path);
  if (stat.isSymbolicLink()) return true;
  if (!stat.isDirectory()) return false;
  try { return !samePath(await realpath(path), resolve(path)); }
  catch { return false; }
}
