import { copyFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const sourceApk = join(projectRoot, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')
const targetApk = join(projectRoot, 'planner-debug.apk')

await copyFile(sourceApk, targetApk)
console.log(`[APK Ready] Exported debug APK to: ${targetApk}`)
