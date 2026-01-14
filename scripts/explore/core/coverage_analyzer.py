"""
Phase 11 Coverage Analyzer - Query × Document Coverage Heatmaps

Analyzes coverage patterns to identify:
- Which documents cover which queries
- Coverage gaps (queries with few sources)
- Coverage overlaps (queries citing same documents)
- Document utilization (which PDFs are most/least cited)
- Query diversity (breadth of topics covered)

Output Formats:
- Terminal ASCII heatmap
- HTML interactive heatmap
- JSON data for external visualization
- CSV for spreadsheet analysis
"""

import json
from pathlib import Path
from typing import Dict, List, Set, Tuple, Optional
from collections import defaultdict
from dataclasses import dataclass, field

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.artifact_loader import ArtifactLoader


@dataclass
class CoverageCell:
    """Single cell in coverage matrix."""
    query: str
    document: str
    ku_count: int
    ku_ids: List[str] = field(default_factory=list)
    confidence_dist: Dict[str, int] = field(default_factory=dict)  # high/medium/low counts


@dataclass
class CoverageMatrix:
    """Query × Document coverage matrix."""
    queries: List[str]
    documents: List[str]
    cells: Dict[Tuple[str, str], CoverageCell]  # (query, doc) -> cell

    def get_cell(self, query: str, document: str) -> Optional[CoverageCell]:
        """Get a specific cell from the matrix."""
        return self.cells.get((query, document))

    def get_query_coverage(self, query: str) -> List[CoverageCell]:
        """Get all documents covering a specific query."""
        return [cell for (q, _), cell in self.cells.items() if q == query]

    def get_document_coverage(self, document: str) -> List[CoverageCell]:
        """Get all queries covered by a specific document."""
        return [cell for (_, d), cell in self.cells.items() if d == document]

    def get_coverage_score(self, query: str, document: str) -> float:
        """Get normalized coverage score [0-1] for a query-document pair."""
        cell = self.get_cell(query, document)
        if not cell:
            return 0.0

        # Weight by confidence: high=1.0, medium=0.5, low=0.25
        weighted_count = (
            cell.confidence_dist.get('high', 0) * 1.0 +
            cell.confidence_dist.get('medium', 0) * 0.5 +
            cell.confidence_dist.get('low', 0) * 0.25
        )

        # Normalize by max observed KU count across all cells
        max_count = max(c.ku_count for c in self.cells.values())
        return min(weighted_count / max(max_count, 1), 1.0)

    def to_dict(self) -> dict:
        """Export to dictionary format."""
        return {
            'queries': self.queries,
            'documents': self.documents,
            'cells': [
                {
                    'query': cell.query,
                    'document': cell.document,
                    'ku_count': cell.ku_count,
                    'ku_ids': cell.ku_ids,
                    'confidence_dist': cell.confidence_dist
                }
                for cell in self.cells.values()
            ]
        }


