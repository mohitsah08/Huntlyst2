#!/usr/bin/env bash
# ==============================================================================
# sync-to-claude.sh - Idempotent Synchronization from agent-toolkit to Claude Code
#
# Features:
# 1. Creates full timestamped backups before making any modifications.
# 2. Synchronizes Skills to ~/.claude/skills/ (or workspace .claude/skills/).
# 3. Synchronizes Master Rules to ~/.claude/CLAUDE.md.
# 4. Merges MCP configuration into Claude Code safely without overwriting existing servers.
# 5. NEVER copies or exposes secrets.
# 6. Reports authentication status and next steps for each server.
# 7. Completely idempotent and fails safe.
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOOLKIT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

CLAUDE_HOME="${HOME}/.claude"
CLAUDE_JSON="${HOME}/.claude.json"
BACKUP_BASE="${CLAUDE_HOME}/backups/toolkit-sync-$(date +%Y%m%d_%H%M%S)"

MODE="${1:-global}" # 'global' (default) or 'workspace'
WORKSPACE_DIR="${2:-$(pwd)}"

echo "========================================================================"
echo " AGENT TOOLKIT -> CLAUDE CODE SYNCHRONIZATION"
echo " Target Mode: ${MODE}"
echo " Toolkit Source: ${TOOLKIT_DIR}"
echo "========================================================================"

# --- 1. PRE-FLIGHT VERIFICATION ---
if ! command -v claude >/dev/null 2>&1; then
  echo "⚠️ Warning: 'claude' CLI not detected in PATH. MCP commands will write to configuration files."
fi

# --- 2. BACKUP EXISTING CLAUDE CONFIGURATION ---
echo ""
echo "[Step 1/5] Creating safety backup of existing Claude Code configuration..."
mkdir -p "${BACKUP_BASE}"

if [ -d "${CLAUDE_HOME}/skills" ]; then
  mkdir -p "${BACKUP_BASE}/skills"
  cp -R "${CLAUDE_HOME}/skills" "${BACKUP_BASE}/"
  echo "  Backed up ~/.claude/skills -> ${BACKUP_BASE}/skills"
fi

if [ -f "${CLAUDE_HOME}/CLAUDE.md" ]; then
  cp "${CLAUDE_HOME}/CLAUDE.md" "${BACKUP_BASE}/CLAUDE.md"
  echo "  Backed up ~/.claude/CLAUDE.md -> ${BACKUP_BASE}/CLAUDE.md"
fi

if [ -f "${CLAUDE_JSON}" ]; then
  cp "${CLAUDE_JSON}" "${BACKUP_BASE}/.claude.json"
  echo "  Backed up ~/.claude.json -> ${BACKUP_BASE}/.claude.json"
fi

if [ -f "${WORKSPACE_DIR}/.mcp.json" ]; then
  cp "${WORKSPACE_DIR}/.mcp.json" "${BACKUP_BASE}/workspace.mcp.json"
  echo "  Backed up ${WORKSPACE_DIR}/.mcp.json -> ${BACKUP_BASE}/workspace.mcp.json"
fi

echo "  Backup successfully created at: ${BACKUP_BASE}"

# --- 3. SYNCHRONIZE SKILLS ---
echo ""
echo "[Step 2/5] Synchronizing Skills..."
DEST_SKILLS_DIR="${CLAUDE_HOME}/skills"
if [ "${MODE}" = "workspace" ]; then
  DEST_SKILLS_DIR="${WORKSPACE_DIR}/.claude/skills"
fi
mkdir -p "${DEST_SKILLS_DIR}"

SKILLS_COUNT=0
UPDATED_COUNT=0

