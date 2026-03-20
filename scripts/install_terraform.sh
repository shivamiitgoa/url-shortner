#!/usr/bin/env bash
set -euo pipefail

if command -v terraform >/dev/null 2>&1; then
  terraform version
  exit 0
fi

TF_VERSION="1.8.5"
OS="darwin"
ARCH="amd64"

if [[ "$(uname -s)" == "Linux" ]]; then
  OS="linux"
fi

if [[ "$(uname -m)" == "arm64" ]]; then
  ARCH="arm64"
fi

mkdir -p "$HOME/.local/bin"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

ZIP_FILE="$TMP_DIR/terraform.zip"
URL="https://releases.hashicorp.com/terraform/${TF_VERSION}/terraform_${TF_VERSION}_${OS}_${ARCH}.zip"

curl -fsSL "$URL" -o "$ZIP_FILE"
unzip -q "$ZIP_FILE" -d "$TMP_DIR"
install "$TMP_DIR/terraform" "$HOME/.local/bin/terraform"

export PATH="$HOME/.local/bin:$PATH"
terraform version
