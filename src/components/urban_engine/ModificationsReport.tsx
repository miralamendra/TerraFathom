import { useState, useEffect } from 'react';
import { ShieldCheck, ShieldAlert } from 'lucide-react';
import { type ArtifactInfo } from '@/stores/urban-engine-store';
import { useDataStore } from '@/stores/data-store';
import { useLayerStore } from '@/stores/layer-store';
import { toast } from 'sonner';

interface ModificationsReportProps {
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

export function ModificationsReport({ jobId, artifacts }: ModificationsReportProps) {
  const [modifications, setModifications] = useState<ModificationEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Find the modifications report JSON artifact by checking download_url
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
          setModifications(data);
        }
      } catch (err) {
        console.error('Failed to load modifications report:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [reportArtifact]);

  const handleSelectModification = (mod: ModificationEntry) => {
    setSelectedId(mod.id === selectedId ? null : mod.id);
    if (mod.id === selectedId) {
      // Clear highlight if clicked again
      const dataStore = useDataStore.getState();
      dataStore.removeDataset('tf-modification-highlight');
      return;
    }

    if (!mod.geom_after_wkt && !mod.geom_before_wkt) return;

    // We can use a lightweight GeoJSON generation helper to visualize this geometry
    try {
      const wkt = mod.geom_after_wkt || mod.geom_before_wkt;
      if (!wkt) return;

      // Import dynamic geometry parser
      const { useDataStore } = require('@/stores/data-store');
      
      // Construct a simple Feature representing the highlighted geometry
      // Since it is WKT, we can parse it or let the deck.gl layer handle WKT
      // A clean way is to format a simple GeoJSON FeatureCollection:
      // WKT to GeoJSON converter or simple segment mapping.
      const datasetName = `Repaired Roads (${jobId.substring(0, 6)})`;
      const roadsDataset = Object.values(useDataStore.getState().datasets).find(
        (d: any) => d.name === datasetName
      ) as any;

      if (roadsDataset) {
        // Highlight all segments whose IDs are in mod.affected_feature_ids or match the new geometry
        const matchingRecords = roadsDataset.records.filter((r: any) => 
          mod.affected_feature_ids.includes(String(r.id)) || 
          mod.affected_feature_ids.includes(String(r.tf_edge_id))
        );

        if (matchingRecords.length > 0) {
          const highlightDataset = {
            ...roadsDataset,
            id: 'tf-modification-highlight',
            name: `Action Highlight (${mod.id.slice(0, 10)})`,
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
            // Bring to top
            const nextLayers = layerStore.layers.filter((l) => l.id !== highlightLayer.id);
            nextLayers.push(highlightLayer);
            layerStore.reorderLayers(nextLayers);
          }
        } else {
          toast.info('Affected geometry segment is collapsed or not directly selectable.');
        }
      }
    } catch (err) {
      console.error('Highlight failed:', err);
    }
  };

  if (!reportArtifact) return null;

  return (
    <div className="flex flex-col gap-3 py-2 border-t border-border-primary/50 mt-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-text-secondary uppercase tracking-[0.12em]">
          Modifications Audit Log
        </span>
        {loading && <span className="text-[10px] text-text-tertiary">Loading...</span>}
      </div>

      <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
        {modifications.length === 0 && !loading && (
          <span className="text-[11px] text-text-tertiary italic">No corridor modifications performed.</span>
        )}

        {modifications.map((mod) => {
          const overallConf = mod.confidence?.overall ?? 100;
          const isHighConf = overallConf >= 95;

          return (
            <div
              key={mod.id}
              onClick={() => handleSelectModification(mod)}
              className={`p-2.5 rounded-control border text-[11px] transition-all cursor-pointer ${
                selectedId === mod.id
                  ? 'bg-orange-500/10 border-orange-500 text-text-primary shadow-tight'
                  : 'bg-bg-secondary border-border-primary/40 hover:border-border-primary text-text-secondary hover:text-text-primary'
              }`}
            >
              <div className="flex items-center justify-between font-semibold mb-1">
                <span className="font-mono text-xs">{mod.id.slice(0, 15)}...</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1 ${
                  isHighConf ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
                }`}>
                  {isHighConf ? <ShieldCheck size={10} /> : <ShieldAlert size={10} />}
                  <span>{overallConf.toFixed(0)}% Conf</span>
                </span>
              </div>

              <div className="flex flex-col gap-1 mt-1.5 leading-relaxed">
                <div>
                  <span className="font-semibold text-text-primary capitalize">{mod.type.replace(/_/g, ' ')}:</span>{' '}
                  {mod.reason}
                </div>
                {selectedId === mod.id && (
                  <div className="mt-2 pt-2 border-t border-border-primary/40 flex flex-col gap-1 text-[10px] text-text-tertiary animate-fade-in">
                    <div>
                      <span className="font-semibold text-text-secondary">Method:</span> {mod.method}
                    </div>
                    <div>
                      <span className="font-semibold text-text-secondary">Affected Features:</span>{' '}
                      {mod.affected_feature_ids.join(', ')}
                    </div>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 mt-1 border-t border-border-primary/30 pt-1 text-[9px] font-mono">
                      <div>Geom: {mod.confidence.geometry}%</div>
                      <div>Topo: {mod.confidence.topology}%</div>
                      <div>Semantics: {mod.confidence.semantics}%</div>
                      <div>Conn: {mod.confidence.connectivity}%</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
export default ModificationsReport;
