#!/usr/bin/env bun
import { $ } from 'bun'

await Promise.all([$`bun run docker:web`, $`bun run docker:api`])
