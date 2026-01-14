Option B Ingestion Pipeline — Phases 1–3 README



Status: ✅ Phases 1–3 complete and verified

Trust level: Proven (filesystem ↔ manifest ↔ vectors ↔ dimensions)



This document describes what exists, why it is shaped this way, and how to prove correctness before proceeding to Phase 4 (retrieval \& synthesis).



0\. Project Context (Locked)



Repository



claudeflow-testing





Environment



WSL (Ubuntu)



ext4 filesystem



Python 3.12+



Authoritative Corpus Root



/home/dalton/projects/claudeflow-testing/corpus





Current Corpus Structure



corpus/

└── rhetorical\_ontology/

&nbsp;   ├── Aristotle - On The Soul (De Anima)\_(2014)\_\[My Copy].pdf

&nbsp;   ├── Aristotle - Movement Of Animals\_(2014)\_\[My Copy].pdf

&nbsp;   ├── Nussbaum, Martha - The Role of Phantasia in Aristotle's Explanation of Action\_(1985)\_\[My Copy].pdf

&nbsp;   └── O'Gorman, Ned - Aristotle's Phantasia in the Rhetoric- Lexis, Appearance, and the Epideictic Function of Discourse\_(2005)\_\[My Copy].pdf





All PDFs are:



Academic



Highlighted / annotated



Treated as authoritative primary sources



1\. Phase 1 — Ingest Skeleton (Completed)

Objective



Create a restart-safe, page-aware ingestion pipeline without embeddings.



Locked Design Decisions

Corpus semantics



First directory under corpus/ = collection



All documents stored in one Chroma collection, filtered via metadata



File identity



sha256 = SHA-256 of raw PDF bytes



Stored in manifest under key sha256 (not sha256\_file)



Document ID

doc\_id = sha256(path\_rel + ":" + sha256)\[:16]





Properties:



Stable across reruns



Changes if file bytes or relative path change



Rename-sensitive by design



Chunk identity

<doc\_id>:<chunk\_index:05d>



Page provenance (critical)



PDFs extracted via:



pdftotext -layout input.pdf -





Page boundaries detected by \\f



Stored per chunk:



page\_start (1-based)



page\_end (1-based)



Printed page numbers are explicitly out of scope



Chunking



Paragraph-based



Target ~800–1200 tokens



Page-aware aggregation (chunks never cross page boundaries blindly)



Manifest



Append-only JSONL:



scripts/ingest/manifest.jsonl





Latest record per path\_abs is authoritative



Enables crash safety, replay, and auditing



Phase 1 Command

python3 scripts/ingest/run\_ingest.py \\

&nbsp; --root /home/dalton/projects/claudeflow-testing/corpus



2\. Phase 2 — Embedding + Chroma Storage (Completed)

Objective



Embed all chunks and persist vectors in Chroma with restart-safe semantics.



Locked Targets



Embedding endpoint



http://127.0.0.1:8000/embed





Embedding dimensionality



1536





Vector store



vector\_db\_1536/





Chroma collection



knowledge\_chunks



Critical Hardening Decisions

Batch size cap



Academic chunks are large



Smaller batches avoid timeouts / payload limits



Adaptive recursive batch splitting



If a batch fails, split and retry



Prevents single pathological chunk from killing progress



Long timeouts



Embedding inference can be slow under GPU contention



Timeouts are intentionally conservative



Idempotent upserts



Stable chunk IDs



Re-runs never duplicate vectors



Phase 2 Command

python3 scripts/ingest/run\_ingest\_phase2.py \\

&nbsp; --root /home/dalton/projects/claudeflow-testing/corpus



3\. Phase 3 — Verification, Audit, Integrity (Completed)



Phase 3 does not ingest or embed anything.

It proves correctness of what already exists.



3.1 Verification Utility



Script



scripts/ingest/verify\_ingest.py





What it verifies

For every PDF:



Manifest record exists



status == ok



phase >= 2



Manifest sha256 matches current file bytes



Chroma contains expected chunks for doc\_id



Embeddings exist and are 1536-dimensional (spot-check)



Important implementation notes



Manifest hash key is sha256



Hash lookup is schema-tolerant (sha256 or sha256\_file)



Chroma may return embeddings as NumPy arrays

→ never use array or \[] (must check is None explicitly)



Command



python3 scripts/ingest/verify\_ingest.py \\

&nbsp; --root /home/dalton/projects/claudeflow-testing/corpus \\

&nbsp; --manifest scripts/ingest/manifest.jsonl \\

&nbsp; --chroma\_dir vector\_db\_1536 \\

&nbsp; --collection knowledge\_chunks





Expected result



\[OK] <each pdf>

--- VERIFY REPORT (OK) ---

OK=N FAIL=0 TOTAL=N



3.2 Audit Utility



Script



scripts/ingest/audit\_ingest.py





What it reports

Classifies corpus PDFs into:



PHASE0\_ONLY



PHASE1\_ONLY



PHASE2\_FAILED



PHASE2\_COMPLETE



SHA\_MISMATCH



MANIFEST\_BROKEN



Audit touches



Filesystem



Manifest only

(No Chroma access)



Command



python3 scripts/ingest/audit\_ingest.py \\

&nbsp; --root /home/dalton/projects/claudeflow-testing/corpus \\

&nbsp; --manifest scripts/ingest/manifest.jsonl





Expected result (current state)



\[PHASE2\_COMPLETE] (4)



3.3 One-Command Health Check



Script



scripts/ingest/healthcheck.sh





Runs:



Audit



Verify



Command



./scripts/ingest/healthcheck.sh \\

&nbsp; --root /home/dalton/projects/claudeflow-testing/corpus \\

&nbsp; --manifest scripts/ingest/manifest.jsonl \\

&nbsp; --chroma\_dir vector\_db\_1536 \\

&nbsp; --collection knowledge\_chunks





If this exits 0, the system is provably correct.



4\. Known Pitfalls (Now Solved)



❌ Assuming manifest key sha256\_file



✅ Correct key is sha256



❌ Using array or \[] with NumPy embeddings



✅ Must check is None explicitly



❌ Letting Phase 1 records block Phase 2



✅ Phase-aware skip logic fixes this



These fixes are now baked into Phase 3 tooling.



5\. Phase Boundary Guarantee



After Phase 3 passes:



Every vector is traceable to:



exact file bytes



exact page range



exact chunk ID



Restarting is safe



Scaling corpus size will not introduce silent corruption



Retrieval and synthesis can rely on citations without guessing



6\. Next Phase (Not Started)



Phase 4 — Retrieval-Time Filtering \& Synthesis



Will add:



Query embedding



Similarity retrieval



Citation-aware outputs



Page-accurate references



No changes to ingestion or embeddings are required.

