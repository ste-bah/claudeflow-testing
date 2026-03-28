---
name: research-usacf-enforcer
enabled: true
event: prompt
pattern: \b(research|investigate|deep\s*dive|analyze|study|explore)\b.*\b(topic|subject|area|question|how\s+does|what\s+is|why\s+does|compare)\b|\bdo\s+(some\s+)?research\b|\bresearch\s+(on|about|into)\b
action: warn
---

MANDATORY: When the user asks you to do research, you MUST use the /research skill which reads the USACF framework from docs2/usacfsearches.md and docs2/usacfsearches2.md. This framework generates structured super-prompts with multi-phase execution (meta-analysis, discovery, gap analysis, synthesis), parallel agents, adversarial reviews, and algorithm selection. NEVER do ad-hoc research without the framework. Run /research or read both USACF docs before starting any research task.
