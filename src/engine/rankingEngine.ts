export class TierCapacityError extends Error {
  constructor(
    public readonly gameCount: number,
    public readonly maxCapacity: number
  ) {
    super(`Collection size ${gameCount} exceeds maximum ${maxCapacity} games`)
    this.name = 'TierCapacityError'
  }
}

// index 0 = tier 10 (best), index 9 = tier 1 (worst); dual peak at indices 4 & 5 (tiers 6 & 5)
export const TIER_WEIGHTS = [2, 6, 11, 15, 18, 18, 14, 9, 5, 2] as const

// 99 unique values × 10 tiers
export const MAX_GAMES = 990

export function validateTierCapacity(count: number): void {
  if (count > MAX_GAMES) {
    throw new TierCapacityError(count, MAX_GAMES)
  }
}

export function computeTierAllocations(
  gameCount: number,
  weights: readonly number[] = TIER_WEIGHTS
): number[] {
  const MAX_PER_TIER = 99
  const total = weights.reduce((a, b) => a + b, 0)
  const exact = weights.map((w) => (w / total) * gameCount)
  const floored = exact.map(Math.floor)
  const remainders = exact.map((v, i) => ({ idx: i, rem: v - floored[i] }))
  const deficit = gameCount - floored.reduce((a, b) => a + b, 0)

  remainders
    .sort((a, b) => b.rem - a.rem)
    .slice(0, deficit)
    .forEach(({ idx }) => floored[idx]++)

  const overflows: { from: number; amount: number }[] = []
  for (let i = 0; i < floored.length; i++) {
    if (floored[i] > MAX_PER_TIER) {
      overflows.push({ from: i, amount: floored[i] - MAX_PER_TIER })
      floored[i] = MAX_PER_TIER
    }
  }
  for (const { from, amount } of overflows) {
    let remaining = amount
    for (let reach = 1; remaining > 0 && reach < floored.length; reach++) {
      const targets: number[] = []
      const left = from - reach
      const right = from + reach
      if (left >= 0 && floored[left] < MAX_PER_TIER) targets.push(left)
      if (right < floored.length && floored[right] < MAX_PER_TIER) targets.push(right)
      for (let t = 0; t < targets.length && remaining > 0; t++) {
        // Distribute evenly across available targets; first target gets the odd unit
        const share = Math.ceil(remaining / (targets.length - t))
        const add = Math.min(share, MAX_PER_TIER - floored[targets[t]])
        floored[targets[t]] += add
        remaining -= add
      }
    }
  }

  return floored
}

// Allowed last-digit sets by tier game count — each band has enough distinct slots for its max count
// (10 slots per unique digit per tier: e.g. {0} gives slots x00,x10,...,x90 = 10 per tier).
function allowedLastDigits(count: number): ReadonlySet<number> {
  if (count <= 10) return new Set([0])
  if (count <= 20) return new Set([0, 5])
  if (count <= 40) return new Set([0, 3, 5, 7])
  if (count <= 60) return new Set([0, 1, 3, 5, 7, 9])
  if (count <= 80) return new Set([0, 1, 3, 4, 5, 6, 7, 9])
  return new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
}

export function assignRatings(
  orderedGameIds: string[],
  allocations: number[]
): Record<string, number> {
  const ratings: Record<string, number> = {}
  let gameIdx = 0

  for (let tierIdx = 0; tierIdx < 10; tierIdx++) {
    const tierNum = 10 - tierIdx // tier 10 first, tier 1 last
    const count = allocations[tierIdx]
    if (count === 0) continue

    // Tier 1: all games rated 1.00 — BGG does not accept ratings below 1.00
    if (tierNum === 1) {
      for (let pos = 0; pos < count; pos++) {
        ratings[orderedGameIds[gameIdx++]] = 100
      }
      continue
    }

    const tierMaxInt = tierNum * 100
    const tierMinInt = (tierNum - 1) * 100 + 1

    const digits = allowedLastDigits(count)
    const slots: number[] = []
    for (let v = tierMaxInt; v >= tierMinInt; v--) {
      if (digits.has(v % 10)) slots.push(v)
    }

    for (let pos = 0; pos < count; pos++) {
      ratings[orderedGameIds[gameIdx++]] = slots[pos]
    }
  }

  return ratings
}

// O(k) where k = loserPos - winnerPos. Returns shallow copy unchanged when winner already ranked
// higher, or when either ID is missing from ratings.
export function applyUpset(
  winnerId: string,
  loserId: string,
  ratings: Record<string, number>
): Record<string, number> {
  const ranked = Object.entries(ratings).sort((a, b) => b[1] - a[1])
  const winnerPos = ranked.findIndex(([id]) => id === winnerId)
  const loserPos = ranked.findIndex(([id]) => id === loserId)

  if (winnerPos === -1 || loserPos === -1 || winnerPos <= loserPos) {
    return { ...ratings }
  }

  const targetRating = ranked[loserPos][1]
  const result = { ...ratings }

  for (let i = loserPos; i < winnerPos; i++) {
    result[ranked[i][0]] = ranked[i + 1][1]
  }
  result[winnerId] = targetRating

  return result
}

// O(n) — only called on explicit user Refresh.
export function redistribute(
  ratings: Record<string, number>,
  weights: readonly number[] = TIER_WEIGHTS
): Record<string, number> {
  const ordered = Object.entries(ratings)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id)

  const allocations = computeTierAllocations(ordered.length, weights)
  return assignRatings(ordered, allocations)
}

// When sorted=true the caller has pre-ordered gameIds best→worst; skip the shuffle.
export function initializeRankings(
  gameIds: string[],
  weights: readonly number[] = TIER_WEIGHTS,
  sorted = false
): Record<string, number> {
  validateTierCapacity(gameIds.length)
  const ordered = sorted ? [...gameIds] : [...gameIds].sort(() => Math.random() - 0.5)
  const allocations = computeTierAllocations(ordered.length, weights)
  return assignRatings(ordered, allocations)
}
