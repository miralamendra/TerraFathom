import { Download, File, Database, Network } from 'lucide-react';
import { type ArtifactInfo } from '@/stores/urban-engine-store';

interface ArtifactDownloadsProps {
  artifacts: ArtifactInfo[];
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function ArtifactDownloads({ artifacts }: ArtifactDownloadsProps) {
  const getIcon = (type: string) => {
    if (type.includes('geopackage')) return Database;
    if (type.includes('graph')) return Network;
    return File;
  };

  const getLabel = (type: string) => {
    switch (type) {
      case 'geopackage':
        return 'GeoPackage Database (GPKG)';
      case 'road_segments':
        return 'Road Segments (GeoParquet)';
      case 'road_nodes':
        return 'Road Nodes (GeoParquet)';
      case 'preview_segments':
        return 'Road Segments (GeoJSON)';
      case 'preview_nodes':
        return 'Road Nodes (GeoJSON)';
      case 'physical_graph':
        return 'Network Graph (GraphML)';
      default:
        return type.replace(/_/g, ' ');
    }
  };

  return (
    <div className="flex flex-col gap-3 py-2">
      <span className="text-xs font-semibold text-text-secondary uppercase tracking-[0.12em]">
        Generated Artifacts
      </span>

      <div className="flex flex-col gap-1.5">
        {artifacts.map((art) => {
          const Icon = getIcon(art.artifact_type);
          return (
            <div 
              key={art.artifact_id}
              className="flex items-center justify-between p-2 rounded-control bg-bg-secondary border border-border-primary/40 hover:border-border-primary hover:bg-bg-hover transition-all text-xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1 rounded bg-bg-tertiary/40 text-text-secondary">
                  <Icon size={14} />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-medium text-text-primary truncate">
                    {getLabel(art.artifact_type)}
                  </span>
                  <span className="text-[10px] text-text-tertiary font-mono">
                    {formatBytes(art.size_bytes)} • {art.format.toUpperCase()}
                  </span>
                </div>
              </div>

              <a 
                href={art.download_url}
                download
                className="p-1.5 rounded-control text-text-secondary hover:text-text-primary hover:bg-bg-active active:scale-95 transition-all cursor-pointer"
                title="Download file"
              >
                <Download size={14} />
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}
export default ArtifactDownloads;
