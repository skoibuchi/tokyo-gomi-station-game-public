#!/bin/bash
# sync_to_other.sh
# このプロジェクトのファイルを別フォルダへ同期するスクリプト
# ビルド成果物・依存パッケージ・gitメタ情報は除外します

set -e

# -----------------------------------------------
# コピー先フォルダを引数で受け取る
# 例: ./scripts/sync_to_other.sh /path/to/other/gomi_map
# -----------------------------------------------
DEST="${1}"

if [ -z "$DEST" ]; then
  echo "使い方: $0 <コピー先フォルダ>"
  echo "例:     $0 /path/to/other/gomi_map"
  exit 1
fi

SRC="$(cd "$(dirname "$0")/.." && pwd)"

echo "コピー元: $SRC"
echo "コピー先: $DEST"
echo ""

rsync -av --progress \
  --exclude='.git/' \
  --exclude='.next/' \
  --exclude='prisma/prisma/dev.db' \
  --exclude='node_modules/' \
  --exclude='tsconfig.tsbuildinfo' \
  --exclude='.env' \
  --exclude='.env.local' \
  "$SRC/" "$DEST/"

echo ""
echo "✅ 同期完了"
