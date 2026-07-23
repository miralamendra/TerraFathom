import { useState, useEffect } from 'react';
import { Play, Loader2, Trash2, X, FileUp, Globe, Search, Check, AlertCircle, Square } from 'lucide-react';
import { useUrbanEngineStore } from '@/stores/urban-engine-store';
import { useMapStore } from '@/stores/map-store';
import { Button, Select } from '@/components/ui';
import { cn } from '@/components/ui/utils';
import { ConfidenceDisplay } from './ConfidenceDisplay';
import { RepairSummary } from './RepairSummary';
import { StatisticsCards } from './StatisticsCards';
import { ArtifactDownloads } from './ArtifactDownloads';
import { NetworkValidationReport } from './NetworkValidationReport';
import { ModificationsReport } from './ModificationsReport';
import { ReviewQueue } from './ReviewQueue';
import { EarthEngineAnalysis } from './EarthEngineAnalysis';

import { useUIStore } from '@/stores/ui-store';
import { useDataStore } from '@/stores/data-store';
import { useLayerStore } from '@/stores/layer-store';
import { toast } from 'sonner';

export function UrbanEnginePanel() {
  const {
    jobs,
    activeJob,
    activeResult,
    isProcessing,
    fetchJobs,
    createJob,
    cancelJob,
    deleteJob,
    selectJob,
    clearActiveJob,
  } = useUrbanEngineStore();

  const mapLon = useMapStore((s) => s.longitude);
  const mapLat = useMapStore((s) => s.latitude);
  const mapZoom = useMapStore((s) => s.zoom);

  const selectionCoords = useUIStore((s) => s.selectionCoordinates);
  const selectionMode = useUIStore((s) => s.selectionMode);
  const setSelectionCoords = useUIStore((s) => s.setSelectionCoordinates);
  const setSelectionMode = useUIStore((s) => s.setSelectionMode);

  // Form State
  const [sourceType, setSourceType] = useState<'upload' | 'osm_bbox' | 'osm_place'>('upload');
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [bbox, setBbox] = useState({ west: 79.83, south: 6.90, east: 79.89, north: 6.96 });
  const [placeName, setPlaceName] = useState('Colombo, Sri Lanka');

  // Options State
  const [profile, setProfile] = useState('all');
  const [snapTolerance, setSnapTolerance] = useState(3.0);
  const [inferCrossings, setInferCrossings] = useState(true);
  const [includeBuildings, setIncludeBuildings] = useState(true);
  const [autoRepair, setAutoRepair] = useState(true);

  // Helper to push local bbox values to map selection layer
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

  // Helper to handle manual field changes
  const handleBboxFieldChange = (field: keyof typeof bbox, val: number) => {
    if (isNaN(val)) return;
    const next = { ...bbox, [field]: val };
    setBbox(next);
    syncBboxToMap(next);
  };

  // 1. Manage drawing mode activation on tab toggle (only runs when sourceType changes)
  useEffect(() => {
    if (sourceType === 'osm_bbox') {
      setSelectionMode('rectangle');
      syncBboxToMap(bbox);
    } else {
      if (selectionMode === 'rectangle') {
        setSelectionMode('none');
        setSelectionCoords([]);
      }
    }
  }, [sourceType]);

  // 2. Sync map selection coordinates -> local bbox state (runs when user draws on map)
  useEffect(() => {
    if (sourceType === 'osm_bbox' && selectionCoords.length === 5) {
      const lons = selectionCoords.map((c) => c[0]);
      const lats = selectionCoords.map((c) => c[1]);
      
      const west = Math.min(...lons);
      const east = Math.max(...lons);
      const south = Math.min(...lats);
      const north = Math.max(...lats);

      // Prevent NaN assignment
      if (isNaN(west) || isNaN(east) || isNaN(south) || isNaN(north)) return;

      // Only update state if values actually changed to prevent loop
      if (
        Math.abs(bbox.west - west) > 0.0001 ||
        Math.abs(bbox.east - east) > 0.0001 ||
        Math.abs(bbox.south - south) > 0.0001 ||
        Math.abs(bbox.north - north) > 0.0001
      ) {
        setBbox({ west, south, east, north });
      }
    }
  }, [selectionCoords, sourceType, bbox]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Handle file upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setUploadFile(file);
    setIsUploading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/v1/urban-engine/uploads', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error('File upload failed.');
      const data = await response.json();
      setUploadId(data.upload_id);
    } catch (err) {
      console.error(err);
      setUploadFile(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleHighlightManualReview = async () => {
    if (!activeJob || !activeResult) return;
    
    const datasetName = `Repaired Roads (${activeJob.job_id.substring(0, 6)})`;
    const dataStore = useDataStore.getState();
    const roadsDataset = Object.values(dataStore.datasets).find(
      (d) => d.name === datasetName
    );
    
    if (!roadsDataset) {
      toast.error('Repaired roads layer not found. Make sure the job runs successfully first.');
      return;
    }
    
    const manualReviewRecords = roadsDataset.records.filter((r: any) => {
      const v = r.manual_review;
      return v === 1 || v === true || String(v) === '1' || String(v) === 'true';
    });
    
    if (manualReviewRecords.length === 0) {
      toast.success('No manual review items detected in this road network.');
      return;
    }
    
    const highlightDatasetId = `geojson-manual-review-${activeJob.job_id.substring(0, 6)}`;
    const highlightDataset = {
      ...roadsDataset,
      id: highlightDatasetId,
      name: `Manual Review Needed (${activeJob.job_id.substring(0, 6)})`,
      records: manualReviewRecords,
      rowCount: manualReviewRecords.length,
    };
    
    dataStore.addDataset(highlightDataset);
    
    const layerStore = useLayerStore.getState();
    const highlightLayer = layerStore.layers.find(
      (l) => l.datasetId === highlightDatasetId
    );
    
    if (highlightLayer) {
      layerStore.updateLayerConfig(highlightLayer.id, {
        strokeColor: [255, 0, 128], // Neon Red-Pink
        strokeWidth: 6, // Super bold
        opacity: 0.95,
      });
      
      // Reorder layers: Move highlightLayer to the end of the list so it renders on top
      const nextLayers = layerStore.layers.filter((l) => l.id !== highlightLayer.id);
      nextLayers.push(highlightLayer);
      layerStore.reorderLayers(nextLayers);
      
      useUIStore.getState().setSelectedLayerId(highlightLayer.id);
      useUIStore.getState().setRightPanelOpen(true);
      
      toast.success(`Highlighted ${manualReviewRecords.length} issues in neon red. You can customize style in the right panel!`);
    }
  };

  // Capture Bbox from map view extent
  const captureBboxFromMap = () => {
    // Generate approximate bbox based on current center coordinates and zoom level
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

  const handleStartRun = async () => {
    let source: any = { kind: sourceType };
    if (sourceType === 'upload') {
      if (!uploadId) return;
      source.upload_id = uploadId;
    } else if (sourceType === 'osm_bbox') {
      source.bbox = bbox;
    } else {
      source.place_name = placeName;
    }

    const options = {
      profile,
      roads: {
        snap_tolerance_m: snapTolerance,
        infer_geometric_crossings: inferCrossings,
      },
      buildings: {
        include_buildings: includeBuildings,
      },
      auto_repair_enabled: autoRepair,
    };

    await createJob(source, options);
  };

  return (
    <div className="flex flex-col h-full bg-bg-secondary select-none text-text-primary text-xs">
      {/* Scrollable controls panel */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-6">
        
        {/* Active job results view */}
        {activeJob && (
          <div className="flex flex-col gap-4 border-b border-border-primary pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-semibold text-text-primary truncate">
                  Job {activeJob.job_id.slice(0, 8)}
                </span>
                <span className={cn(
                  "px-1.5 py-0.5 rounded text-[10px] font-mono capitalize",
                  activeJob.status === 'succeeded' && 'bg-[#27a644]/15 text-[#27a644]',
                  activeJob.status === 'failed' && 'bg-[#eb5757]/15 text-[#eb5757]',
                  ['running', 'queued'].includes(activeJob.status) && 'bg-accent/15 text-accent animate-pulse'
                )}>
                  {activeJob.status}
                </span>
              </div>
              <button 
                type="button"
                onClick={clearActiveJob}
                className="text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            {/* Progress indicators for active job */}
            {['queued', 'running', 'cancelling'].includes(activeJob.status) && (
              <div className="flex flex-col gap-2 p-3 rounded-control bg-bg-tertiary/20">
                <div className="flex justify-between items-baseline">
                  <span className="font-medium text-text-secondary">
                    {activeJob.phase_description || 'Staging pipeline'}
                  </span>
                  <span className="font-mono text-text-primary font-bold">
                    {Math.round(activeJob.progress_pct)}%
                  </span>
                </div>
                <div className="h-1.5 w-full bg-bg-tertiary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-accent transition-all duration-300"
                    style={{ width: `${activeJob.progress_pct}%` }}
                  />
                </div>
                {activeJob.status === 'running' && (
                  <button 
                    onClick={() => cancelJob(activeJob.job_id)}
                    className="self-end mt-1 text-[10px] text-[#eb5757] font-semibold hover:underline cursor-pointer"
                  >
                    Cancel Run
                  </button>
                )}
              </div>
            )}

            {/* Error message */}
            {activeJob.status === 'failed' && (
              <div className="flex items-start gap-2 p-3 rounded-control bg-[#eb5757]/10 border border-[#eb5757]/20 text-[#eb5757]">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <div className="flex flex-col gap-0.5">
                  <span className="font-semibold text-[11px] uppercase tracking-wider">
                    {activeJob.error_code || 'Error'}
                  </span>
                  <span className="leading-relaxed">{activeJob.error_message}</span>
                </div>
              </div>
            )}

            {/* Completed stats & confidence */}
            {activeJob.status === 'succeeded' && activeResult && (
              <div className="flex flex-col gap-5">
                {activeResult.confidence && (
                  <ConfidenceDisplay scores={activeResult.confidence} />
                )}
                {activeResult.repair_summary && (
                  <RepairSummary 
                    summary={activeResult.repair_summary} 
                    onManualReviewClick={handleHighlightManualReview}
                  />
                )}
                {activeResult.quality?.warnings && (
                  <NetworkValidationReport warnings={activeResult.quality.warnings} />
                )}
                {activeResult.artifacts && (
                  <ModificationsReport jobId={activeJob.job_id} artifacts={activeResult.artifacts} />
                )}
                {activeResult.artifacts && (
                  <ReviewQueue jobId={activeJob.job_id} artifacts={activeResult.artifacts} />
                )}
                {activeResult.statistics && (
                  <StatisticsCards statistics={activeResult.statistics} />
                )}
                {activeResult.artifacts && (
                  <ArtifactDownloads artifacts={activeResult.artifacts} />
                )}
              </div>
            )}
          </div>
        )}

        {/* Input Source Form */}
        {!activeJob && (
          <div className="flex flex-col gap-4">
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-[0.12em]">
              Input Source
            </span>

            {/* Source Type Tab Buttons */}
            <div className="flex p-0.5 rounded bg-bg-tertiary/40">
              <button
                type="button"
                onClick={() => setSourceType('upload')}
                className={cn(
                  "flex-1 py-1.5 flex items-center justify-center gap-1 rounded text-xs font-medium cursor-pointer transition-all",
                  sourceType === 'upload' ? 'bg-bg-secondary text-text-primary shadow-tight' : 'text-text-tertiary hover:text-text-primary'
                )}
              >
                <FileUp size={12} />
                <span>Upload</span>
              </button>
              <button
                type="button"
                onClick={() => setSourceType('osm_bbox')}
                className={cn(
                  "flex-1 py-1.5 flex items-center justify-center gap-1 rounded text-xs font-medium cursor-pointer transition-all",
                  sourceType === 'osm_bbox' ? 'bg-bg-secondary text-text-primary shadow-tight' : 'text-text-tertiary hover:text-text-primary'
                )}
              >
                <Globe size={12} />
                <span>Map Bounding Box</span>
              </button>
              <button
                type="button"
                onClick={() => setSourceType('osm_place')}
                className={cn(
                  "flex-1 py-1.5 flex items-center justify-center gap-1 rounded text-xs font-medium cursor-pointer transition-all",
                  sourceType === 'osm_place' ? 'bg-bg-secondary text-text-primary shadow-tight' : 'text-text-tertiary hover:text-text-primary'
                )}
              >
                <Search size={12} />
                <span>Place Geocoder</span>
              </button>
            </div>

            {/* Upload Selector */}
            {sourceType === 'upload' && (
              <div className="flex flex-col gap-2">
                <div className="relative group flex flex-col items-center justify-center p-4 border border-dashed border-border-primary rounded-control bg-bg-secondary hover:bg-bg-hover transition-colors min-h-24 text-center cursor-pointer">
                  <input
                    type="file"
                    onChange={handleFileChange}
                    accept=".osm,.pbf,.geojson,.json,.gpkg,.zip"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <FileUp size={20} className="text-text-tertiary mb-2 group-hover:text-text-secondary transition-colors" />
                  <span className="text-xs font-medium text-text-secondary">
                    {uploadFile ? uploadFile.name : 'Select or drop spatial data'}
                  </span>
                  <span className="text-[10px] text-text-tertiary mt-1">
                    OSM PBF/XML, GeoJSON, Shapefile ZIP
                  </span>
                </div>
                {isUploading && (
                  <div className="flex items-center gap-2 text-text-tertiary text-xs">
                    <Loader2 size={12} className="animate-spin text-accent" />
                    <span>Uploading and hashing...</span>
                  </div>
                )}
                {uploadId && !isUploading && (
                  <div className="flex items-center gap-1.5 text-[#27a644] font-medium text-xs mt-1">
                    <Check size={12} />
                    <span>Data staged successfully.</span>
                  </div>
                )}
              </div>
            )}

            {/* Bbox Selector */}
            {sourceType === 'osm_bbox' && (
              <div className="flex flex-col gap-3 p-3 rounded-control bg-bg-secondary border border-border-primary">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex flex-col gap-1">
                    <label className="text-text-secondary font-medium">West Lon</label>
                    <input
                      type="number"
                      value={bbox.west}
                      onChange={(e) => handleBboxFieldChange('west', parseFloat(e.target.value))}
                      className="h-8 px-2 bg-bg-tertiary/20 rounded border border-border-primary font-mono text-xs focus-ring"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-text-secondary font-medium">South Lat</label>
                    <input
                      type="number"
                      value={bbox.south}
                      onChange={(e) => handleBboxFieldChange('south', parseFloat(e.target.value))}
                      className="h-8 px-2 bg-bg-tertiary/20 rounded border border-border-primary font-mono text-xs focus-ring"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-text-secondary font-medium">East Lon</label>
                    <input
                      type="number"
                      value={bbox.east}
                      onChange={(e) => handleBboxFieldChange('east', parseFloat(e.target.value))}
                      className="h-8 px-2 bg-bg-tertiary/20 rounded border border-border-primary font-mono text-xs focus-ring"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-text-secondary font-medium">North Lat</label>
                    <input
                      type="number"
                      value={bbox.north}
                      onChange={(e) => handleBboxFieldChange('north', parseFloat(e.target.value))}
                      className="h-8 px-2 bg-bg-tertiary/20 rounded border border-border-primary font-mono text-xs focus-ring"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={captureBboxFromMap}
                    className="flex-1 h-8 flex items-center justify-center gap-1.5 rounded bg-bg-tertiary/50 hover:bg-bg-hover transition-colors text-xs font-semibold cursor-pointer text-text-primary"
                  >
                    <Globe size={11} />
                    <span>Capture View</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectionMode(selectionMode === 'rectangle' ? 'none' : 'rectangle')}
                    className={cn(
                      "flex-1 h-8 flex items-center justify-center gap-1.5 rounded transition-colors text-xs font-semibold cursor-pointer border",
                      selectionMode === 'rectangle'
                        ? "bg-accent/25 text-accent border-accent/30 hover:bg-accent/35"
                        : "bg-bg-tertiary/50 text-text-primary border-transparent hover:bg-bg-hover"
                    )}
                  >
                    <Square size={11} />
                    <span>{selectionMode === 'rectangle' ? 'Drawing' : 'Draw Area'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Place Geocoder */}
            {sourceType === 'osm_place' && (
              <div className="flex flex-col gap-1.5">
                <input
                  type="text"
                  value={placeName}
                  onChange={(e) => setPlaceName(e.target.value)}
                  placeholder="e.g. Amsterdam, Netherlands"
                  className="h-8 px-2 bg-bg-secondary rounded border border-border-primary text-xs w-full focus-ring"
                />
                <span className="text-[10px] text-text-tertiary">
                  Nominatim will geocode the coordinates of this location bounds.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Engine Pipeline Configuration */}
        {!activeJob && (
          <div className="flex flex-col gap-4">
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-[0.12em]">
              Engine Configuration
            </span>

            <div className="flex flex-col gap-3">
              {/* Profile */}
              <div className="flex flex-col gap-1">
                <label className="text-text-secondary font-medium">Network Routing Profile</label>
                <Select
                  value={profile}
                  onChange={(e) => setProfile(e.target.value)}
                  options={[
                    { value: 'all', label: 'All Routing Modes' },
                    { value: 'walk', label: 'Pedestrian Accessible' },
                    { value: 'bicycle', label: 'Bicycle Accessible' },
                    { value: 'drive', label: 'Vehicular Streets' },
                  ]}
                  className="h-8 text-xs font-medium"
                />
              </div>

              {/* Snap Tolerance */}
              <div className="flex flex-col gap-1">
                <label className="text-text-secondary font-medium">Snap Proximity (meters)</label>
                <input
                  type="number"
                  step="0.1"
                  value={snapTolerance}
                  onChange={(e) => setSnapTolerance(parseFloat(e.target.value))}
                  className="h-8 px-2 bg-bg-secondary rounded border border-border-primary font-mono text-xs focus-ring"
                />
              </div>

              {/* Options Checkboxes */}
              <div className="flex flex-col gap-2.5 mt-1.5 text-xs text-text-secondary font-medium">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={inferCrossings}
                    onChange={(e) => setInferCrossings(e.target.checked)}
                    className="rounded border-border-primary accent-accent"
                  />
                  <span>Infer intersection crossings</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeBuildings}
                    onChange={(e) => setIncludeBuildings(e.target.checked)}
                    className="rounded border-border-primary accent-accent"
                  />
                  <span>Process building morphometrics</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoRepair}
                    onChange={(e) => setAutoRepair(e.target.checked)}
                    className="rounded border-border-primary accent-accent"
                  />
                  <span>Enable automatic topology repair</span>
                </label>
              </div>
            </div>

            {/* Run Button */}
            <Button
              onClick={handleStartRun}
              disabled={isProcessing || (sourceType === 'upload' && !uploadId)}
              className="h-9 mt-2 flex items-center justify-center gap-1.5 w-full bg-accent hover:bg-accent-hover text-bg-primary font-semibold transition-all shadow-tight"
            >
              {isProcessing ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Play size={12} fill="currentColor" />
              )}
              <span>Initialize Processing Run</span>
            </Button>
          </div>
        )}

        {/* Earth Engine Satellite Analysis Dashboard */}
        {!activeJob && (
          <EarthEngineAnalysis />
        )}

        {/* Previous Runs List */}
        {!activeJob && jobs.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-border-primary/50 pt-5">
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-[0.12em]">
              Processing Runs
            </span>
            <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-1">
              {jobs.map((j) => (
                <div
                  key={j.job_id}
                  onClick={() => selectJob(j.job_id)}
                  className="flex items-center justify-between p-2 rounded-control bg-bg-secondary/40 border border-border-primary/30 hover:border-border-primary hover:bg-bg-hover transition-all cursor-pointer text-xs"
                >
                  <div className="flex flex-col min-w-0">
                    <span className="font-semibold text-text-primary truncate">
                      Job {j.job_id.slice(0, 8)}
                    </span>
                    <span className="text-[10px] text-text-tertiary font-mono">
                      {j.created_at ? new Date(j.created_at).toLocaleDateString() : 'Active'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={cn(
                      "px-1.5 py-0.5 rounded text-[10px] capitalize",
                      j.status === 'succeeded' && 'bg-[#27a644]/10 text-[#27a644]',
                      j.status === 'failed' && 'bg-[#eb5757]/10 text-[#eb5757]',
                      ['running', 'queued'].includes(j.status) && 'bg-accent/10 text-accent animate-pulse'
                    )}>
                      {j.status}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteJob(j.job_id);
                      }}
                      className="p-1 rounded text-text-tertiary hover:text-[#eb5757] hover:bg-bg-active transition-all cursor-pointer"
                      title="Delete record"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
export default UrbanEnginePanel;
