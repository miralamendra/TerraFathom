// Premium Network Labs Panel for geospatial-platform.
// Provides Centrality, Community, and Degree Distribution analyses on completed network runs.
// Results are plotted in high performance Deck.gl layers and custom SVG charts.

import { useState, useEffect, useMemo } from 'react';
import { useUrbanEngineStore } from '@/stores/urban-engine-store';
import { useDataStore } from '@/stores/data-store';
import { useLayerStore } from '@/stores/layer-store';
import { Button, Select } from '@/components/ui';
import { cn } from '@/components/ui/utils';
import { toast } from 'sonner';
import { GitBranch, Loader2, Play, BarChart2, ShieldCheck } from 'lucide-react';
import { useUIStore } from '@/stores/ui-store';
import { useMapStore } from '@/stores/map-store';

export function NetworkLabsPanel() {
  const {
    jobs,
    activeJob,
    isProcessing,
    fetchJobs,
    createJob,
    cancelJob,
  } = useUrbanEngineStore();
  
  const [selectedJobId, setSelectedJobId] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'centrality' | 'community' | 'distribution'>('centrality');
  const [calculating, setCalculating] = useState(false);

  // Quick Ingestion State
  const [newPlaceName, setNewPlaceName] = useState('Colombo, Sri Lanka');
  const [ingestType, setIngestType] = useState<'osm_place' | 'osm_bbox'>('osm_place');
  const [bbox, setBbox] = useState({ west: 79.83, south: 6.90, east: 79.89, north: 6.96 });
  const [ingestedJobId, setIngestedJobId] = useState<string | null>(null);

  // Map state and controls
  const mapLon = useMapStore((s) => s.longitude);
  const mapLat = useMapStore((s) => s.latitude);
  const mapZoom = useMapStore((s) => s.zoom);

  const selectionCoords = useUIStore((s) => s.selectionCoordinates);
  const selectionMode = useUIStore((s) => s.selectionMode);
  const setSelectionCoords = useUIStore((s) => s.setSelectionCoordinates);
  const setSelectionMode = useUIStore((s) => s.setSelectionMode);

  const syncBboxToMap = (nextBbox: typeof bbox) => {
    const rect = [
      [nextBbox.west, nextBbox.south],
      [nextBbox.east, nextBbox.south],
      [nextBbox.east, nextBbox.north],
      [nextBbox.west, nextBbox.north],
      [nextBbox.west, nextBbox.south],
    ] as [number, number][];
    setSelectionCoords(rect);
  };

  const handleBboxChange = (field: keyof typeof bbox, val: number) => {
    if (isNaN(val)) return;
    const next = { ...bbox, [field]: val };
    setBbox(next);
    syncBboxToMap(next);
  };

  const captureBboxFromMap = () => {
    const size = 360 / Math.pow(2, mapZoom);
    const next = {
      west: mapLon - size / 2,
      south: mapLat - size / 4,
      east: mapLon + size / 2,
      north: mapLat + size / 4,
    };
    setBbox(next);
    syncBboxToMap(next);
  };

  // Synchronize drawn coords back to state
  useEffect(() => {
    if (ingestType === 'osm_bbox' && !selectedJobId && selectionCoords.length === 5) {
      const lons = selectionCoords.map((c) => c[0]);
      const lats = selectionCoords.map((c) => c[1]);
      const nextWest = Math.min(...lons);
      const nextEast = Math.max(...lons);
      const nextSouth = Math.min(...lats);
      const nextNorth = Math.max(...lats);

      const eps = 0.00001;
      if (
        Math.abs(bbox.west - nextWest) > eps ||
        Math.abs(bbox.east - nextEast) > eps ||
        Math.abs(bbox.south - nextSouth) > eps ||
        Math.abs(bbox.north - nextNorth) > eps
      ) {
        setBbox({
          west: nextWest,
          east: nextEast,
          south: nextSouth,
          north: nextNorth,
        });
      }
    }
  }, [selectionCoords, ingestType, selectedJobId, bbox]);

  // Handle active drawing mode toggle
  useEffect(() => {
    if (ingestType === 'osm_bbox' && !selectedJobId) {
      setSelectionMode('rectangle');
      syncBboxToMap(bbox);
    } else {
      if (selectionMode === 'rectangle') {
        setSelectionMode('none');
        setSelectionCoords([]);
      }
    }
  }, [ingestType, selectedJobId]);

  // Clean drawing helper on unmount
  useEffect(() => {
    return () => {
      setSelectionMode('none');
      setSelectionCoords([]);
    };
  }, []);

  // Centrality State
  const [centralityMetric, setCentralityMetric] = useState('degree');
  const [centralityResult, setCentralityResult] = useState<any>(null);

  // Community State
  const [communityAlg, setCommunityAlg] = useState('louvain');
  const [communityResolution, setCommunityResolution] = useState(1.0);
  const [communityResult, setCommunityResult] = useState<any>(null);

  // Distribution State
  const [distResult, setDistResult] = useState<any>(null);

  // Filter completed runs
  const succeededJobs = useMemo(() => {
    return jobs.filter((j) => j.status === 'succeeded');
  }, [jobs]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Auto-select newly completed job that was triggered here
  useEffect(() => {
    if (activeJob && activeJob.status === 'succeeded' && activeJob.job_id === ingestedJobId) {
      setSelectedJobId(activeJob.job_id);
      setIngestedJobId(null);
      fetchJobs();
      toast.success("Network build complete! Loaded directly into Network Labs.");
    }
  }, [activeJob, ingestedJobId, fetchJobs]);

  const selectedJob = useMemo(() => {
    return jobs.find((j) => j.job_id === selectedJobId) || null;
  }, [selectedJobId, jobs]);

  const handleIngestNetwork = async () => {
    const source: any = { kind: ingestType };
    if (ingestType === 'osm_bbox') {
      source.bbox = bbox;
    } else {
      source.place_name = newPlaceName;
    }
    const options = {
      profile: 'all',
      roads: {
        snap_tolerance_m: 3.0,
        infer_geometric_crossings: true,
      },
      buildings: {
        include_buildings: false,
      },
      auto_repair_enabled: true,
    };

    const toastId = toast.loading('Initializing network build...');
    try {
      const jobId = await createJob(source, options);
      if (jobId) {
        setIngestedJobId(jobId);
        toast.success('Started network build. Track progress in the panel!', { id: toastId });
      } else {
        toast.error('Failed to start network build', { id: toastId });
      }
    } catch (e) {
      toast.error('Failed to start network build', { id: toastId });
    }
  };

  // Reset and fetch results/artifacts when active run changes
  useEffect(() => {
    setCentralityResult(null);
    setCommunityResult(null);
    setDistResult(null);

    if (!selectedJobId) return;

    const fetchResult = async () => {
      try {
        // Load layers directly from the GeoJSON files
        await ensureNetworkLayers(selectedJobId);
      } catch (e) {
        console.error("Failed to fetch job result / artifacts:", e);
      }
    };
    fetchResult();
  }, [selectedJobId]);

  // Helper to load GeoJSON layers directly from job directory (fast path)
  const ensureNetworkLayers = async (jobId: string) => {
    const dataStore = useDataStore.getState();
    const { processDataset } = await import('@/core/data/processors/data-processor');

    const roadsName = `Repaired Roads (${jobId.substring(0, 6)})`;
    const junctionsName = `Junctions (${jobId.substring(0, 6)})`;

    let roadsId = '';
    let junctionsId = '';

    // Load roads if missing — try preview_segments first, then raw_roads as fallback
    const existingRoads = Object.values(dataStore.datasets).find((d) => d.name === roadsName);
    if (!existingRoads) {
      const roadFiles = ['preview_segments.geojson', 'corridors.geojson', 'clean_roads.geojson', 'raw_roads.geojson'];
      for (const filename of roadFiles) {
        try {
          const res = await fetch(`/api/v1/urban-engine/jobs/${jobId}/geojson/${filename}`);
          if (!res.ok) continue;
          const geojsonText = await res.text();
          const processed = processDataset(roadsName, geojsonText, 'geojson', '#4c8bf5');
          dataStore.addDataset(processed);
          roadsId = processed.id;
          break;
        } catch { /* try next */ }
      }
    } else {
      roadsId = existingRoads.id;
    }

    // Load junctions if missing
    const existingJunctions = Object.values(dataStore.datasets).find((d) => d.name === junctionsName);
    if (!existingJunctions) {
      try {
        const res = await fetch(`/api/v1/urban-engine/jobs/${jobId}/geojson/junctions.geojson`);
        if (res.ok) {
          const geojsonText = await res.text();
          const processed = processDataset(junctionsName, geojsonText, 'geojson', '#34d399');
          dataStore.addDataset(processed);
          junctionsId = processed.id;
        }
      } catch (e) {
        console.error("Failed to load junctions:", e);
      }
    } else {
      junctionsId = existingJunctions.id;
    }

    return { roadsId, junctionsId };
  };

  // Helper to inject computed values into data store
  // Tries multiple ID property names since GraphML node IDs (osm_xxx, TF_NODE_xxx) 
  // may be stored in different GeoJSON properties depending on the export pipeline
  const injectAnalysisField = (
    datasetId: string,
    scores: Record<string, number | string>,
    fieldName: string,
    fieldType: 'real' | 'string'
  ) => {
    const dataStore = useDataStore.getState();
    const dataset = dataStore.datasets[datasetId];
    if (!dataset) return;

    const fieldExists = dataset.fields.some((f) => f.name === fieldName);
    const updatedFields = [...dataset.fields];

    if (!fieldExists) {
      if (fieldType === 'string') {
        const uniqueValues = Array.from(new Set(Object.values(scores) as string[]));
        updatedFields.push({
          name: fieldName,
          type: 'string',
          min: null,
          max: null,
          uniqueValues,
          count: Object.keys(scores).length,
        });
      } else {
        const vals = Object.values(scores) as number[];
        updatedFields.push({
          name: fieldName,
          type: 'real',
          min: Math.min(...vals, 0),
          max: Math.max(...vals, 1),
          uniqueValues: [],
          count: vals.length,
        });
      }
    }

    // Try multiple ID fields to match GraphML node IDs to GeoJSON record properties
    const ID_FIELDS = ['node_id', 'id', 'osmid', 'osm_id', 'fid', '@id'];

    const updatedRecords = dataset.records.map((r: any, idx: number) => {
      // Try each candidate ID field
      for (const idField of ID_FIELDS) {
        if (r[idField] !== undefined && r[idField] !== null) {
          const lookupId = String(r[idField]);
          if (scores[lookupId] !== undefined) {
            return { ...r, [fieldName]: scores[lookupId] };
          }
        }
      }
      // Fallback: try the record index as string
      const idxStr = String(idx);
      if (scores[idxStr] !== undefined) {
        return { ...r, [fieldName]: scores[idxStr] };
      }
      return { ...r, [fieldName]: fieldType === 'string' ? 'none' : 0.0 };
    });

    dataStore.addDataset({
      ...dataset,
      fields: updatedFields,
      records: updatedRecords,
    });
  };

  const handleRunCentrality = async () => {
    if (!selectedJob) return;
    setCalculating(true);
    const toastId = toast.loading('Calculating network centralities...');
    try {
      const url = `/api/v1/urban-engine/jobs/${selectedJob.job_id}/analysis/centrality?metric=${centralityMetric}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error();
      const result = await response.json();
      setCentralityResult(result);

      // Ensure layers are loaded and inject scores
      const { roadsId, junctionsId } = await ensureNetworkLayers(selectedJob.job_id);
      const isNode = centralityMetric !== 'edge_betweenness';
      const targetDatasetId = isNode ? junctionsId : roadsId;
      const fieldName = `centrality_${centralityMetric}`;

      if (targetDatasetId && result.scores) {
        injectAnalysisField(targetDatasetId, result.scores, fieldName, 'real');
        
        // Auto-select and style layer
        const layerStore = useLayerStore.getState();
        let layer = layerStore.layers.find((l) => l.datasetId === targetDatasetId && l.type === (isNode ? 'scatterplot' : 'geojson'));
        if (!layer) {
          layerStore.addLayer(targetDatasetId, isNode ? 'scatterplot' : 'geojson', isNode ? 'Junction Centrality' : 'Edge Centrality', {
            colorMode: 'mapped',
            colorField: fieldName,
            colorPalette: 'viridis',
            colorScale: 'linear',
            opacity: 0.8,
          });
        } else {
          layerStore.updateLayerConfig(layer.id, {
            colorMode: 'mapped',
            colorField: fieldName,
            colorPalette: 'viridis',
            colorScale: 'linear',
            visible: true,
          });
          layerStore.selectLayer(layer.id);
        }
      }
      toast.success('Centrality calculated successfully!', { id: toastId });
    } catch (e) {
      toast.error('Failed to compute centrality metrics', { id: toastId });
    } finally {
      setCalculating(false);
    }
  };

  const handleRunCommunity = async () => {
    if (!selectedJob) return;
    setCalculating(true);
    const toastId = toast.loading('Running community detection...');
    try {
      const url = `/api/v1/urban-engine/jobs/${selectedJob.job_id}/analysis/community?algorithm=${communityAlg}&resolution=${communityResolution}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error();
      const result = await response.json();
      setCommunityResult(result);

      const { junctionsId } = await ensureNetworkLayers(selectedJob.job_id);
      if (junctionsId && result.node_assignments) {
        const scores: Record<string, string> = {};
        for (const ass of result.node_assignments) {
          scores[String(ass.node_id)] = `C${ass.community_id}`;
        }
        const fieldName = `community_${communityAlg}`;
        injectAnalysisField(junctionsId, scores, fieldName, 'string');

        // Style junctions layer by community categorical colors
        const layerStore = useLayerStore.getState();
        let layer = layerStore.layers.find((l) => l.datasetId === junctionsId && l.type === 'scatterplot');
        if (!layer) {
          layerStore.addLayer(junctionsId, 'scatterplot', 'Junction Communities', {
            colorMode: 'mapped',
            colorField: fieldName,
            colorPalette: 'bold',
            opacity: 0.8,
          });
        } else {
          layerStore.updateLayerConfig(layer.id, {
            colorMode: 'mapped',
            colorField: fieldName,
            colorPalette: 'bold',
            visible: true,
          });
          layerStore.selectLayer(layer.id);
        }
      }
      toast.success('Community detection complete!', { id: toastId });
    } catch (e) {
      toast.error('Failed to run community detection', { id: toastId });
    } finally {
      setCalculating(false);
    }
  };

  const handleRunDistribution = async () => {
    if (!selectedJob) return;
    setCalculating(true);
    const toastId = toast.loading('Calculating degree distribution...');
    try {
      const url = `/api/v1/urban-engine/jobs/${selectedJob.job_id}/analysis/distribution`;
      const response = await fetch(url);
      if (!response.ok) throw new Error();
      const result = await response.json();
      setDistResult(result);
      toast.success('Degree distribution computed!', { id: toastId });
    } catch (e) {
      toast.error('Failed to compute distribution', { id: toastId });
    } finally {
      setCalculating(false);
    }
  };

  const renderDistributionCharts = () => {
    if (!distResult) return null;
    const { histogram, power_law } = distResult;

    if (!histogram || histogram.length === 0) return null;

    // Simple SVG rendering for histogram
    const maxCount = Math.max(...histogram.map((h: any) => h.count), 1);
    const chartWidth = 260;
    const chartHeight = 90;
    const barWidth = Math.max(2, Math.floor(chartWidth / histogram.length) - 1);

    return (
      <div className="flex flex-col gap-4 mt-2">
        {/* Momemts summary */}
        <div className="grid grid-cols-2 gap-2 bg-bg-tertiary/20 p-2.5 rounded-lg border border-border-primary/50 text-[11px] font-mono">
          <div className="flex justify-between">
            <span className="text-text-tertiary">Mean</span>
            <span className="font-semibold text-text-primary">{distResult.moments.mean.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-tertiary">Std Dev</span>
            <span className="font-semibold text-text-primary">{distResult.moments.std.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-tertiary">Skewness</span>
            <span className="font-semibold text-text-primary">{distResult.moments.skewness.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-tertiary">Kurtosis</span>
            <span className="font-semibold text-text-primary">{distResult.moments.kurtosis.toFixed(2)}</span>
          </div>
        </div>

        {/* Classification */}
        <div className="flex items-center gap-1.5 p-2 bg-[#27a644]/10 border border-[#27a644]/20 rounded-md text-text-primary">
          <ShieldCheck size={13} className="text-[#27a644]" />
          <span className="text-[11px]">
            Network Classification: {
              distResult.network_type.is_scale_free ? 'Scale-Free (Power Law)' :
              distResult.network_type.is_small_world ? 'Small-World Topology' :
              distResult.network_type.is_random ? 'Poisson Random Network' : 'General Urban Graph'
            }
          </span>
        </div>

        {/* Histogram Chart */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] uppercase font-bold text-text-tertiary tracking-wide">Degree Frequency Histogram</span>
          <div className="bg-bg-tertiary/10 p-2 rounded-lg border border-border-primary/30 flex items-center justify-center">
            <svg width={chartWidth} height={chartHeight} className="overflow-visible">
              {histogram.map((h: any, idx: number) => {
                const x = idx * (barWidth + 1);
                const hHeight = (h.count / maxCount) * (chartHeight - 15);
                const y = chartHeight - hHeight - 12;
                return (
                  <g key={idx}>
                    <rect
                      x={x}
                      y={y}
                      width={barWidth}
                      height={hHeight}
                      fill="#4c8bf5"
                      opacity={0.8}
                      className="hover:opacity-100 transition-opacity"
                    />
                    {idx % Math.max(5, Math.floor(histogram.length / 5)) === 0 && (
                      <text
                        x={x + barWidth / 2}
                        y={chartHeight - 2}
                        textAnchor="middle"
                        fill="#5f6578"
                        fontSize={8}
                        fontFamily="monospace"
                      >
                        {h.degree}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Power law details */}
        {power_law && (
          <div className="flex flex-col gap-1 bg-bg-tertiary/15 p-2.5 rounded-lg border border-border-primary/50 text-[11px]">
            <span className="font-semibold text-text-secondary">Power-Law MLE Fit</span>
            <div className="flex justify-between font-mono mt-1 text-[10.5px]">
              <span className="text-text-tertiary">Tail threshold (xmin)</span>
              <span className="text-text-primary">{power_law.xmin}</span>
            </div>
            <div className="flex justify-between font-mono text-[10.5px]">
              <span className="text-text-tertiary">Scaling Exponent (α)</span>
              <span className="text-text-primary font-bold">{power_law.alpha.toFixed(4)}</span>
            </div>
            <div className="flex justify-between font-mono text-[10.5px]">
              <span className="text-text-tertiary">Fit Goodness (1 - KS)</span>
              <span className="text-[#34d399] font-bold">{power_law.goodness_of_fit.toFixed(4)}</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-bg-secondary select-none text-text-primary text-xs">
      {/* Dropdown Job Select */}
      <div className="flex flex-col gap-1.5 px-4 pt-4 shrink-0">
        <span className="text-[11px] uppercase tracking-widest text-text-tertiary font-bold">Select Active Run</span>
        <Select
          value={selectedJobId}
          onChange={(e) => setSelectedJobId(e.target.value)}
          options={[
            { value: '', label: 'Select completed network run...' },
            ...succeededJobs.map((j) => ({
              value: j.job_id,
              label: `Job ${j.job_id.slice(0, 8)} (${j.created_at ? new Date(j.created_at).toLocaleDateString() : 'N/A'})`,
            })),
          ]}
          className="h-8 text-xs"
        />
      </div>

      {!selectedJobId ? (
        <div className="flex-1 flex flex-col gap-5 p-4 overflow-y-auto min-h-0">
          
          {/* Ingestion progress (if job is currently running) */}
          {activeJob && ['queued', 'running', 'cancelling'].includes(activeJob.status) ? (
            <div className="flex flex-col gap-3 p-3.5 rounded-lg bg-bg-tertiary/20 border border-border-primary/50 shrink-0">
              <div className="flex items-center gap-2">
                <Loader2 size={13} className="animate-spin text-accent" />
                <span className="font-semibold text-text-primary text-[11px] uppercase tracking-wide">
                  Building Network...
                </span>
                <span className="ml-auto font-mono text-accent font-bold text-xs">
                  {Math.round(activeJob.progress_pct)}%
                </span>
              </div>
              <span className="text-[11px] text-text-secondary leading-relaxed">
                {activeJob.phase_description || 'Staging pipeline'}
              </span>
              <div className="h-1.5 w-full bg-bg-tertiary rounded-full overflow-hidden">
                <div 
                  className="h-full bg-accent transition-all duration-300"
                  style={{ width: `${activeJob.progress_pct}%` }}
                />
              </div>
              <button 
                onClick={() => cancelJob(activeJob.job_id)}
                className="self-end text-[10px] text-[#eb5757] font-semibold hover:underline cursor-pointer"
              >
                Cancel Run
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4 p-4 rounded-lg bg-bg-tertiary/10 border border-border-primary/30 shrink-0">
              <div className="flex flex-col gap-1">
                <span className="font-semibold text-text-primary">No Active Network Run</span>
                <span className="text-text-tertiary text-[11px] leading-normal">
                  Select a completed run above, or build a new network directly:
                </span>
              </div>

              {/* Source Type Selector */}
              <div className="flex gap-1.5 p-0.5 rounded bg-bg-tertiary/20 shrink-0 mt-1">
                <button
                  type="button"
                  onClick={() => setIngestType('osm_place')}
                  className={cn(
                    "flex-1 py-1 text-center rounded text-[10px] font-semibold transition-all cursor-pointer",
                    ingestType === 'osm_place' 
                      ? "bg-bg-secondary text-text-primary shadow-tight" 
                      : "text-text-tertiary hover:text-text-primary"
                  )}
                >
                  Place Name
                </button>
                <button
                  type="button"
                  onClick={() => setIngestType('osm_bbox')}
                  className={cn(
                    "flex-1 py-1 text-center rounded text-[10px] font-semibold transition-all cursor-pointer",
                    ingestType === 'osm_bbox' 
                      ? "bg-bg-secondary text-text-primary shadow-tight" 
                      : "text-text-tertiary hover:text-text-primary"
                  )}
                >
                  Bounding Box
                </button>
              </div>
              
              {ingestType === 'osm_place' ? (
                <div className="flex flex-col gap-1.5">
                  <label className="text-text-secondary font-medium text-[11px]">OSM Place Name</label>
                  <input
                    type="text"
                    value={newPlaceName}
                    onChange={(e) => setNewPlaceName(e.target.value)}
                    placeholder="e.g. Colombo, Sri Lanka or Cambridge, MA"
                    className="h-8 px-2.5 bg-bg-secondary rounded border border-border-primary text-xs focus-ring text-text-primary"
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-2 text-[10.5px] font-mono">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-text-tertiary">West (Min Lng)</span>
                      <input
                        type="number"
                        step="0.0001"
                        value={bbox.west}
                        onChange={(e) => handleBboxChange('west', parseFloat(e.target.value))}
                        className="h-7 px-1.5 bg-bg-secondary border border-border-primary rounded text-text-primary focus-ring"
                      />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-text-tertiary">East (Max Lng)</span>
                      <input
                        type="number"
                        step="0.0001"
                        value={bbox.east}
                        onChange={(e) => handleBboxChange('east', parseFloat(e.target.value))}
                        className="h-7 px-1.5 bg-bg-secondary border border-border-primary rounded text-text-primary focus-ring"
                      />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-text-tertiary">South (Min Lat)</span>
                      <input
                        type="number"
                        step="0.0001"
                        value={bbox.south}
                        onChange={(e) => handleBboxChange('south', parseFloat(e.target.value))}
                        className="h-7 px-1.5 bg-bg-secondary border border-border-primary rounded text-text-primary focus-ring"
                      />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-text-tertiary">North (Max Lat)</span>
                      <input
                        type="number"
                        step="0.0001"
                        value={bbox.north}
                        onChange={(e) => handleBboxChange('north', parseFloat(e.target.value))}
                        className="h-7 px-1.5 bg-bg-secondary border border-border-primary rounded text-text-primary focus-ring"
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={captureBboxFromMap}
                    className="h-7 bg-bg-tertiary hover:bg-bg-tertiary/80 text-text-primary text-[10px] uppercase font-bold tracking-wider"
                  >
                    Capture from Viewport
                  </Button>
                </div>
              )}

              <Button
                onClick={handleIngestNetwork}
                disabled={isProcessing}
                className="h-8 flex items-center justify-center gap-1.5 bg-accent hover:bg-accent-hover text-bg-primary font-semibold w-full shadow-tight mt-2"
              >
                {isProcessing ? <Loader2 size={12} className="animate-spin" /> : <Play size={10} fill="currentColor" />}
                <span>Load & Analyze Network</span>
              </Button>
            </div>
          )}
          
          <div className="flex flex-col items-center justify-center py-6 text-center text-text-tertiary border border-dashed border-border-primary/40 rounded-lg shrink-0">
            <GitBranch size={20} className="mb-2 opacity-30 animate-pulse" />
            <span className="text-[11px] leading-relaxed max-w-[200px]">
              Or select an existing completed run from the dropdown menu at the top.
            </span>
          </div>

        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0 mt-3">
          {/* Subtabs */}
          <div className="flex px-4 shrink-0 border-b border-border-primary/50 bg-bg-secondary/40">
            {(['centrality', 'community', 'distribution'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveSubTab(tab)}
                className={cn(
                  'flex-1 py-2 text-center text-[11px] font-semibold border-b-2 transition-all cursor-pointer capitalize tracking-wider',
                  activeSubTab === tab
                    ? 'border-accent text-text-primary'
                    : 'border-transparent text-text-tertiary hover:text-text-secondary'
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Subtab content container */}
          <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
            
            {/* 1. CENTRALITY SUBTAB */}
            {activeSubTab === 'centrality' && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-text-secondary font-medium">Centrality Metric</label>
                  <Select
                    value={centralityMetric}
                    onChange={(e) => setCentralityMetric(e.target.value)}
                    options={[
                      { value: 'degree', label: 'Degree Centrality' },
                      { value: 'closeness', label: 'Closeness Centrality' },
                      { value: 'betweenness', label: 'Betweenness Centrality' },
                      { value: 'eigenvector', label: 'Eigenvector Centrality' },
                      { value: 'pagerank', label: 'PageRank Score' },
                      { value: 'edge_betweenness', label: 'Edge Betweenness Centrality' },
                    ]}
                    className="h-8 text-xs"
                  />
                </div>

                <Button
                  onClick={handleRunCentrality}
                  disabled={calculating}
                  className="h-8 flex items-center justify-center gap-1.5 bg-accent hover:bg-accent-hover text-bg-primary font-semibold w-full shadow-tight"
                >
                  {calculating ? <Loader2 size={12} className="animate-spin" /> : <Play size={10} fill="currentColor" />}
                  <span>Calculate Centrality</span>
                </Button>

                {centralityResult && (
                  <div className="flex flex-col gap-3 mt-2">
                    <span className="text-[10px] uppercase font-bold text-text-tertiary tracking-wide">Summary Statistics</span>
                    <div className="grid grid-cols-2 gap-2 bg-bg-tertiary/20 p-2.5 rounded-lg border border-border-primary/50 text-[11px] font-mono">
                      <div className="flex justify-between">
                        <span className="text-text-tertiary">Mean</span>
                        <span className="font-semibold text-text-primary">{centralityResult.summary.mean.toFixed(5)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-tertiary">Max</span>
                        <span className="font-semibold text-text-primary">{centralityResult.summary.max.toFixed(5)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-tertiary">Min</span>
                        <span className="font-semibold text-text-primary">{centralityResult.summary.min.toFixed(5)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-tertiary">Std Dev</span>
                        <span className="font-semibold text-text-primary">{centralityResult.summary.std.toFixed(5)}</span>
                      </div>
                    </div>

                    <span className="text-[10px] uppercase font-bold text-text-tertiary tracking-wide mt-1">Top Rankings</span>
                    <div className="flex flex-col gap-1 max-h-48 overflow-y-auto bg-bg-tertiary/10 p-2 rounded-lg border border-border-primary/30">
                      {centralityResult.ranking.map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center text-[10.5px] py-1 border-b border-border-primary/10 last:border-0">
                          <span className="text-text-secondary truncate max-w-[170px] font-mono">
                            {item.node_id ? `Node ${item.node_id}` : `Edge ${item.edge_id}`}
                          </span>
                          <span className="font-semibold font-mono text-accent">{item.value.toFixed(6)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 2. COMMUNITY SUBTAB */}
            {activeSubTab === 'community' && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-text-secondary font-medium">Detection Algorithm</label>
                    <Select
                      value={communityAlg}
                      onChange={(e) => setCommunityAlg(e.target.value)}
                      options={[
                        { value: 'louvain', label: 'Greedy Louvain' },
                        { value: 'leiden', label: 'Leiden Partition' },
                        { value: 'girvan_newman', label: 'Divisive Girvan-Newman' },
                      ]}
                      className="h-8 text-xs"
                    />
                  </div>

                  {communityAlg !== 'girvan_newman' && (
                    <div className="flex flex-col gap-1">
                      <label className="text-text-secondary font-medium">Resolution Parameter</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        max="5"
                        value={communityResolution}
                        onChange={(e) => setCommunityResolution(parseFloat(e.target.value))}
                        className="h-8 px-2 bg-bg-secondary rounded border border-border-primary font-mono text-xs focus-ring text-text-primary"
                      />
                    </div>
                  )}
                </div>

                <Button
                  onClick={handleRunCommunity}
                  disabled={calculating}
                  className="h-8 flex items-center justify-center gap-1.5 bg-accent hover:bg-accent-hover text-bg-primary font-semibold w-full shadow-tight"
                >
                  {calculating ? <Loader2 size={12} className="animate-spin" /> : <Play size={10} fill="currentColor" />}
                  <span>Detect Communities</span>
                </Button>

                {communityResult && (
                  <div className="flex flex-col gap-3 mt-2">
                    <span className="text-[10px] uppercase font-bold text-text-tertiary tracking-wide">Community Quality</span>
                    <div className="grid grid-cols-2 gap-2 bg-bg-tertiary/20 p-2.5 rounded-lg border border-border-primary/50 text-[11px] font-mono">
                      <div className="flex justify-between">
                        <span className="text-text-tertiary">Modularity</span>
                        <span className="font-semibold text-text-primary">{communityResult.modularity.toFixed(4)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-tertiary">Total count</span>
                        <span className="font-semibold text-text-primary">{communityResult.community_count}</span>
                      </div>
                      <div className="flex justify-between col-span-2">
                        <span className="text-text-tertiary">Partition Coverage</span>
                        <span className="font-semibold text-text-primary">{(communityResult.statistics.coverage * 100).toFixed(1)}%</span>
                      </div>
                    </div>

                    <span className="text-[10px] uppercase font-bold text-text-tertiary tracking-wide mt-1">Largest Communities</span>
                    <div className="flex flex-col gap-1 max-h-48 overflow-y-auto bg-bg-tertiary/10 p-2 rounded-lg border border-border-primary/30">
                      {communityResult.community_sizes.slice(0, 10).map((comm: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center text-[10.5px] py-1 border-b border-border-primary/10 last:border-0">
                          <span className="text-text-secondary font-mono">Community {comm.community_id}</span>
                          <span className="font-semibold font-mono text-accent">{comm.size} nodes</span>
                        </div>
                      ))}
                      {communityResult.community_sizes.length > 10 && (
                        <div className="text-[10px] text-text-tertiary italic text-center mt-1">
                          + {communityResult.community_sizes.length - 10} more communities
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 3. DISTRIBUTION SUBTAB */}
            {activeSubTab === 'distribution' && (
              <div className="flex flex-col gap-4">
                <Button
                  onClick={handleRunDistribution}
                  disabled={calculating}
                  className="h-8 flex items-center justify-center gap-1.5 bg-accent hover:bg-accent-hover text-bg-primary font-semibold w-full shadow-tight"
                >
                  {calculating ? <Loader2 size={12} className="animate-spin" /> : <BarChart2 size={13} />}
                  <span>Calculate Degree Distribution</span>
                </Button>

                {renderDistributionCharts()}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default NetworkLabsPanel;
