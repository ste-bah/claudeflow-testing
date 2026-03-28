---
name: prd-template-enforcer
enabled: true
event: prompt
pattern: \b(create|write|draft|make|build|generate)\b.*\b(PRD|prd|product requirements)\b|\bPRD\b.*\b(for|about|covering)\b
action: warn
---

MANDATORY: When creating a PRD, you MUST use the /prd skill which reads the template from docs2/ai-agent-prd.md. NEVER improvise a PRD structure from memory. The template has 14 mandatory sections with stable identifiers (FR-001, NFR-001, etc.), MoSCoW priorities, and Given/When/Then acceptance criteria. Run /prd or read the template file directly before generating any PRD content.
