"""
Remote OSM Downloader.

Downloads OSM data from Overpass API using bounding boxes or place names geocoded via Nominatim.
Includes local file caching to prevent duplicate API requests.
"""

from __future__ import annotations

import hashlib
import logging
import time
from pathlib import Path
import urllib.parse

import httpx
from config import settings
from urban_engine.exceptions import OverpassTimeoutError, RemoteAreaTooLargeError

logger = logging.getLogger("urban_engine.import.remote_osm")

# Local cache directory inside storage
CACHE_DIR = settings.storage_dir / "cache" / "overpass"
CACHE_DIR.mkdir(parents=True, exist_ok=True)


def _compute_bbox_area_km2(bbox: dict[str, float]) -> float:
    """Calculate approximate area of a bounding box in square kilometers."""
    # Length of 1 degree latitude is approx 111 km
    lat_dist = abs(bbox["north"] - bbox["south"]) * 111.0
    
    # Length of 1 degree longitude depends on latitude
    mean_lat = (bbox["north"] + bbox["south"]) / 2.0
    import math
    lon_dist = abs(bbox["east"] - bbox["west"]) * 111.0 * math.cos(math.radians(mean_lat))
    
    return lat_dist * lon_dist


def fetch_osm_by_bbox(bbox: dict[str, float], include_buildings: bool = True, use_cache: bool = True) -> Path:
    """
    Query Overpass for roads and buildings in a bounding box.
    Returns path to downloaded raw OSM XML file.
    """
    area = _compute_bbox_area_km2(bbox)
    if area > settings.max_overpass_area_km2:
        raise RemoteAreaTooLargeError(
            f"Query area ({area:.2f} km²) exceeds maximum allowed size "
            f"of {settings.max_overpass_area_km2:.2f} km²."
        )

    # Build unique cache key
    key_str = f"{bbox['west']:.6f}_{bbox['south']:.6f}_{bbox['east']:.6f}_{bbox['north']:.6f}_bld_{include_buildings}"
    cache_hash = hashlib.md5(key_str.encode()).hexdigest()
    cache_path = CACHE_DIR / f"{cache_hash}.osm"

    if use_cache and cache_path.exists():
        logger.info("Found cached OSM data for bbox: %s", key_str)
        return cache_path

    # Build Overpass QL query dynamically based on whether buildings are needed
    building_query = ""
    if include_buildings:
        building_query = f"""
      way["building"]({bbox['south']},{bbox['west']},{bbox['north']},{bbox['east']});
      relation["building"]({bbox['south']},{bbox['west']},{bbox['north']},{bbox['east']});"""

    query = f"""
    [out:xml][timeout:{settings.overpass_timeout_s}];
    (
      way["highway"]({bbox['south']},{bbox['west']},{bbox['north']},{bbox['east']});{building_query}
    );
    (._; >;);
    out body qt;
    """

    logger.info("Fetching OSM data from Overpass for bbox: %s", key_str)
    
    OVERPASS_MIRRORS = [
        settings.overpass_url,
        "https://overpass.kumi.systems/api/interpreter",
        "https://overpass.osm.ch/api/interpreter",
        "https://overpass.nchc.org.tw/api/interpreter"
    ]
    
    last_error = None
    success = False
    
    for url in OVERPASS_MIRRORS:
        try:
            logger.info("Trying Overpass endpoint: %s", url)
            with httpx.Client(timeout=settings.overpass_timeout_s) as client:
                response = client.post(
                    url,
                    data={"data": query},
                    headers={"User-Agent": settings.nominatim_user_agent},
                )
                if response.status_code == 429:
                    logger.warning("Endpoint %s rate limited. Trying next...", url)
                    last_error = "Rate limit exceeded (429)."
                    continue
                response.raise_for_status()
                
                # Save to cache
                cache_path.write_bytes(response.content)
                logger.info("Successfully fetched OSM data from %s", url)
                success = True
                break
        except httpx.TimeoutException:
            logger.warning("Endpoint %s timed out. Trying next...", url)
            last_error = "TimeoutException."
        except Exception as e:
            logger.warning("Endpoint %s failed: %s. Trying next...", url, e)
            last_error = str(e)

    if not success:
        raise OverpassTimeoutError(f"All Overpass API mirrors failed. Last error: {last_error}")

    return cache_path


def geocode_place(place_name: str) -> dict[str, float]:
    """
    Geocode a place name to a WGS84 bounding box using Nominatim.
    Returns dictionary with west, south, east, north.
    """
    logger.info("Geocoding place name: %s", place_name)
    encoded_place = urllib.parse.quote(place_name)
    url = f"{settings.nominatim_url}/search?q={encoded_place}&format=json&limit=1"

    try:
        with httpx.Client() as client:
            response = client.get(url, headers={"User-Agent": settings.nominatim_user_agent})
            response.raise_for_status()
            results = response.json()
            
            if not results:
                raise ValueError(f"Could not resolve location: '{place_name}'")
                
            place = results[0]
            # boundingbox format in Nominatim is: [south, north, west, east]
            bbox_arr = place["boundingbox"]
            return {
                "south": float(bbox_arr[0]),
                "north": float(bbox_arr[1]),
                "west": float(bbox_arr[2]),
                "east": float(bbox_arr[3]),
            }
    except Exception as e:
        raise ValueError(f"Geocoding failed for place '{place_name}': {e}")
