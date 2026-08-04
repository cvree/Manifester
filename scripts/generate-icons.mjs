/**
 * Renders the app icons from one original SVG motif.
 *
 * Run with `npm run icons` after editing the artwork below. The generated PNGs
 * are committed so a plain `npm ci && npm run build` never needs sharp.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const iconsDir = path.join(root, 'public', 'icons')

const CREAM = '#F7F1E8'
const LAVENDER = '#E7E0F0'
const ROSE = '#C4818A'
const ROSE_DEEP = '#A5636D'
const SAGE = '#7F9D81'
const GOLD = '#CFA45F'
const TWILIGHT = '#2E3A59'

/**
 * A seed sprouting under a crescent moon — the app's own motif.
 * `inset` pulls the artwork in so maskable icons survive an aggressive crop.
 */
function motif({ inset = 0, background = 'rounded' } = {}) {
  const scale = 1 - inset
  const offset = (512 * inset) / 2

  const backdrop =
    background === 'full'
      ? `<rect width="512" height="512" fill="url(#sky)"/>`
      : `<rect width="512" height="512" rx="112" fill="url(#sky)"/>`

  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0%" stop-color="${CREAM}"/>
      <stop offset="60%" stop-color="${LAVENDER}"/>
      <stop offset="100%" stop-color="#DCD4E8"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="44%" r="46%">
      <stop offset="0%" stop-color="${ROSE}" stop-opacity="0.42"/>
      <stop offset="100%" stop-color="${ROSE}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="leaf" x1="0" y1="1" x2="0.6" y2="0">
      <stop offset="0%" stop-color="${SAGE}"/>
      <stop offset="100%" stop-color="#A2BE9F"/>
    </linearGradient>
  </defs>

  ${backdrop}
  <rect width="512" height="512" fill="url(#glow)"/>

  <g transform="translate(${offset} ${offset}) scale(${scale})">
    <!-- crescent moon -->
    <path d="M330 96a112 112 0 1 0 74 196 92 92 0 1 1-74-196Z"
          fill="${GOLD}" opacity="0.9"/>

    <!-- seed -->
    <path d="M256 214c46 30 70 68 70 112a70 70 0 0 1-140 0c0-44 24-82 70-112Z"
          fill="${ROSE}"/>
    <path d="M256 214c46 30 70 68 70 112a70 70 0 0 1-70 70V214Z"
          fill="${ROSE_DEEP}" opacity="0.55"/>

    <!-- stem and leaf -->
    <path d="M256 396v56" stroke="${TWILIGHT}" stroke-width="13"
          stroke-linecap="round" opacity="0.55"/>
    <path d="M256 428c-24-4-40-20-44-46 26 2 42 18 44 46Z" fill="url(#leaf)"/>

    <!-- sparks -->
    <circle cx="140" cy="150" r="9" fill="${TWILIGHT}" opacity="0.4"/>
    <circle cx="404" cy="392" r="7" fill="${TWILIGHT}" opacity="0.32"/>
    <circle cx="112" cy="330" r="6" fill="${ROSE_DEEP}" opacity="0.45"/>
  </g>
</svg>`
}

const OUTPUTS = [
  { file: 'icons/icon-192.png', size: 192, svg: motif() },
  { file: 'icons/icon-512.png', size: 512, svg: motif() },
  { file: 'icons/icon-180.png', size: 180, svg: motif() },
  { file: 'apple-touch-icon.png', size: 180, svg: motif() },
  {
    file: 'icons/maskable-512.png',
    size: 512,
    svg: motif({ inset: 0.22, background: 'full' }),
  },
]

await mkdir(iconsDir, { recursive: true })

// The favicon is the same artwork, served as vector.
await writeFile(path.join(root, 'public', 'favicon.svg'), motif(), 'utf8')

for (const { file, size, svg } of OUTPUTS) {
  const target = path.join(root, 'public', file)
  await sharp(Buffer.from(svg)).resize(size, size).png({ quality: 92 }).toFile(target)
  console.log(`wrote public/${file} (${size}×${size})`)
}

console.log('wrote public/favicon.svg')
