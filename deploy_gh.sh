#!/usr/bin/env bash
# ============================================================================
# GitHub Pages 部署脚本
# ============================================================================
# 用法：
#   ./deploy_gh.sh <仓库地址> <分支> [Pages 源]
#   例：./deploy_gh.sh https://github.com/<user>/<repo>.git main
#
# 前置条件：
#   1. 环境变量 GITHUB_TOKEN 已设置，且该 token 具备 repo 权限
#      （GitHub → Settings → Developer settings → Personal access tokens
#        → Fine-grained tokens → 选中目标仓库 → Permissions:
#        Contents: Read and write · Pages: Read and write）
#   2. 仓库已在 GitHub 上创建，且 Pages 已设为 GitHub Actions 部署源
#
# 说明：
#   首次推完还需在仓库 Settings → Pages → Source 选择 "GitHub Actions"，
#   之后每次 push 会自动触发 .github/workflows/pages.yml 重新部署。
# ============================================================================
set -euo pipefail

REPO="${1:-}"
BRANCH="${2:-main}"
SRC_DIR="$(cd "$(dirname "$0")" && pwd)"

if [[ -z "$REPO" ]]; then
  echo "用法: $0 <仓库地址> [分支]" >&2
  echo "示例: $0 https://github.com/minchenke/portfolio.git main" >&2
  exit 2
fi

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo "❌ 未设置 GITHUB_TOKEN" >&2
  echo "   PowerShell: \$env:GITHUB_TOKEN = 'ghp_xxx'" >&2
  echo "   bash:      export GITHUB_TOKEN=ghp_xxx" >&2
  exit 2
fi

echo "══════════════════════════════════════════"
echo " 部署到 GitHub Pages"
echo "══════════════════════════════════════════"
echo " 仓库: $REPO"
echo " 分支: $BRANCH"
echo " 目录: $SRC_DIR"
echo ""

cd "$SRC_DIR"

# ── 1. 初始化仓库 ──
if [[ ! -d .git ]]; then
  git init -q
  git branch -M "$BRANCH"
  echo "✓ 已初始化 git 仓库"
fi

# ── 2. 暂存与提交 ──
git add -A
if git diff --cached --quiet; then
  echo "• 没有内容变更，跳过提交"
else
  MSG="${1:-}"
  git -c user.name="${GIT_USER_NAME:-闵晨可}" \
      -c user.email="${GIT_USER_EMAIL:-minchenke@users.noreply.github.com}" \
      commit -q -m "docs: 更新作品集内容与附录${MSG:+（$MSG）}"
  echo "✓ 已提交"
fi

# ── 3. 设置远端并推送 ──
if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$REPO"
else
  git remote add origin "$REPO"
fi

# 用 token 认证，避免要求本机已登录
AUTH_URL="$REPO"
if [[ "$REPO" == https://* ]]; then
  AUTH_URL="https://x-access-token:${GITHUB_TOKEN}@${REPO#https://}"
fi

echo "→ 推送到远端…"
# 代理容错：git 全局可能配了 127.0.0.1:7890，但代理未启动时会直接失败。
# 先按全局配置试，失败则绕过代理重试一次（GitHub 直连通常可用）。
PUSH_ARGS=()
if git push -q "$AUTH_URL" "$BRANCH" 2>/tmp/_ghpush.err; then
  PUSH_OK=1
elif grep -qiE "proxy|Could not connect" /tmp/_ghpush.err 2>/dev/null; then
  echo "  · 全局代理不可用，改为直连重试…"
  if git -c http.proxy= -c https.proxy= push -q "$AUTH_URL" "$BRANCH" 2>/tmp/_ghpush.err; then
    PUSH_OK=1
  else
    PUSH_OK=0
  fi
else
  PUSH_OK=0
fi

if [[ $PUSH_OK -eq 1 ]]; then
  echo "✓ 推送成功"
else
  echo "✗ 推送失败" >&2
  echo "  常见原因：" >&2
  echo "   · token 缺少 Contents: Read and write 权限" >&2
  echo "   · 仓库不存在或用户名/仓库名拼写有误" >&2
  exit 1
fi

# ── 4. 输出 Pages 地址 ──
PAGES_URL="$(echo "$REPO" | sed -E 's#https://github\.com/([^/]+)/([^/.]+).*#\1.github.io/\2#')"

cat <<EOF

══════════════════════════════════════════
 ✅ 已推送
══════════════════════════════════════════

 线上地址（Pages 部署完成后生效，通常 1–3 分钟）：

     $PAGES_URL

 首次使用请到仓库 Settings → Pages → Source 选择
 "GitHub Actions"，之后每次 push 自动重新部署。

 验证：curl -sI "$PAGES_URL" | head -1
EOF
