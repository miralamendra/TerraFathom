"""
Google Earth Engine Integration Module — Production Grade.

Uses real GEE satellite data at native resolution (30m SRTM, 10m Sentinel-2,
500m VIIRS nightlights, 10m ESA WorldCover).

Two visualization modes:
  - live_tiles: GEE-rendered map tiles via getMapId() for instant map overlay.
  - pixel_grid: Real per-pixel GeoJSON grid via sampleRectangle() for Deck.gl
    rendering with hover tooltips and value inspection.

Statistics (analyze_polygon) are computed via reduceRegion() on real data.
Fallback to simulated data only if GEE initialization truly fails.
"""

from __future__ import annotations

import logging
import math
from pathlib import Path
from typing import Any, Dict, List
import numpy as np

logger = logging.getLogger("urban_engine.analysis.earth_engine")

_ee_initialized = False
_ee_module = None  # cache the ee module after import


def _get_ee():
    """Lazy-import and cache the ee module."""
    global _ee_module
    if _ee_module is None:
        import ee
        _ee_module = ee
    return _ee_module


def initialize_earth_engine() -> bool:
    """Initialize Google Earth Engine with the registered service account key."""
    global _ee_initialized
    if _ee_initialized:
        return True

    base_dir = Path(__file__).resolve().parent.parent.parent
    credentials_path = base_dir / "private_key.json"

    if not credentials_path.exists():
        logger.warning("Earth Engine credentials not found at %s", credentials_path)
        return False

    try:
        ee = _get_ee()
        credentials = ee.ServiceAccountCredentials(
            "terrafathom-backend@terrafathom.iam.gserviceaccount.com",
            str(credentials_path)
        )
        ee.Initialize(credentials)
        _ee_initialized = True
        logger.info("Google Earth Engine initialized successfully.")
        return True
    except Exception as e:
        logger.error("Failed to initialize Earth Engine: %s", e)
        return False


# ─────────────────────────────────────────────────────────────────────────────
# Color helpers
# ─────────────────────────────────────────────────────────────────────────────

def _interpolate_color(val: float, ramp: List[tuple]) -> str:
    """Linearly interpolate a hex color from a value ramp list [(t, '#hex'), ...]."""
    val = max(ramp[0][0], min(ramp[-1][0], val))
    for k in range(len(ramp) - 1):
        t1, c1 = ramp[k]
        t2, c2 = ramp[k + 1]
        if t1 <= val <= t2:
            r1, g1, b1 = int(c1[1:3], 16), int(c1[3:5], 16), int(c1[5:7], 16)
            r2, g2, b2 = int(c2[1:3], 16), int(c2[3:5], 16), int(c2[5:7], 16)
            f = (val - t1) / (t2 - t1) if t2 > t1 else 0.0
            return "#{:02x}{:02x}{:02x}".format(
                int(r1 + (r2 - r1) * f),
                int(g1 + (g2 - g1) * f),
                int(b1 + (b2 - b1) * f),
            )
    return ramp[-1][1]


# ─────────────────────────────────────────────────────────────────────────────
# Layer configurations — datasets, vis params, legends, color ramps
# ─────────────────────────────────────────────────────────────────────────────

ELEVATION_RAMP = [
    (0.0, "#2b83ba"), (0.2, "#abdda4"), (0.5, "#ffffbf"),
    (0.75, "#fdae61"), (1.0, "#d7191c"),
]
ELEVATION_LEGEND = [
    {"label": "0 – 5 m  (Coastal / Tidal Flat)", "color": "#2b83ba"},
    {"label": "5 – 15 m  (Alluvial Plain)", "color": "#80c1a0"},
    {"label": "15 – 30 m  (Low Terraces)", "color": "#ffffbf"},
    {"label": "30 – 60 m  (Uplands)", "color": "#fdae61"},
    {"label": "60 m +  (Hills / Escarpment)", "color": "#d7191c"},
]

