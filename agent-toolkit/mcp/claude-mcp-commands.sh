#!/usr/bin/env bash
# CLI helper to add MCP servers to Claude Code using `claude mcp add`
set -e

echo 'Registering MCP servers with Claude Code...'

# 1. Playwright (Headless UI E2E automation)
claude mcp add playwright -- npx -y @playwright/mcp@latest --headless

# 2. Chrome DevTools (Console, network, DOM inspection)
claude mcp add chrome-devtools -- npx -y chrome-devtools-mcp@latest

# 3. GitHub (Repository inspect, PRs, diffs)
if [ -n "$GITHUB_PERSONAL_ACCESS_TOKEN" ]; then
  claude mcp add github -e GITHUB_PERSONAL_ACCESS_TOKEN="$GITHUB_PERSONAL_ACCESS_TOKEN" -- /usr/local/bin/github-mcp-runner
else
  echo 'Notice: GITHUB_PERSONAL_ACCESS_TOKEN not set. Registering with placeholder env...'
  claude mcp add github -- /usr/local/bin/github-mcp-runner
fi

# 4. Supabase (Database schema, PostgreSQL, RLS)
claude mcp add supabase -- npx -y mcp-remote@latest https://mcp.supabase.com/mcp

# 5. Vercel (Deployments, serverless function logs)
claude mcp add vercel -- npx -y mcp-remote@latest https://mcp.vercel.com --static-oauth-client-metadata '{"scope":"openid offline_access"}'

# 6. Higgsfield AI (Generative creative assets & visual media)
claude mcp add higgsfield -- npx -y mcp-remote@latest https://mcp.higgsfield.ai/mcp

echo 'All 6 MCP servers configured in Claude Code.'
echo 'Verify with: claude mcp list'