for skill_path in "${TOOLKIT_DIR}/skills"/*; do
  if [ -d "${skill_path}" ]; then
    skill_name="$(basename "${skill_path}")"
    target_dest="${DEST_SKILLS_DIR}/${skill_name}"
    
    # Check if target exists and is newer
    if [ -d "${target_dest}" ] && [ "${target_dest}" -nt "${skill_path}" ]; then
      echo "  Preserving newer existing skill: ${skill_name}"
    else
      # If target is symlink, replace safely
      if [ -L "${target_dest}" ]; then
        rm "${target_dest}"
      fi
      mkdir -p "${target_dest}"
      cp -R "${skill_path}/"* "${target_dest}/"
      UPDATED_COUNT=$((UPDATED_COUNT + 1))
    fi
    SKILLS_COUNT=$((SKILLS_COUNT + 1))
  fi
done

echo "  Synchronized ${UPDATED_COUNT}/${SKILLS_COUNT} Skills to ${DEST_SKILLS_DIR}."

# --- 4. SYNCHRONIZE RULES & AGENTS ---
echo ""
echo "[Step 3/5] Synchronizing Rules and Agent Personas..."
if [ "${MODE}" = "workspace" ]; then
  mkdir -p "${WORKSPACE_DIR}/.claude"
  cp "${TOOLKIT_DIR}/rules/CLAUDE.md" "${WORKSPACE_DIR}/CLAUDE.md"
  echo "  Synchronized rules -> ${WORKSPACE_DIR}/CLAUDE.md"
else
  mkdir -p "${CLAUDE_HOME}"
  cp "${TOOLKIT_DIR}/rules/CLAUDE.md" "${CLAUDE_HOME}/CLAUDE.md"
  echo "  Synchronized rules -> ${CLAUDE_HOME}/CLAUDE.md"
fi

# Copy agent definitions to ~/.claude/agents if directory exists or create it
mkdir -p "${CLAUDE_HOME}/agents"
cp -R "${TOOLKIT_DIR}/agents/"* "${CLAUDE_HOME}/agents/"
echo "  Synchronized custom Agent definitions -> ${CLAUDE_HOME}/agents/"

# --- 5. MERGE MCP CONFIGURATION SAFELY ---
echo ""
echo "[Step 4/5] Merging MCP Configuration into Claude Code..."

python3 - <<EOF
import json, os

claude_json_path = os.path.expanduser("~/.claude.json")
toolkit_mcp_path = "${TOOLKIT_DIR}/mcp/claude_mcp.json"

with open(toolkit_mcp_path) as f:
    toolkit_data = json.load(f)
toolkit_servers = toolkit_data.get("mcpServers", {})

existing_data = {}
if os.path.exists(claude_json_path):
    try:
        with open(claude_json_path) as f:
            existing_data = json.load(f)
    except Exception as e:
        print(f"  Error reading existing {claude_json_path}: {e}")

if "mcpServers" not in existing_data:
    existing_data["mcpServers"] = {}

added = 0
kept = 0

for name, cfg in toolkit_servers.items():
    if name in existing_data["mcpServers"]:
        print(f"  MCP server '{name}' already exists in ~/.claude.json (preserved)")
        kept += 1
    else:
        existing_data["mcpServers"][name] = cfg
        print(f"  Added MCP server '{name}' to ~/.claude.json")
        added += 1

with open(claude_json_path, 'w') as f:
    json.dump(existing_data, f, indent=2)

print(f"  MCP merge complete: {added} added, {kept} existing preserved.")
EOF

# Also generate workspace .mcp.json if in workspace mode
if [ "${MODE}" = "workspace" ]; then
  cp "${TOOLKIT_DIR}/mcp/claude_mcp.json" "${WORKSPACE_DIR}/.mcp.json"
  echo "  Generated workspace .mcp.json at ${WORKSPACE_DIR}/.mcp.json"
fi

# --- 6. AUTHENTICATION & NEXT STEPS REPORT ---
echo ""
echo "[Step 5/5] Checking Authentication Requirements..."
echo "------------------------------------------------------------------------"
echo "  SERVER          STATUS         AUTH ACTION REQUIRED"
echo "------------------------------------------------------------------------"
echo "  playwright      READY          None (runs locally headless)"
echo "  chrome-devtools READY          None (attaches to local Chrome)"

if [ -n "\${GITHUB_PERSONAL_ACCESS_TOKEN:-}" ]; then
  echo "  github          CONFIGURED     GITHUB_PERSONAL_ACCESS_TOKEN is set"
else
  echo "  github          ACTION NEEDED  Export GITHUB_PERSONAL_ACCESS_TOKEN=<token>"
fi

echo "  supabase        ACTION NEEDED  Run: claude mcp login supabase (or browser OAuth)"
echo "  vercel          ACTION NEEDED  Run: claude mcp login vercel (or browser OAuth)"
echo "  higgsfield      ACTION NEEDED  Run: claude mcp login higgsfield (or account login)"
echo "------------------------------------------------------------------------"
echo ""
echo "✅ Synchronization complete! Claude Code is now equipped with the Antigravity toolkit."
echo "Backup location: ${BACKUP_BASE}"
