import { describe, it, expect } from 'vitest'
import { sanitizeSessionToken, extractSessionId, buildSessionCookie } from './session.js'

describe('sanitizeSessionToken', () => {
  it('returns the value when it matches [A-Za-z0-9_-]+', () => {
    expect(sanitizeSessionToken('abc-123_XYZ')).toBe('abc-123_XYZ')
  })

  it('returns undefined for a value containing a semicolon', () => {
    expect(sanitizeSessionToken('bad;value')).toBeUndefined()
  })

  it('returns undefined for a value containing a space', () => {
    expect(sanitizeSessionToken('a b')).toBeUndefined()
  })

  it('returns undefined for undefined input', () => {
    expect(sanitizeSessionToken(undefined)).toBeUndefined()
  })
})

describe('extractSessionId', () => {
  it('extracts sessionid case-insensitively from a Set-Cookie array', () => {
    expect(
      extractSessionId(['SessionID=tok123; Path=/; Secure', 'bggusername=joe; Path=/'])
    ).toBe('tok123')
  })

  it('returns empty string for an empty array', () => {
    expect(extractSessionId([])).toBe('')
  })

  it('returns empty string for undefined input', () => {
    expect(extractSessionId(undefined)).toBe('')
  })
})

describe('buildSessionCookie', () => {
  it('joins the 3-cookie set into name=value pairs separated by "; "', () => {
    expect(
      buildSessionCookie([
        'SessionID=tok; Path=/; Secure',
        'bggusername=joe; Path=/',
        'bggpassword=hash; Path=/',
      ])
    ).toBe('SessionID=tok; bggusername=joe; bggpassword=hash')
  })

  it('excludes Max-Age=0 entries', () => {
    expect(buildSessionCookie(['SessionID=tok; Path=/', 'stale=x; Max-Age=0'])).toBe(
      'SessionID=tok'
    )
  })

  it('returns empty string for undefined input', () => {
    expect(buildSessionCookie(undefined)).toBe('')
  })
})
