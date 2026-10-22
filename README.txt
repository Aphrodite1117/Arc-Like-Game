# Arc-Like-Game 戦闘画面プロトタイプ 0.1

## ファイル
- `index.html`
- `main.js`
- `style.css`

## Linux Mint / Firefox での確認
1. 3ファイルを既存リポジトリの同名ファイルにコピーして置き換える。
2. ターミナルでリポジトリへ移動する:
   `cd ~/projects/Arc-Like-Game`
3. ローカルサーバーを起動する:
   `python3 -m http.server 8000 --bind 0.0.0.0`
4. Firefoxで `http://127.0.0.1:8000` を開く。
5. キャラクターや行動順のアイコンをクリック/タップし、選択表示とステータスが切り替わることを確認する。
6. 終了するときはターミナルで `Ctrl+C`。

## スマートフォンで確認
同じWi-Fiに接続し、Lenovoのターミナルで `hostname -I` を実行。
表示されたLAN内IPを使い、スマートフォンで `http://<IPアドレス>:8000` を開く。