class CoverageAnalyzer:
    """
    Analyze query × document coverage patterns.

    Identifies:
    - Coverage gaps: Queries with few document sources
    - Coverage overlaps: Multiple queries citing same docs
    - Document utilization: Which PDFs are most/least used
    - Query diversity: Breadth of topics covered
    """

    def __init__(self, loader: ArtifactLoader):
        self.loader = loader

    def build_coverage_matrix(self) -> CoverageMatrix:
        """
        Build query × document coverage matrix.

        Returns:
            CoverageMatrix with all query-document pairs
        """
        kus = self.loader.get_all_kus()

        # Collect unique queries and documents
        queries = set()
        documents = set()

        # Build cells
        cells = {}

        for ku in kus.values():
            query = ku.created_from_query
            queries.add(query)

            for source in ku.sources:
                doc = source.path_rel
                documents.add(doc)

                # Get or create cell
                key = (query, doc)
                if key not in cells:
                    cells[key] = CoverageCell(
                        query=query,
                        document=doc,
                        ku_count=0,
                        ku_ids=[],
                        confidence_dist={'high': 0, 'medium': 0, 'low': 0}
                    )

                # Update cell
                cell = cells[key]
                cell.ku_count += 1
                cell.ku_ids.append(ku.id)
                cell.confidence_dist[ku.confidence] = cell.confidence_dist.get(ku.confidence, 0) + 1

        return CoverageMatrix(
            queries=sorted(queries),
            documents=sorted(documents),
            cells=cells
        )

    def find_coverage_gaps(self, matrix: CoverageMatrix, min_sources: int = 2) -> List[dict]:
        """
        Find queries with insufficient document coverage.

        Args:
            matrix: Coverage matrix
            min_sources: Minimum number of documents expected per query

        Returns:
            List of gaps with query, document count, and recommendations
        """
        gaps = []

        for query in matrix.queries:
            cells = matrix.get_query_coverage(query)
            doc_count = len(set(cell.document for cell in cells))
            ku_count = sum(cell.ku_count for cell in cells)

            if doc_count < min_sources:
                gaps.append({
                    'query': query,
                    'document_count': doc_count,
                    'ku_count': ku_count,
                    'severity': 'critical' if doc_count == 0 else 'high' if doc_count == 1 else 'medium',
                    'recommendation': f'Add {min_sources - doc_count} more documents covering this query'
                })

        return sorted(gaps, key=lambda x: x['document_count'])

    def find_coverage_overlaps(self, matrix: CoverageMatrix) -> List[dict]:
        """
        Find queries that heavily cite the same documents.

        Returns:
            List of overlapping query pairs with shared documents
        """
        overlaps = []

        # For each pair of queries
        for i, q1 in enumerate(matrix.queries):
            for q2 in matrix.queries[i+1:]:
                # Get documents for each query
                docs1 = set(cell.document for cell in matrix.get_query_coverage(q1))
                docs2 = set(cell.document for cell in matrix.get_query_coverage(q2))

                # Find overlap
                shared = docs1 & docs2

                if shared:
                    overlap_ratio = len(shared) / max(len(docs1), len(docs2))
                    overlaps.append({
                        'query1': q1,
                        'query2': q2,
                        'shared_documents': sorted(shared),
                        'shared_count': len(shared),
                        'overlap_ratio': overlap_ratio,
                        'interpretation': self._interpret_overlap(overlap_ratio)
                    })

        return sorted(overlaps, key=lambda x: x['overlap_ratio'], reverse=True)

    def _interpret_overlap(self, ratio: float) -> str:
        """Interpret overlap ratio."""
        if ratio >= 0.8:
            return 'Very high overlap - queries may be redundant'
        elif ratio >= 0.5:
            return 'High overlap - queries cover similar topics'
        elif ratio >= 0.3:
            return 'Moderate overlap - some thematic connection'
        else:
            return 'Low overlap - queries are distinct'

    def analyze_document_utilization(self, matrix: CoverageMatrix) -> List[dict]:
        """
        Analyze how documents are utilized across queries.

        Returns:
            List of documents with utilization metrics
        """
        utilization = []

        for doc in matrix.documents:
            cells = matrix.get_document_coverage(doc)
            query_count = len(set(cell.query for cell in cells))
            ku_count = sum(cell.ku_count for cell in cells)

            # Calculate confidence distribution
            total_high = sum(cell.confidence_dist.get('high', 0) for cell in cells)
            total_medium = sum(cell.confidence_dist.get('medium', 0) for cell in cells)
            total_low = sum(cell.confidence_dist.get('low', 0) for cell in cells)

            utilization.append({
                'document': doc,
                'query_count': query_count,
                'ku_count': ku_count,
                'confidence_dist': {
                    'high': total_high,
                    'medium': total_medium,
                    'low': total_low
                },
                'utilization_score': query_count * ku_count,  # Simple metric
                'assessment': self._assess_utilization(query_count, ku_count)
            })

        return sorted(utilization, key=lambda x: x['utilization_score'], reverse=True)

    def _assess_utilization(self, query_count: int, ku_count: int) -> str:
        """Assess document utilization level."""
        if query_count == 0:
            return 'Unused - document not cited'
        elif query_count == 1 and ku_count < 3:
            return 'Under-utilized - cited by only 1 query'
        elif query_count >= 3:
            return 'Well-utilized - cited by multiple queries'
        else:
            return 'Moderately utilized'

    def generate_heatmap_ascii(self, matrix: CoverageMatrix, max_width: int = 120) -> str:
        """
        Generate ASCII heatmap for terminal display.

        Args:
            matrix: Coverage matrix
            max_width: Maximum terminal width

        Returns:
            ASCII art heatmap
        """
        lines = []

        # Truncate document names for display
        doc_names = [self._truncate_doc_name(doc) for doc in matrix.documents]
        max_doc_len = max(len(name) for name in doc_names)
        max_query_len = max(len(q) for q in matrix.queries)

        # Header
        lines.append('Coverage Heatmap: Queries × Documents')
        lines.append('=' * min(max_width, max_query_len + max_doc_len + 20))
        lines.append('')

        # Column headers (documents)
        header = ' ' * (max_query_len + 2)
        for doc_name in doc_names:
            header += f'{doc_name[:10]:^12}'
        lines.append(header[:max_width])
        lines.append('-' * min(len(header), max_width))

        # Rows (queries)
        for query in matrix.queries:
            row = f'{query[:max_query_len]:<{max_query_len}}  '

            for doc in matrix.documents:
                cell = matrix.get_cell(query, doc)
                if cell and cell.ku_count > 0:
                    # Use symbols to represent coverage intensity
                    if cell.ku_count >= 5:
                        symbol = '████'
                    elif cell.ku_count >= 3:
                        symbol = '███ '
                    elif cell.ku_count >= 2:
                        symbol = '██  '
                    else:
                        symbol = '█   '
                    row += f'{symbol:^12}'
                else:
                    row += '    ·       '

            lines.append(row[:max_width])

        # Legend
        lines.append('')
        lines.append('Legend: █ = 1 KU, ██ = 2 KUs, ███ = 3-4 KUs, ████ = 5+ KUs, · = no coverage')

        return '\n'.join(lines)

    def _truncate_doc_name(self, doc_path: str, max_len: int = 30) -> str:
        """Truncate document path for display."""
        # Extract just the filename
        filename = Path(doc_path).name

        # Remove common prefixes
        filename = filename.replace('rhetorical_ontology/', '')

        # Truncate if too long
        if len(filename) > max_len:
            return filename[:max_len-3] + '...'

        return filename

    def generate_heatmap_html(self, matrix: CoverageMatrix, output_path: Path):
        """
        Generate interactive HTML heatmap.

        Args:
            matrix: Coverage matrix
            output_path: Output HTML file path
        """
        html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Phase 11 Coverage Heatmap</title>
    <style>
        body {{
            font-family: Arial, sans-serif;
            margin: 20px;
            background: #f5f5f5;
        }}
        h1 {{
            color: #333;
        }}
        .heatmap {{
            background: white;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            overflow-x: auto;
        }}
        table {{
            border-collapse: collapse;
            margin: 20px 0;
        }}
        th, td {{
            padding: 12px;
            text-align: center;
            border: 1px solid #ddd;
        }}
        th {{
            background: #2196F3;
            color: white;
            font-weight: bold;
            position: sticky;
            top: 0;
        }}
        td.query {{
            background: #E3F2FD;
            font-weight: bold;
            text-align: left;
        }}
        td.cell {{
            cursor: pointer;
            transition: all 0.2s;
        }}
        td.cell:hover {{
            transform: scale(1.1);
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        }}
        .coverage-0 {{ background: #fff; }}
        .coverage-1 {{ background: #BBDEFB; }}
        .coverage-2 {{ background: #90CAF9; }}
        .coverage-3 {{ background: #64B5F6; }}
        .coverage-4 {{ background: #42A5F5; }}
        .coverage-5 {{ background: #2196F3; color: white; }}
        .stats {{
            margin: 20px 0;
            padding: 15px;
            background: #E8F5E9;
            border-radius: 4px;
        }}
        .legend {{
            margin: 20px 0;
            padding: 15px;
            background: #FFF3E0;
            border-radius: 4px;
        }}
        .legend-item {{
            display: inline-block;
            margin: 5px 10px;
        }}
        .legend-box {{
            display: inline-block;
            width: 30px;
            height: 20px;
            border: 1px solid #ddd;
            vertical-align: middle;
            margin-right: 5px;
        }}
    </style>
</head>
<body>
    <h1>📊 Phase 11 Coverage Heatmap</h1>
    <p>Query × Document Coverage Matrix</p>

    <div class="stats">
        <strong>Statistics:</strong><br>
        Queries: {len(matrix.queries)} |
        Documents: {len(matrix.documents)} |
        Total KUs: {sum(cell.ku_count for cell in matrix.cells.values())} |
        Coverage Cells: {len([c for c in matrix.cells.values() if c.ku_count > 0])} / {len(matrix.queries) * len(matrix.documents)}
    </div>

    <div class="legend">
        <strong>Legend:</strong>
        <div class="legend-item">
            <span class="legend-box coverage-0"></span> 0 KUs
        </div>
        <div class="legend-item">
            <span class="legend-box coverage-1"></span> 1 KU
        </div>
        <div class="legend-item">
            <span class="legend-box coverage-2"></span> 2 KUs
        </div>
        <div class="legend-item">
            <span class="legend-box coverage-3"></span> 3 KUs
        </div>
        <div class="legend-item">
            <span class="legend-box coverage-4"></span> 4 KUs
        </div>
        <div class="legend-item">
            <span class="legend-box coverage-5"></span> 5+ KUs
        </div>
    </div>

    <div class="heatmap">
        <table>
            <thead>
                <tr>
                    <th>Query</th>
"""

        # Document headers
        for doc in matrix.documents:
            doc_name = self._truncate_doc_name(doc, max_len=20)
            html += f'                    <th title="{doc}">{doc_name}</th>\n'

        html += """                </tr>
            </thead>
            <tbody>
"""

        # Rows
        for query in matrix.queries:
            html += f'                <tr>\n'
            html += f'                    <td class="query">{query}</td>\n'

            for doc in matrix.documents:
                cell = matrix.get_cell(query, doc)
                count = cell.ku_count if cell else 0

                # Determine coverage class
                if count == 0:
                    css_class = 'coverage-0'
                elif count >= 5:
                    css_class = 'coverage-5'
                else:
                    css_class = f'coverage-{count}'

                # Build tooltip
                if cell:
                    tooltip = f"Query: {query}\\nDocument: {doc}\\nKUs: {count}\\nKU IDs: {', '.join(cell.ku_ids)}"
                else:
                    tooltip = f"No coverage"

                html += f'                    <td class="cell {css_class}" title="{tooltip}">{count if count > 0 else ""}</td>\n'

            html += '                </tr>\n'

        html += """            </tbody>
        </table>
    </div>

    <script>
        // Add click handler to show KU IDs
        document.querySelectorAll('td.cell').forEach(cell => {
            cell.addEventListener('click', () => {
                alert(cell.title);
            });
        });
    </script>
</body>
</html>
"""

        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(html)

    def export_coverage_json(self, matrix: CoverageMatrix, output_path: Path):
        """Export coverage data as JSON."""
        data = matrix.to_dict()

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)

    def export_coverage_csv(self, matrix: CoverageMatrix, output_path: Path):
        """Export coverage data as CSV."""
        import csv

        with open(output_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)

            # Header
            writer.writerow(['Query'] + matrix.documents)

            # Rows
            for query in matrix.queries:
                row = [query]
                for doc in matrix.documents:
                    cell = matrix.get_cell(query, doc)
                    row.append(cell.ku_count if cell else 0)
                writer.writerow(row)
