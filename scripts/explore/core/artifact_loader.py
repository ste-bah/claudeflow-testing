"""
Phase 11 Artifact Loader - Read-only access to Phase 1-9 artifacts

This module provides immutable access to:
- Knowledge Units (god-learn/knowledge.jsonl)
- Reasoning Units (god-reason/reasoning.jsonl)
- Chunk metadata (via chunk_id lookups)

Architectural Invariants:
- Pure read-only operations (no mutations)
- Explicit error handling (no silent failures)
- Performance: O(1) lookups via index building
- Provenance chains fully traceable
"""

import json
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple
from dataclasses import dataclass, field
from collections import defaultdict


@dataclass
class Source:
    """Single source citation for a knowledge unit."""
    author: str
    title: str
    path_rel: str
    pages: str
    chunk_id: str

    @classmethod
    def from_dict(cls, data: dict) -> 'Source':
        return cls(
            author=data['author'],
            title=data['title'],
            path_rel=data['path_rel'],
            pages=data['pages'],
            chunk_id=data['chunk_id']
        )


@dataclass
class KnowledgeUnit:
    """Knowledge Unit (KU) from Phase 6."""
    id: str
    claim: str
    sources: List[Source]
    confidence: str
    tags: List[str]
    created_from_query: str
    debug: dict = field(default_factory=dict)

    @classmethod
    def from_dict(cls, data: dict) -> 'KnowledgeUnit':
        return cls(
            id=data['id'],
            claim=data['claim'],
            sources=[Source.from_dict(s) for s in data.get('sources', [])],
            confidence=data.get('confidence', 'unknown'),
            tags=data.get('tags', []),
            created_from_query=data.get('created_from_query', ''),
            debug=data.get('debug', {})
        )

    def get_chunk_ids(self) -> Set[str]:
        """Extract all chunk IDs referenced by this KU."""
        return {source.chunk_id for source in self.sources}

    def get_documents(self) -> Set[str]:
        """Extract all document paths referenced by this KU."""
        return {source.path_rel for source in self.sources}


@dataclass
class Evidence:
    """Evidence for a reasoning unit (embedded KU)."""
    ku_id: str
    claim: str
    sources: List[Source]

    @classmethod
    def from_dict(cls, data: dict) -> 'Evidence':
        return cls(
            ku_id=data['ku_id'],
            claim=data['claim'],
            sources=[Source.from_dict(s) for s in data.get('sources', [])]
        )


@dataclass
class ReasoningUnit:
    """Reasoning Unit (RU) from Phase 7."""
    reason_id: str
    relation: str  # conflict, support, elaboration, etc.
    topic: str
    knowledge_ids: List[str]
    evidence: List[Evidence]
    score: float
    hash: str
    llm: dict = field(default_factory=dict)
    shared_ngrams_count: int = 0
    shared_ngrams_sample: List[str] = field(default_factory=list)

    @classmethod
    def from_dict(cls, data: dict) -> 'ReasoningUnit':
        return cls(
            reason_id=data['reason_id'],
            relation=data['relation'],
            topic=data.get('topic', 'unknown'),
            knowledge_ids=data['knowledge_ids'],
            evidence=[Evidence.from_dict(e) for e in data.get('evidence', [])],
            score=data.get('score', 0.0),
            hash=data.get('hash', ''),
            llm=data.get('llm', {}),
            shared_ngrams_count=data.get('shared_ngrams_count', 0),
            shared_ngrams_sample=data.get('shared_ngrams_sample', [])
        )


