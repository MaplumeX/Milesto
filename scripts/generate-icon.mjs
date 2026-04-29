#!/usr/bin/env node
/**
 * Generate platform-specific app icons from the SVG source using sharp.
 *
 * Outputs:
 *   build/icon.png   — 1024×1024 PNG (Linux + source for macOS/Windows)
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const buildDir = path.join(rootDir, 'build')
const svgPath = path.join(rootDir, 'assets', 'icon.svg')

if (!fs.existsSync(svgPath)) {
  console.error('Error: assets/icon.svg not found')
  process.exit(1)
}

if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true })
}

const { default: sharp } = await import('sharp')

const svgBuffer = fs.readFileSync(svgPath)

// Generate 1024×1024 PNG (electron-builder uses this for all platforms)
const icon1024 = await sharp(svgBuffer, { density: 300 })
  .resize(1024, 1024, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer()
fs.writeFileSync(path.join(buildDir, 'icon.png'), icon1024)
console.log('✓ build/icon.png (1024×1024)')

// Also generate smaller favicon-style sizes for reference
const sizes = [512, 256, 128, 64, 32, 16]
for (const size of sizes) {
  const buf = await sharp(svgBuffer, { density: 300 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
  fs.writeFileSync(path.join(buildDir, `icon-${size}.png`), buf)
  console.log(`✓ build/icon-${size}.png`)
}

console.log('\nDone. electron-builder will auto-generate .icns (macOS) and .ico (Windows) from icon.png.')
