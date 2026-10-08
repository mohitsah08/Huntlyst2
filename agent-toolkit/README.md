# Agent Toolkit: Portable Agent Ecosystem for Claude Code

This toolkit is an automated, portable export of your local **Antigravity** configuration, engineered for direct consumption by **Claude Code** without manually copying individual skills, agents, or MCP configurations.

---

## 1. Directory Structure

```
agent-toolkit/
├── skills/          # 136 Discovered and validated Skills with SKILL.md frontmatter
├── agents/          # Agent persona definitions (design-review, antigravity-engineer, etc.)
├── rules/           # Global development guidelines, 9-step debugging workflow, and CLAUDE.md
├── mcp/             # Sanitized MCP server configurations, env templates, and CLI commands
├── workflows/       # Pipeline and evaluation workflows
├── plugins/         # 10 Plugin bundle definitions and catalog manifests
├── sync/            # sync-to-claude.sh idempotent sync script with automated backups
├── manifest.json    # Machine-readable inventory of all discovered and migrated assets
└── README.md        # Comprehensive operations guide
```

---

## 2. Discovered & Migrated Assets

| Category | Total Discovered | Migrated | Duplicates Resolved | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Skills** | **136** | **136** | 22 duplicates | Full directory trees preserved with verified YAML frontmatter. |
| **Agents** | **4** | **4** | 0 | Design review, Higgsfield agent specs, and Antigravity Engineer persona. |
| **Rules** | **3** | **3** | 0 | Global Development, Higgsfield guidelines, and master `CLAUDE.md`. |
| **Workflows**| **2** | **2** | 0 | Design Review CI/CD and Rebuilt Deterministic Verification Workflow. |
| **Plugins** | **10** | **10** | 0 | Metadata catalogs generated for all 10 plugins. |
| **MCP Servers** | **6** | **6** | 0 | 100% sanitized: zero secrets copied, ready for Claude Code. |

---

## 3. MCP Servers & Authentication Requirements

| Server | Transport | Command / URL | Authentication Method |
| :--- | :--- | :--- | :--- |
| **playwright** | `stdio` | `npx -y @playwright/mcp@latest --headless` | **Zero Auth Required** (runs locally headless). |
| **chrome-devtools** | `stdio` | `npx -y chrome-devtools-mcp@latest` | **Zero Auth Required** (attaches to local browser). |
| **github** | `stdio` | `/usr/local/bin/github-mcp-runner` | **Token Required**: Set `GITHUB_PERSONAL_ACCESS_TOKEN` in your environment or `.env`. |
| **supabase** | `stdio (remote proxy)` | `npx -y mcp-remote@latest https://mcp.supabase.com/mcp` | **OAuth / Browser Login**: Authenticate via browser or `claude mcp login supabase`. |
| **vercel** | `stdio (remote proxy)` | `npx -y mcp-remote@latest https://mcp.vercel.com` | **OAuth / Browser Login**: Authenticate via browser or `claude mcp login vercel`. |
| **higgsfield** | `stdio (remote proxy)` | `npx -y mcp-remote@latest https://mcp.higgsfield.ai/mcp` | **Account Login**: Authenticate via `claude mcp login higgsfield`. |

> [!IMPORTANT]
> **Zero Secrets Policy**: No API tokens, private keys, or passwords were copied during migration. Use `agent-toolkit/mcp/env.example` as a template for required environment variables.

---

## 4. How to Run the Synchronization

To synchronize the entire toolkit into your Claude Code installation:

```bash
# 1. From the project root, execute the sync script:
./agent-toolkit/sync/sync-to-claude.sh

# 2. Or to sync for a specific project/workspace:
./agent-toolkit/sync/sync-to-claude.sh workspace /path/to/project
```

### Safety & Idempotency Guarantees:
1. **Automated Backup**: Before touching anything, the script creates a full timestamped backup in `~/.claude/backups/toolkit-sync-YYYYMMDD_HHMMSS/`.
2. **Conflict Preservation**: If a destination file is newer than the toolkit source, it is preserved rather than overwritten.
3. **Safe MCP Merging**: Merges new MCP servers into `~/.claude.json` without deleting or overwriting any pre-existing servers.
4. **Idempotent**: Can be run safely as many times as needed.

---

## 5. How to Add a New Skill

1. Create a directory under `agent-toolkit/skills/<my-skill-name>/`.
2. Add a `SKILL.md` file with valid YAML frontmatter:
   ```markdown
   ---
   name: my-skill-name
   description: Explains what this skill does and when to activate it.
   ---

   # Instructions
   ...
   ```
3. Run `./agent-toolkit/sync/sync-to-claude.sh` to propagate it to Claude Code immediately.

---

## 6. How to Add a New MCP Server

1. Open `agent-toolkit/mcp/claude_mcp.json` and add your server definition:
   ```json
   "my-server": {
     "command": "npx",
     "args": ["-y", "my-mcp-server@latest"],
     "env": { "API_KEY": "${MY_API_KEY}" }
   }
   ```
2. Or use the Claude CLI directly:
   ```bash
   claude mcp add my-server -- npx -y my-mcp-server@latest
   ```
3. Re-run `./agent-toolkit/sync/sync-to-claude.sh` to merge changes safely.

---

## 7. Keeping Antigravity and Claude Code Synchronized

- **Antigravity Source of Truth**: When you add or update skills in Antigravity (`~/.gemini/config/skills/` or `~/.agents/skills/`), re-run the toolkit migration script to update `agent-toolkit/`.
- **Sync to Claude**: Run `./agent-toolkit/sync/sync-to-claude.sh` to mirror changes to `~/.claude/skills/` and `~/.claude/CLAUDE.md`.
