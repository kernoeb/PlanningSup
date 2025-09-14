#!/usr/bin/env bun
import { readdir } from 'node:fs/promises'
import process from 'node:process'
import concurrently from 'concurrently'

const [, , command] = process.argv

// Add the full path of any app or package you want to exclude.
const blacklist: string[] = ['apps/extension']

function mapPrefix(prefix: string) {
  return (folders: string[]) =>
    folders.map(folder => `${prefix}/${folder}`)
}

const folders = await Promise.all([
  readdir('apps').then(mapPrefix('apps')),
  readdir('packages').then(mapPrefix('packages')),
])
  .then(x => x.reduce((x, y) => [...x, ...y], []))
  .then(allFolders => allFolders.filter(folder => !blacklist.includes(folder)))

const paths = await Promise.all(
  folders.map(async (path) => {
    const file = Bun.file(`${path}/package.json`)

    if (!(await file.exists())) return

    const packageJson = await file.json()

    if (packageJson.scripts && command in packageJson.scripts) return path
  }),
).then(x => x.filter(Boolean)) // Using Boolean is a concise way to filter out undefined/null

const colors = ['blue', 'green', 'magenta', 'yellow', 'red']

if (paths.length === 0) {
  console.log(`No packages found with a "${command}" script.`)
  process.exit(0)
}

concurrently(
  paths.map((path, index) => ({
    name: path,
    command: `cd ${path} && bun run ${command}`,
    prefixColor: colors[index % colors.length],
  })),
).result.catch((error) => {
  // Concurrently's error is often an array of exit info, not a real Error object
  // This avoids printing a generic message for a graceful command failure (e.g. exit code 1)
  if (error.message) {
    console.error('Error:', error.message)
  }
  process.exit(1)
})
