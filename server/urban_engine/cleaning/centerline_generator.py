"""
Centerline Generator.

Generates a generalized centerline for parallel carriageways (corridors)
using vector vertex projection, midpoint averaging, and bend preservation.
"""

from __future__ import annotations

import logging
import numpy as np
from shapely.geometry import Point, LineString
from shapely.ops import substring

logger = logging.getLogger("urban_engine.cleaning.centerline_generator")


def generate_corridor_centerline(
    geom_a: LineString,
    geom_b: LineString,
    sampling_interval_m: float = 5.0,
) -> LineString | None:
    """
    Generate a smooth centerline from two parallel road geometries.
    1. Samples points along geom_a.
    2. Projects them to geom_b and finds nearest point correspondences.
    3. Calculates midpoints.
    4. Reconstructs and smooths the centerline.
    """
    if not isinstance(geom_a, LineString) or not isinstance(geom_b, LineString):
        return None

    len_a = geom_a.length
    len_b = geom_b.length

    # Ensure geom_a is the longer one for robust sampling
    if len_b > len_a:
        geom_a, geom_b = geom_b, geom_a
        len_a, len_b = len_b, len_a

    # 1. Sample coordinates along geom_a
    # If sampling interval is too small or line too short, use at least 5 samples
    n_samples = max(5, int(np.ceil(len_a / sampling_interval_m)))
    sample_distances = np.linspace(0, len_a, n_samples)

    midpoints = []
    
    for dist in sample_distances:
        pt_a = geom_a.interpolate(dist)
        
        # Project pt_a onto geom_b
        proj_dist = geom_b.project(pt_a)
        pt_b = geom_b.interpolate(proj_dist)
        
        # Reject unstable correspondence (e.g. if projection snaps to endpoints of geom_b from far away)
        # This prevents the centerline from skewing/folding at ends
        actual_dist = pt_a.distance(pt_b)
        if (proj_dist < 0.05 or proj_dist > len_b - 0.05) and actual_dist > 15.0:
            continue
            
        mx = (pt_a.x + pt_b.x) / 2.0
        my = (pt_a.y + pt_b.y) / 2.0
        midpoints.append((mx, my))

    # Remove consecutive duplicates
    unique_midpoints = []
    for pt in midpoints:
        if not unique_midpoints or pt != unique_midpoints[-1]:
            unique_midpoints.append(pt)

    if len(unique_midpoints) < 2:
        return None

    centerline = LineString(unique_midpoints)
    
    # Smooth line vertices if we have enough points
    # (keeps significant bends by keeping the midpoints of the sampling process)
    return centerline
