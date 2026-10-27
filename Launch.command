#!/bin/zsh
cd "$(dirname "$0")"
PORT=5173
echo "Starting Minion Colony on http://127.0.0.1:${PORT} ..."
(sleep 1 && open "http://127.0.0.1:${PORT}") &
node server.mjs
