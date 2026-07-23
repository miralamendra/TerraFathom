import hashlib

def generate_stable_id(prefix: str, content: str) -> str:
    """Generate a deterministic stable ID prefixed by the given type."""
    h = hashlib.md5(content.encode()).hexdigest()[:12]
    return f"{prefix}_{h}"

def generate_node_id(x: float, y: float) -> str:
    """Generate deterministic stable node ID based on coordinate grid snapping (6 decimal places = ~10cm)."""
    content = f"{x:.6f}_{y:.6f}"
    return generate_stable_id("TF_NODE", content)

def generate_edge_id(start_node_id: str, end_node_id: str, index: int = 0) -> str:
    """Generate deterministic stable edge ID based on endpoints."""
    nodes = sorted([start_node_id, end_node_id])
    content = f"{nodes[0]}_{nodes[1]}_{index}"
    return generate_stable_id("TF_EDGE", content)

def generate_corridor_id(name: str | None, index: int) -> str:
    """Generate stable corridor ID."""
    name_str = name if name else "unnamed"
    content = f"{name_str}_{index}"
    return generate_stable_id("TF_CORRIDOR", content)

def generate_junction_id(node_id: str) -> str:
    """Generate stable junction ID based on node ID."""
    return generate_stable_id("TF_JUNCTION", node_id)

def generate_repair_id(repair_type: str, index: int) -> str:
    """Generate stable repair action ID."""
    content = f"{repair_type}_{index}"
    return generate_stable_id("TF_REPAIR", content)
