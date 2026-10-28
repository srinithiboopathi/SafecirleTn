# SafeCircle AI
## AI-Powered Women's Travel Safety & Route Intelligence Platform

SafeCircle AI is an integrated full-stack web application designed to empower women travelers to make safer, better-informed navigation decisions. Rather than relying on black-box predictions or false safety guarantees, SafeCircle AI calculates transparent, multi-factor route safety indices based on verifiable civic datasets, municipal street lighting audits, open road hazards, atmospheric conditions, and proximity to staffed emergency outposts.

---

### 1. Key Architectural Features

1. **Interactive Route Planner & Multi-Route Comparison**
   - Geocoding and reverse geocoding powered by OpenStreetMap Nominatim.
   - Real street geometry alternatives retrieved via the Open Source Routing Machine (OSRM).
   - Dynamic Leaflet visualization with color-coded safety polylines:
     - **Green:** Better relative indicators based on available evidence.
     - **Amber:** Mixed risk indicators or moderate uncertainty.
     - **Red:** Substantial identified risk indicators (lighting outages, high incident density).
     - **Grey:** Insufficient safety data (never falsely presented as safe).
   - Factor breakdown: Street Lighting (25%), Incident Density (35%), Emergency Proximity Buffer (20%), Road & Weather Hazards (20%).

2. **Safety Incident Heatmap & Civic Outages**
   - Interactive clustering of verified police reports, streetlighting blackouts, harassment hotspots, and accident-prone zones.
   - Comprehensive multi-attribute filtering (category, severity, verification status, search keywords).
   - Privacy preservation: victim identities and private home locations are never exposed.

3. **Emergency SOS & 112 Pan-India Protocol**
   - 3-second accidental-press cancellation countdown.
   - Immediate dispatch of GPS coordinates and human-readable reverse geocoded address to configured trusted contacts.
   - Direct integration link with India's National Emergency Response Service (**112**) and Women Helpline (**1091**).
   - Audit trail and cancellation management.

4. **Live Journey Sharing**
   - Time-limited, unguessable, revocable sharing tokens (`/share/:token`).
   - Breadcrumb tracking and arrival progress indicator.
   - Real-time safety notification dispatch.

5. **Community Hazard Reporting & Admin Moderation**
   - Crowdsourced reporting of broken lamps, harassers, or road obstacles.
   - Dedicated Administrative Moderation Queue with role-based access control (RBAC).

6. **AI Safety Intelligence Assistant**
   - Grounded queries regarding night travel precautions, route factor explanations, and facility lookups.
   - Powered by Gemini 2.5 Flash via `@google/genai` TypeScript SDK with deterministic rule engine fallback.

---

### 2. Technology Stack

- **Frontend:** React 19, Vite, TypeScript, Tailwind CSS, Leaflet, Lucide React icons.
- **Node.js Server:** Express full-stack middleware (`server.ts`), in-memory JSON data store with realistic seed datasets.
- **Python Backend Reference (`backend/`):** FastAPI, SQLAlchemy, Alembic, Pydantic, PostGIS geographic queries, Pytest suite.
- **External APIs:** OpenStreetMap Nominatim, OSRM Routing Machine, Open-Meteo Weather Grid, Gemini 2.5 Flash API.

---

### 3. Quickstart & Installation (Windows PowerShell & Linux)

#### Option A: Running the Integrated Full-Stack Application (Node.js)

1. **Clone repository and install dependencies:**
   ```powershell
   npm install
   ```

2. **Configure Environment Variables (Optional for Gemini API):**
   ```powershell
   cp .env.example .env
   # Add your GEMINI_API_KEY (optional, app automatically falls back to intelligent deterministic engine)
   ```

3. **Start the Development Server:**
   ```powershell
   npm run dev
   ```
   The application runs on `http://localhost:3000`.

#### Option B: Running the Python FastAPI Backend (`backend/`)

1. **Create and activate Python virtual environment:**
   ```powershell
   python -m venv venv
   .\venv\Scripts\Activate.ps1
   ```

2. **Install Python dependencies:**
   ```powershell
   pip install -r backend/requirements.txt
   ```

3. **Run FastAPI Server:**
   ```powershell
   uvicorn backend.app.main:app --reload --port 8000
   ```
   Access interactive Swagger UI documentation at `http://localhost:8000/docs`.

4. **Run Pytest Suite:**
   ```powershell
   pytest backend/tests/test_backend.py -v
   ```

---

### 4. Demo Evaluation Accounts

SafeCircle AI includes pre-seeded demonstration accounts for testing:
- **Regular Traveler:** `user@safecircle.org` / `password123` (Priya Sharma)
- **Safety Administrator:** `admin@safecircle.org` / `admin123` (Dr. Anita Roy)
*(Or click the 1-click role switcher button in the top navigation bar).*

---

### 5. Known Limitations & Responsible Data Statement

- **No Guarantees:** No mathematical or machine learning score can guarantee personal safety.
- **Missing Data:** An absence of reported crime or lighting complaints does not mean an area is safe. SafeCircle AI highlights unmapped routes in **Grey (Insufficient Data)**.
- **Browser GPS:** When the browser tab is backgrounded or minimized, mobile operating systems restrict GPS updates to conserve battery.
