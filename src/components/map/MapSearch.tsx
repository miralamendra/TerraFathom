import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { useMapStore } from '@/stores/map-store';
import { toast } from 'sonner';

interface GeocodeResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  boundingbox?: string[];
  type?: string;
}

export function MapSearch() {
  const animateViewport = useMapStore((s) => s.animateViewport);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setIsOpen(true);
    try {
      // Nominatim search API
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        query
      )}&format=json&limit=5`;
      
      const response = await fetch(url, {
        headers: {
          'Accept-Language': 'en',
          // Nominatim usage policy recommends setting a User-Agent
          'User-Agent': 'TerraFathom-GIS-Workspace'
        }
      });

      if (!response.ok) {
        throw new Error('Geocoding service unavailable');
      }

      const data = (await response.json()) as GeocodeResult[];
      setResults(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Search failed';
      toast.error(msg);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectLocation = (loc: GeocodeResult) => {
    const lat = Number(loc.lat);
    const lon = Number(loc.lon);

    if (isNaN(lat) || isNaN(lon)) {
      toast.error('Invalid coordinates returned for location');
      return;
    }

    // Determine default zoom based on features type (e.g. higher zoom for street addresses, lower for countries)
    let zoomLevel = 13; // default City/Address zoom
    if (loc.type === 'administrative' || loc.type === 'country') {
      zoomLevel = 5; // country zoom
    } else if (loc.type === 'state' || loc.type === 'province') {
      zoomLevel = 7; // state/province zoom
    }

    // Trigger viewport animation
    animateViewport({
      latitude: lat,
      longitude: lon,
      zoom: zoomLevel,
      pitch: 0, // flatten viewpoint on search target
      bearing: 0
    }, 2000);

    setQuery(loc.display_name);
    setIsOpen(false);
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
  };

  return (
    <div 
      ref={containerRef}
      className="absolute right-4 top-4 z-30 w-72 md:w-80 flex flex-col select-none"
    >
      <form 
        onSubmit={handleSearchSubmit}
        className="w-full flex items-center h-9 px-3 gap-2 bg-bg-elevated border border-border-primary rounded-control shadow-floating backdrop-blur-md transition-colors focus-within:border-accent-primary"
      >
        <Search size={14} className="text-text-tertiary shrink-0" />
        
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search country, city, address..."
          className="flex-1 h-full bg-transparent border-0 outline-none text-xs text-text-primary placeholder:text-text-tertiary"
        />

        {loading ? (
          <Loader2 size={13} className="text-text-tertiary animate-spin shrink-0" />
        ) : query ? (
          <button
            type="button"
            onClick={clearSearch}
            className="text-text-tertiary hover:text-text-primary transition-colors cursor-pointer outline-none shrink-0"
          >
            <X size={14} />
          </button>
        ) : null}
      </form>

      {/* Results Dropdown */}
      {isOpen && (results.length > 0 || (!loading && query.trim() !== '')) && (
        <div className="mt-1 w-full bg-bg-elevated border border-border-primary rounded-control shadow-floating max-h-56 overflow-y-auto divide-y divide-border-primary/40 backdrop-blur-md z-40">
          {results.length > 0 ? (
            results.map((loc) => (
              <button
                key={loc.place_id}
                type="button"
                onClick={() => handleSelectLocation(loc)}
                className="w-full text-left px-3 py-2 text-[11px] text-text-secondary hover:text-text-primary hover:bg-bg-hover cursor-pointer transition-colors block truncate"
                title={loc.display_name}
              >
                {loc.display_name}
              </button>
            ))
          ) : (
            <div className="px-3 py-2.5 text-center text-[11px] text-text-tertiary">
              No matching locations found
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default MapSearch;
