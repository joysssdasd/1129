import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const npmrcPath = path.join(projectRoot, '.npmrc')
const projectNodeModulesDir = path.join(projectRoot, 'node_modules')

const exists = async (targetPath) => {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

const getVirtualStoreDir = async () => {
  if (!(await exists(npmrcPath))) {
    return null
  }

  const content = await fs.readFile(npmrcPath, 'utf8')
  const line = content
    .split(/\r?\n/)
    .map((value) => value.trim())
    .find((value) => value.startsWith('virtual-store-dir='))

  if (!line) {
    return null
  }

  const configuredPath = line.slice('virtual-store-dir='.length).trim()
  if (!configuredPath) {
    return null
  }

  return path.isAbsolute(configuredPath) ? configuredPath : path.resolve(projectRoot, configuredPath)
}

const main = async () => {
  const virtualStoreDir = await getVirtualStoreDir()
  if (!virtualStoreDir) {
    return
  }

  if (!(await exists(projectNodeModulesDir))) {
    return
  }

  const virtualNodeModulesDir = path.join(path.dirname(virtualStoreDir), 'node_modules')
  if (await exists(virtualNodeModulesDir)) {
    return
  }

  await fs.mkdir(path.dirname(virtualNodeModulesDir), { recursive: true })
  await fs.symlink(projectNodeModulesDir, virtualNodeModulesDir, process.platform === 'win32' ? 'junction' : 'dir')
  console.log(`Linked virtual node_modules at ${virtualNodeModulesDir}`)
}

main().catch((error) => {
  console.error('Failed to link virtual node_modules:', error)
  process.exit(1)
})
