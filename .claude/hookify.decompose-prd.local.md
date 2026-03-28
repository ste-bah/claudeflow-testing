---
name: decompose-prd-enforcer
enabled: true
event: prompt
pattern: \b(decompose|break\s*down|split|convert)\b.*\b(PRD|prd|requirements)\b.*\b(task|spec|prompt)|task\s*spec.*\bPRD\b|\b_index\.md\b.*\b(PRD|task|batch)
action: warn
---

MANDATORY: When decomposing a PRD into task specs, you MUST use the /decompose-prd skill which reads the framework from docs2/prdtospec.md. NEVER improvise a decomposition approach from memory. The framework defines the 5-level specification hierarchy, task spec format (TASK-XXX-NNN), batching rules (max 3 per batch), and _index.md runbook format. Run /decompose-prd or read the template file directly before generating any task specs.
