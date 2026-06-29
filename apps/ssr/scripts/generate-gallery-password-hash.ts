import process from 'node:process'
import { emitKeypressEvents } from 'node:readline'

import { hashGalleryPassword } from '../src/lib/gallery-access/password'

const readHiddenLine = (prompt: string) => {
  if (!process.stdin.isTTY || !process.stderr.isTTY) {
    throw new Error('This command requires an interactive terminal')
  }

  return new Promise<string>((resolve, reject) => {
    let value = ''

    emitKeypressEvents(process.stdin)
    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stderr.write(prompt)

    const finish = () => {
      process.stdin.off('keypress', onKeypress)
      process.stdin.setRawMode(false)
      process.stdin.pause()
      process.stderr.write('\n')
    }

    const onKeypress = (input: string, key: { ctrl?: boolean, name?: string }) => {
      if (key.ctrl && key.name === 'c') {
        finish()
        reject(new Error('Cancelled'))
        return
      }

      if (key.name === 'return' || key.name === 'enter') {
        finish()
        resolve(value)
        return
      }

      if (key.name === 'backspace') {
        value = Array.from(value).slice(0, -1).join('')
        return
      }

      if (!key.ctrl && key.name !== 'tab' && input) {
        value += input
      }
    }

    process.stdin.on('keypress', onKeypress)
  })
}

const main = async () => {
  const password = await readHiddenLine('Gallery password: ')
  if (!password) {
    throw new Error('Password must not be empty')
  }

  const confirmation = await readHiddenLine('Confirm password: ')
  if (password !== confirmation) {
    throw new Error('Passwords do not match')
  }

  process.stdout.write(`${await hashGalleryPassword(password)}\n`)
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Failed to generate password hash'}\n`)
  process.exitCode = 1
})
