import { type ConfidenceScores } from '@/stores/urban-engine-store';

interface ConfidenceDisplayProps {
  scores: ConfidenceScores;
}

export function ConfidenceDisplay({ scores }: ConfidenceDisplayProps) {
  const categories = [
    { label: 'Geometry', value: scores.geometry },
    { label: 'Topology', value: scores.topology },
    { label: 'Connectivity', value: scores.connectivity },
    { label: 'Classification', value: scores.road_classification },
    { label: 'Pedestrian Completeness', value: scores.pedestrian_completeness },
  ];

  return (
    <div className="flex flex-col gap-3 py-2">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-semibold text-text-secondary uppercase tracking-[0.12em]">
          Overall Confidence
        </span>
        <span className="text-xl font-bold text-accent">
          {scores.overall}%
        </span>
      </div>

      <div className="h-1.5 w-full bg-bg-tertiary rounded-full overflow-hidden">
        <div 
          className="h-full bg-accent transition-all duration-500 ease-out"
          style={{ width: `${scores.overall}%` }}
        />
      </div>

      <div className="flex flex-col gap-2 mt-2">
        {categories.map((cat) => (
          <div key={cat.label} className="flex flex-col gap-1">
            <div className="flex justify-between items-baseline text-xs">
              <span className="text-text-secondary font-medium">{cat.label}</span>
              <span className="text-text-primary font-semibold font-mono">{cat.value}%</span>
            </div>
            <div className="h-1 w-full bg-bg-tertiary/50 rounded-full overflow-hidden">
              <div 
                className="h-full bg-text-secondary transition-all duration-500"
                style={{ width: `${cat.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
export default ConfidenceDisplay;
