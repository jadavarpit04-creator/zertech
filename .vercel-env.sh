#!/bin/bash
TOKEN="vcp_3yv8p72Rk5grlbU7iN1LHV5cmIOWV8WUT8I2HOcJmypv843Jz71ecUOQ"
cd /c/Users/jadav/Zertech
while IFS='=' read -r key value || [ -n "$key" ]; do
  [[ -z "$key" || "$key" =~ ^# ]] && continue
  echo "$value" | vercel env add "$key" production --token="$TOKEN" --yes 2>&1 | tail -1
done < .env