NDVI_RAMP = [
    (0.0, "#a6611a"), (0.15, "#dfc27d"), (0.35, "#f5f5f5"),
    (0.55, "#80cdc1"), (0.8, "#018571"),
]
NDVI_LEGEND = [
    {"label": "< 0.10  Barren / Built-up", "color": "#a6611a"},
    {"label": "0.10 – 0.25  Sparse Grass", "color": "#dfc27d"},
    {"label": "0.25 – 0.45  Shrub / Open Canopy", "color": "#f5f5f5"},
    {"label": "0.45 – 0.65  Mixed Woodland", "color": "#80cdc1"},
    {"label": "> 0.65  Dense Forest / Plantation", "color": "#018571"},
]

NIGHTLIGHTS_RAMP = [
    (0.0, "#0d0d1a"), (0.1, "#1a1a33"), (0.3, "#664400"),
    (0.6, "#ff9900"), (1.0, "#ffffff"),
]
NIGHTLIGHTS_LEGEND = [
    {"label": "< 1 nW  Dark / Rural", "color": "#0d0d1a"},
    {"label": "1 – 8 nW  Low-density Residential", "color": "#1a1a33"},
    {"label": "8 – 25 nW  Suburban Corridor", "color": "#664400"},
    {"label": "25 – 55 nW  High-density Urban", "color": "#ff9900"},
    {"label": "> 55 nW  Metro Core / Industry", "color": "#ffffff"},
]

# ESA WorldCover v200 class → label & color
LANDCOVER_MAP = {
    10: ("Tree Cover", "#006400"),
    20: ("Shrubland", "#ffbb22"),
    30: ("Grassland", "#ffff4c"),
    40: ("Cropland", "#f096ff"),
    50: ("Built-up", "#fa0000"),
    60: ("Bare / Sparse Vegetation", "#b4b4b4"),
    70: ("Snow / Ice", "#f0f0f0"),
    80: ("Permanent Water", "#0064c8"),
    90: ("Herbaceous Wetland", "#0096a0"),
    95: ("Mangroves", "#00cf75"),
    100: ("Moss / Lichen", "#fae6a0"),
}
LANDCOVER_LEGEND = [
    {"label": v[0], "color": v[1]} for v in LANDCOVER_MAP.values()
    if v[0] in ("Tree Cover", "Shrubland", "Grassland", "Cropland",
                "Built-up", "Permanent Water", "Herbaceous Wetland")
]


# ─────────────────────────────────────────────────────────────────────────────
# Real GEE pixel grid extraction (sampleRectangle → GeoJSON)
# ─────────────────────────────────────────────────────────────────────────────

