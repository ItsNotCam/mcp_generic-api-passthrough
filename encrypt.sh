#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"

usage() {
  echo "Usage: $0 <text> <output_file>"
  echo "  Encrypts <text> using ENCRYPTION_KEY from .env (AES-256-GCM)"
  exit 1
}

[[ $# -lt 2 ]] && usage

PLAINTEXT="$1"
OUTPUT_FILE="$2"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: .env file not found at $ENV_FILE" >&2
  exit 1
fi

ENCRYPTION_KEY=$(grep -E '^ENCRYPTION_KEY=' "$ENV_FILE" | head -1 | cut -d '=' -f2-)

if [[ -z "$ENCRYPTION_KEY" ]]; then
  echo "Error: ENCRYPTION_KEY not set in $ENV_FILE" >&2
  exit 1
fi

OUTPUT_ABS="$(realpath -m "$OUTPUT_FILE")"

ENCRYPTION_KEY="$ENCRYPTION_KEY" PLAINTEXT="$PLAINTEXT" OUTPUT_PATH="$OUTPUT_ABS" bun -e "
  const key = process.env.ENCRYPTION_KEY;
  const plaintext = process.env.PLAINTEXT;
  const output = process.env.OUTPUT_PATH;

  const cryptoKey = await crypto.subtle.importKey(
    'raw', Buffer.from(key, 'hex'), { name: 'AES-GCM' }, false, ['encrypt']
  );

  const data = new TextEncoder().encode(plaintext);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, data);

  const combined = Buffer.concat([Buffer.from(iv), Buffer.from(encrypted)]);
  await Bun.write(output, combined.toString('base64'));
"

echo "Encrypted: $OUTPUT_FILE"
