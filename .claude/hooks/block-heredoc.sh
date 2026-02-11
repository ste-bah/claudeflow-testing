#!/bin/bash
# PreToolUse hook: Block Bash commands containing heredoc patterns.
# Prevents pipeline agents from writing file content via heredoc,
# which corrupts settings.local.json when auto-allowed.

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name // empty')
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

if [ "$TOOL" = "Bash" ]; then
  # Auto-allow any writes to /tmp/ (pipeline agent output, etc.)
  if echo "$COMMAND" | grep -q '> */tmp/'; then
    echo '{"decision": "allow"}'
    exit 0
  fi
  # Block heredoc writes to non-tmp paths (these corrupt settings.local.json)
  if echo "$COMMAND" | grep -qE "<<\s*'?[A-Z_]*EOF[A-Z_]*'?|<<\s*'?END'?|<<\s*'?HEREDOC'?"; then
    echo '{"decision": "block", "reason": "BLOCKED: Heredoc file writing detected. Use the Write tool instead of Bash heredoc to create files. Heredoc commands corrupt settings.local.json."}'
    exit 0
  fi
fi

echo '{"decision": "allow"}'