def _extract_pixel_grid(
    geometry_geojson: Dict[str, Any],
    layer_type: str,
) -> Dict[str, Any] | None:
    """
    Extract actual pixel values from GEE at native resolution and convert
    to a GeoJSON FeatureCollection of per-pixel rectangle polygons.
    
    Returns None if GEE is not available or extraction fails.
    """
    if not initialize_earth_engine():
        return None

    ee = _get_ee()
    coords = geometry_geojson.get("coordinates", [])
    if not coords:
        return None

    try:
        ee_geom = ee.Geometry.Polygon(coords)
        bounds = ee_geom.bounds().getInfo()["coordinates"][0]
        min_lon = bounds[0][0]
        min_lat = bounds[0][1]
        max_lon = bounds[2][0]
        max_lat = bounds[2][1]
        bbox = ee.Geometry.Rectangle([min_lon, min_lat, max_lon, max_lat])

        # Choose dataset, band, scale and value range
        if layer_type == "elevation":
            image = ee.Image("USGS/SRTMGL1_003").select("elevation")
            band_name = "elevation"
            scale = 30
            vis_min, vis_max = 0, 80
            color_ramp = ELEVATION_RAMP
            unit = "m"
            legend = ELEVATION_LEGEND
        elif layer_type == "ndvi":
            s2 = (ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
                  .filterBounds(ee_geom)
                  .filterDate("2024-01-01", "2024-12-31")
                  .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 20))
                  .median())
            image = s2.normalizedDifference(["B8", "B4"]).rename("ndvi")
            band_name = "ndvi"
            scale = 30  # Resample from native 10m → 30m to keep payload manageable
            vis_min, vis_max = -0.1, 0.8
            color_ramp = NDVI_RAMP
            unit = "NDVI"
            legend = NDVI_LEGEND
        elif layer_type == "nightlights":
            image = (ee.ImageCollection("NOAA/VIIRS/DNB/MONTHLY_V1/VCMSLCFG")
                     .filterDate("2024-01-01", "2024-12-31")
                     .median()
                     .select("avg_rad")
                     .rename("nightlights"))
            band_name = "nightlights"
            scale = 500  # Native resolution ~500m
            vis_min, vis_max = 0, 60
            color_ramp = NIGHTLIGHTS_RAMP
            unit = "nW/cm²/sr"
            legend = NIGHTLIGHTS_LEGEND
        else:  # landcover
            image = ee.Image("ESA/WorldCover/v200/2021").select("Map").rename("landcover")
            band_name = "landcover"
            scale = 30  # Resample from native 10m → 30m
            vis_min, vis_max = 10, 100
            color_ramp = None  # categorical
            unit = "class"
            legend = LANDCOVER_LEGEND

        # Estimate pixel count and cap if too large (>100k pixels → coarsen)
        lon_span_m = (max_lon - min_lon) * 111320 * math.cos(math.radians((min_lat + max_lat) / 2))
        lat_span_m = (max_lat - min_lat) * 110574
        estimated_pixels = (lon_span_m / scale) * (lat_span_m / scale)
        
        actual_scale = scale
        if estimated_pixels > 80000:
            # Coarsen to keep under 80k pixels
            target_side = math.sqrt(80000)
            actual_scale = max(lon_span_m, lat_span_m) / target_side
            actual_scale = max(actual_scale, scale)  # never finer than native
            logger.info("Coarsening from %dm to %dm (estimated %d pixels → ~%d)",
                       scale, int(actual_scale), int(estimated_pixels),
                       int((lon_span_m / actual_scale) * (lat_span_m / actual_scale)))

        # Reproject image to a fixed CRS at the chosen scale for sampleRectangle
        image_proj = image.reproject(crs="EPSG:4326", scale=actual_scale)
        
        # Extract pixel array
        sampled = image_proj.sampleRectangle(region=bbox, defaultValue=0)
        result = sampled.getInfo()
        pixel_array = result["properties"][band_name]

        n_rows = len(pixel_array)
        n_cols = len(pixel_array[0]) if n_rows > 0 else 0
        
        if n_rows == 0 or n_cols == 0:
            return None

        logger.info("Extracted %d × %d = %d real pixels at ~%dm for %s",
                    n_rows, n_cols, n_rows * n_cols, int(actual_scale), layer_type)

        # Cell dimensions in degrees
        cell_lon = (max_lon - min_lon) / n_cols
        cell_lat = (max_lat - min_lat) / n_rows

        features = []
        for r in range(n_rows):
            for c in range(n_cols):
                raw_val = pixel_array[r][c]
                if raw_val is None:
                    continue

                cell_min_lon = min_lon + c * cell_lon
                cell_max_lon = cell_min_lon + cell_lon
                # Rows are top-to-bottom in image space
                cell_max_lat = max_lat - r * cell_lat
                cell_min_lat = cell_max_lat - cell_lat

                if layer_type == "landcover":
                    lc_class = int(raw_val)
                    label, color = LANDCOVER_MAP.get(lc_class, ("Unknown", "#888888"))
                    props = {
                        "value": label,
                        "class_code": lc_class,
                        "normalized_value": 0.5,
                        "color": color,
                        "unit": "class",
                    }
                else:
                    val = float(raw_val)
                    norm = (val - vis_min) / (vis_max - vis_min) if vis_max > vis_min else 0.0
                    norm = max(0.0, min(1.0, norm))
                    props = {
                        "value": round(val, 3) if layer_type == "ndvi" else round(val, 1),
                        "normalized_value": round(norm, 4),
                        "color": _interpolate_color(norm, color_ramp),
                        "unit": unit,
                    }

                features.append({
                    "type": "Feature",
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[
                            [cell_min_lon, cell_min_lat],
                            [cell_max_lon, cell_min_lat],
                            [cell_max_lon, cell_max_lat],
                            [cell_min_lon, cell_max_lat],
                            [cell_min_lon, cell_min_lat],
                        ]]
                    },
                    "properties": props,
                })

        return {
            "success": True,
            "mode": "fallback_grid",  # Keep mode name for frontend compatibility
            "geojson": {"type": "FeatureCollection", "features": features},
            "legend": legend,
            "source": f"Google Earth Engine — Real {layer_type.upper()} at ~{int(actual_scale)}m resolution ({n_cols}×{n_rows} = {n_cols*n_rows:,} pixels)",
        }

    except Exception as e:
        logger.warning("Pixel grid extraction failed for %s: %s", layer_type, e)
        return None


