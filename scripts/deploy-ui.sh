#!/bin/bash
# Hydro UI Dark Theme Deployment
# Run on test machine (192.168.2.19) as debian user

set -e
export PATH=$HOME/node-v22.14.0-linux-x64/bin:$PATH
cd ~/Hydro

echo "=== 1/4 Pulling latest code ==="
# No git available, manual update needed
# wget -q -O hydro.tar.gz https://codeload.github.com/echocc00/js001/tar.gz/base-deploy

echo "=== 2/4 Compiling dark theme CSS ==="
node scripts/compile-dark-css.js

echo "=== 3/4 Restarting Hydro ==="
pm2 restart hydro-backend
sleep 2

echo "=== 4/4 Verifying ==="
curl -s -o /dev/null -w "%{http_code}" http://localhost:8888/status
echo ""
echo "DONE. Refresh browser to see UI changes."
