/**
 * IndexedDB Offline Cache Strategy for SafeCircle AI (Coimbatore)
 * Caches Leaflet map tiles, previously calculated routes, and safety records
 * so users maintain continuous map navigation and risk intelligence when offline.
 */

const DB_NAME = 'safecircle_coimbatore_offline_db';
const DB_VERSION = 1;
const TILES_STORE = 'map_tiles';
const ROUTES_STORE = 'cached_routes';
const SAFETY_STORE = 'offline_safety_data';

class OfflineCacheService {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(TILES_STORE)) {
          db.createObjectStore(TILES_STORE);
        }
        if (!db.objectStoreNames.contains(ROUTES_STORE)) {
          db.createObjectStore(ROUTES_STORE);
        }
        if (!db.objectStoreNames.contains(SAFETY_STORE)) {
          db.createObjectStore(SAFETY_STORE);
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  // --- TILE CACHING ---
  async getTile(tileUrl: string): Promise<Blob | null> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(TILES_STORE, 'readonly');
        const store = tx.objectStore(TILES_STORE);
        const req = store.get(tileUrl);
        req.onsuccess = () => {
          if (req.result && req.result.blob) {
            resolve(req.result.blob);
          } else {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  async saveTile(tileUrl: string, blob: Blob): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(TILES_STORE, 'readwrite');
      const store = tx.objectStore(TILES_STORE);
      store.put({ blob, timestamp: Date.now() }, tileUrl);
    } catch (e) {
      console.warn('Failed to cache map tile to IndexedDB:', e);
    }
  }

  async getCachedTileCount(): Promise<number> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(TILES_STORE, 'readonly');
        const store = tx.objectStore(TILES_STORE);
        const req = store.count();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(0);
      });
    } catch {
      return 0;
    }
  }

  // --- ROUTE CACHING ---
  private getRouteKey(s: [number, number], d: [number, number], mode: string): string {
    return `${s[0].toFixed(3)}_${s[1].toFixed(3)}__${d[0].toFixed(3)}_${d[1].toFixed(3)}__${mode}`;
  }

  async cacheRoute(
    start: [number, number],
    dest: [number, number],
    mode: string,
    routes: any[],
    analyses: any[]
  ): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(ROUTES_STORE, 'readwrite');
      const store = tx.objectStore(ROUTES_STORE);
      const key = this.getRouteKey(start, dest, mode);
      store.put({ routes, analyses, timestamp: Date.now() }, key);
    } catch (e) {
      console.warn('Failed to save route to offline IndexedDB store:', e);
    }
  }

  async getCachedRoute(
    start: [number, number],
    dest: [number, number],
    mode: string
  ): Promise<{ routes: any[]; analyses: any[] } | null> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(ROUTES_STORE, 'readonly');
        const store = tx.objectStore(ROUTES_STORE);
        const key = this.getRouteKey(start, dest, mode);
        const req = store.get(key);
        req.onsuccess = () => {
          if (req.result) {
            resolve({ routes: req.result.routes, analyses: req.result.analyses });
          } else {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  // --- GENERAL SAFETY DATA (INCIDENTS & EMERGENCY FACILITIES) ---
  async cacheSafetyData(key: string, data: any): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(SAFETY_STORE, 'readwrite');
      const store = tx.objectStore(SAFETY_STORE);
      store.put({ data, timestamp: Date.now() }, key);
    } catch (e) {
      console.warn('Failed to cache offline safety data:', e);
    }
  }

  async getCachedSafetyData<T>(key: string): Promise<T | null> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(SAFETY_STORE, 'readonly');
        const store = tx.objectStore(SAFETY_STORE);
        const req = store.get(key);
        req.onsuccess = () => {
          if (req.result && req.result.data) {
            resolve(req.result.data as T);
          } else {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  // --- PRELOAD COIMBATORE TILES ---
  // Preloads the central metropolitan tiles for zoom levels 12 to 14 so Coimbatore is instantly usable offline
  async prefetchCoimbatoreTiles(onProgress?: (count: number, total: number) => void): Promise<number> {
    // Coimbatore center ~ 11.0168, 76.9558
    // Tile coordinates:
    // z=12: x=2923, y=1933
    // z=13: x=5846 to 5848, y=3866 to 3868
    // z=14: x=11692 to 11696, y=7732 to 7736
    const tilesToFetch: { z: number; x: number; y: number }[] = [];

    // Zoom 12
    tilesToFetch.push({ z: 12, x: 2923, y: 1933 });

    // Zoom 13
    for (let x = 5846; x <= 5848; x++) {
      for (let y = 3866; y <= 3868; y++) {
        tilesToFetch.push({ z: 13, x, y });
      }
    }

    // Zoom 14 (Central Gandhipuram, RS Puram, Peelamedu, Ukkadam)
    for (let x = 11693; x <= 11695; x++) {
      for (let y = 7733; y <= 7735; y++) {
        tilesToFetch.push({ z: 14, x, y });
      }
    }

    let loaded = 0;
    for (const t of tilesToFetch) {
      const url = `https://tile.openstreetmap.org/${t.z}/${t.x}/${t.y}.png`;
      try {
        const existing = await this.getTile(url);
        if (!existing) {
          const res = await fetch(url, { mode: 'cors' });
          if (res.ok) {
            const blob = await res.blob();
            await this.saveTile(url, blob);
          }
        }
      } catch (err) {
        // Continue if one tile fetch fails
      }
      loaded++;
      if (onProgress) onProgress(loaded, tilesToFetch.length);
    }

    return loaded;
  }
}

export const offlineCache = new OfflineCacheService();
