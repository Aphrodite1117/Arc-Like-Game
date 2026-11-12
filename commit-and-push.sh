#!/usr/bin/env bash
# Arc-Like-Game: 新規ファイル・変更ファイルを確認し、必要ならコミットしてGitHubへPush
set -Eeuo pipefail

REPO_DIR="$HOME/projects/Arc-Like-Game"

pause_exit() {
  echo
  read -r -p "Enterキーで終了..."
}

fail() {
  echo
  echo "エラー: $1"
  pause_exit
  exit 1
}

if [[ ! -d "$REPO_DIR/.git" ]]; then
  fail "Gitリポジトリが見つかりません: $REPO_DIR"
fi

cd "$REPO_DIR"
BRANCH="$(git branch --show-current)"
[[ -n "$BRANCH" ]] || fail "現在のブランチを確認できません。"

echo "========================================"
echo " Arc-Like-Game Git コミット & Push"
echo "========================================"
echo "リポジトリ: $REPO_DIR"
echo

echo "[1/5] 変更ファイルを確認します..."
git status --short --untracked-files=all
echo

# 新規ファイルも含めてステージング
git add -A

if ! git diff --cached --quiet; then
  echo "今回コミットするファイル:"
  git diff --cached --name-status
  echo
  read -r -p "上記の変更をコミットしますか？ [y/N]: " confirm
  case "$confirm" in
    y|Y|yes|YES|Yes) ;;
    *)
      echo "コミットをキャンセルしました。変更内容は保持されています。"
      pause_exit
      exit 0
      ;;
  esac

  echo
  read -r -p "コミットメッセージを入力してください: " commit_message
  [[ -n "${commit_message//[[:space:]]/}" ]] || fail "コミットメッセージが空です。"
  git commit -m "$commit_message"
else
  echo "新たにコミットする変更はありません。"
  echo "既に作成済みで、まだGitHubへ送っていないコミットがあるか確認します。"
fi

echo
echo "[2/5] GitHub側の最新状態を取得します..."
git fetch origin || fail "GitHubから最新状態を取得できませんでした。ネットワーク接続を確認してください。"

UPSTREAM="$(git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null || true)"

if [[ -z "$UPSTREAM" ]]; then
  echo "このブランチには送信先（upstream）が設定されていません。"
  read -r -p "origin/$BRANCH に初回Pushしますか？ [y/N]: " first_push
  case "$first_push" in
    y|Y|yes|YES|Yes) git push -u origin "$BRANCH" || fail "初回Pushに失敗しました。" ;;
    *) echo "Pushをキャンセルしました。"; pause_exit; exit 0 ;;
  esac
else
  COUNTS="$(git rev-list --left-right --count "$UPSTREAM"...HEAD)"
  BEHIND="$(awk '{print $1}' <<< "$COUNTS")"
  AHEAD="$(awk '{print $2}' <<< "$COUNTS")"

  echo
  echo "ブランチ: $BRANCH"
  echo "GitHubより新しいローカルコミット: $AHEAD"
  echo "ローカルに取り込まれていないGitHub側コミット: $BEHIND"

  if (( BEHIND > 0 )); then
    fail "GitHub側に先行コミットがあります。先に git pull --rebase を実行して内容を確認し、その後このスクリプトを再実行してください。"
  fi

  if (( AHEAD > 0 )); then
    echo
    echo "GitHubへ送信するコミット:"
    git log --oneline "$UPSTREAM"..HEAD
    echo
    read -r -p "上記のコミットをGitHubへPushしますか？ [y/N]: " push_confirm
    case "$push_confirm" in
      y|Y|yes|YES|Yes) git push || fail "Pushに失敗しました。" ;;
      *) echo "Pushをキャンセルしました。ローカルコミットは保持されています。"; pause_exit; exit 0 ;;
    esac
  else
    echo
    echo "GitHubと同期済みです。Pushするコミットはありません。"
  fi
fi

echo
echo "[5/5] 完了時の状態:"
git status --short --branch
echo
echo "処理が完了しました。"
git log -1 --oneline
pause_exit
