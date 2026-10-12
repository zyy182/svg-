#!/bin/zsh
# macOS convenience launcher; the portable entry remains npm run cli.
cd -- "$(dirname -- "$0")" || exit 1
task_node="$(command -v node)"
if [[ -z "$task_node" ]]; then
  task_node="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
fi
if [[ ! -x "$task_node" ]]; then
  echo "未找到 Node.js。请安装 Node.js 22 或更新版本，然后运行 npm ci。"
  read "task_answer?按回车关闭窗口。"
  exit 1
fi
if [[ ! -f node_modules/typescript/bin/tsc ]]; then
  echo "请先在工程目录执行 npm ci 安装依赖。"
  read "task_answer?按回车关闭窗口。"
  exit 1
fi
"$task_node" node_modules/typescript/bin/tsc -p tsconfig.json || exit 1
"$task_node" dist/src/main.js
