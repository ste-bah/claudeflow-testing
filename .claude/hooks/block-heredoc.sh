#!/bin/bash
# PreToolUse hook: Block Bash commands containing heredoc patterns.
# Prevents pipeline agents from writing file content via heredoc,
# which corrupts settings.local.json when auto-allowed.

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name // empty')
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

if [ "$TOOL" = "Bash" ]; then
  # Auto-allow pipeline agent output writes to /tmp/
  if echo "$COMMAND" | grep -q '/tmp/pipeline-agent-output'; then
    echo '{"decision": "allow"}'
    exit 0
  fi
  if echo "$COMMAND" | grep -qE "<<\s*'?EOF'?|<<\s*'?END'?|<<\s*'?HEREDOC'?"; then
    echo '{"decision": "block", "reason": "BLOCKED: Heredoc file writing detected. Use the Write tool instead of Bash heredoc to create files. Heredoc commands corrupt settings.local.json."}'
    exit 0
  fi
fi

echo '{"decision": "allow"}'