class ArtifactLoader:
    """
    Read-only loader for Phase 1-9 artifacts.

    Performance:
    - Lazy loading: Files read on first access
    - O(1) lookups: All artifacts indexed by ID
    - Memory efficient: Can filter/paginate for large corpora
    """

    def __init__(self, project_root: Optional[Path] = None):
        if project_root is None:
            project_root = Path(__file__).parent.parent.parent.parent

        self.project_root = Path(project_root)
        self.knowledge_path = self.project_root / "god-learn" / "knowledge.jsonl"
        self.reasoning_path = self.project_root / "god-reason" / "reasoning.jsonl"

        # Lazy-loaded caches
        self._knowledge_units: Optional[Dict[str, KnowledgeUnit]] = None
        self._reasoning_units: Optional[Dict[str, ReasoningUnit]] = None

        # Indexes for fast lookup
        self._ku_by_query: Optional[Dict[str, List[str]]] = None
        self._ku_by_document: Optional[Dict[str, List[str]]] = None
        self._ku_by_chunk: Optional[Dict[str, List[str]]] = None
        self._ru_by_relation: Optional[Dict[str, List[str]]] = None
        self._ru_by_ku: Optional[Dict[str, List[str]]] = None

    def _load_knowledge_units(self) -> Dict[str, KnowledgeUnit]:
        """Load all knowledge units from JSONL file."""
        if not self.knowledge_path.exists():
            raise FileNotFoundError(
                f"Knowledge file not found: {self.knowledge_path}\n"
                "Have you run Phase 6 (god-learn compile)?"
            )

        units = {}
        with open(self.knowledge_path, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f, start=1):
                try:
                    data = json.loads(line)
                    ku = KnowledgeUnit.from_dict(data)
                    units[ku.id] = ku
                except json.JSONDecodeError as e:
                    raise ValueError(f"Invalid JSON at line {line_num}: {e}")
                except KeyError as e:
                    raise ValueError(f"Missing required field at line {line_num}: {e}")

        return units

    def _load_reasoning_units(self) -> Dict[str, ReasoningUnit]:
        """Load all reasoning units from JSONL file."""
        if not self.reasoning_path.exists():
            # Reasoning units are optional (Phase 7 may not be run yet)
            return {}

        units = {}
        with open(self.reasoning_path, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f, start=1):
                try:
                    data = json.loads(line)
                    ru = ReasoningUnit.from_dict(data)
                    units[ru.reason_id] = ru
                except json.JSONDecodeError as e:
                    raise ValueError(f"Invalid JSON at line {line_num}: {e}")
                except KeyError as e:
                    raise ValueError(f"Missing required field at line {line_num}: {e}")

        return units

    def _build_indexes(self):
        """Build indexes for fast lookups."""
        if self._knowledge_units is None:
            self._knowledge_units = self._load_knowledge_units()

        if self._reasoning_units is None:
            self._reasoning_units = self._load_reasoning_units()

        # Build KU indexes
        self._ku_by_query = defaultdict(list)
        self._ku_by_document = defaultdict(list)
        self._ku_by_chunk = defaultdict(list)

        for ku_id, ku in self._knowledge_units.items():
            # Index by query
            query = ku.created_from_query.lower()
            self._ku_by_query[query].append(ku_id)

            # Index by document
            for doc in ku.get_documents():
                self._ku_by_document[doc].append(ku_id)

            # Index by chunk
            for chunk_id in ku.get_chunk_ids():
                self._ku_by_chunk[chunk_id].append(ku_id)

        # Build RU indexes
        self._ru_by_relation = defaultdict(list)
        self._ru_by_ku = defaultdict(list)

        for ru_id, ru in self._reasoning_units.items():
            # Index by relation type
            self._ru_by_relation[ru.relation].append(ru_id)

            # Index by knowledge unit
            for ku_id in ru.knowledge_ids:
                self._ru_by_ku[ku_id].append(ru_id)

    # === Knowledge Unit Access ===

    def get_all_kus(self) -> Dict[str, KnowledgeUnit]:
        """Get all knowledge units. O(1) after first load."""
        if self._knowledge_units is None:
            self._knowledge_units = self._load_knowledge_units()
        return self._knowledge_units

    def get_ku(self, ku_id: str) -> Optional[KnowledgeUnit]:
        """Get a single knowledge unit by ID."""
        return self.get_all_kus().get(ku_id)

    def get_kus_by_query(self, query: str) -> List[KnowledgeUnit]:
        """Get all KUs created from a specific query."""
        if self._ku_by_query is None:
            self._build_indexes()

        query_lower = query.lower()
        ku_ids = self._ku_by_query.get(query_lower, [])
        return [self.get_ku(ku_id) for ku_id in ku_ids]

    def get_kus_by_document(self, doc_path: str) -> List[KnowledgeUnit]:
        """Get all KUs that reference a specific document."""
        if self._ku_by_document is None:
            self._build_indexes()

        ku_ids = self._ku_by_document.get(doc_path, [])
        return [self.get_ku(ku_id) for ku_id in ku_ids]

    def get_kus_by_chunk(self, chunk_id: str) -> List[KnowledgeUnit]:
        """Get all KUs that reference a specific chunk."""
        if self._ku_by_chunk is None:
            self._build_indexes()

        ku_ids = self._ku_by_chunk.get(chunk_id, [])
        return [self.get_ku(ku_id) for ku_id in ku_ids]

    def filter_kus(
        self,
        query: Optional[str] = None,
        confidence: Optional[str] = None,
        min_sources: int = 0,
        tags: Optional[List[str]] = None
    ) -> List[KnowledgeUnit]:
        """Filter KUs by various criteria."""
        kus = list(self.get_all_kus().values())

        if query:
            query_lower = query.lower()
            kus = [ku for ku in kus if query_lower in ku.created_from_query.lower()]

        if confidence:
            kus = [ku for ku in kus if ku.confidence == confidence]

        if min_sources > 0:
            kus = [ku for ku in kus if len(ku.sources) >= min_sources]

        if tags:
            tag_set = set(tags)
            kus = [ku for ku in kus if tag_set.intersection(ku.tags)]

        return kus

    # === Reasoning Unit Access ===

    def get_all_rus(self) -> Dict[str, ReasoningUnit]:
        """Get all reasoning units. O(1) after first load."""
        if self._reasoning_units is None:
            self._reasoning_units = self._load_reasoning_units()
        return self._reasoning_units

    def get_ru(self, ru_id: str) -> Optional[ReasoningUnit]:
        """Get a single reasoning unit by ID."""
        return self.get_all_rus().get(ru_id)

    def get_rus_by_relation(self, relation: str) -> List[ReasoningUnit]:
        """Get all RUs with a specific relation type (conflict, support, etc.)."""
        if self._ru_by_relation is None:
            self._build_indexes()

        ru_ids = self._ru_by_relation.get(relation, [])
        return [self.get_ru(ru_id) for ru_id in ru_ids]

    def get_rus_for_ku(self, ku_id: str) -> List[ReasoningUnit]:
        """Get all reasoning units that reference a specific KU."""
        if self._ru_by_ku is None:
            self._build_indexes()

        ru_ids = self._ru_by_ku.get(ku_id, [])
        return [self.get_ru(ru_id) for ru_id in ru_ids]

    def filter_rus(
        self,
        relation: Optional[str] = None,
        min_score: float = 0.0,
        topic: Optional[str] = None
    ) -> List[ReasoningUnit]:
        """Filter RUs by various criteria."""
        rus = list(self.get_all_rus().values())

        if relation:
            rus = [ru for ru in rus if ru.relation == relation]

        if min_score > 0:
            rus = [ru for ru in rus if ru.score >= min_score]

        if topic:
            rus = [ru for ru in rus if ru.topic == topic]

        return rus

    # === Statistics ===

    def get_stats(self) -> dict:
        """Get statistics about loaded artifacts."""
        kus = self.get_all_kus()
        rus = self.get_all_rus()

        if not kus:
            return {"error": "No knowledge units found"}

        # KU statistics
        total_sources = sum(len(ku.sources) for ku in kus.values())
        queries = set(ku.created_from_query for ku in kus.values())
        documents = set()
        chunks = set()

        for ku in kus.values():
            documents.update(ku.get_documents())
            chunks.update(ku.get_chunk_ids())

        # RU statistics
        relations = defaultdict(int)
        for ru in rus.values():
            relations[ru.relation] += 1

        return {
            "knowledge_units": {
                "total": len(kus),
                "total_sources": total_sources,
                "avg_sources_per_ku": total_sources / len(kus) if kus else 0,
                "unique_queries": len(queries),
                "unique_documents": len(documents),
                "unique_chunks": len(chunks)
            },
            "reasoning_units": {
                "total": len(rus),
                "by_relation": dict(relations)
            }
        }

    # === Provenance Tracing ===

    def trace_provenance(self, ku_id: str) -> dict:
        """
        Trace full provenance chain for a knowledge unit.

        Returns:
            {
                "ku": KnowledgeUnit,
                "sources": [...],
                "reasoning_units": [...],
                "documents": [...]
            }
        """
        ku = self.get_ku(ku_id)
        if not ku:
            return {"error": f"Knowledge unit not found: {ku_id}"}

        # Get all reasoning units that reference this KU
        rus = self.get_rus_for_ku(ku_id)

        # Get all related KUs through reasoning units
        related_ku_ids = set()
        for ru in rus:
            related_ku_ids.update(ru.knowledge_ids)
        related_ku_ids.discard(ku_id)  # Remove self

        related_kus = [self.get_ku(related_id) for related_id in related_ku_ids]
        related_kus = [ku for ku in related_kus if ku is not None]

        return {
            "ku": ku,
            "sources": ku.sources,
            "reasoning_units": rus,
            "related_kus": related_kus,
            "documents": list(ku.get_documents()),
            "chunk_ids": list(ku.get_chunk_ids())
        }
