import fs from 'node:fs'

function replaceOnce(file, before, after) {
  const current = fs.readFileSync(file, 'utf8')
  if (!current.includes(before)) {
    throw new Error(`Expected text not found in ${file}: ${before.slice(0, 80)}`)
  }
  fs.writeFileSync(file, current.replace(before, after))
}

replaceOnce(
  'src/lib/timer.test.ts',
  "import { afterEach, describe, expect, it, vi } from 'vitest'",
  "import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'",
)
replaceOnce(
  'src/lib/timer.test.ts',
  "afterEach(() => {\n  vi.useRealTimers()\n})",
  "beforeEach(() => {\n  vi.useFakeTimers()\n  vi.setSystemTime(0)\n  vi.stubGlobal('window', {\n    setInterval,\n    clearInterval,\n    setTimeout,\n    clearTimeout,\n    addEventListener: vi.fn(),\n    removeEventListener: vi.fn(),\n  })\n  vi.stubGlobal('document', {\n    addEventListener: vi.fn(),\n    removeEventListener: vi.fn(),\n  })\n})\n\nafterEach(() => {\n  vi.useRealTimers()\n  vi.unstubAllGlobals()\n})",
)
replaceOnce(
  'src/lib/loops.test.ts',
  "expect(pickLaunchLoop([make('blank', 1, null), { ...make('blank-2', 2, null), text: '   ' }])).toBeNull()",
  "expect(\n      pickLaunchLoop([\n        { ...make('blank', 1, null), text: '   ' },\n        { ...make('blank-2', 2, null), text: '   ' },\n      ]),\n    ).toBeNull()",
)
replaceOnce(
  'src/lib/timer.test.ts',
  "    vi.setSystemTime(3_000)\n    vi.advanceTimersByTime(3_000)",
  "    vi.advanceTimersByTime(3_000)",
)
replaceOnce(
  'src/lib/timer.test.ts',
  "    vi.setSystemTime(30_000)\n    vi.advanceTimersByTime(10_000)\n    expect(timer.remainingSeconds).toBe(held)\n    expect(complete).not.toHaveBeenCalled()\n\n    timer.resume()\n    vi.setSystemTime(37_000)\n    vi.advanceTimersByTime(7_100)",
  "    vi.advanceTimersByTime(30_000)\n    expect(timer.remainingSeconds).toBe(held)\n    expect(complete).not.toHaveBeenCalled()\n\n    timer.resume()\n    vi.advanceTimersByTime(held * 1000 + 300)",
)

replaceOnce(
  'src/lib/timer.test.ts',
  "  it('does not advance while paused and completes once', () => {\n    vi.useFakeTimers()\n    vi.setSystemTime(0)",
  "  it('does not advance while paused and completes once', () => {",
)
replaceOnce(
  'src/lib/timer.test.ts',
  "  it('makes repeated pause and resume calls harmless', () => {\n    vi.useFakeTimers()\n    vi.setSystemTime(0)",
  "  it('makes repeated pause and resume calls harmless', () => {",
)
