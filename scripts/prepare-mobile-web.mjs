import { cp, copyFile, mkdir, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const projectRoot = dirname(fileURLToPath(import.meta.url))
const dist = join(projectRoot, '..', 'dist')
const mobileDist = join(projectRoot, '..', 'dist-mobile')

await rm(mobileDist, { recursive: true, force: true })
await mkdir(mobileDist, { recursive: true })
await copyFile(join(dist, 'index.html'), join(mobileDist, 'index.html'))
await cp(join(dist, 'assets'), join(mobileDist, 'assets'), { recursive: true })
try {
  await copyFile(join(dist, 'planner-icon.png'), join(mobileDist, 'planner-icon.png'))
} catch {}

console.log('Prepared mobile web bundle for Android.')
