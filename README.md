# etmos

A visual, interactive graph-based application for exploring etymological connections between words across different languages. Users can search for words and discover how they connect to related words in other languages through cognates, borrowings, derivatives, and other etymological relationships.

## Getting Started

1. Clone the repository:
```bash
git clone https://github.com/your-username/etmos.git
cd etmos
```

2. Install dependencies for all components:
```bash
npm run install:all
```

## Development

Start the development servers (with hot-reload):
```bash
npm run dev
```

This will start:
- Backend server on `http://localhost:54330`
- Frontend application on `http://localhost:5173`

Both the client and server will automatically reload when you make changes to the code.

### Running Client or Server Individually

```bash
# Run only the client in development mode
npm run client:dev

# Run only the server in development mode
npm run server:dev
```

## Production

### Building for Production

Build both client and server:
```bash
# Build the client (creates optimized bundle in client/dist)
npm run client:build

# Build the server (compiles TypeScript to server/dist)
npm run server:build
```

### Running Production Builds

**Option 1: Run production server**
```bash
npm run server:start:prod
```

**Option 2: Preview production build locally**
```bash
# Build and preview the client
cd client
npm run build
npm run preview  # Serves production build on http://localhost:4173

# In another terminal, run the production server
cd server
npm run start:prod
```

## Usage

### Controls

**Click** on words to add related words to graph

The settings menu can be accessed by clicking on the icon in the top left of the screen

Press **Shift** to toggle settings menu visbility

