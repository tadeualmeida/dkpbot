#!/usr/bin/env bash
set -euo pipefail

# Move into the repo directory (adjust if this script lives elsewhere)
#cd "$(dirname "$0")"

echo "Pulling latest changes from GitHub..."
git pull origin main

echo "Installing any new dependencies..."
npm install --production

echo "Restarting bot with PM2..."
# Replace 'bot' with the name or ecosystem entry you used
pm2 restart bot.js

echo "Update complete."
