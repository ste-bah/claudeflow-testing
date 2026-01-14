Phase 9 — ANSWER \& SYNTHESIS (Interaction Layer)



answer.py provides a read-only interaction interface over the locked God-Learn substrate (Phases 1–8).



It supports two modes:



Phase 9B — ANSWER (Deterministic)

Structured, grounded presentation of evidence, knowledge units, and reasoning edges.



Phase 9C — ANSWER + SYNTHESIS (Optional, Controlled)

Structured claim synthesis with explicit grounding enforcement.



No Phase 9 command mutates corpus files, embeddings, knowledge units, or reasoning graphs.



Command Overview

python3 scripts/interaction/answer.py --query "<QUERY>" \[OPTIONS]



Core Arguments

Argument	Description

--query QUERY	Required. User query string.

--format {json,md}	Output format (json for automation, md for human review).

--out PATH	Write output to a file (optional).

Retrieval / Report Controls (Phase 4 passthrough)

Argument	Description

--k K	Number of retrieved chunks (default from REPORT).

--overfetch N	Overfetch count for retrieval.

--no\_include\_docs	Skip document text inclusion.

--max\_evidence N	Max evidence items rendered.

--max\_edges N	Max reasoning edges rendered (MD only).

Strict Mode (Phase 9B / 9C)

Argument	Description

--strict	Enforce strict diagnostics. Exit code 2 on failure, but still print output.



Strict checks include:



Evidence / KU / reasoning provenance validity



Grounding correctness (Phase 9C)



Schema integrity



Phase 9C — Synthesis Controls

Enable Synthesis

--enable\_synthesis





When enabled:



A structured claim synthesis step is run



Output is JSON-constrained



Every claim is explicitly labeled:



assertion → must be grounded



inference → explicitly ungrounded



External LLM Invocation

--llm\_cmd "<command>"

--llm\_timeout\_s <seconds>





Examples:



export GOD\_LEARN\_LLM\_CMD="claude -p"



python3 scripts/interaction/answer.py \\

&nbsp; --query "phantasia and action" \\

&nbsp; --enable\_synthesis \\

&nbsp; --format md



Synthesis Caching (Recommended)



To guarantee bit-for-bit parity between human review and strict validation:



1\. Generate synthesis once (save)

python3 scripts/interaction/answer.py \\

&nbsp; --query "phantasia and action" \\

&nbsp; --enable\_synthesis \\

&nbsp; --synthesis\_cache\_out /tmp/syn\_phantasia\_action.json \\

&nbsp; --format md



2\. Re-validate the same synthesis (no LLM call)

python3 scripts/interaction/answer.py \\

&nbsp; --query "phantasia and action" \\

&nbsp; --enable\_synthesis \\

&nbsp; --synthesis\_cache\_in /tmp/syn\_phantasia\_action.json \\

&nbsp; --strict \\

&nbsp; --format json



Strict Synthesis Policy (Optional Hard Gate)

--strict\_inferences\_fail





When used with --strict and --enable\_synthesis:



Fails if any claim is type: inference



Enforces fully grounded synthesis only



Useful for CI, publication checks, or archival validation



Example:



python3 scripts/interaction/answer.py \\

&nbsp; --query "phantasia and action" \\

&nbsp; --enable\_synthesis \\

&nbsp; --synthesis\_cache\_in /tmp/syn\_phantasia\_action.json \\

&nbsp; --strict \\

&nbsp; --strict\_inferences\_fail \\

&nbsp; --format json





Exit code:



0 → all claims grounded



2 → inference present or grounding violation



Output Structure (Phase 9C)

Synthesis

{

&nbsp; "enabled": true,

&nbsp; "claims": \[

&nbsp;   {

&nbsp;     "claim\_id": "c1",

&nbsp;     "text": "...",

&nbsp;     "type": "assertion",

&nbsp;     "supports": \["ku\_...", "ru\_...", "docid:chunk"]

&nbsp;   }

&nbsp; ]

}



Claim Map

{

&nbsp; "claim\_id": "c1",

&nbsp; "grounded\_by": \["ku\_...", "ru\_..."],

&nbsp; "type": "assertion"

}



Guarantees \& Invariants



Phase 9 is read-only



No mutation of Phases 1–8 artifacts



All grounding references are verified IDs



Ungrounded content is never silently accepted



Deterministic mode remains unchanged



Phase 9 Status

Component	Status

Phase 9A — REPORT	✅ Locked

Phase 9B — ANSWER (Deterministic)	✅ Locked

Phase 9C — Synthesis	✅ Complete

Strict Grounding Enforcement	✅

Cacheable / Reproducible	✅

