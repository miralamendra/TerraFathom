from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List

class RepairType(str, Enum):
    MERGED_CARRIAGEWAY = "MERGED_CARRIAGEWAY"
    ROUNDABOUT_COLLAPSE = "ROUNDABOUT_COLLAPSE"
    SNAP_ENDPOINT = "SNAP_ENDPOINT"
    REMOVE_DUPLICATE = "REMOVE_DUPLICATE"
    SPLIT_INTERSECTION = "SPLIT_INTERSECTION"
    SIMPLIFY_GEOMETRY = "SIMPLIFY_GEOMETRY"
    FIX_DIRECTION = "FIX_DIRECTION"
    REMOVE_FRAGMENT = "REMOVE_FRAGMENT"

@dataclass
class ModificationRecord:
    id: str  # TF_REPAIR_...
    type: RepairType
    reason: str
    method: str
    confidence: Dict[str, float]  # geometry, topology, semantics, connectivity, overall
    affected_feature_ids: List[str]
    geom_before_wkt: str | None = None
    geom_after_wkt: str | None = None
    undone: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "type": self.type.value,
            "reason": self.reason,
            "method": self.method,
            "confidence": self.confidence,
            "affected_feature_ids": self.affected_feature_ids,
            "geom_before_wkt": self.geom_before_wkt,
            "geom_after_wkt": self.geom_after_wkt,
            "undone": self.undone,
        }
