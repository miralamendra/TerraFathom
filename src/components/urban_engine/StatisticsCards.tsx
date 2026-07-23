import { useState } from 'react';
import { ChevronDown, ChevronRight, Activity, Layers, GitBranch, Shield, Map } from 'lucide-react';

interface StatisticsCardsProps {
  statistics: any;
}

export function StatisticsCards({ statistics }: StatisticsCardsProps) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    roads: true,
    buildings: true,
    topology: false,
    graphs: false,
    connectivity: false,
  });

  const toggleSection = (sec: string) => {
    setOpenSections((prev) => ({ ...prev, [sec]: !prev[sec] }));
  };

  const renderSectionHeader = (key: string, label: string, Icon: any) => {
    const isOpen = openSections[key];
    return (
      <button
        type="button"
        onClick={() => toggleSection(key)}
        className="w-full flex items-center justify-between py-2 text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary border-b border-border-primary/50 hover:text-text-primary transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <Icon size={12} className="text-text-tertiary" />
          <span>{label}</span>
        </div>
        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 1. Roads */}
      <div className="flex flex-col gap-2">
        {renderSectionHeader('roads', 'Road Statistics', Map)}
        {openSections.roads && statistics.roads && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 py-1 text-xs">
            <div className="flex justify-between border-b border-border-primary/20 pb-1">
              <span className="text-text-tertiary">Total segments</span>
              <span className="font-semibold font-mono text-text-primary">{statistics.roads.total_count}</span>
            </div>
            <div className="flex justify-between border-b border-border-primary/20 pb-1">
              <span className="text-text-tertiary">Total length</span>
              <span className="font-semibold font-mono text-text-primary">{statistics.roads.total_length_km} km</span>
            </div>
            <div className="flex justify-between border-b border-border-primary/20 pb-1 col-span-2">
              <span className="text-text-tertiary">Average speed limit</span>
              <span className="font-semibold font-mono text-text-primary">{statistics.roads.average_speed_kmh} km/h</span>
            </div>
          </div>
        )}
      </div>

      {/* 2. Buildings */}
      <div className="flex flex-col gap-2">
        {renderSectionHeader('buildings', 'Building Statistics', Layers)}
        {openSections.buildings && statistics.buildings && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 py-1 text-xs">
            <div className="flex justify-between border-b border-border-primary/20 pb-1">
              <span className="text-text-tertiary">Total buildings</span>
              <span className="font-semibold font-mono text-text-primary">{statistics.buildings.total_count}</span>
            </div>
            <div className="flex justify-between border-b border-border-primary/20 pb-1">
              <span className="text-text-tertiary">Footprint area</span>
              <span className="font-semibold font-mono text-text-primary">{Math.round(statistics.buildings.total_footprint_area_m2 / 1000)}k m²</span>
            </div>
            <div className="flex justify-between border-b border-border-primary/20 pb-1">
              <span className="text-text-tertiary">Average compactness</span>
              <span className="font-semibold font-mono text-text-primary">{statistics.buildings.average_compactness}</span>
            </div>
            <div className="flex justify-between border-b border-border-primary/20 pb-1">
              <span className="text-text-tertiary">Average area</span>
              <span className="font-semibold font-mono text-text-primary">{statistics.buildings.average_area_m2} m²</span>
            </div>
          </div>
        )}
      </div>

      {/* 3. Topology */}
      <div className="flex flex-col gap-2">
        {renderSectionHeader('topology', 'Topology Statistics', GitBranch)}
        {openSections.topology && statistics.topology && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 py-1 text-xs">
            <div className="flex justify-between border-b border-border-primary/20 pb-1">
              <span className="text-text-tertiary">Junction nodes</span>
              <span className="font-semibold font-mono text-text-primary">{statistics.topology.total_nodes}</span>
            </div>
            <div className="flex justify-between border-b border-border-primary/20 pb-1">
              <span className="text-text-tertiary">Dead-end segments</span>
              <span className="font-semibold font-mono text-text-primary">{statistics.topology.dead_end_nodes_count}</span>
            </div>
            <div className="flex justify-between border-b border-border-primary/20 pb-1 col-span-2">
              <span className="text-text-tertiary">Dead-end ratio</span>
              <span className="font-semibold font-mono text-text-primary">{statistics.topology.dead_end_percentage}%</span>
            </div>
          </div>
        )}
      </div>

      {/* 4. Connectivity */}
      <div className="flex flex-col gap-2">
        {renderSectionHeader('connectivity', 'Connectivity & Components', Shield)}
        {openSections.connectivity && statistics.connectivity && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 py-1 text-xs">
            <div className="flex justify-between border-b border-border-primary/20 pb-1">
              <span className="text-text-tertiary">Components</span>
              <span className="font-semibold font-mono text-text-primary">{statistics.connectivity.connected_components_count}</span>
            </div>
            <div className="flex justify-between border-b border-border-primary/20 pb-1">
              <span className="text-text-tertiary">Isolated nodes</span>
              <span className="font-semibold font-mono text-text-primary">{statistics.connectivity.isolated_nodes_count}</span>
            </div>
            <div className="flex justify-between border-b border-border-primary/20 pb-1 col-span-2">
              <span className="text-text-tertiary">Largest component size</span>
              <span className="font-semibold font-mono text-text-primary">
                {statistics.connectivity.largest_component_size_nodes} nodes ({statistics.connectivity.largest_component_percentage}%)
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 5. Performance */}
      <div className="flex flex-col gap-2">
        {renderSectionHeader('performance', 'Engine Performance', Activity)}
        {openSections.performance && statistics.performance && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 py-1 text-xs">
            <div className="flex justify-between border-b border-border-primary/20 pb-1">
              <span className="text-text-tertiary">Processing time</span>
              <span className="font-semibold font-mono text-text-primary">{statistics.performance.processing_time_s}s</span>
            </div>
            <div className="flex justify-between border-b border-border-primary/20 pb-1">
              <span className="text-text-tertiary">Peak memory</span>
              <span className="font-semibold font-mono text-text-primary">{statistics.performance.peak_memory_mb || 'N/A'} MB</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
export default StatisticsCards;
