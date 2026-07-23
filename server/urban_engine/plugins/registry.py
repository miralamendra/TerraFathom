"""
Analysis Plugin Registry.

Registers and manages analysis plugins.
"""

from __future__ import annotations

import logging
from typing import Dict, List, Type

from .base_plugin import AnalysisPlugin

logger = logging.getLogger("urban_engine.plugins.registry")


class PluginRegistry:
    """Registry for discovering and managing analysis plugins."""

    def __init__(self) -> None:
        self._plugins: Dict[str, AnalysisPlugin] = {}

    def register(self, plugin: AnalysisPlugin) -> None:
        """Register a plugin instance."""
        if plugin.name in self._plugins:
            logger.warning(
                "Overwriting plugin '%s' (version %s) with version %s",
                plugin.name,
                self._plugins[plugin.name].version,
                plugin.version,
            )
        self._plugins[plugin.name] = plugin
        logger.info("Registered plugin '%s' (version %s)", plugin.name, plugin.version)

    def get(self, name: str) -> AnalysisPlugin | None:
        """Get plugin by name."""
        return self._plugins.get(name)

    def list_plugins(self) -> List[AnalysisPlugin]:
        """List all registered plugins."""
        return list(self._plugins.values())


# Global registry instance
registry = PluginRegistry()
