#!/bin/bash

# 1. ターミナルと同じNode.jsのパスを強制的に追加する（※そのままキープ！）
export PATH="/run/user/1000/fnm_multishells/52355_1771409057772/bin:$PATH"

# ▼OSから受け取ったファイルパスを「環境変数」として記憶させる（※追加！）
export AHME_OPEN_FILE="$1"

# 2. ディレクトリの移動と起動
cd /mnt/SSD4TB/projects/ahme

# ▼ 引数リレー（-- "$@"）はもう使わないので削除し、シンプルにする
npm run dev:all