# ─────────────────────────────────────────────────────────────────────────────
# Live GEE tile URL extraction via getMapId()
# ─────────────────────────────────────────────────────────────────────────────

def _get_live_tile_url(
    geometry_geojson: Dict[str, Any],
    layer_type: str,
) -> Dict[str, Any] | None:
    """
    Acquire a GEE-rendered XYZ tile URL for a given layer via getMapId().
    Returns None on failure.
    """
    if not initialize_earth_engine():
        return None

    ee = _get_ee()
    coords = geometry_geojson.get("coordinates", [])
    if not coords:
        return None

    try:
        ee_geom = ee.Geometry.Polygon(coords)

        if layer_type == "elevation":
            image = ee.Image("USGS/SRTMGL1_003").clip(ee_geom)
            vis_params = {
                "min": 0, "max": 80,
                "palette": ["#2b83ba", "#abdda4", "#ffffbf", "#fdae61", "#d7191c"],
            }
            legend = ELEVATION_LEGEND
        elif layer_type == "ndvi":
            s2 = (ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
                  .filterBounds(ee_geom)
                  .filterDate("2024-01-01", "2024-12-31")
                  .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 20))
                  .median())
            image = s2.normalizedDifference(["B8", "B4"]).clip(ee_geom)
            vis_params = {
                "min": -0.1, "max": 0.8,
                "palette": ["#a6611a", "#dfc27d", "#f5f5f5", "#80cdc1", "#018571"],
            }
            legend = NDVI_LEGEND
        elif layer_type == "nightlights":
            image = (ee.ImageCollection("NOAA/VIIRS/DNB/MONTHLY_V1/VCMSLCFG")
                     .filterDate("2024-01-01", "2024-12-31")
                     .median()
                     .select("avg_rad")
                     .clip(ee_geom))
            vis_params = {
                "min": 0, "max": 60,
                "palette": ["#0d0d1a", "#1a1a33", "#664400", "#ff9900", "#ffffff"],
            }
            legend = NIGHTLIGHTS_LEGEND
        else:  # landcover
            image = ee.Image("ESA/WorldCover/v200/2021").select("Map").clip(ee_geom)
            vis_params = {
                "min": 10, "max": 100,
                "palette": [
                    "#006400", "#ffbb22", "#ffff4c", "#f096ff", "#fa0000",
                    "#b4b4b4", "#f0f0f0", "#0064c8", "#0096a0", "#00cf75", "#fae6a0",
                ],
            }
            legend = LANDCOVER_LEGEND

        map_id_dict = image.getMapId(vis_params)
        tile_fetcher = map_id_dict.get("tile_fetcher")
        if tile_fetcher and hasattr(tile_fetcher, "url_format"):
            tile_url = tile_fetcher.url_format
            return {
                "success": True,
                "mode": "live_tiles",
                "tile_url": tile_url,
                "legend": legend,
                "source": f"Google Earth Engine — Live {layer_type.upper()} Tiles",
            }
        return None

    except Exception as e:
        logger.warning("Tile URL acquisition failed for %s: %s", layer_type, e)
        return None


# ─────────────────────────────────────────────────────────────────────────────
# Real GEE statistics via reduceRegion()
# ─────────────────────────────────────────────────────────────────────────────

