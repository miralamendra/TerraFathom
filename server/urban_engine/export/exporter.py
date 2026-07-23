"""
Export Engine.

Generates pipeline output formats: GeoParquet, GeoPackage, WGS84 GeoJSON,
GraphML (with geometry WKT attributes), and Web Preview layers.
"""

from __future__ import annotations

import logging
import json
from pathlib import Path
from typing import Any, Dict
from enum import Enum

import geopandas as gpd
import networkx as nx
import shapely

logger = logging.getLogger("urban_engine.export.exporter")


def export_all_outputs(
    ctx: Any,
    output_dir: Path,
) -> Dict[str, Path]:
    """
    Export all outputs required by the configuration.
    Returns dictionary mapping format/layer name to output Path.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    exported_paths: Dict[str, Path] = {}

    roads_gdf = ctx.road_segments
    nodes_gdf = ctx.road_nodes
    buildings_gdf = ctx.buildings
    graphs = ctx.graphs

    # 1. GeoParquet (Metric analysis CRS)
    try:
        roads_parquet = output_dir / "roads.parquet"
        roads_gdf.to_parquet(roads_parquet)
        exported_paths["roads_parquet"] = roads_parquet
        
        nodes_parquet = output_dir / "nodes.parquet"
        nodes_gdf.to_parquet(nodes_parquet)
        exported_paths["nodes_parquet"] = nodes_parquet

        if buildings_gdf is not None and not buildings_gdf.empty:
            buildings_parquet = output_dir / "buildings.parquet"
            buildings_gdf.to_parquet(buildings_parquet)
            exported_paths["buildings_parquet"] = buildings_parquet
    except Exception as e:
        logger.error("Failed to export GeoParquet: %s", e)

    # Copy dataframes to drop index name before fiona/gdal to_file calls
    roads_to_file = roads_gdf.copy()
    if roads_to_file.index.name is not None:
        roads_to_file.index.name = None

    nodes_to_file = nodes_gdf.copy()
    if nodes_to_file.index.name is not None:
        nodes_to_file.index.name = None

    # Convert complex lists/dicts to strings for GPKG/Fiona compatibility
    for col in ["repair_history", "parents", "children", "confidence"]:
        if col in roads_to_file.columns:
            roads_to_file[col] = roads_to_file[col].apply(lambda x: json.dumps(x) if isinstance(x, (list, dict)) else str(x))

    # 2. GeoPackage (All layers in GPKG)
    try:
        gpkg_path = output_dir / "urban_network.gpkg"
        if gpkg_path.exists():
            gpkg_path.unlink()
            
        roads_to_file.to_file(gpkg_path, driver="GPKG", layer="roads")
        nodes_to_file.to_file(gpkg_path, driver="GPKG", layer="nodes")
        
        if buildings_gdf is not None and not buildings_gdf.empty:
            buildings_to_file = buildings_gdf.copy()
            if buildings_to_file.index.name is not None:
                buildings_to_file.index.name = None
            buildings_to_file.to_file(gpkg_path, driver="GPKG", layer="buildings")
            
        exported_paths["geopackage"] = gpkg_path
    except Exception as e:
        logger.error("Failed to export GeoPackage: %s", e)

    # 3. GeoJSON snap shots & visualization layers (WGS84)
    try:
        from shapely.geometry import Point
        
        def _serialize_geojson_columns(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
            from enum import Enum as PyEnum
            df_copy = gdf.copy()
            for col in df_copy.columns:
                if col == "geometry":
                    continue
                df_copy[col] = df_copy[col].apply(
                    lambda x: json.dumps(x) if isinstance(x, (list, dict, set))
                    else (x.value if isinstance(x, PyEnum) else x)
                )
            return df_copy

        # A. raw_roads.geojson (v0)
        if ctx.v0_raw is not None and not ctx.v0_raw.empty:
            raw_path = output_dir / "raw_roads.geojson"
            _serialize_geojson_columns(ctx.v0_raw).to_crs("EPSG:4326").to_file(raw_path, driver="GeoJSON")
            exported_paths["raw_roads"] = raw_path

        # B. clean_roads.geojson (v1)
        if ctx.v1_clean is not None and not ctx.v1_clean.empty:
            clean_path = output_dir / "clean_roads.geojson"
            _serialize_geojson_columns(ctx.v1_clean).to_crs("EPSG:4326").to_file(clean_path, driver="GeoJSON")
            exported_paths["clean_roads"] = clean_path

        # C. v2_topology.geojson
        if ctx.v2_topology is not None and not ctx.v2_topology.empty:
            topo_path = output_dir / "v2_topology.geojson"
            _serialize_geojson_columns(ctx.v2_topology).to_crs("EPSG:4326").to_file(topo_path, driver="GeoJSON")
            exported_paths["v2_topology"] = topo_path

        # D. corridors.geojson (v3)
        if ctx.v3_corridors is not None and not ctx.v3_corridors.empty:
            corridor_path = output_dir / "corridors.geojson"
            _serialize_geojson_columns(ctx.v3_corridors).to_crs("EPSG:4326").to_file(corridor_path, driver="GeoJSON")
            exported_paths["corridors"] = corridor_path

        # E. validation.geojson
        validation_features = []
        for issue in ctx.validation_issues:
            for f_id in issue.get("feature_ids", []):
                # Retrieve from v1_clean or raw
                lookup_gdf = ctx.v1_clean if ctx.v1_clean is not None else ctx.road_segments
                if lookup_gdf is not None and f_id in lookup_gdf.index:
                    geom = lookup_gdf.loc[f_id].geometry
                    validation_features.append({
                        "geometry": geom,
                        "issue_code": issue["code"],
                        "severity": issue["severity"],
                        "message": issue["message"],
                        "feature_id": str(f_id)
                    })
        if validation_features:
            val_gdf = gpd.GeoDataFrame(validation_features, crs=ctx.analysis_crs)
            val_path = output_dir / "validation.geojson"
            _serialize_geojson_columns(val_gdf).to_crs("EPSG:4326").to_file(val_path, driver="GeoJSON")
            exported_paths["validation_geojson"] = val_path

        # F. repair_points.geojson
        repair_points = []
        for mod in ctx.modifications_log:
            if mod.geom_after_wkt:
                try:
                    from shapely.wkt import loads
                    geom = loads(mod.geom_after_wkt)
                    if isinstance(geom, Point):
                        repair_points.append({
                            "geometry": geom,
                            "repair_id": mod.id,
                            "type": mod.type.value,
                            "reason": mod.reason,
                            "method": mod.method,
                            "confidence": mod.confidence.get("overall", 100.0)
                        })
                except Exception:
                    pass
        if repair_points:
            rep_gdf = gpd.GeoDataFrame(repair_points, crs=ctx.analysis_crs)
            rep_path = output_dir / "repair_points.geojson"
            _serialize_geojson_columns(rep_gdf).to_crs("EPSG:4326").to_file(rep_path, driver="GeoJSON")
            exported_paths["repair_points"] = rep_path

        # G. junctions.geojson
        junctions_path = output_dir / "junctions.geojson"
        nodes_wgs84 = _serialize_geojson_columns(nodes_to_file).to_crs("EPSG:4326")
        nodes_wgs84.to_file(junctions_path, driver="GeoJSON")
        exported_paths["junctions_geojson"] = junctions_path

        # H. Default preview layer for UI (Repaired Roads mapping)
        roads_wgs84 = _serialize_geojson_columns(roads_to_file).to_crs("EPSG:4326")
        preview_geojson = output_dir / "preview_segments.geojson"
        roads_wgs84.to_file(preview_geojson, driver="GeoJSON")
        exported_paths["preview_segments"] = preview_geojson

    except Exception as e:
        logger.error("Failed to export GeoJSON layers: %s", e)

    # 4. GraphML (With WKT geometry attributes)
    try:
        for g_name, g in graphs.items():
            graphml_path = output_dir / f"{g_name}_graph.graphml"
            g_export = g.copy()
            
            for n_id, n_data in g_export.nodes(data=True):
                if n_id in nodes_gdf.index:
                    n_geom = nodes_gdf.geometry.loc[n_id]
                    n_data["wkt"] = n_geom.wkt
                for k, v in list(n_data.items()):
                    if isinstance(v, Enum):
                        n_data[k] = v.value
                    elif isinstance(v, dict):
                        n_data[k] = json.dumps(v)
            
            if isinstance(g_export, nx.MultiGraph) or isinstance(g_export, nx.MultiDiGraph):
                for u, v, key, e_data in g_export.edges(keys=True, data=True):
                    if key in roads_gdf.index:
                        e_geom = roads_gdf.geometry.loc[key]
                        e_data["wkt"] = e_geom.wkt
                    for k, v in list(e_data.items()):
                        if isinstance(v, Enum):
                            e_data[k] = v.value
                        elif isinstance(v, dict):
                            e_data[k] = json.dumps(v)
            
            nx.write_graphml(g_export, graphml_path)
            exported_paths[f"{g_name}_graphml"] = graphml_path
            
    except Exception as e:
        logger.error("Failed to export GraphML: %s", e)

    # 5. Export Modifications Report JSON & Markdown
    try:
        mods_list = [m.to_dict() for m in ctx.modifications_log]
        mods_path = output_dir / "modifications_report.json"
        with open(mods_path, "w") as f:
            json.dump(mods_list, f, indent=2)
        exported_paths["modifications_json"] = mods_path

        md_lines = ["# Corridor Inference Modifications Report\n", f"Job ID: {ctx.job_id}\n", "## Applied Actions\n"]
        for m in ctx.modifications_log:
            md_lines.append(f"### [{m.type.value}] {m.id}")
            md_lines.append(f"- **Reason**: {m.reason}")
            md_lines.append(f"- **Method**: {m.method}")
            md_lines.append(f"- **Confidence**: Overall {m.confidence.get('overall', 100.0)}% (Geometry: {m.confidence.get('geometry')}%, Topology: {m.confidence.get('topology')}%)\n")
        
        md_path = output_dir / "modifications_report.md"
        md_path.write_text("\n".join(md_lines))
        exported_paths["modifications_md"] = md_path
    except Exception as e:
        logger.error("Failed to write modifications report: %s", e)

    # 6. Export QA Report JSON & Markdown
    try:
        if hasattr(ctx, "quality_report") and ctx.quality_report:
            qa_json_path = output_dir / "qa_report.json"
            with open(qa_json_path, "w") as f:
                json.dump(ctx.quality_report, f, indent=2)
            exported_paths["qa_report_json"] = qa_json_path

            # Create QA markdown report
            qa = ctx.quality_report
            qa_md_lines = [
                "# Network Quality Assurance (QA) Report\n",
                f"Job ID: {ctx.job_id}\n",
                f"Overall Status: **{qa.get('status', 'passed').upper()}**\n",
                "## Summary Statistics\n",
                f"- Total Road Segments: {qa.get('statistics', {}).get('total_segments', 0)}",
                f"- Total Junction Nodes: {qa.get('statistics', {}).get('total_nodes', 0)}",
                f"- Total Buildings: {qa.get('statistics', {}).get('total_buildings', 0)}\n",
                "## Geometry Checks\n",
                f"- Status: **{'PASSED' if qa.get('geometry_checks', {}).get('passed') else 'NEEDS WORK'}**",
                f"- Failed Features Count: {qa.get('geometry_checks', {}).get('failed_count', 0)}\n",
                "## Topology Checks\n",
                f"- Status: **{'PASSED' if qa.get('topology_checks', {}).get('passed') else 'NEEDS WORK'}**",
                f"- Failed Features Count: {qa.get('topology_checks', {}).get('failed_count', 0)}\n",
                "## Semantic Checks\n",
                f"- Status: **{'PASSED' if qa.get('semantic_checks', {}).get('passed') else 'NEEDS WORK'}**",
                f"- Failed Features Count: {qa.get('semantic_checks', {}).get('failed_count', 0)}\n"
            ]
            qa_md_path = output_dir / "qa_report.md"
            qa_md_path.write_text("\n".join(qa_md_lines))
            exported_paths["qa_report_md"] = qa_md_path
    except Exception as e:
        logger.error("Failed to write QA report: %s", e)

    logger.info("All outputs successfully written to %s", output_dir)
    return exported_paths
