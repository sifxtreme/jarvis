#!/bin/bash
set -e

SSH_KEY=~/Downloads/jarvis.pem
SSH_HOST=ubuntu@sifxtre.me

echo "Deploying Jarvis..."
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new "$SSH_HOST" 'cd ~/jarvis && ./update_server.sh'
echo "Deploy complete!"