def _compute_real_statistics(
    geometry_geojson: Dict[str, Any],
    metrics: List[str],
) -> Dict[str, Any] | None:
    """
    Compute real satellite statistics for the polygon via ee.Reducer calls.
    Returns a dict of metric results keyed by metric name, or None on failure.
    """
    if not initialize_earth_engine():
        return None

    ee = _get_ee()
    coords = geometry_geojson.get("coordinates", [])
    if not coords:
        return None

    try:
        ee_geom = ee.Geometry.Polygon(coords)
        results: Dict[str, Any] = {}

        if "elevation" in metrics:
            srtm = ee.Image("USGS/SRTMGL1_003").select("elevation")
            stats = srtm.reduceRegion(
                reducer=ee.Reducer.mean().combine(ee.Reducer.minMax(), sharedInputs=True)
                                        .combine(ee.Reducer.stdDev(), sharedInputs=True),
                geometry=ee_geom,
                scale=30,
                maxPixels=5e6,
            ).getInfo()
            results["elevation"] = {
                "mean": round(stats.get("elevation_mean", 0), 2),
                "min": round(stats.get("elevation_min", 0), 2),
                "max": round(stats.get("elevation_max", 0), 2),
                "std_dev": round(stats.get("elevation_stdDev", 0), 2),
                "unit": "meters",
                "dataset": "USGS SRTM GL1 (30m)",
                "real_data": True,
            }

        if "ndvi" in metrics:
            s2 = (ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
                  .filterBounds(ee_geom)
                  .filterDate("2024-01-01", "2024-12-31")
                  .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 20))
                  .median())
            ndvi = s2.normalizedDifference(["B8", "B4"]).rename("ndvi")
            stats = ndvi.reduceRegion(
                reducer=ee.Reducer.mean().combine(ee.Reducer.minMax(), sharedInputs=True)
                                        .combine(ee.Reducer.stdDev(), sharedInputs=True),
                geometry=ee_geom,
                scale=10,
                maxPixels=5e6,
            ).getInfo()

            mean_ndvi = stats.get("ndvi_mean", 0.0) or 0.0
            veg_type = "Barren / Built-up"
            if mean_ndvi > 0.65:
                veg_type = "Dense Forest / Plantation"
            elif mean_ndvi > 0.45:
                veg_type = "Mixed Woodland"
            elif mean_ndvi > 0.25:
                veg_type = "Open Shrubland"
            elif mean_ndvi > 0.10:
                veg_type = "Sparse Grassland"

            results["ndvi"] = {
                "mean": round(mean_ndvi, 4),
                "min": round(stats.get("ndvi_min", 0.0) or 0.0, 4),
                "max": round(stats.get("ndvi_max", 0.0) or 0.0, 4),
                "std_dev": round(stats.get("ndvi_stdDev", 0.0) or 0.0, 4),
                "vegetation_density": veg_type,
                "canopy_cover_pct": round(mean_ndvi * 100, 1),
                "dataset": "Copernicus Sentinel-2 SR (10m)",
                "real_data": True,
            }

        if "nightlights" in metrics:
            nl = (ee.ImageCollection("NOAA/VIIRS/DNB/MONTHLY_V1/VCMSLCFG")
                  .filterDate("2024-01-01", "2024-12-31")
                  .median()
                  .select("avg_rad")
                  .rename("nightlights"))
            stats = nl.reduceRegion(
                reducer=ee.Reducer.mean().combine(ee.Reducer.minMax(), sharedInputs=True),
                geometry=ee_geom,
                scale=500,
                maxPixels=5e6,
            ).getInfo()

            mean_nl = stats.get("nightlights_mean", 0.0) or 0.0
            urbanisation = "Rural / Unlit"
            if mean_nl > 40:
                urbanisation = "Metro Core"
            elif mean_nl > 20:
                urbanisation = "High-Density Urban"
            elif mean_nl > 8:
                urbanisation = "Suburban Corridor"
            elif mean_nl > 2:
                urbanisation = "Low-Density Residential"

            results["nightlights"] = {
                "mean": round(mean_nl, 2),
                "min": round(stats.get("nightlights_min", 0.0) or 0.0, 2),
                "max": round(stats.get("nightlights_max", 0.0) or 0.0, 2),
                "urban_activity": urbanisation,
                "radiance_unit": "nW/cm²/sr",
                "dataset": "NOAA VIIRS DNB Monthly (500m)",
                "real_data": True,
            }

        if "landcover" in metrics:
            lc = ee.Image("ESA/WorldCover/v200/2021").select("Map")
            hist = lc.reduceRegion(
                reducer=ee.Reducer.frequencyHistogram(),
                geometry=ee_geom,
                scale=10,
                maxPixels=5e6,
            ).getInfo()
            
            raw_hist = hist.get("Map", {})
            total = sum(raw_hist.values()) if raw_hist else 1
            breakdown = {}
            for code_str, count in raw_hist.items():
                code = int(code_str)
                label, color = LANDCOVER_MAP.get(code, (f"Class {code}", "#888888"))
                breakdown[label] = {
                    "percentage": round(count / total * 100, 1),
                    "pixel_count": count,
                    "color": color,
                }

            # Dominant class
            dominant = max(breakdown.items(), key=lambda x: x[1]["percentage"]) if breakdown else ("Unknown", {"percentage": 0})
            results["landcover"] = {
                "dominant_class": dominant[0],
                "dominant_percentage": dominant[1]["percentage"],
                "breakdown": breakdown,
                "dataset": "ESA WorldCover v200 2021 (10m)",
                "real_data": True,
            }

        return results

    except Exception as e:
        logger.warning("Real statistics computation failed: %s", e)
        return None


