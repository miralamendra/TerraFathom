import { useEffect, useState, useMemo } from 'react';
import { Play, Pause, RotateCcw, Repeat, Clock } from 'lucide-react';
import { useAnimationStore } from '@/stores/animation-store';
import { useDataStore } from '@/stores/data-store';
import { Select } from '@/components/ui';
import { cn } from '@/components/ui/utils';

export function AnimationPlayer() {
  const isPlaying = useAnimationStore((s) => s.isPlaying);
  const currentTime = useAnimationStore((s) => s.currentTime);
  const timeRange = useAnimationStore((s) => s.timeRange);
  const timeField = useAnimationStore((s) => s.timeField);
  const speed = useAnimationStore((s) => s.speed);
  const loop = useAnimationStore((s) => s.loop);

  const setPlaying = useAnimationStore((s) => s.setPlaying);
  const setCurrentTime = useAnimationStore((s) => s.setCurrentTime);
  const setTimeRange = useAnimationStore((s) => s.setTimeRange);
  const setTimeField = useAnimationStore((s) => s.setTimeField);
  const setSpeed = useAnimationStore((s) => s.setSpeed);
  const setWindowSize = useAnimationStore((s) => s.setWindowSize);
  const setLoop = useAnimationStore((s) => s.setLoop);

  const selectedDatasetId = useDataStore((s) => s.selectedDatasetId);
  const datasets = useDataStore((s) => s.datasets);
  const dataset = selectedDatasetId ? datasets[selectedDatasetId] : null;

  const [activeWindowOption, setActiveWindowOption] = useState<string>('0');

  // Find numeric and timestamp fields for animation selection
  const animatableFields = dataset
    ? dataset.fields.filter((f) => f.type === 'integer' || f.type === 'real' || f.type === 'timestamp')
    : [];

  const selectedFieldStats = dataset?.fields.find((f) => f.name === timeField);

  // Calculate data distribution bins for sparkline graph
  const bins = useMemo(() => {
    if (!dataset || !timeField || !timeRange || !selectedFieldStats) return [];
    const [minVal, maxVal] = timeRange;
    const range = maxVal - minVal;
    if (range <= 0) return [];

    const binCount = 40;
    const counts = new Array(binCount).fill(0);
    const step = range / binCount;

    for (const r of dataset.records) {
      const val = r[timeField];
      if (val === null || val === undefined) continue;
      
      let numVal: number;
      if (typeof val === 'number') {
        numVal = val;
      } else if (selectedFieldStats.type === 'timestamp') {
        numVal = Date.parse(val as string);
      } else {
        numVal = parseFloat(String(val));
      }

      if (isNaN(numVal)) continue;

      const binIdx = Math.min(binCount - 1, Math.floor((numVal - minVal) / step));
      if (binIdx >= 0 && binIdx < binCount) {
        counts[binIdx]++;
      }
    }

    const maxCount = Math.max(...counts, 1);
    return counts.map((count, i) => ({
      binStart: minVal + i * step,
      binEnd: minVal + (i + 1) * step,
      count,
      heightPercent: (count / maxCount) * 100,
    }));
  }, [dataset, timeField, timeRange, selectedFieldStats]);

  // Initialize time range when time field changes
  useEffect(() => {
    if (!dataset || !timeField || !selectedFieldStats) return;

    let minVal = 0;
    let maxVal = 0;

    if (selectedFieldStats.type === 'timestamp') {
      const records = dataset.records;
      const times = records
        .map((r) => Date.parse(r[timeField] as string))
        .filter((t) => !isNaN(t));
      if (times.length > 0) {
        minVal = Math.min(...times);
        maxVal = Math.max(...times);
      }
    } else {
      minVal = Number(selectedFieldStats.min) || 0;
      maxVal = Number(selectedFieldStats.max) || 100;
    }

    setTimeRange([minVal, maxVal]);
    setCurrentTime(minVal);
    // Reset window size when switching fields
    setWindowSize(0);
    setActiveWindowOption('0');
  }, [timeField, dataset]);

  // requestAnimationFrame loop for smooth playback ticks
  useEffect(() => {
    if (!isPlaying || !timeRange || !timeField) return;

    let animFrame: number;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const deltaMs = now - lastTime;
      lastTime = now;

      const min = timeRange[0];
      const max = timeRange[1];
      const rangeSpan = max - min;

      // Complete traversal of entire range in 25 seconds at 1x speed
      const baseDurationMs = 25000;
      const increment = (rangeSpan / baseDurationMs) * deltaMs * speed;

      useAnimationStore.setState((state) => {
        let nextTime = state.currentTime + increment;
        if (nextTime > max) {
          if (state.loop) {
            nextTime = min;
          } else {
            nextTime = max;
            return { currentTime: nextTime, isPlaying: false };
          }
        }
        return { currentTime: nextTime };
      });

      animFrame = requestAnimationFrame(tick);
    };

    animFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrame);
  }, [isPlaying, timeRange, timeField, speed]);

  if (!dataset) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <span className="text-xs text-text-tertiary">Select a dataset to use the playback animator.</span>
      </div>
    );
  }

  if (animatableFields.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <span className="text-xs text-text-tertiary">This dataset has no columns compatible with animation (numeric or dates).</span>
      </div>
    );
  }

  // Format current value based on data type
  const formatCurrentValue = () => {
    if (!timeField || !selectedFieldStats) return 'No Column';
    if (selectedFieldStats.type === 'timestamp') {
      try {
        return new Date(currentTime).toLocaleString();
      } catch {
        return 'Invalid Date';
      }
    }
    return currentTime.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  const min = timeRange ? timeRange[0] : 0;
  const max = timeRange ? timeRange[1] : 100;
  const progressPercent = max > min ? ((currentTime - min) / (max - min)) * 100 : 0;

  // Window options (sliding tail length)
  const getWindowOptions = () => {
    if (selectedFieldStats?.type === 'timestamp') {
      return [
        { label: 'Cumulative (All time)', value: '0' },
        { label: '1 Minute', value: String(60 * 1000) },
        { label: '5 Minutes', value: String(5 * 60 * 1000) },
        { label: '15 Minutes', value: String(15 * 60 * 1000) },
        { label: '1 Hour', value: String(60 * 60 * 1000) },
        { label: '12 Hours', value: String(12 * 60 * 60 * 1000) },
        { label: '1 Day', value: String(24 * 60 * 60 * 1000) },
      ];
    }
    // Numeric percentages
    const span = max - min;
    return [
      { label: 'Cumulative (All)', value: '0' },
      { label: '1% of Range', value: String(span * 0.01) },
      { label: '5% of Range', value: String(span * 0.05) },
      { label: '10% of Range', value: String(span * 0.10) },
      { label: '25% of Range', value: String(span * 0.25) },
    ];
  };

  const handleWindowChange = (valStr: string) => {
    const parsed = parseFloat(valStr);
    setWindowSize(parsed);
    setActiveWindowOption(valStr);
  };

  return (
    <div className="h-full flex flex-col justify-between px-6 py-4 bg-bg-secondary select-none">
      {/* Symmetrical Settings & Digital Display Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 items-end gap-4 shrink-0 pb-3 border-b border-border-primary border-opacity-30">
        {/* Col 1: Animation Column Select */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] text-text-tertiary font-bold uppercase tracking-widest">Animation Column</span>
          <Select
            className="h-8 text-xs font-semibold bg-bg-tertiary border-border-primary"
            value={timeField || ''}
            onChange={(e) => setTimeField(e.target.value || null)}
            options={[{ value: '', label: 'Select column...' }, ...animatableFields.map((f) => ({ value: f.name, label: `${f.name} (${f.type})` }))]}
          />
        </div>

        {/* Col 2: Tail/Window Select */}
        <div className="flex flex-col gap-1.5">
          {timeField ? (
            <div className="flex flex-col gap-1.5 animate-fade-in">
              <span className="text-[10px] text-text-tertiary font-bold uppercase tracking-widest">Window / Tail Size</span>
              <Select
                className="h-8 text-xs font-semibold bg-bg-tertiary border-border-primary"
                value={activeWindowOption}
                onChange={(e) => handleWindowChange(e.target.value)}
                options={getWindowOptions()}
              />
            </div>
          ) : (
            <div className="h-14" /> // Empty placeholder to preserve alignment
          )}
        </div>

        {/* Col 3: Digital Time Display */}
        <div className="flex flex-col items-end gap-1.5 justify-end h-full">
          {timeField && timeRange ? (
            <div className="flex flex-col items-end gap-1 font-mono pr-1 animate-fade-in select-all">
              <span className="text-[10px] text-text-tertiary font-bold uppercase tracking-widest select-none">Current Value</span>
              <span className="text-sm font-bold text-accent tracking-wide">{formatCurrentValue()}</span>
            </div>
          ) : (
            <div className="h-14" />
          )}
        </div>
      </div>

      {/* Main Playback Control Center */}
      {timeField && timeRange ? (
        <div className="flex-1 flex flex-col justify-end gap-4 mt-3">
          {/* Progress Timeline Slider Track */}
          <div className="flex flex-col gap-1.5">
            {/* Distribution sparkline graph */}
            {bins.length > 0 && (
              <div className="h-10 w-full flex items-end gap-[1px] px-1 relative select-none">
                <div className="absolute inset-x-0 bottom-0 h-px bg-border-primary opacity-20" />
                {bins.map((bin, i) => {
                  const isActive = bin.binStart <= currentTime;
                  return (
                    <div
                      key={i}
                      className="flex-1 rounded-t-[1px] transition-all duration-300"
                      style={{
                        height: `${Math.max(4, bin.heightPercent)}%`,
                        backgroundColor: isActive ? 'var(--accent)' : 'var(--color-border-primary)',
                        opacity: isActive ? 0.75 : 0.2,
                      }}
                    />
                  );
                })}
                <div
                  className="absolute top-0 bottom-0 w-px bg-text-primary shadow-glow transition-all duration-75 pointer-events-none"
                  style={{ left: `${progressPercent}%` }}
                />
              </div>
            )}

            <div className="relative group/timeline w-full flex items-center h-5">
              {/* Timeline Track Background */}
              <div className="absolute inset-x-0 h-1 rounded bg-bg-tertiary border border-border-primary border-opacity-30 pointer-events-none" />
              {/* Active Progress Fill */}
              <div
                className="absolute left-0 h-1 rounded bg-accent pointer-events-none transition-all duration-75"
                style={{ width: `${progressPercent}%` }}
              />
              {/* Native Invisible Range Input Overlaid */}
              <input
                type="range"
                min={min}
                max={max}
                step={(max - min) / 1000}
                value={currentTime}
                onChange={(e) => setCurrentTime(parseFloat(e.target.value))}
                className="w-full h-full opacity-0 cursor-pointer relative z-10"
              />
              {/* Custom floating handle */}
              <div
                className="absolute w-3 h-3 rounded-full bg-text-primary shadow-floating border border-border-primary pointer-events-none transform -translate-x-1/2 scale-100 group-hover/timeline:scale-125 transition-transform duration-100 ease-out"
                style={{ left: `${progressPercent}%` }}
              />
            </div>
            
            {/* Timeline min/max limits */}
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] text-text-tertiary font-mono">
                {selectedFieldStats?.type === 'timestamp'
                  ? new Date(min).toLocaleDateString()
                  : min.toFixed(1)}
              </span>
              <span className="text-[10px] text-text-tertiary font-mono">
                {selectedFieldStats?.type === 'timestamp'
                  ? new Date(max).toLocaleDateString()
                  : max.toFixed(1)}
              </span>
            </div>
          </div>

          {/* Action Bar: Controls, Loop, Speed */}
          <div className="grid grid-cols-3 items-center pt-2">
            {/* Col 1: Playback Buttons */}
            <div className="flex items-center gap-2">
              {/* Reset to Start */}
              <button
                type="button"
                onClick={() => setCurrentTime(min)}
                className="w-8 h-8 flex items-center justify-center rounded-control bg-bg-tertiary text-text-secondary hover:text-text-primary hover:bg-bg-hover active:bg-bg-active transition-colors cursor-pointer border border-border-primary border-opacity-60"
                title="Reset to start"
              >
                <RotateCcw size={13} />
              </button>

              {/* Play / Pause */}
              <button
                type="button"
                onClick={() => setPlaying(!isPlaying)}
                className={cn(
                  'w-9 h-9 flex items-center justify-center rounded-full transition-all cursor-pointer shadow-tight transform active:scale-95 border',
                  isPlaying
                    ? 'bg-bg-active border-border-focus text-text-primary'
                    : 'bg-accent border-accent/20 text-text-inverse hover:scale-105'
                )}
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause size={15} fill="currentColor" /> : <Play size={15} className="ml-0.5" fill="currentColor" />}
              </button>

              {/* Loop Toggle */}
              <button
                type="button"
                onClick={() => setLoop(!loop)}
                className={cn(
                  'w-8 h-8 flex items-center justify-center rounded-control transition-colors cursor-pointer border',
                  loop
                    ? 'bg-accent/10 border-accent/20 text-accent font-bold'
                    : 'bg-bg-tertiary border-border-primary border-opacity-60 text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                )}
                title={loop ? 'Disable looping' : 'Enable looping'}
              >
                <Repeat size={13} className={loop ? 'text-accent' : ''} />
              </button>
            </div>

            {/* Col 2: Center Spacer */}
            <div />

            {/* Col 3: Speed Segmented Control */}
            <div className="flex items-center gap-3 justify-end">
              <span className="text-[10px] text-text-tertiary font-bold uppercase tracking-wider">Speed</span>
              <div className="flex gap-0.5 bg-bg-tertiary rounded-control p-0.5 border border-border-primary border-opacity-60">
                {([0.5, 1, 2, 5, 10] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSpeed(s)}
                    className={cn(
                      'px-2.5 py-1 rounded-[4px] text-[10px] font-semibold transition-colors cursor-pointer',
                      speed === s
                        ? 'bg-accent text-text-inverse'
                        : 'text-text-secondary hover:text-text-primary'
                    )}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-4">
          <Clock size={24} className="text-text-tertiary mb-3 opacity-60" />
          <span className="text-sm font-bold text-text-secondary">Playback Timeline Ready</span>
          <span className="text-[11px] text-text-tertiary max-w-[340px] mt-1.5 leading-relaxed">
            Choose a date/time or numeric column from the dropdown above to initialize the animation player interface.
          </span>
        </div>
      )}
    </div>
  );
}
export default AnimationPlayer;
