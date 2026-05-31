// 배포 전 버전 0.1 자동 증가
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const versionFile = resolve(__dirname, '../src/config/version.ts')

const content = readFileSync(versionFile, 'utf-8')

// 현재 버전 추출
const match = content.match(/APP_VERSION = '([\d.]+)'/)
if (!match) { console.error('버전을 찾을 수 없어요'); process.exit(1) }

const parts = match[1].split('.').map(Number)   // [1, 0, 0]
parts[1] = (parts[1] ?? 0) + 1                  // 0.1 증가
if (parts[1] >= 10) { parts[0] += 1; parts[1] = 0 }  // 1.9 → 2.0
const newVersion = parts.join('.')               // "1.1.0"
const shortVer   = `VER${parts[0]}.${parts[1]}` // "VER1.1"

const updated = content
  .replace(/APP_VERSION = '[\d.]+'/, `APP_VERSION = '${newVersion}'`)
  .replace(/APP_VERSION_SHORT = '[^']+'/, `APP_VERSION_SHORT = '${shortVer}'`)

writeFileSync(versionFile, updated, 'utf-8')
console.log(`✅ 버전 업데이트: ${match[1]} → ${newVersion}`)
