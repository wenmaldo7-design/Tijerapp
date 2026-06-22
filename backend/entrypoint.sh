#!/bin/sh
set -e

echo "[entrypoint] Running database migrations..."
node node_modules/.bin/typeorm migration:run -d dist/data-source.js

echo "[entrypoint] Starting application..."
exec node dist/main
