import { useState, useEffect } from 'react';
import { ShieldCheck, ShieldAlert, MapPin, CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { type ArtifactInfo, useUrbanEngineStore } from '@/stores/urban-engine-store';
import { useDataStore } from '@/stores/data-store';
import { useLayerStore } from '@/stores/layer-store';
import { toast } from 'sonner';

interface ReviewQueueProps {
  jobId: string;
  artifacts: ArtifactInfo[];
}

interface ModificationEntry {
  id: string;
  type: string;
  reason: string;
  method: string;
  confidence: {
    geometry: number;
    topology: number;
    semantics: number;
    connectivity: number;
    overall: number;
  };
  affected_feature_ids: string[];
  geom_before_wkt: string | null;
  geom_after_wkt: string | null;
  undone: boolean;
}

export function ReviewQueue({ jobId, artifacts }: ReviewQueueProps) {
  const [candidates, setCandidates] = useState<ModificationEntry[]>([]);
  const [rejectedIds, setRejectedIds] = useState<string[]>([]);
  const [approvedIds, setApprovedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const { createJob, jobs } = useUrbanEngineStore();

  const reportArtifact = artifacts.find(
    (art) => art.format === 'json' && art.download_url.includes('modifications_report')
  );

  useEffect(() => {
    if (!reportArtifact) return;

    const fetchReport = async () => {
      setLoading(true);
      try {
        const res = await fetch(reportArtifact.download_url);
        if (res.ok) {
          const data = await res.json();
          // Sort by confidence ascending so lowest confidence (most uncertain) shows first
          const sorted = data.sort((a: ModificationEntry, b: ModificationEntry) => {
            const confA = a.confidence?.overall ?? 100;
            const confB = b.confidence?.overall ?? 100;
            return confA - confB;
          });
          setCandidates(sorted);
        }
      } catch (err) {
        console.error('Failed to load modifications report:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [reportArtifact]);

  const handleLocateOnMap = (cand: ModificationEntry) => {
    setHighlightedId(cand.id === highlightedId ? null : cand.id);
    if (cand.id === highlightedId) {
      useDataStore.getState().removeDataset('tf-modification-highlight');
      return;
    }

    if (!cand.geom_after_wkt && !cand.geom_before_wkt) return;

    try {
      const datasetName = `Repaired Roads (${jobId.substring(0, 6)})`;
      const roadsDataset = Object.values(useDataStore.getState().datasets).find(
        (d: any) => d.name === datasetName
      ) as any;

      if (roadsDataset) {
        const matchingRecords = roadsDataset.records.filter((r: any) => 
          cand.affected_feature_ids.includes(String(r.id)) || 
          cand.affected_feature_ids.includes(String(r.tf_edge_id))
        );

        if (matchingRecords.length > 0) {
          const highlightDataset = {
            ...roadsDataset,
            id: 'tf-modification-highlight',
            name: `Action Highlight (${cand.id.slice(0, 10)})`,
            records: matchingRecords,
            rowCount: matchingRecords.length,
          };
          
          useDataStore.getState().addDataset(highlightDataset);
          
          const layerStore = useLayerStore.getState();
          const highlightLayer = layerStore.layers.find(
            (l) => l.datasetId === 'tf-modification-highlight'
          );
          
          if (highlightLayer) {
            layerStore.updateLayerConfig(highlightLayer.id, {
              strokeColor: [249, 115, 22], // Bright Orange
              strokeWidth: 8,
              opacity: 0.95,
            });
            const nextLayers = layerStore.layers.filter((l) => l.id !== highlightLayer.id);
            nextLayers.push(highlightLayer);
            layerStore.reorderLayers(nextLayers);
          }
          toast.success(`Centered on modification ${cand.id.substring(0, 8)}`);
        } else {
          toast.info('Affected geometry segment is collapsed or not directly selectable.');
        }
      }
    } catch (err) {
      console.error('Highlight failed:', err);
    }
  };

  const toggleReject = (id: string) => {
    if (rejectedIds.includes(id)) {
      setRejectedIds(rejectedIds.filter((x) => x !== id));
    } else {
      setRejectedIds([...rejectedIds, id]);
      setApprovedIds(approvedIds.filter((x) => x !== id));
    }
  };

  const toggleApprove = (id: string) => {
    if (approvedIds.includes(id)) {
      setApprovedIds(approvedIds.filter((x) => x !== id));
    } else {
      setApprovedIds([...approvedIds, id]);
      setRejectedIds(rejectedIds.filter((x) => x !== id));
    }
  };

  const handleReprocess = async () => {
    // Find active job details
    const activeJobDetails = jobs.find((j) => j.job_id === jobId);
    if (!activeJobDetails) return;

    try {
      // Fetch the source config from the job
      const jobRes = await fetch(`/api/v1/urban-engine/jobs/${jobId}`);
      if (!jobRes.ok) throw new Error('Could not retrieve job info.');
      const jobData = await jobRes.json();
      
      const sourceConfig = JSON.parse(jobData.source_reference || '{}');
      const options = JSON.parse(jobData.config_json || '{}');
      
      // Update options with undone repairs list
      options.undone_repairs = [...(options.undone_repairs || []), ...rejectedIds];
      
      toast.promise(
        createJob(sourceConfig, options),
        {
          loading: 'Submitting updated network run...',
          success: 'Network re-processing initialized!',
          error: 'Failed to reprocess network.'
        }
      );
    } catch (error) {
      console.error(error);
      toast.error('Failed to parse active job config.');
    }
  };

  if (!reportArtifact) return null;

  return (
    <div className="flex flex-col gap-3 py-2 border-t border-border-primary/50 mt-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-text-secondary uppercase tracking-[0.12em]">
          Interactive Review Queue
        </span>
        {loading && <span className="text-[10px] text-text-tertiary">Loading candidates...</span>}
      </div>

      {rejectedIds.length > 0 && (
        <div className="flex flex-col gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-control text-text-primary animate-fade-in">
          <div className="flex items-start gap-2 text-xs">
            <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-0.5">
              <span className="font-semibold text-red-400">Rollback Decisions Pending</span>
              <span>You have rejected {rejectedIds.length} operations. Re-run preprocessing to apply.</span>
            </div>
          </div>
          <button
            onClick={handleReprocess}
            className="mt-2 h-8 flex items-center justify-center gap-1.5 rounded bg-red-600 hover:bg-red-500 transition-colors text-xs font-semibold cursor-pointer text-white w-full shadow-tight"
          >
            <RefreshCw size={12} className="animate-spin-slow" />
            <span>Reprocess Network</span>
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
        {candidates.map((cand) => {
          const overallConf = cand.confidence?.overall ?? 100;
          const isHighConf = overallConf >= 95;
          const isRejected = rejectedIds.includes(cand.id);
          const isApproved = approvedIds.includes(cand.id);

          // Category color matching Section 19
          let statusColorClass = 'border-border-primary/40 bg-bg-secondary';
          if (isRejected) {
            statusColorClass = 'border-red-500/50 bg-red-500/5';
          } else if (isApproved) {
            statusColorClass = 'border-blue-500/50 bg-blue-500/5';
          } else if (!isHighConf) {
            statusColorClass = 'border-yellow-500/50 bg-yellow-500/5'; // Needs review
          } else {
            statusColorClass = 'border-emerald-500/50 bg-emerald-500/5'; // High confidence auto
          }

          return (
            <div
              key={cand.id}
              className={`p-3 rounded-control border text-[11px] transition-all flex flex-col gap-2.5 ${statusColorClass}`}
            >
              <div className="flex items-center justify-between font-semibold">
                <span className="font-mono text-xs">{cand.id.substring(0, 12)}...</span>
                <div className="flex items-center gap-1.5">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1 ${
                    isHighConf ? 'bg-emerald-500/10 text-emerald-500' : 'bg-yellow-500/10 text-yellow-600'
                  }`}>
                    {isHighConf ? <ShieldCheck size={10} /> : <ShieldAlert size={10} />}
                    <span>{overallConf.toFixed(0)}% Conf</span>
                  </span>
                </div>
              </div>

              <div className="leading-relaxed text-text-secondary">
                <span className="font-semibold text-text-primary capitalize">{cand.type.replace(/_/g, ' ')}:</span>{' '}
                {cand.reason}
              </div>

              {/* Action Buttons Row */}
              <div className="flex items-center justify-between border-t border-border-primary/20 pt-2.5 mt-0.5">
                <button
                  onClick={() => handleLocateOnMap(cand)}
                  className={`flex items-center gap-1 px-2 py-1 rounded transition-colors text-[10px] font-semibold cursor-pointer border ${
                    highlightedId === cand.id
                      ? 'bg-orange-500 text-white border-orange-500'
                      : 'bg-bg-tertiary/40 border-transparent text-text-secondary hover:text-text-primary'
                  }`}
                  title="Locate geometry on map"
                >
                  <MapPin size={10} />
                  <span>{highlightedId === cand.id ? 'Highlighted' : 'Locate'}</span>
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => toggleReject(cand.id)}
                    className={`flex items-center gap-1 px-2 py-1 rounded transition-colors text-[10px] font-semibold cursor-pointer border ${
                      isRejected
                        ? 'bg-red-500 text-white border-red-500'
                        : 'bg-bg-tertiary/40 border-transparent text-text-secondary hover:text-red-500'
                    }`}
                  >
                    <XCircle size={10} />
                    <span>{isRejected ? 'Rejected' : 'Reject'}</span>
                  </button>

                  <button
                    onClick={() => toggleApprove(cand.id)}
                    className={`flex items-center gap-1 px-2 py-1 rounded transition-colors text-[10px] font-semibold cursor-pointer border ${
                      isApproved
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'bg-bg-tertiary/40 border-transparent text-text-secondary hover:text-blue-500'
                    }`}
                  >
                    <CheckCircle size={10} />
                    <span>{isApproved ? 'Approved' : 'Approve'}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