# ─────────────────────────────────────────────────────────────────────────────
# Public API functions
# ─────────────────────────────────────────────────────────────────────────────

def get_earth_engine_map(geometry_geojson: Dict[str, Any], layer_type: str) -> Dict[str, Any]:
    """
    Generate a satellite visualization for the given polygon.
    
    Attempts real GEE pixel grid extraction first (best quality: hover values
    per pixel), then falls back to live tile overlay, then to simulated data.
    """
    # 1. Try real pixel grid (preferred — shows real values on hover)
    pixel_result = _extract_pixel_grid(geometry_geojson, layer_type)
    if pixel_result:
        return pixel_result

    # 2. Try live tile overlay
    tile_result = _get_live_tile_url(geometry_geojson, layer_type)
    if tile_result:
        return tile_result

    # 3. Last resort — simulated fallback
    logger.warning("All GEE methods failed for %s, returning simulated data", layer_type)
    return _generate_fallback_grid(geometry_geojson, layer_type)


def analyze_polygon(geometry_geojson: Dict[str, Any], metrics: list[str] | None = None) -> Dict[str, Any]:
    """
    Compute satellite analysis statistics for the provided polygon.
    Uses real GEE data when available, simulated data as fallback.
    """
    if metrics is None:
        metrics = ["elevation", "ndvi", "nightlights", "landcover"]

    coords = geometry_geojson.get("coordinates", [])
    flat_coords = []
    if coords:
        for ring in coords:
            for pt in ring:
                if len(pt) >= 2:
                    flat_coords.append(pt)

    center_lon, center_lat = 79.86, 6.92
    if flat_coords:
        arr = np.array(flat_coords)
        center_lon = float(np.mean(arr[:, 0]))
        center_lat = float(np.mean(arr[:, 1]))

    # Try real GEE statistics first
    real_results = _compute_real_statistics(geometry_geojson, metrics)
    if real_results:
        return {
            "success": True,
            "metrics": real_results,
            "center": [center_lon, center_lat],
            "source": "Google Earth Engine (Real Satellite Data)",
        }

    # Fallback to simulated statistics
    logger.warning("Using simulated satellite statistics")
    return _generate_fallback_statistics(geometry_geojson, metrics, center_lon, center_lat)


# ─────────────────────────────────────────────────────────────────────────────
# Simulated fallback (only used if GEE is not available at all)
# ─────────────────────────────────────────────────────────────────────────────

