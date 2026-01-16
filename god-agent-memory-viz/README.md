# God Agent Memory Visualization

A React-based visualization tool for exploring and analyzing God Agent memory structures, learning trajectories, patterns, and feedback data stored in SQLite databases.

## Features

- **Interactive Graph Visualization**: Explore memory structures using Cytoscape.js with multiple layout algorithms
- **Dashboard View**: Metrics cards, timeline charts, and activity feeds
- **Advanced Filtering**: Filter by node types, edge types, time ranges, sessions, and agents
- **Search**: Full-text search with regex support across all graph data
- **Export**: Export graphs as PNG, SVG, JSON, or CSV
- **Keyboard Shortcuts**: Full keyboard navigation support
- **Dark Mode**: Light/dark/system theme support
- **Accessibility**: ARIA labels, screen reader support, keyboard navigation

## Quick Start

### Prerequisites

- Node.js 18+ (Node 22 recommended)
- npm 9+

### Installation

```bash
# Clone and navigate to the project
cd god-agent-memory-viz

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`

### Building for Production

```bash
npm run build
npm run preview  # Preview the production build
```

## Usage

### Loading Data

1. **Drag & Drop**: Drag a `.db` or `.sqlite` file onto the application
2. **File Picker**: Click the "Load Database" button in the header

The application expects SQLite databases with God Agent memory structures containing:
- `events` table - Learning events and trajectories
- `memory_entries` table - Memory patterns and episodes
- `feedback` table - User feedback data

### Views

#### Dashboard View
- **Metrics Cards**: Total nodes, edges, sessions, and patterns
- **Timeline Chart**: Activity over time
- **Quick Actions**: Navigate to graph, filters, or export

#### Graph View
- **Canvas**: Interactive graph visualization
- **Left Panel**: Filter controls for node/edge types
- **Right Panel**: Details, search, and statistics

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + F` | Focus search |
| `Cmd/Ctrl + A` | Select all nodes |
| `Escape` | Clear selection / Close modal |
| `+` / `-` | Zoom in / out |
| `0` | Reset zoom to 100% |
| `F` | Fit graph to viewport |
| `H` or `?` | Show keyboard shortcuts help |
| `Arrow keys` | Pan graph |
| `Cmd/Ctrl + E` | Export graph |

### Layouts

- **Force**: Force-directed layout (default)
- **Grid**: Organized grid pattern
- **Circle**: Circular arrangement
- **Concentric**: Concentric circles by degree
- **Breadthfirst**: Hierarchical BFS tree
- **Dagre**: Directed acyclic graph
- **CoSE**: Compound spring embedder
- **Cola**: Constraint-based layout

### Node Types

| Type | Color | Description |
|------|-------|-------------|
| Trajectory | Blue (#3B82F6) | Learning trajectories with verdict/quality |
| Pattern | Green (#10B981) | Learned patterns with success rates |
| Episode | Purple (#8B5CF6) | Memory episodes with context |
| Feedback | Amber (#F59E0B) | User feedback with ratings |
| Reasoning Step | Pink (#EC4899) | Individual reasoning steps |
| Checkpoint | Indigo (#6366F1) | State checkpoints |

### Exporting

Click the export buttons in the toolbar:
- **PNG**: Raster image (configurable scale)
- **SVG**: Vector graphics
- **JSON**: Full graph data with positions
- **CSV**: Node/edge lists

## Development

### Project Structure

```
src/
├── components/          # React components
│   ├── common/         # Shared UI components
│   ├── dashboard/      # Dashboard views
│   ├── graph/          # Graph visualization
│   ├── layout/         # App layout
│   └── panels/         # Side panels
├── hooks/              # Custom React hooks
├── services/           # Business logic
│   ├── database/       # SQLite/SQL.js integration
│   ├── export/         # Export functionality
│   └── graph/          # Cytoscape management
├── stores/             # Zustand state stores
├── styles/             # CSS styles
├── types/              # TypeScript definitions
└── utils/              # Utility functions
```

### Scripts

```bash
npm run dev        # Start development server
npm run build      # Build for production
npm run preview    # Preview production build
npm run lint       # Run ESLint
npm run typecheck  # Run TypeScript checker
npm run test       # Run tests
```

### Tech Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 5
- **State Management**: Zustand with Immer
- **Graph Visualization**: Cytoscape.js
- **Database**: SQL.js (SQLite in browser)
- **Styling**: CSS with BEM naming

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

MIT
