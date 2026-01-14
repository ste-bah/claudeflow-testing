"""
Phase 11 Visualization Exporters

Export knowledge graphs to various visualization formats:
- GraphViz DOT: Publication-quality static graphs
- Cytoscape JSON: Interactive network analysis
- D3.js JSON: Web-based interactive visualizations
- Mermaid: Markdown-embeddable diagrams
"""

import json
from typing import Dict, List, Optional, Set
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.graph_builder import KnowledgeGraph, Node, Edge


class GraphVizExporter:
    """
    Export to GraphViz DOT format for static graph rendering.

    Usage:
        dot -Tpng graph.dot -o graph.png
        dot -Tsvg graph.dot -o graph.svg
        dot -Tpdf graph.dot -o graph.pdf
    """

    def __init__(self, graph: KnowledgeGraph):
        self.graph = graph

    def export(
        self,
        output_path: Path,
        layout: str = 'dot',
        node_colors: Optional[Dict[str, str]] = None,
        edge_colors: Optional[Dict[str, str]] = None
    ):
        """
        Export graph to DOT format.

        Args:
            output_path: Output file path
            layout: Layout algorithm (dot, neato, fdp, sfdp, circo, twopi)
            node_colors: Mapping of node types to colors
            edge_colors: Mapping of edge relations to colors
        """
        # Default colors
        if node_colors is None:
            node_colors = {
                'ku': '#E3F2FD',  # Light blue
                'reasoning': '#FFF3E0',  # Light orange
                'document': '#E8F5E9',  # Light green
                'chunk': '#F3E5F5',  # Light purple
                'query': '#FFEBEE'  # Light red
            }

        if edge_colors is None:
            edge_colors = {
                'conflict': '#F44336',  # Red
                'support': '#4CAF50',  # Green
                'elaboration': '#2196F3',  # Blue
                'cites': '#9C27B0',  # Purple
                'created': '#FF9800',  # Orange
                'contained_in': '#607D8B',  # Blue grey
                'participates_in': '#FFC107'  # Amber
            }

        # Build DOT content
        lines = []
        lines.append(f'digraph KnowledgeGraph {{')
        lines.append(f'  layout={layout};')
        lines.append(f'  overlap=false;')
        lines.append(f'  splines=true;')
        lines.append(f'  node [shape=box, style=filled, fontname="Arial"];')
        lines.append(f'  edge [fontname="Arial", fontsize=10];')
        lines.append('')

        # Add nodes
        for node in self.graph.nodes.values():
            node_id = self._escape(node.id)
            label = self._escape(self._truncate(node.label, 80))
            color = node_colors.get(node.type, '#FFFFFF')

            shape = 'box'
            if node.type == 'query':
                shape = 'ellipse'
            elif node.type == 'document':
                shape = 'folder'
            elif node.type == 'reasoning':
                shape = 'diamond'

            lines.append(f'  "{node_id}" [label="{label}", fillcolor="{color}", shape={shape}];')

        lines.append('')

        # Add edges
        for edge in self.graph.edges:
            source = self._escape(edge.source)
            target = self._escape(edge.target)
            label = edge.relation
            color = edge_colors.get(edge.relation, '#000000')

            # Add score to label if available
            if 'score' in edge.attributes:
                score = edge.attributes['score']
                label = f"{label}\\n({score:.3f})"

            lines.append(f'  "{source}" -> "{target}" [label="{label}", color="{color}"];')

        lines.append('}')

        # Write to file
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))

    def _escape(self, text: str) -> str:
        """Escape special characters for DOT format."""
        return text.replace('"', '\\"').replace('\n', '\\n')

    def _truncate(self, text: str, max_len: int) -> str:
        """Truncate text to max length."""
        if len(text) <= max_len:
            return text
        return text[:max_len-3] + '...'


class CytoscapeExporter:
    """
    Export to Cytoscape JSON format for interactive network analysis.

    Cytoscape Desktop can import this format directly.
    """

    def __init__(self, graph: KnowledgeGraph):
        self.graph = graph

    def export(self, output_path: Path):
        """Export graph to Cytoscape JSON format."""
        elements = []

        # Add nodes
        for node in self.graph.nodes.values():
            element = {
                'data': {
                    'id': node.id,
                    'label': node.label,
                    'type': node.type,
                    **node.attributes
                },
                'group': 'nodes'
            }
            elements.append(element)

        # Add edges
        for i, edge in enumerate(self.graph.edges):
            element = {
                'data': {
                    'id': f'edge_{i}',
                    'source': edge.source,
                    'target': edge.target,
                    'label': edge.relation,
                    'relation': edge.relation,
                    **edge.attributes
                },
                'group': 'edges'
            }
            elements.append(element)

        # Create Cytoscape JSON
        cytoscape_json = {
            'format_version': '1.0',
            'generated_by': 'god-explore Phase 11',
            'target_cytoscapejs_version': '~3.20',
            'data': {},
            'elements': elements
        }

        # Add style
        cytoscape_json['style'] = self._create_style()

        # Write to file
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(cytoscape_json, f, indent=2)

    def _create_style(self) -> List[dict]:
        """Create Cytoscape style definitions."""
        return [
            {
                'selector': 'node',
                'style': {
                    'label': 'data(label)',
                    'width': 30,
                    'height': 30,
                    'text-valign': 'center',
                    'text-halign': 'center',
                    'background-color': '#0074D9',
                    'color': '#333',
                    'font-size': 10
                }
            },
            {
                'selector': 'node[type = "ku"]',
                'style': {
                    'background-color': '#2196F3',
                    'shape': 'rectangle'
                }
            },
            {
                'selector': 'node[type = "reasoning"]',
                'style': {
                    'background-color': '#FF9800',
                    'shape': 'diamond'
                }
            },
            {
                'selector': 'node[type = "document"]',
                'style': {
                    'background-color': '#4CAF50',
                    'shape': 'hexagon'
                }
            },
            {
                'selector': 'node[type = "query"]',
                'style': {
                    'background-color': '#F44336',
                    'shape': 'ellipse'
                }
            },
            {
                'selector': 'edge',
                'style': {
                    'label': 'data(label)',
                    'width': 2,
                    'line-color': '#9E9E9E',
                    'target-arrow-color': '#9E9E9E',
                    'target-arrow-shape': 'triangle',
                    'curve-style': 'bezier',
                    'font-size': 8
                }
            },
            {
                'selector': 'edge[relation = "conflict"]',
                'style': {
                    'line-color': '#F44336',
                    'target-arrow-color': '#F44336'
                }
            },
            {
                'selector': 'edge[relation = "support"]',
                'style': {
                    'line-color': '#4CAF50',
                    'target-arrow-color': '#4CAF50'
                }
            },
            {
                'selector': 'edge[relation = "elaboration"]',
                'style': {
                    'line-color': '#2196F3',
                    'target-arrow-color': '#2196F3'
                }
            }
        ]


