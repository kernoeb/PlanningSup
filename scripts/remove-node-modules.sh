#!/usr/bin/env bash
set -e

rm bun.lock || echo "No bun.lock to remove"
rm -rf ./node_modules/ || echo "No root node_modules to remove"
rm -rf ./apps/api/node_modules/ || echo "No api node_modules to remove"
rm -rf ./apps/app/node_modules/ || echo "No app node_modules to remove"
rm -rf ./apps/extension/node_modules/ || echo "No extension node_modules to remove"
rm -rf ./apps/web/node_modules/ || echo "No web node_modules to remove"
rm -rf ./packages/config/node_modules/ || echo "No config node_modules to remove"
rm -rf ./packages/libs/node_modules/ || echo "No libs node_modules to remove"
rm -rf ./test/node_modules/ || echo "No test node_modules to remove"
