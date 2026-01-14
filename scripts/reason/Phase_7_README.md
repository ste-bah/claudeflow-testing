Phase 7 — Cross-Document Reasoning (MVP)



Repository: claudeflow-testing

Status: Phase 7 complete (minimal working state, locked)



Overview



Phase 7 introduces structured, deterministic cross-document reasoning over promoted knowledge units only.



This phase is where thinking happens — but as data, not prose.



Phase 7 operates exclusively on:



god-learn/knowledge.jsonl





and produces inspectable reasoning artifacts suitable for long-form assembly in Phase 8.



Design Constraints (Locked)



Phase 7 MUST:



Use only promoted knowledge units (god-learn/knowledge.jsonl)



Preserve citation locking



Remain deterministic and replayable



Emit reasoning as structured data (JSONL)



Support multi-source relationships (≥ 2 knowledge units per reasoning node)



Phase 7 MUST NOT:



Query ChromaDB



Re-embed content



Introduce uncited claims



Collapse reasoning into prose



Key Architectural Decisions

1\. No embeddings, no vector search



All semantic retrieval is complete by Phase 6.

Phase 7 reasons over a closed, curated knowledge set to ensure stability and auditability.



2\. Char n-gram similarity (n = 4)



Reasoning edges are inferred using character n-gram Jaccard similarity, not keywords or embeddings.



This avoids:



curated vocabularies



domain overfitting



embedding drift



and scales to heterogeneous corpora.



3\. Single bucket (early Phase 7)



For Phase 7 (especially early), do a single bucket so you get a dense-enough graph, then reintroduce bucketing later as a scalability optimization.



All knowledge units are compared against each other during early Phase 7 to ensure sufficient graph density. Topic bucketing will be reintroduced later for scale.



4\. Deterministic pruning (top-K per unit)



To prevent combinatorial explosion as the corpus grows, Phase 7 applies deterministic top-K pruning:



For each knowledge unit, keep its top-K strongest edges



Union the retained edges across all units



Tie-break deterministically by reason\_id



Current locked default:



top\_k\_per\_unit = 12



Outputs



Phase 7 produces:



god-reason/

├── reasoning.jsonl   # one reasoning unit per line

└── index.json        # run metadata and statistics



reasoning.jsonl schema (example)

{

&nbsp; "reason\_id": "ru\_0265cbc52dae4b20",

&nbsp; "relation": "contrast",

&nbsp; "topic": "all",

&nbsp; "knowledge\_ids": \["ku\_...", "ku\_..."],

&nbsp; "shared\_ngrams\_sample": \[...],

&nbsp; "shared\_ngrams\_count": 34,

&nbsp; "evidence": \[

&nbsp;   { "ku\_id": "...", "claim": "...", "sources": \[...] },

&nbsp;   { "ku\_id": "...", "claim": "...", "sources": \[...] }

&nbsp; ],

&nbsp; "score": 0.061483,

&nbsp; "hash": "sha256:..."

}



How to Run Phase 7



From the repository root:



python3 scripts/reason/reason\_over\_knowledge.py \\

&nbsp; --knowledge god-learn/knowledge.jsonl \\

&nbsp; --out god-reason \\

&nbsp; --top\_k\_per\_unit 12





Verify determinism and referential integrity:



python3 scripts/reason/verify\_reasoning.py \\

&nbsp; --knowledge god-learn/knowledge.jsonl \\

&nbsp; --reasoning god-reason/reasoning.jsonl \\

&nbsp; --strict\_order





Expected output:



\[Phase7:verify] OK reasoning\_units=...



Determinism Guarantees



Phase 7 is deterministic with respect to:



knowledge unit ordering (sorted by ID)



pairwise comparison order



similarity scoring



pruning rules



hashing of canonical reasoning fields



Re-running Phase 7 with unchanged inputs will produce identical outputs.



Relationship to Phase 8



Phase 7 produces reasoning-as-data, not prose.



Phase 8 will:



consume god-reason/reasoning.jsonl



traverse reasoning structures



assemble long-form arguments



preserve citation locking throughout



Phase 7 Status



✔ Implemented

✔ Verified

✔ Deterministic

✔ Scalable (bounded)

✔ Ready for Phase 8

