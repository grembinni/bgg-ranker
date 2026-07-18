#!/usr/bin/env node
// Cold-start-tolerant real-credential smoke test for the live Render proxy.
// Usage: RENDER_URL=... BGG_USERNAME=... BGG_PASSWORD=... node scripts/smoke-test-render.mjs
// Optional: SMOKE_COLL_ID, SMOKE_OBJECT_ID to skip parsing the collection XML.
//
// Covers (D-09/D-10): collection read + login + authenticated rating write
// against the live Render URL. Exits non-zero on any failure.

const RENDER_URL = process.env.RENDER_URL
const BGG_USERNAME = process.env.BGG_USERNAME
const BGG_PASSWORD = process.env.BGG_PASSWORD

if (!RENDER_URL || !BGG_USERNAME || !BGG_PASSWORD) {
  console.error(
    'Usage: RENDER_URL=<url> BGG_USERNAME=<user> BGG_PASSWORD=<pass> node scripts/smoke-test-render.mjs'
  )
  console.error('  (optional: SMOKE_COLL_ID, SMOKE_OBJECT_ID to skip collection XML parsing)')
  process.exit(1)
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Mirrors poll202Loop's attempt-count + delay + throw-on-exhaustion shape
// (src/api/bggClient.ts) — Render free-tier cold start is ~30-60s, so the
// first request after idle may fail/hang; retry with a longer delay.
async function withColdStartRetry(fn, { retries = 3, delayMs = 15000 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (attempt === retries) throw err
      console.log(`  retrying after possible cold start (${attempt + 1}/${retries})...`, err.message)
      await delay(delayMs)
    }
  }
  throw new Error('withColdStartRetry: retries exhausted')
}

// Mirrors poll202Loop's 202-polling shape for the collection endpoint.
async function poll202(url, init, { maxRetries = 8, retryDelayMs = 3000 } = {}) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, init)

    if (res.status === 202) {
      if (attempt === maxRetries) {
        throw new Error('Collection fetch timed out after 8 retries (still 202)')
      }
      await delay(retryDelayMs)
      continue
    }

    if (!res.ok) {
      throw new Error(`Collection fetch failed: HTTP ${res.status}`)
    }

    const text = await res.text()
    if (text.trim().toLowerCase().startsWith('<html')) {
      throw new Error('Collection fetch returned HTML error page instead of XML')
    }
    return text
  }

  throw new Error('poll202: loop exhausted')
}

function extractFirstCollAndObjectId(xmlText) {
  const collMatch = xmlText.match(/collid="(\d+)"/)
  const objMatch = xmlText.match(/objectid="(\d+)"/)
  if (!collMatch || !objMatch) {
    throw new Error('Could not parse collid/objectid from collection XML')
  }
  return { collId: collMatch[1], objectId: objMatch[1] }
}

function extractCurrentRating(xmlText, objectId) {
  // Find the <item objectid="X" ...>...<rating value="Y" .../>...</item> block
  // for the matched item and read its rating value, if any.
  const itemRegex = new RegExp(`<item[^>]*objectid="${objectId}"[\\s\\S]*?</item>`, 'i')
  const itemMatch = xmlText.match(itemRegex)
  if (!itemMatch) return null
  const ratingMatch = itemMatch[0].match(/<rating\s+value="([^"]+)"/)
  if (!ratingMatch || ratingMatch[1] === 'N/A') return null
  const rating = parseFloat(ratingMatch[1])
  return isNaN(rating) ? null : rating
}

async function main() {
  console.log(`Smoke testing ${RENDER_URL} as ${BGG_USERNAME}...`)

  // 1. Collection read
  console.log('\n[1/3] Collection read...')
  let collectionXml
  try {
    const url = `${RENDER_URL}/xmlapi2/collection?username=${encodeURIComponent(BGG_USERNAME)}&own=1&subtype=boardgame&excludesubtype=boardgameexpansion&stats=1`
    collectionXml = await withColdStartRetry(() => poll202(url))
    console.log('  PASS: collection XML received')
  } catch (err) {
    console.error('  FAIL:', err.message)
    process.exit(1)
  }

  // 2. Login
  console.log('\n[2/3] Login...')
  let sessionId
  try {
    sessionId = await withColdStartRetry(async () => {
      const res = await fetch(`${RENDER_URL}/login/api/v1`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentials: { username: BGG_USERNAME, password: BGG_PASSWORD } }),
      })
      if (!res.ok) {
        throw new Error(`Login HTTP ${res.status}`)
      }
      const data = await res.json()
      if (!data.sessionId || typeof data.sessionId !== 'string') {
        throw new Error('Login response missing non-empty sessionId')
      }
      return data.sessionId
    })
    console.log('  PASS: sessionId received (from JSON body, not Set-Cookie)')
  } catch (err) {
    console.error('  FAIL:', err.message)
    process.exit(1)
  }

  // 3. Rating write
  console.log('\n[3/3] Rating write...')
  try {
    let collId = process.env.SMOKE_COLL_ID
    let objectId = process.env.SMOKE_OBJECT_ID

    if (!collId || !objectId) {
      const parsed = extractFirstCollAndObjectId(collectionXml)
      collId = collId || parsed.collId
      objectId = objectId || parsed.objectId
    }

    const currentRating = extractCurrentRating(collectionXml, objectId)
    const ratingToWrite = currentRating ?? 7 // benign safe value if unrated

    await withColdStartRetry(async () => {
      const res = await fetch(`${RENDER_URL}/api/collectionitem/${collId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-BGG-Session': sessionId,
        },
        body: JSON.stringify({
          item: {
            collid: collId,
            objecttype: 'thing',
            objectid: objectId,
            rating: ratingToWrite,
          },
        }),
      })
      if (!res.ok) {
        throw new Error(`Rating write HTTP ${res.status}`)
      }
    })
    console.log(`  PASS: wrote rating ${ratingToWrite} to collId=${collId} objectId=${objectId}`)
  } catch (err) {
    console.error('  FAIL:', err.message)
    process.exit(1)
  }

  console.log('\nAll checks passed.')
  process.exit(0)
}

main().catch((err) => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
