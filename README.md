# etmos

  <div align="center">
      <a href="https://etmos.pages.dev" target="_blank">
          <img src="assets/etmos-preview-2.png" alt="etmos preview">
      </a>
      <br>
      <a href="https://etmos.pages.dev" target="_blank">
          <b>https://etmos.pages.dev</b>
      </a>
     </div>
    <br>
    
A visual, interactive graph-based application for exploring etymological connections between words across different languages. 
 


## Tech Stack

**Frontend:**
- React 19 with TypeScript
- D3.js for graph visualization
- TanStack Query for data fetching
- Vite for build tooling
- Tailwind CSS for styling

**Backend:**
- Fastify server with TypeScript
- Node-cache for response caching
- Deployed on Railway

## Getting Started

### Installation

1. Clone the repository:
```bash
git clone https://github.com/jo56/etmos.git
cd etmos
```

2. Install dependencies for all components:
```bash
npm run install:all
```

### Development

Start both frontend and backend development servers:
```bash
npm run dev
```

This will start:
- Backend API server on `http://localhost:54330`
- Frontend application on `http://localhost:5173`

Both will automatically reload when you make changes to the code.

### Running Client or Server Individually

```bash
# Run only the frontend in development mode
npm run client:dev

# Run only the backend in development mode
npm run server:dev
```

## Production

### Building for Production

Build both frontend and backend:
```bash
# Build the client (creates optimized bundle in client/dist)
npm run client:build

# Build the server (compiles TypeScript to server/dist)
npm run server:build
```

### Running Production Builds

Start the production server:
```bash
npm run server:start:prod
```

Preview the frontend production build locally:
```bash
cd client
npm run build
npm run preview  # Serves on http://localhost:4173
```

## Usage

1. **Search**: Enter a word in the search bar to create an initial graph
2. **Expand**: Click on any node to reveal its etymological connections
3. **Settings**: Click the settings icon (top-left) or press `Shift` to toggle the settings panel
4. **Themes**: Choose from 12 different visual themes in the settings panel
5. **Max Neighbors**: Adjust the maximum number of connections shown per node (1-50)

## API Endpoints

The backend provides the following endpoints:

- `GET /api/etymology/search?word={word}&language={lang}` - Search for a word's etymology
- `POST /api/etymology/initial` - Get initial graph data for a word
- `POST /api/etymology/neighbors` - Get neighbors for a specific node
- `GET /api/health` - Health check endpoint

## Environment Variables

Create a `.env` file in the server directory:

```env
PORT=54330
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
```

## License

MIT