def _generate_fallback_statistics(
    geometry_geojson: Dict[str, Any],
    metrics: List[str],
    center_lon: float,
    center_lat: float,
) -> Dict[str, Any]:
    """Generate simulated statistics when GEE is unavailable."""
    seed = int(abs(center_lon * 1000) + abs(center_lat * 1000)) % 100000
    rng = np.random.default_rng(seed)

    results: Dict[str, Any] = {}

    if "elevation" in metrics:
        base = 5.0 + rng.uniform(0, 30)
        results["elevation"] = {
            "mean": round(base, 2),
            "min": round(max(0, base - rng.uniform(3, 10)), 2),
            "max": round(base + rng.uniform(8, 25), 2),
            "unit": "meters",
            "dataset": "Simulated",
            "real_data": False,
        }

    if "ndvi" in metrics:
        mean_ndvi = round(0.15 + rng.uniform(0, 0.5), 3)
        results["ndvi"] = {
            "mean": mean_ndvi,
            "vegetation_density": "Simulated",
            "canopy_cover_pct": round(mean_ndvi * 100, 1),
            "real_data": False,
        }

    if "nightlights" in metrics:
        results["nightlights"] = {
            "mean": round(rng.uniform(1, 40), 2),
            "urban_activity": "Simulated",
            "radiance_unit": "nW/cm²/sr",
            "real_data": False,
        }

    return {
        "success": True,
        "metrics": results,
        "center": [center_lon, center_lat],
        "source": "Simulated Data (GEE Unavailable)",
    }


def _generate_fallback_grid(geometry_geojson: Dict[str, Any], layer_type: str) -> Dict[str, Any]:
    """Generate a simulated spatial grid when GEE is unavailable."""
    coords = geometry_geojson.get("coordinates", [])
    flat_coords = []
    if coords:
        for ring in coords:
            for pt in ring:
                if len(pt) >= 2:
                    flat_coords.append(pt)

    if not flat_coords:
        min_lon, min_lat, max_lon, max_lat = 79.83, 6.90, 79.89, 6.96
    else:
        flat_coords = np.array(flat_coords)
        min_lon = float(np.min(flat_coords[:, 0]))
        max_lon = float(np.max(flat_coords[:, 0]))
        min_lat = float(np.min(flat_coords[:, 1]))
        max_lat = float(np.max(flat_coords[:, 1]))

    steps = 40
    lon_step = (max_lon - min_lon) / steps
    lat_step = (max_lat - min_lat) / steps

    seed = int(abs(min_lon * 1000) + abs(min_lat * 1000)) % 100000
    rng = np.random.default_rng(seed)
    features = []

    for r in range(steps):
        for c in range(steps):
            cell_min_lon = min_lon + c * lon_step
            cell_max_lon = cell_min_lon + lon_step
            cell_min_lat = min_lat + r * lat_step
            cell_max_lat = cell_min_lat + lat_step

            val = rng.uniform(0, 1)

            if layer_type == "elevation":
                ev = val * 60
                norm = val
                color = _interpolate_color(norm, ELEVATION_RAMP)
                props = {"value": round(ev, 1), "normalized_value": round(norm, 3), "color": color, "unit": "m"}
            elif layer_type == "ndvi":
                nv = val * 0.8
                norm = val
                color = _interpolate_color(norm, NDVI_RAMP)
                props = {"value": round(nv, 3), "normalized_value": round(norm, 3), "color": color, "unit": "NDVI"}
            elif layer_type == "nightlights":
                nlv = val * 50
                norm = val
                color = _interpolate_color(norm, NIGHTLIGHTS_RAMP)
                props = {"value": round(nlv, 1), "normalized_value": round(norm, 3), "color": color, "unit": "nW/cm²/sr"}
            else:
                codes = list(LANDCOVER_MAP.keys())
                code = rng.choice(codes)
                label, color = LANDCOVER_MAP[code]
                props = {"value": label, "normalized_value": 0.5, "color": color, "unit": "class"}

            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[
                        [cell_min_lon, cell_min_lat],
                        [cell_max_lon, cell_min_lat],
                        [cell_max_lon, cell_max_lat],
                        [cell_min_lon, cell_max_lat],
                        [cell_min_lon, cell_min_lat],
                    ]]
                },
                "properties": props,
            })

    legend = {
        "elevation": ELEVATION_LEGEND,
        "ndvi": NDVI_LEGEND,
        "nightlights": NIGHTLIGHTS_LEGEND,
    }.get(layer_type, LANDCOVER_LEGEND)

    return {
        "success": True,
        "mode": "fallback_grid",
        "geojson": {"type": "FeatureCollection", "features": features},
        "legend": legend,
        "source": "Simulated Data (GEE Unavailable)",
    }
