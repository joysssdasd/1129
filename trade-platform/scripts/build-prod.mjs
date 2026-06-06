import { spawnSync } from 'node:child_process'

const run = (command, args) => {
  const result = spawnSync(command, args, {
    env: { ...process.env, BUILD_MODE: 'prod' },
    shell: process.platform === 'win32',
    stdio: 'inherit',
  })

  if (result.status !== 0) {
    process.exit(result.status || 1)
  }
}

run('tsc', ['-b'])
run('vite', ['build'])
