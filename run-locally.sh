#!/usr/bin/env sh
# Starts Faxton Rentals on your computer. Needs Node.js or Python.
cd "$(dirname "$0")"
if command -v npx >/dev/null 2>&1; then npx --yes serve public -l 3000
elif command -v python3 >/dev/null 2>&1; then python3 -m http.server 3000 -d public
else echo "Install Node.js from https://nodejs.org and run again."; fi
