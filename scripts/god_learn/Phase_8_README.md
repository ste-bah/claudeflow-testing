1️⃣ Phase 8 README (LOCKED)

Filename (recommended)

docs/HANDOFF\_PHASE\_8\_LOCKED.md



Contents (copy/paste exactly)

\# HANDOFF — Phase 8 (LOCKED)

God-Learn Compiler Pipeline  

Compile / Update Separation Finalization



\## Status

\*\*Phase 8 is complete, validated, and locked.\*\*



No further behavioral or semantic changes are permitted in Phase 8.

All subsequent work must treat this interface as authoritative.



---



\## 1. Purpose of Phase 8



Phase 8 finalized the \*compiler front-end contract\* for the God-Learn system.



The core goal was to eliminate conceptual and operational ambiguity between:



\- \*\*Corpus compilation\*\* (maintenance)

\- \*\*Query-conditioned retrieval \& promotion\*\* (demand-driven)

\- \*\*Future interaction layers\*\* (reporting / answering)



This phase enforces a strict compiler metaphor:

> Compilation is never epistemic.  

> Queries are selection lenses, not questions.



---



\## 2. Final Command Surface (Authoritative)



\### `/god-learn-compile`

\*\*Purpose:\*\*  

Pure corpus maintenance.



\*\*Behavior:\*\*

\- Runs Phase 1–3 substrate only:

&nbsp; - Ingest

&nbsp; - Audit

&nbsp; - Verify

\- Requires \*\*no query\*\*

\- Performs \*\*no retrieval\*\*

\- Performs \*\*no promotion\*\*

\- Deterministic and idempotent



\*\*Implementation:\*\*

```bash

python3 scripts/god\_learn/god\_learn.py compile



/god-learn-update "<query>"



Purpose:

Query-conditioned retrieval and optional knowledge promotion.



Behavior:



Always runs compilation first (safety + incrementality)



Requires --query at CLI level



Uses query only to:



Retrieve relevant chunks



Run diagnostic reranking



Test promotion eligibility



May promote new Knowledge Units



Does not answer questions



Does not generate prose



Implementation:



python3 scripts/god\_learn/god\_learn.py update --query "<query>"



/god-learn-verify



Purpose:

Integrity verification and normalization.



Behavior:



Verifies ingest integrity



Verifies knowledge store with strict ordering



Automatically:



Normalizes knowledge.jsonl ordering



Rebuilds index.json byte offsets



Re-verifies until stable



Optionally verifies Phase 8 assembly outputs if present



No query required



Implementation:



python3 scripts/god\_learn/god\_learn.py verify



3\. Key Invariants (Now Enforced)

Compilation Invariant



Compilation never requires a query



Compilation never performs retrieval



Compilation never performs promotion



Promotion Invariant



Promotion is always query-conditioned



Promotion is explicit and demand-driven



Knowledge Units are immutable once written



Verification Invariant



Strict ordering is mandatory



Index offsets must match byte positions



Normalization is automatic and deterministic



4\. Phase 8 Self-Healing Behavior



If strict verification fails after promotion:



knowledge.jsonl is deterministically re-sorted



index.json is rebuilt with correct offsets



Verification is re-run



This guarantees unattended execution (Claude Code safe).



5\. Explicit Non-Goals of Phase 8



Phase 8 does not include:



Answer generation



Reporting or diagnostics



Vocabulary bridging



Reasoning graph modification



Assembly regeneration



Any Phase 9 interaction logic



Any such functionality belongs strictly to Phase 9+.



6\. Phase 8 Lock Declaration



As of this document:



The compile/update/verify contract is final



CLI semantics are stable



Compiler metaphor is enforced



Phase 9 may build on top of this surface only



Phase 8 is LOCKED.





---



\## 2️⃣ Where to store this (recommended)



\### ✅ Primary location





docs/HANDOFF\_PHASE\_8\_LOCKED.md





\*\*Why:\*\*

\- It is \*\*architectural\*\*, not implementation-specific

\- It’s a contract, not a how-to

\- It should live alongside other phase handoffs

\- It’s discoverable without digging into scripts



---



\### Optional (secondary reference)

You \*may\* also add a one-line pointer in:







scripts/god\_learn/README.md





Example:



```md

See docs/HANDOFF\_PHASE\_8\_LOCKED.md for the authoritative compile/update contract.





But do not duplicate the content — the lock document should be single-source-of-truth.



3️⃣ What is now “frozen” going forward



You have now frozen:



The meaning of compile



The meaning of update



The requirement of query for promotion



The enforcement of strict ordering



The expectation of unattended execution



This is exactly what you need before Phase 9, because Phase 9 can now assume:



“The corpus substrate is correct, stable, and epistemically inert.”



Next step (when you’re ready)



When you open the next prompt, the correct title is something like:



Phase 9 — REPORT \& ANSWER Interaction Layers (Design + Implementation)

