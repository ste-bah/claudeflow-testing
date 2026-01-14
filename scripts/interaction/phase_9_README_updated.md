Phase 9 README



REPORT / ANSWER Completion + god-research-{local,hybrid} Integration



Repo: ~/projects/claudeflow-testing

Status: Phase 9 epistemic layer COMPLETE

Date: 2026-01-12



0\. Purpose of Phase 9



Phase 9 introduces a read-only epistemic interaction layer over a fully locked local research substrate (Phases 1–8).



Its goal is not generation, but diagnosis and grounding:



What does the local corpus already know?



How strong is that coverage?



Where (if anywhere) is external supplementation justified?



This phase establishes the final boundary between knowledge and presentation.



1\. What Phase 9 Produces



Phase 9 produces two authoritative, machine-first artifacts per query:



1.1 report.json — Coverage \& Retrieval Diagnostic



Runs local retrieval only



Grades coverage: NONE | LOW | MED | HIGH



Records:



Retrieved chunks



Distinct documents



Knowledge units



Reasoning edges



No LLM usage



Deterministic



Epistemic authority for “what exists in the corpus”



1.2 answer.json — Grounded Synthesis Artifact



Deterministic synthesis from:



Retrieved chunks



Knowledge units



Reasoning edges



Preserves full provenance



No external knowledge



No hallucination vector



No natural-language synthesis enabled by default

(synthesis.enabled: false)



These artifacts are not UI outputs.

They are the final, authoritative record of local knowledge.



2\. Data Source Modes (Pipeline-Wide)



A new canonical policy field was introduced and persisted:



type DataSourceMode = "external" | "local" | "hybrid"





Plumbed through CLI → session → prompt builder



Persisted in .phd-sessions/<id>.json



Survives init → resume → next



Verified by runtime tests



This allows policy changes without forking the pipeline.



3\. god-research-local (COMPLETE \& FROZEN)

Behavior



Forces --data-source local



Runs Phase 9 REPORT → ANSWER immediately



Skips the full multi-agent pipeline



Returns a virtual “agent” pointing to artifacts



next immediately returns complete



Properties



No external retrieval



No LLM synthesis



No hallucinations



Deterministic



Corpus-authoritative



Design Decision



god-research-local is intentionally non-generative.

It is the safest possible research interface and will remain unchanged.



4\. god-research-hybrid (COMPLETED THIS PHASE)

Purpose



To answer:



What does the local corpus already know, and where—if anywhere—must external material be consulted responsibly?



Core Principle



Local knowledge is epistemically primary.

External knowledge is conditional, supplemental, and explicitly labeled.



5\. Hybrid Execution Model

5.1 Non-Negotiable Order



Phase 9 REPORT always runs first



Local coverage is assessed



Hybrid policy is injected into agent prompts



Only then may agents proceed



5.2 Two-Axis Coverage Logic (IMPORTANT)



Hybrid distinguishes between:



Axis	Meaning

Conceptual coverage	Does the corpus cover the general theoretical domain?

Query-specific coverage	Does it cover this time period / domain intersection?



As a result:



coverage\_grade: HIGH does not forbid external use



External supplementation may still be justified by:



Recency intent (e.g. “2025”, “current”, “latest”)



Outside-corpus domains (e.g. VR rhetoric not yet ingested)



Claude is allowed to make this secondary judgment, and this behavior is intentional and correct.



6\. Hybrid Compliance Rules (Enforced)



When external tools are used in hybrid mode:



Agents must:



Read the Phase 9 REPORT first



Explicitly justify why external retrieval is required



Outputs must clearly separate:



Local provenance



chunk\_id



knowledge\_unit\_id



reasoning\_edge\_id



External provenance



URL



Source name



Reason for supplementation



Mixing or implicit blending is disallowed



If no justification exists, external tools must not be used.



7\. Tooling \& Permissions



Web tools are:



Disabled globally



Enabled only for god-research-hybrid



god-research-local cannot access web tools by design



This guarantees:



No accidental leakage



Predictable, auditable behavior



8\. What Phase 9 Explicitly Does Not Do



❌ No LLM synthesis inside Phase 9



❌ No mutation of REPORT or ANSWER artifacts



❌ No automatic merging of local + external claims



❌ No UI or stylistic polishing



Those belong to Phase 10.



9\. Phase 9 Closure Criteria (MET)



Phase 9 is considered closed because:



Local corpus always runs first



External supplementation is impossible without justification



Provenance is explicit and separable



No hallucinated knowledge path exists



Behavior is predictable and explainable



At this point, epistemic correctness is locked.



10\. What Comes Next (Phase 10+)



Future phases may safely add:



UI-friendly summaries



Optional LLM-based presentation



Style rendering



Answer condensation



Interactive exploration



All of this will occur after grounding and will never mutate epistemic artifacts.



Final Note



This phase completes the hardest part of the system:



separating knowing from saying.



Once that line is enforced, creativity becomes safe.



Phase 9 did that.

