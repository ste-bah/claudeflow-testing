Phase 10 — Presentation Layer (UI Rendering)



God-Learn / God-Agent Scholarly Pipeline



Status: ✅ CLOSED — IMPLEMENTED, HARDENED, VALIDATED

Epistemic Status: Non-authoritative (presentation only)

Date Closed: 2026-01-13

Repo: ~/projects/claudeflow-testing



0\. Purpose of Phase 10



Phase 10 introduces a presentation-only rendering layer that converts authoritative Phase 9 artifacts into human-readable UI JSON suitable for interfaces, previews, and downstream UX.



Core invariant (non-negotiable):



Knowledge is earned upstream; language is applied downstream.



Phase 10 must never:



mutate Phase 9 artifacts,



introduce new claims,



invent citations or IDs,



or bypass deterministic validation.



All Phase 10 outputs are regenerable, non-authoritative, and safe to discard.



1\. Inputs and Outputs

Inputs (READ-ONLY)



Phase 9 REPORT artifact



docs/research/phantasia-and-action/phase9/report.json





Phase 9 ANSWER artifact (authoritative)



docs/research/phantasia-and-action/phase9/answer.json



Output (GENERATED)



Phase 10 UI artifact



docs/research/phantasia-and-action/phase10/answer.ui.json





Optional (debug only, not committed):



Raw LLM output on failure



answer.ui.json.llm\_raw.txt



2\. Phase 10 Responsibilities



Phase 10 performs exactly four tasks:



Render a UI-friendly JSON object from Phase 9 artifacts



Optionally use an LLM to improve readability and structure



Strictly validate grounding against Phase 9 IDs



Gracefully fall back to deterministic rendering on any failure



At no point does Phase 10 alter epistemic content.



3\. Renderer Implementation



File:



scripts/presentation/phase10\_render\_ui.py



Key design properties



Presentation-only



Deterministic fallback always available



Strict JSON parsing (json.loads)



Grounding validator enforced



Failure-safe and auditable



Provider support



Controlled via environment variables:



export PHASE10\_PROVIDER=claude   # or "openai"

export PHASE10\_MODEL=claude-3-haiku-20240307





LLM usage can be fully disabled:



--no-llm



4\. Prompt Hardening (Critical Work Completed)



Two prompt files define Phase 10 LLM behavior:



scripts/presentation/prompts/answer\_ui.system.txt

scripts/presentation/prompts/answer\_ui.user.txt



4.1 System Prompt (answer\_ui.system.txt)



Responsibilities:



Enforce JSON-only output



Forbid markdown, prose, or examples



Prevent truncation and malformed output



Require single-line strings



Key constraints:



Output must start with { and end with }



No commentary



No examples



Strict JSON only



4.2 User Prompt (answer\_ui.user.txt)



This file underwent extensive hardening to address real failure modes.



Problems encountered



LLM inventing placeholder IDs (chunk\_1, ku\_1, etc.)



LLM answering unrelated example questions



Truncated JSON causing parse failures



Ungrounded support references



Final solutions



Explicit ID whitelisting from payload



“Omit if unsure” rule (never invent IDs)



Output size caps to prevent truncation



Mandatory use of payload query



Explicit instruction to avoid examples/templates



The final prompt guarantees that every support ID must exist in Phase 9, or the key point is omitted.



5\. Grounding Validation



After rendering (LLM or fallback), the UI object is validated against Phase 9.



Validator checks:



Every support\[].id exists in:



layers.evidence\[].chunk\_id



layers.knowledge\_units\[].knowledge\_id | ku\_id | id



layers.reasoning\_edges\[].edge\_id | id



No invented or synthetic IDs allowed



Missing or invalid support causes failure



Validation failure does not crash the pipeline — it triggers fallback.



6\. Failure Handling \& Debug Instrumentation

6.1 Deterministic Fallback



If the LLM:



errors,



produces invalid JSON,



truncates output,



or fails validation,



Phase 10 automatically falls back to deterministic rendering.



This guarantees:



Output is always produced



No hallucinations enter the system



Phase 9 integrity is preserved



6.2 Raw LLM Dump on Failure (Debug-Only)



When JSON parsing fails, raw LLM output is written to:



answer.ui.json.llm\_raw.txt





This file:



is presentation-only,



is not authoritative,



is ignored by the pipeline,



and should not be committed.



Recommended .gitignore entry:



\*\*/\*.llm\_raw.txt



7\. Logging



Log file:



docs/research/phantasia-and-action/phase10/render.log.jsonl



Events emitted



phase10\_llm\_render\_ok



phase10\_llm\_render\_failed



phase10\_validation\_failed



phase10\_render\_fallback\_ok



phase10\_render\_ok



Each event includes timestamps, provider/model info, and outcome flags.



8\. Canonical Phase 10 Command

python3 scripts/presentation/phase10\_render\_ui.py \\

&nbsp; --report "docs/research/phantasia-and-action/phase9/report.json" \\

&nbsp; --answer-full "docs/research/phantasia-and-action/phase9/answer.json" \\

&nbsp; --out "docs/research/phantasia-and-action/phase10/answer.ui.json" \\

&nbsp; --log "docs/research/phantasia-and-action/phase10/render.log.jsonl" \\

&nbsp; --max-output-tokens 1600



Success criteria



Command exits normally



Log ends with:



"event": "phase10\_render\_ok",

"llm\_used": true





answer.ui.json exists and parses



Validator reports no errors



9\. Verification Snippets

Check whether LLM path was used

tail -n 5 docs/research/phantasia-and-action/phase10/render.log.jsonl



Inspect output summary

python3 - <<'PY'

import json

ui=json.load(open("docs/research/phantasia-and-action/phase10/answer.ui.json"))

print("llm\_used:", ui.get("generation",{}).get("llm\_used"))

print("query:", ui.get("query"))

print("key\_points:", len(ui.get("ui",{}).get("key\_points",\[])))

print("first support:", ui\["ui"]\["key\_points"]\[0]\["support"])

PY



10\. Known Failure Modes (Now Resolved)

Failure	Resolution

Unterminated JSON strings	Output size caps + strict JSON rules

Example answers unrelated to payload	Explicit “no examples” + payload-only rules

Invented support IDs	ID whitelist + omit-if-unsure rule

Silent LLM failures	Raw dump + failure logging

Misreported llm\_used	Corrected generation metadata

11\. Final Phase 10 Status



✅ LLM output parses

✅ Grounding validation enforced

✅ Deterministic fallback preserved

✅ Debuggable failures

✅ Epistemic integrity maintained



Phase 10 is now COMPLETE and LOCKED.



12\. What Comes Next (Phase 11+)



Future phases may include:



UI visualization layers



Interactive exploration



Pedagogical tools



Evaluation across corpus growth



All future phases remain non-epistemic and must treat Phase 9 artifacts as immutable.