class D3Exporter:
    """
    Export to D3.js force-directed graph format.

    Output can be used directly with D3.js force layout.
    """

    def __init__(self, graph: KnowledgeGraph):
        self.graph = graph

    def export(self, output_path: Path):
        """Export graph to D3.js JSON format."""
        # Build node list with indices
        nodes = []
        node_index = {}

        for i, node in enumerate(self.graph.nodes.values()):
            nodes.append({
                'id': node.id,
                'label': node.label,
                'type': node.type,
                'attributes': node.attributes
            })
            node_index[node.id] = i

        # Build edge list with source/target IDs (string format for D3.js)
        links = []
        for edge in self.graph.edges:
            links.append({
                'source': edge.source,
                'target': edge.target,
                'relation': edge.relation,
                'attributes': edge.attributes
            })

        # Create D3 JSON
        d3_json = {
            'nodes': nodes,
            'links': links,
            'metadata': {
                'node_count': len(nodes),
                'edge_count': len(links),
                'generated_by': 'god-explore Phase 11'
            }
        }

        # Write to file
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(d3_json, f, indent=2)


class MermaidExporter:
    """
    Export to Mermaid diagram format for markdown embedding.

    Can be rendered in GitHub, GitLab, and many markdown viewers.
    """

    def __init__(self, graph: KnowledgeGraph):
        self.graph = graph

    def export(self, output_path: Path):
        """Export graph to Mermaid format."""
        lines = []
        lines.append('```mermaid')
        lines.append('graph TB')
        lines.append('')

        # Create node ID mapping (Mermaid doesn't like colons in IDs)
        node_map = {}
        for i, node_id in enumerate(self.graph.nodes.keys()):
            node_map[node_id] = f'N{i}'

        # Add nodes with labels
        for node_id, node in self.graph.nodes.items():
            mermaid_id = node_map[node_id]
            label = self._truncate(node.label, 50)

            # Choose shape based on type
            if node.type == 'ku':
                lines.append(f'  {mermaid_id}["{label}"]')
            elif node.type == 'reasoning':
                lines.append(f'  {mermaid_id}{{{"{label}"}}}')
            elif node.type == 'document':
                lines.append(f'  {mermaid_id}(["{label}"])')
            elif node.type == 'query':
                lines.append(f'  {mermaid_id}(("{label}"))')
            else:
                lines.append(f'  {mermaid_id}["{label}"]')

        lines.append('')

        # Add edges
        for edge in self.graph.edges:
            source = node_map[edge.source]
            target = node_map[edge.target]
            label = edge.relation

            # Choose arrow style based on relation
            if edge.relation == 'conflict':
                lines.append(f'  {source} -.->|{label}| {target}')
            elif edge.relation == 'support':
                lines.append(f'  {source} ==>|{label}| {target}')
            else:
                lines.append(f'  {source} -->|{label}| {target}')

        lines.append('```')

        # Write to file
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))

    def _truncate(self, text: str, max_len: int) -> str:
        """Truncate text to max length."""
        if len(text) <= max_len:
            return text
        return text[:max_len-3] + '...'


def export_graph(
    graph: KnowledgeGraph,
    output_path: Path,
    format: str = 'dot'
):
    """
    Export graph to specified format.

    Args:
        graph: KnowledgeGraph to export
        output_path: Output file path
        format: Export format (dot, graphviz, cytoscape, d3, mermaid)
    """
    if format in ['dot', 'graphviz']:
        exporter = GraphVizExporter(graph)
        exporter.export(output_path)
    elif format == 'cytoscape':
        exporter = CytoscapeExporter(graph)
        exporter.export(output_path)
    elif format == 'd3':
        exporter = D3Exporter(graph)
        exporter.export(output_path)
    elif format == 'mermaid':
        exporter = MermaidExporter(graph)
        exporter.export(output_path)
    else:
        raise ValueError(f"Unknown format: {format}. Supported: dot, cytoscape, d3, mermaid")
