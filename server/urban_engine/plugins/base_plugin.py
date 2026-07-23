"""
Analysis Plugin Base Class.

All analysis plugins (Space Syntax, Centrality, Walkability, etc.)
inherit from this. Plugins register themselves and declare which
graph types they need.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

import geopandas as gpd


@dataclass
class PluginContext:
    """Context provided to analysis plugins."""

    segments: gpd.GeoDataFrame
    nodes: gpd.GeoDataFrame
    buildings: gpd.GeoDataFrame | None
    graphs: dict[str, Any]  # graph_type → networkx graph
    config: dict[str, Any]
    metadata: dict[str, Any]
    output_dir: str


@dataclass
class PluginResult:
    """Result from an analysis plugin."""

    name: str
    version: str
    success: bool
    data: dict[str, Any] = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    output_files: list[str] = field(default_factory=list)


class AnalysisPlugin(ABC):
    """
    Base class for all analysis plugins.

    Future plugins:
      - SpaceSyntaxPlugin
      - NetworkCentralityPlugin
      - WalkabilityPlugin
      - AccessibilityPlugin
      - RouteOptimizationPlugin
      - UrbanMorphologyPlugin
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Plugin identifier (e.g., 'space_syntax')."""
        ...

    @property
    @abstractmethod
    def version(self) -> str:
        """Plugin version string."""
        ...

    @property
    @abstractmethod
    def description(self) -> str:
        """Human-readable description."""
        ...

    @property
    @abstractmethod
    def required_graphs(self) -> list[str]:
        """
        Which graph types this plugin needs.
        Options: 'physical', 'directed', 'pedestrian', 'vehicle'
        """
        ...

    @abstractmethod
    def validate_input(
        self,
        segments: gpd.GeoDataFrame,
        nodes: gpd.GeoDataFrame,
    ) -> list[str]:
        """
        Validate that input data meets plugin requirements.
        Returns list of error messages (empty = OK).
        """
        ...

    @abstractmethod
    def run(self, context: PluginContext) -> PluginResult:
        """Execute the analysis. Returns a PluginResult."""
        ...
