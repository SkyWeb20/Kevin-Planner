import { copyFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const sourceApk = join(projectRoot, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk')
const targetApk = join(projectRoot, 'planner-release.apk')

await copyFile(sourceApk, targetApk)
console.log(`[Release APK Ready] Exported signed release APK to: ${targetApk}`)
