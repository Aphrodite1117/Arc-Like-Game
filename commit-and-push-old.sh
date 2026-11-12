#!/usr/bin/env bash

# Arc-Like-Game: 変更をまとめてコミットし、GitHubへ送信するスクリプト
# 保存先: ~/projects/Arc-Like-Game/commit-and-push.sh

set -Eeuo pipefail

REPO_DIR="$HOME/projects/Arc-Like-Game"

if [[ ! -d "$REPO_DIR/.git" ]]; then
  echo "エラー: Gitリポジトリが見つかりません: $REPO_DIR"
  echo "REPO_DIR の設定を確認してください。"
  read -r -p "Enterキーで終了..."
  exit 1
fi

cd "$REPO_DIR"

echo "========================================"
echo " Arc-Like-Game Git コミット & Push"
echo "========================================"
echo
echo "リポジトリ: $REPO_DIR"
echo

if [[ -z "$(git status --porcelain)" ]]; then
  echo "変更はありません。コミットするものがないため終了します。"
  read -r -p "Enterキーで終了..."
  exit 0
fi

echo "変更内容:"
git status --short
echo

read -r -p "この変更をコミットしてGitHubへ送信しますか？ [y/N]: " confirm
case "$confirm" in
  y|Y|yes|YES|Yes) ;;
  *)
    echo "キャンセルしました。ファイルの変更はそのまま残っています。"
    read -r -p "Enterキーで終了..."
    exit 0
    ;;
esac

echo
read -r -p "コミットメッセージを入力してください: " commit_message
if [[ -z "${commit_message//[[:space:]]/}" ]]; then
  echo "エラー: コミットメッセージが空です。"
  read -r -p "Enterキーで終了..."
  exit 1
fi

echo
echo "変更をステージングします..."
git add -A

if git diff --cached --quiet; then
  echo "コミット対象の変更がありません。"
  read -r -p "Enterキーで終了..."
  exit 0
fi

echo "コミットを作成します..."
git commit -m "$commit_message"

echo
echo "GitHubへ送信します..."
git push

echo
echo "完了: コミットとGitHubへの送信が成功しました。"
echo
git log -1 --oneline
echo
read -r -p "Enterキーで終了..."
