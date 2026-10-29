/**
 * Combines the bundled list with what Firestore holds. Bundled order is kept, stored versions replace bundled
 * ones, and items only admins added go last. exclusive: once anything is stored, bundled-only items are dropped.
 */
export function mergeStored<T>(fallback: T[], stored: Map<string, T>, key: (item: T) => string, exclusive: boolean): T[] {
  const bundled = new Set(fallback.map(key));
  return [...fallback.flatMap(item => stored.get(key(item)) ?? (exclusive && stored.size ? [] : [item])),
    ...[...stored.values()].filter(item => !bundled.has(key(item)))];
}
