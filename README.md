# Language Mapping Explorer

A visual, interactive graph-based application for exploring etymological connections between words across different languages. Users can search for words and discover how they connect to related words in other languages through cognates, borrowings, derivatives, and other etymological relationships.

## Features

- **Interactive Graph Visualization**: Explore word relationships through an interactive network graph
- **Multi-language Support**: Discover connections across multiple language families
- **Etymology Types**: Visualize different types of relationships (cognates, derivatives, borrowings, calques)
- **Dynamic Expansion**: Click on nodes to expand and discover more connections
- **Search Interface**: Search for words to begin exploration
- **Confidence Scoring**: Relationships are weighted by confidence levels

## Architecture

### Frontend (React + TypeScript)
- **React 19** with TypeScript for the user interface
- **Cytoscape.js** for interactive graph visualization
- **TanStack Query** for efficient data fetching and caching
- **Tailwind CSS** for styling

### Backend (Node.js + Express)
- **Express.js** REST API server
- **In-memory graph data structure** for fast traversal
- **Node-cache** for performance optimization
- **Sample etymological dataset** included

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/your-username/language-mapping.git
cd language-mapping
```

2. Install dependencies for all components:
```bash
npm run install:all
```

3. Start the development servers:
```bash
npm run dev
```

This will start:
- Backend server on `http://localhost:3001`
- Frontend application on `http://localhost:5173`

### Usage

1. **Search for a word**: Use the search bar to find a word you're interested in
2. **Explore the graph**: Click on search results to load the word's etymological network
3. **Expand connections**: Right-click on nodes to discover more related words
4. **Navigate the graph**: Use mouse controls to zoom and pan around the visualization

## Sample Data

The application comes with sample etymological data including:

- **Indo-European family**: English, German, Spanish, French, Italian, Portuguese, Latin
- **Common word families**: water/agua/eau, mother/madre/mère, brother/hermano/frère, fire/fuego/feu

## Data Model

### Core Entities

- **Word**: Basic unit with text, language, part of speech, and definition
- **Language**: Language metadata with ISO codes and family information
- **EtymologicalConnection**: Relationships between words with type and confidence
- **Graph**: Network structure for efficient traversal and visualization

### Relationship Types

- **Cognate**: Words sharing common ancestral origin
- **Derivative**: Direct evolutionary relationship
- **Borrowing**: Words adopted from one language to another
- **Calque**: Loan translations
- **Semantic**: Words with related meanings
- **Phonetic**: Words with similar sounds

## API Endpoints

### Words
- `GET /api/words/search?query=word&limit=10` - Search for words
- `GET /api/words/:id` - Get word details and connections
- `POST /api/words` - Add a new word

### Graph
- `GET /api/graph/subgraph/:wordId?degrees=2` - Get subgraph around a word
- `POST /api/graph/expand/:wordId` - Expand connections for a word

### Connections
- `POST /api/connections` - Add etymological connection

### Meta
- `GET /api/languages` - Get all languages
- `GET /api/health` - Health check

## Development

### Project Structure
```
language-mapping/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── services/       # API services
│   │   ├── types/          # TypeScript definitions
│   │   └── App.tsx         # Main application
│   └── package.json
├── server/                 # Express backend
│   ├── models/             # Data models
│   ├── data/               # Sample data
│   └── index.js            # Server entry point
└── package.json            # Root package.json
```

### Adding New Data

To add new words and connections:

1. **Add words**: Use the `POST /api/words` endpoint or modify `server/data/sampleData.js`
2. **Add connections**: Use the `POST /api/connections` endpoint
3. **Extend languages**: Add to the languages list in the sample data

### Extending Functionality

- **New relationship types**: Add to `relationshipStyles` in `LanguageGraph.tsx`
- **External data sources**: Integrate APIs like Wiktionary in the server
- **Advanced layouts**: Experiment with different Cytoscape.js layouts
- **Authentication**: Add user accounts for personal word collections

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/new-feature`)
3. Commit your changes (`git commit -am 'Add new feature'`)
4. Push to the branch (`git push origin feature/new-feature`)
5. Open a Pull Request

## Future Enhancements

- [ ] Integration with external etymological databases
- [ ] User accounts and personal word collections
- [ ] Advanced filtering and search options
- [ ] Export functionality for graphs
- [ ] Mobile-optimized interface
- [ ] Pronunciation guides and audio
- [ ] Historical timeline view of word evolution
- [ ] Collaborative editing of etymological data

## License

MIT License - see LICENSE file for details

## Acknowledgments

- Sample etymological data derived from various linguistic sources
- Built with modern web technologies for performance and usability
- Inspired by the beauty of language evolution and connection