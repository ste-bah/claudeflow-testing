#!/usr/bin/env python3
"""Parse pipeline CLI output (init, complete-and-next, resume formats).

Reads JSON from stdin (with optional ANSI escape codes stripped),
extracts key fields, writes the agent prompt to a session-scoped file,
and prints a compact summary to stdout.

Usage:
  npx tsx .../pipeline-thin-cli.ts init "task" 2>&1 | python3 scripts/parse-pipeline.py
  npx tsx .../pipeline-thin-cli.ts complete-and-next <sid> <key> --file ... 2>&1 | python3 scripts/parse-pipeline.py
  npx tsx .../pipeline-thin-cli.ts resume <sid> 2>&1 | python3 scripts/parse-pipeline.py

Output lines (machine-parseable):
  SESSION: <uuid>
  STATUS: running|complete
  COMPLETED: <key> | quality: <score> | xp: <earned>
  NEXT: <key> | model: <model>
  PROGRESS: {"completed": N, "total": M, "percentage": P}
  PROMPT_FILE: <path>          ← where the full prompt was written
  PROMPT_LEN: <bytes>          ← size of prompt (0 means no prompt available)
  PIPELINE COMPLETE: {...}
"""
import sys, os, re, json

raw = sys.stdin.read()
clean = re.sub(r'\x1b\[[0-9;]*m', '', raw)

try:
    start = clean.index('{')
    decoder = json.JSONDecoder()
    obj, _ = decoder.raw_decode(clean[start:])
except (ValueError, json.JSONDecodeError) as e:
    print(f"PARSE_ERROR: {e}", file=sys.stderr)
    print(clean[:2000])
    sys.exit(1)


def write_prompt(session_id: str, agent_key: str, prompt: str) -> str:
    """Write prompt to session-scoped path and return the file path."""
    if not prompt:
        return ""
    out_dir = f".god-agent/pipeline-output/{session_id}"
    os.makedirs(out_dir, exist_ok=True)
    path = f"{out_dir}/_next-prompt-{agent_key}.txt"
    with open(path, 'w') as f:
        f.write(prompt)
    return path


# ── Handle init / resume format ──────────────────────────────────────────
# Shape: { sessionId, status, agent: { key, prompt, model }, progress }
if 'sessionId' in obj and 'agent' in obj and 'completed' not in obj:
    sid = obj['sessionId']
    agent = obj.get('agent', {})
    key = agent.get('key', '?')
    model = agent.get('model', 'sonnet')
    prompt = agent.get('prompt', '')
    prog = obj.get('progress', {})

    print(f"SESSION: {sid}")
    print(f"STATUS: {obj.get('status', 'unknown')}")
    print(f"NEXT: {key} | model: {model}")
    print(f"PROGRESS: {json.dumps(prog)}")

    path = write_prompt(sid, key, prompt)
    print(f"PROMPT_FILE: {path}")
    print(f"PROMPT_LEN: {len(prompt)}")
    sys.exit(0)


# ── Handle complete-and-next format ──────────────────────────────────────
# Shape: { completed: { success, quality, xp }, next: { status, agent, progress } }
c = obj.get('completed', {})
quality = c.get('quality', {})
xp = c.get('xp', {})
agent_key_done = c.get('agentKey', '?')
print(f"COMPLETED: {agent_key_done} | quality: {quality.get('score', 0)} | xp: {xp.get('earned', 0)}")

n = obj.get('next', {})
status = n.get('status', 'unknown')
print(f"STATUS: {status}")

if status == 'complete':
    prog = n.get('progress', {})
    print(f"PIPELINE COMPLETE: {json.dumps(prog)}")
    print(f"PROMPT_FILE: ")
    print(f"PROMPT_LEN: 0")
else:
    agent = n.get('agent', {})
    key = agent.get('key', '?')
    model = agent.get('model', 'sonnet')
    prompt = agent.get('prompt', '')
    prog = n.get('progress', {})

    # Extract sessionId from completed data or progress
    sid = n.get('sessionId', '') or obj.get('sessionId', '') or c.get('sessionId', '')
    # Fallback: try to find it from the progress context
    if not sid:
        # Look in the completed agent's response for sessionId
        sid = c.get('sessionId', '')

    print(f"NEXT: {key} | model: {model}")
    print(f"PROGRESS: {json.dumps(prog)}")

    if sid and prompt:
        path = write_prompt(sid, key, prompt)
        print(f"PROMPT_FILE: {path}")
    else:
        # Even without session-scoped path, write to a known fallback
        if prompt:
            fallback = "/tmp/pipeline-next-prompt.txt"
            with open(fallback, 'w') as f:
                f.write(prompt)
            print(f"PROMPT_FILE: {fallback}")
        else:
            print(f"PROMPT_FILE: ")

    print(f"PROMPT_LEN: {len(prompt)}")
