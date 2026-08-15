import { describe, expect, it } from 'vitest'
import { sha256Hex, sha256HexOfString } from './sha256'

/*
 * The vectors from FIPS 180-4 and a couple of the usual suspects.
 *
 * This function is the reason a cached clip can be found again, on another
 * device, months later — and it is hand-written, so it is worth being sure of
 * rather than assuming. If it were ever subtly wrong the symptom would not be
 * an error: it would be a cache that never hits and a bill for synthesising
 * everything twice.
 */
describe('sha256', () => {
  it('matches the published test vectors', () => {
    expect(sha256HexOfString('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    )
    expect(sha256HexOfString('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
    expect(
      sha256HexOfString(
        'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq',
      ),
    ).toBe('248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1')
    expect(sha256HexOfString('a'.repeat(1_000_000))).toBe(
      'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0',
    )
  })

  it('hashes bytes rather than characters', () => {
    // Two encodings of the same text must agree, and a multi-byte character
    // must not be truncated on the way in.
    expect(sha256HexOfString('é')).toBe(
      sha256Hex(new Uint8Array([0xc3, 0xa9])),
    )
  })

  it('is stable across the 64-byte block boundary', () => {
    // Padding is where an implementation like this usually goes wrong: one
    // block, one block exactly full, and one block plus a byte.
    for (const length of [55, 56, 63, 64, 65, 119, 120]) {
      const digest = sha256HexOfString('x'.repeat(length))
      expect(digest).toMatch(/^[0-9a-f]{64}$/)
    }
    expect(sha256HexOfString('x'.repeat(64))).not.toBe(
      sha256HexOfString('x'.repeat(65)),
    )
  })
})
