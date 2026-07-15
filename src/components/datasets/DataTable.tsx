import { useState, useEffect } from 'react';
import { useDataStore } from '@/stores/data-store';
import { useUIStore } from '@/stores/ui-store';
import { useFilterStore } from '@/stores/filter-store';
import { useMapStore } from '@/stores/map-store';
import { applyFilters } from '@/core/filters/filter-engine';
import { cn } from '@/components/ui/utils';
import { ChevronUp, ChevronDown } from 'lucide-react';

export function DataTable() {
  const selectedId = useUIStore((s) => s.selectedDatasetId);
  const datasets = useDataStore((s) => s.datasets);
  const filters = useFilterStore((s) => s.filters);

  const dataset = selectedId ? datasets[selectedId] : null;

  const selectedRowIndex = useUIStore((s) => s.selectedRowIndex);
  const setSelectedRowIndex = useUIStore((s) => s.setSelectedRowIndex);

  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Auto-scroll selected row into view
  useEffect(() => {
    if (selectedRowIndex !== null) {
      // Small timeout to allow the table to render/reflow first
      const timer = setTimeout(() => {
        const el = document.querySelector(`[data-row-id="${selectedRowIndex}"]`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [selectedRowIndex]);

  if (!dataset) {
    return (
      <div className="text-center text-text-tertiary p-8 font-sans text-xs">
        No dataset selected to inspect. Choose a dataset from the Left Panel or Toolbar.
      </div>
    );
  }

  const datasetFilters = filters.filter((f) => f.datasetId === dataset.id);
  const filteredRecords = applyFilters(dataset.records, datasetFilters);

  if (filteredRecords.length === 0) {
    return (
      <div className="text-center text-text-tertiary p-8 font-sans text-xs flex flex-col items-center justify-center gap-1">
        <span className="font-semibold text-text-secondary">No rows match filters</span>
        <span className="text-[11px]">Try disabling or widening your active filters in the Left Sidebar.</span>
      </div>
    );
  }

  const { fields } = dataset;
  const headers = fields.map((f) => f.name);
  
  // Sort records
  const sortedRecords = [...filteredRecords].sort((a, b) => {
    if (!sortField) return 0;
    const aVal = a[sortField];
    const bVal = b[sortField];
    if (aVal === bVal) return 0;
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;
    
    const direction = sortDirection === 'asc' ? 1 : -1;
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return (aVal - bVal) * direction;
    }
    return String(aVal).localeCompare(String(bVal)) * direction;
  });

  // Shift selected record to the very top of the table
  if (selectedRowIndex !== null) {
    const selectedIdx = sortedRecords.findIndex((r) => r.__id === selectedRowIndex);
    if (selectedIdx !== -1) {
      const [selectedRecord] = sortedRecords.splice(selectedIdx, 1);
      sortedRecords.unshift(selectedRecord);
    }
  }

  const displayLimit = 100;
  const slicedRecords = sortedRecords.slice(0, displayLimit);

  const getFieldType = (fieldName: string) => {
    return fields.find((f) => f.name === fieldName)?.type;
  };

  const isNumeric = (fieldName: string) => {
    const type = getFieldType(fieldName);
    return type === 'integer' || type === 'real';
  };

  // Helper to format values for tabular representation
  const formatCellValue = (value: unknown, header: string): string => {
    if (value === null || value === undefined) {
      return '-';
    }
    
    if (header === 'geometry' && typeof value === 'object') {
      const geom = value as { type: string; coordinates?: unknown };
      if (geom.type === 'Point' && Array.isArray(geom.coordinates)) {
        const [lng, lat] = geom.coordinates;
        return `Point [${Number(lng).toFixed(5)}, ${Number(lat).toFixed(5)}]`;
      }
      return geom.type || 'Geometry';
    }

    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    
    return String(value);
  };

  const handleHeaderClick = (header: string) => {
    if (sortField === header) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(header);
      setSortDirection('asc');
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-bg-secondary select-none font-sans text-xs">
      {/* Table Info Bar */}
      <div className="px-4 py-2 bg-bg-tertiary border-b border-border-primary text-text-secondary flex justify-between items-center text-xs">
        <span className="font-medium">
          {filteredRecords.length.toLocaleString()} rows
          {filteredRecords.length > displayLimit && (
            <span className="text-text-tertiary ml-2">· showing first {displayLimit}</span>
          )}
        </span>
        <span className="text-text-tertiary">{dataset.name}</span>
      </div>

      {/* Grid Container */}
      <div className="flex-1 overflow-auto min-h-0 scrollbar-thin">
        <table className="w-full border-collapse text-left table-fixed">
          <colgroup>
            {headers.map((header: string) => {
              const numeric = isNumeric(header);
              return (
                <col
                  key={header}
                  style={{
                    width: numeric ? '110px' : 'minmax(140px, 1fr)',
                    minWidth: numeric ? '90px' : '140px',
                    maxWidth: numeric ? '140px' : '320px',
                  }}
                />
              );
            })}
          </colgroup>
          <thead className="sticky top-0 bg-bg-tertiary z-10">
            <tr className="h-8">
              {headers.map((header: string, idx: number) => {
                const numeric = isNumeric(header);
                const isFirst = idx === 0;
                return (
                  <th
                    key={header}
                    onClick={() => handleHeaderClick(header)}
                    className={cn(
                      "px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-text-tertiary select-none cursor-pointer bg-bg-tertiary hover:bg-bg-hover hover:text-text-primary transition-colors border-b border-border-primary overflow-hidden",
                      numeric ? "text-right" : "text-left",
                      isFirst ? "sticky left-0 z-20 shadow-[2px_0_5px_rgba(0,0,0,0.05)]" : ""
                    )}
                  >
                    <div className={cn("flex items-center gap-1.5", numeric ? "justify-end" : "justify-start")}>
                      <span className="truncate block min-w-0" title={header}>{header}</span>
                      {sortField === header && (
                        <span className="text-accent shrink-0">
                          {sortDirection === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {slicedRecords.map((record, rowIndex) => {
              const recordId = record.__id as number;
              const isSelected = selectedRowIndex === recordId;
              return (
                <tr
                  key={rowIndex}
                  data-row-id={recordId}
                  onClick={() => {
                    setSelectedRowIndex(recordId);

                    let lat: number | undefined;
                    let lng: number | undefined;

                    if (typeof record.latitude === 'number' && typeof record.longitude === 'number') {
                      lat = record.latitude;
                      lng = record.longitude;
                    } else if (dataset.latField && dataset.lngField) {
                      lat = Number(record[dataset.latField]);
                      lng = Number(record[dataset.lngField]);
                    } else if (record.geometry) {
                      const geom = record.geometry as any;
                      if (geom.type === 'Point' && Array.isArray(geom.coordinates)) {
                        lng = geom.coordinates[0];
                        lat = geom.coordinates[1];
                      }
                    }

                    if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
                      // Apply map offset if bottom drawer is open
                      const targetZoom = 16.5;
                      const drawerOpen = useUIStore.getState().bottomDrawerOpen;
                      const latOffset = drawerOpen ? (42 / Math.pow(2, targetZoom)) : 0;

                      useMapStore.getState().animateViewport({
                        longitude: lng,
                        latitude: lat - latOffset,
                        zoom: targetZoom,
                        pitch: 50,
                        bearing: 25,
                      }, 1200);
                    }
                  }}
                  className={cn(
                    "h-8 transition-colors duration-100 cursor-pointer select-none",
                    isSelected
                      ? "bg-bg-active text-text-primary"
                      : "bg-transparent hover:bg-bg-hover"
                  )}
                >
                  {headers.map((header: string, idx: number) => {
                    const rawVal = record[header];
                    const numeric = isNumeric(header);
                    const isFirst = idx === 0;
                    const display = formatCellValue(rawVal, header);
                    return (
                      <td
                        key={header}
                        className={cn(
                          "px-3 truncate text-text-primary font-normal text-xs border-b border-border-primary overflow-hidden",
                          numeric ? "text-right font-mono tabular-nums" : "text-left font-sans",
                          isFirst ? "sticky left-0 bg-inherit z-0" : "",
                          rawVal === null || rawVal === undefined ? "text-text-tertiary" : ""
                        )}
                        title={display}
                      >
                        {display}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
export default DataTable;
