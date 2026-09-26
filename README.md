# Notify4 - Full Stack Web App

A simple full-stack web application built with:
- **Backend:** Python Flask
- **Frontend:** React with Vite
- **Deployment:** Vercel

## Project Structure

```
notify4/
├── api/                    # Python Flask backend
│   ├── index.py           # Flask app with test endpoints
│   ├── requirements.txt    # Python dependencies
│   └── .gitignore
├── frontend/              # React + Vite frontend
│   ├── src/
│   │   ├── App.jsx        # Main React component
│   │   ├── App.css        # Component styling
│   │   ├── index.css      # Global styles
│   │   └── main.jsx       # React entry point
│   ├── index.html         # HTML entry point
│   ├── vite.config.js     # Vite configuration with API proxy
│   ├── package.json       # Node dependencies
│   └── .gitignore
├── vercel.json            # Vercel deployment configuration
├── package.json           # Root package with dev scripts
└── .gitignore
```

## Setup Instructions

### Prerequisites
- Node.js 18+ and npm
- Python 3.8+
- Visual Studio Code (recommended)

### Local Development

1. **Install dependencies:**
   ```bash
   # Install root dependencies (concurrently)
   npm install
   
   # Install Python dependencies
   cd api
   pip install -r requirements.txt
   cd ..
   
   # Install frontend dependencies
   cd frontend
   npm install
   cd ..
   ```

2. **Run both services simultaneously:**
   ```bash
   npm run dev
   ```
   
   This will start:
   - Flask backend on `http://localhost:5000`
   - Vite dev server on `http://localhost:3000`
   
   The Vite dev server is configured with a proxy that forwards `/api/*` requests to the Flask backend.

### Individual Server Commands

If you prefer to run services separately:

```bash
# Terminal 1: Start Flask backend
npm run api

# Terminal 2: Start Vite frontend
npm run frontend
```

## API Endpoints

The backend provides three simple test endpoints:

### 1. Test Endpoint 1
- **URL:** `GET /api/test1`
- **Response:**
  ```json
  {
    "status": "success",
    "message": "Test endpoint 1 is working!",
    "data": {
      "test": "endpoint1",
      "timestamp": "2026-02-22T12:00:00Z"
    }
  }
  ```

### 2. Test Endpoint 2
- **URL:** `GET /api/test2`
- **Response:**
  ```json
  {
    "status": "success",
    "message": "Test endpoint 2 is working!",
    "data": {
      "test": "endpoint2",
      "count": 42,
      "items": ["apple", "banana", "orange"]
    }
  }
  ```

### 3. Health Check
- **URL:** `GET /api/health`
- **Response:**
  ```json
  {
    "status": "healthy"
  }
  ```

## Frontend Features

The React frontend includes:
- Clean, modern UI built with Vite + React
- Two buttons to call the backend endpoints
- Real-time response display in JSON format
- Error handling with user-friendly messages
- Loading state management
- CORS-enabled for easy API communication

## Building for Production

### Build the frontend:
```bash
npm run build
```

This creates an optimized production build in `frontend/dist/`.

## Deployment to Vercel

1. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Deploy:**
   ```bash
   vercel
   ```

The `vercel.json` file is pre-configured to:
- Build the frontend with Vite
- Serve the Flask backend as serverless functions
- Handle all routing correctly

## Development Notes

### API Proxy Configuration
The Vite dev server is configured to proxy `/api` requests to the Flask backend running on port 5000. This is defined in `frontend/vite.config.js`:

```javascript
proxy: {
  '/api': {
    target: 'http://localhost:5000',
    changeOrigin: true,
  }
}
```

### CORS
Flask-CORS is enabled on the backend to allow requests from the frontend during development.

### Testing Endpoints

You can test endpoints directly using curl:
```bash
curl http://localhost:5000/api/test1
curl http://localhost:5000/api/test2
curl http://localhost:5000/api/health
```

Or through the Vite proxy:
```bash
curl http://localhost:3000/api/test1
curl http://localhost:3000/api/test2
curl http://localhost:3000/api/health
```

## Troubleshooting

### Port conflicts
- If ports 3000 or 5000 are in use, modify the port in:
  - Flask: `api/index.py` - Change `port=5000`
  - Vite: `frontend/vite.config.js` - Change `port: 3000`

### CORS errors
- Ensure CORS is enabled: Flask app should have `CORS(app)` initialized
- Check that the proxy target in `vite.config.js` matches your backend URL

### Dependencies not installing
- Delete `node_modules` and `package-lock.json`, then run `npm install` again
- For Python, use a virtual environment: `python -m venv .venv`

## I-405 commute tolls

`GET /api/wsdot/tolls` uses the existing `WSDOT_ACCESS_CODE`. The frontend polls separately every minute; toll failures do not affect corridor health. On weekends and overnight (8 p.m. to 5 a.m. Pacific), the display uses the published free-hours schedule even when the feed is stale or missing. Fresh restrictions override that schedule. During tolling hours, prices older than five minutes are hidden with a small awaiting-update note. Morning is before noon in America/Los_Angeles, including DST.

Trip mapping verified against WSDOT's `GetTollRatesAsJson` catalog on 2026-09-20:

- Northbound: `405tp01352`, Bellevue mainline / NE 4th to the SR 522 destination zone, covering NE 128th and NE 160th beyond NE 124th. NE 6th direct access is a different entry.
- Southbound: `405tp02162`, NE 145th toll board after entry from NE 160th, to NE 6th / Bellevue.

Prices and operational messages come from `GetTollRatesAsJson`: `CurrentToll` is converted from cents to dollars, `CurrentMessage` carries restrictions, and `TimeUpdated` determines freshness. The trip-message endpoint (`GetTollTripRatesAsJson`) was observed lagging more than seven minutes behind this feed on 2026-09-25, causing the five-minute freshness cutoff to hide valid prices. Responses are not cached. Route assumptions are visible in the expanded Drive section. Source: https://wsdot.wa.gov/traffic/api/Documentation/class_toll_rate.html and WSDOT's I-405 express toll lane zone rules.

Verify with `python -m unittest api.test_tolls`, `npm --prefix frontend test`, and `npm run build`. The existing local Mock Drive Data toggle also supplies clearly labeled demo toll prices.

## License

MIT
