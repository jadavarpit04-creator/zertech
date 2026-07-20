#!/bin/bash
TOKEN="vcp_4YOLPWjOnD6aJXoK9QZduSHdSCJk3XBhUPkH8wJc1BJCErDi6r28ubIj"
cd /c/Users/jadav/Zertech
while IFS='=' read -r key value || [ -n "$key" ]; do
  [[ -z "$key" || "$key" =~ ^# ]] && continue
  echo "$value" | vercel env add "$key" production --token="$TOKEN" --yes 2>&1 | tail -1
done < .env
