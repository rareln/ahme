#!/bin/bash

# デバッグ用ログ（無事に起動できたらこの行は後で消してOKです）
exec > /tmp/ahme-boot.log 2>&1

# 1. fnmへのパスを通す
export PATH="/home/raregroove/.local/share/fnm:$PATH"

# 2. 【ここが解決の鍵】fnmに明示的にbashであることを伝えて初期化する
eval "$(fnm env --shell bash)"

# 3. OSから受け取ったファイルパスを記憶
export AHME_OPEN_FILE="$1"

# 4. ディレクトリ移動と起動
cd /mnt/SSD4TB/projects/ahme
npm run start:all
