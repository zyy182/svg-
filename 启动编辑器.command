#!/bin/zsh
# macOS convenience launcher; the portable entry remains npm run cli.
cd -- "$(dirname -- "$0")" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
task_node="$(command -v node)"
if [[ ! -x "$task_node" ]]; then
  echo "未找到 Node.js。请安装 Node.js 22 或更新版本，然后运行 npm ci。"
  read "task_answer?按回车关闭窗口。"
  exit 1
fi
if ! "$task_node" -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 22 ? 0 : 1)'; then
  echo "需要 Node.js 22 或更新版本。请升级后重新启动。"
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
