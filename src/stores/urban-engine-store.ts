import { create } from 'zustand';
import { toast } from 'sonner';

export type JobStatus = 'queued' | 'running' | 'cancelling' | 'cancelled' | 'succeeded' | 'failed' | 'expired';

export interface UrbanJob {
  job_id: string;
  status: JobStatus;
  progress_pct: number;
  current_phase: string | null;
  phase_description: string | null;
  created_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  error_code: string | null;
  error_message: string | null;
  status_url: string | null;
  events_url: string | null;
  result_url: string | null;
}

export interface ConfidenceScores {
  geometry: number;
  topology: number;
  connectivity: number;
  road_classification: number;
  pedestrian_completeness: number;
  overall: number;
}

export interface RepairSummary {
  detected: number;
  auto_fixed: number;
  manual_review: number;
}

export interface ArtifactInfo {
  artifact_id: string;
  artifact_type: string;
  format: string;
  size_bytes: number;
  download_url: string;
}

export interface JobResult {
  job_id: string;
  statistics: any | null;
  quality: any | null;
  confidence: ConfidenceScores | null;
  repair_summary: RepairSummary | null;
  metadata: any | null;
  artifacts: ArtifactInfo[];
  analysis_crs: string | null;
}

interface UrbanEngineState {
  jobs: UrbanJob[];
  activeJob: UrbanJob | null;
  activeResult: JobResult | null;
  isLoading: boolean;
  isProcessing: boolean;
  
  // Actions
  fetchJobs: () => Promise<void>;
  createJob: (source: { kind: string; [key: string]: any }, options?: any) => Promise<string | null>;
  cancelJob: (jobId: string) => Promise<void>;
  deleteJob: (jobId: string) => Promise<void>;
  selectJob: (jobId: string) => Promise<void>;
  clearActiveJob: () => void;
}

let pollIntervalId: any = null;

const loadJobLayersToMap = async (jobId: string, artifacts: ArtifactInfo[]) => {
  const roadsArtifact = artifacts.find(
    (art) => art.artifact_type === 'preview_segments' && art.format === 'geojson'
  );
  if (!roadsArtifact) return;

  try {
    const geojsonRes = await fetch(roadsArtifact.download_url);
    if (!geojsonRes.ok) throw new Error('Failed to download segment layer.');
    const geojsonText = await geojsonRes.text();
    
    // Lazy imports to prevent store dependency cycles
    const { processDataset } = await import('@/core/data/processors/data-processor');
    const { useDataStore } = await import('./data-store');
    
    const datasetName = `Repaired Roads (${jobId.substring(0, 6)})`;
    const processed = processDataset(datasetName, geojsonText, 'geojson', '#27a644');
    
    useDataStore.getState().addDataset(processed);
    toast.success('Repaired roads loaded onto the map!');
  } catch (err) {
    console.error('Failed to load segment layer onto map:', err);
    toast.error('Failed to load repaired roads onto map.');
  }
};

export const useUrbanEngineStore = create<UrbanEngineState>((set, get) => ({
  jobs: [],
  activeJob: null,
  activeResult: null,
  isLoading: false,
  isProcessing: false,

  fetchJobs: async () => {
    set({ isLoading: true });
    try {
      const response = await fetch('/api/v1/urban-engine/jobs');
      if (!response.ok) throw new Error('Failed to fetch jobs list.');
      const data = await response.json();
      set({ jobs: data.jobs || [] });
    } catch (error: any) {
      toast.error('Failed to load processing jobs', {
        description: error.message,
      });
    } finally {
      set({ isLoading: false });
    }
  },

  createJob: async (source, options = {}) => {
    set({ isProcessing: true });
    try {
      const response = await fetch('/api/v1/urban-engine/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, options }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Failed to submit processing job.');
      }
      const data = await response.json();
      
      // Update list and select the new job
      const newJob: UrbanJob = data;
      set((state) => ({
        jobs: [newJob, ...state.jobs],
        activeJob: newJob,
        activeResult: null,
      }));

      // Connect real-time progress update polling
      get().selectJob(newJob.job_id);
      
      toast.success('Urban processing job submitted.');
      return newJob.job_id;
    } catch (error: any) {
      toast.error('Failed to start processing', {
        description: error.message,
      });
      set({ isProcessing: false });
      return null;
    }
  },

  cancelJob: async (jobId) => {
    try {
      const response = await fetch(`/api/v1/urban-engine/jobs/${jobId}/cancel`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to request cancellation.');
      await response.json();
      
      set((state) => ({
        jobs: state.jobs.map((j) => (j.job_id === jobId ? { ...j, status: 'cancelling' } : j)),
        activeJob: state.activeJob?.job_id === jobId ? { ...state.activeJob, status: 'cancelling' } : state.activeJob,
      }));
      toast.info('Job cancellation requested.');
    } catch (error: any) {
      toast.error('Failed to cancel job', {
        description: error.message,
      });
    }
  },

  deleteJob: async (jobId) => {
    try {
      const response = await fetch(`/api/v1/urban-engine/jobs/${jobId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete job record.');
      
      set((state) => ({
        jobs: state.jobs.filter((j) => j.job_id !== jobId),
        activeJob: state.activeJob?.job_id === jobId ? null : state.activeJob,
        activeResult: state.activeJob?.job_id === jobId ? null : state.activeResult,
      }));
      toast.success('Job record deleted.');
    } catch (error: any) {
      toast.error('Failed to delete job', {
        description: error.message,
      });
    }
  },

  selectJob: async (jobId) => {
    // Clear existing poll interval if any
    if (pollIntervalId) {
      clearInterval(pollIntervalId);
      pollIntervalId = null;
    }

    set({ isLoading: true });
    try {
      const response = await fetch(`/api/v1/urban-engine/jobs/${jobId}`);
      if (!response.ok) throw new Error('Job not found.');
      const job: UrbanJob = await response.json();
      set({ activeJob: job });

      if (job.status === 'succeeded') {
        // Fetch results immediately
        const resResponse = await fetch(`/api/v1/urban-engine/jobs/${jobId}/result`);
        if (resResponse.ok) {
          const resData = await resResponse.json();
          set({ activeResult: resData, isProcessing: false });
          await loadJobLayersToMap(jobId, resData.artifacts);
        }
      } else if (['queued', 'running', 'cancelling'].includes(job.status)) {
        set({ isProcessing: true });
        
        // Start polling every 1200ms
        pollIntervalId = setInterval(async () => {
          try {
            const pollResponse = await fetch(`/api/v1/urban-engine/jobs/${jobId}`);
            if (!pollResponse.ok) {
              clearInterval(pollIntervalId);
              pollIntervalId = null;
              return;
            }
            const updatedJob: UrbanJob = await pollResponse.json();
            
            // Sync updated job with state
            set((state) => {
              if (state.activeJob?.job_id !== jobId) return {};
              return { activeJob: updatedJob };
            });

            // If job completes, fails, or cancels: stop polling and update results
            if (updatedJob.status === 'succeeded') {
              clearInterval(pollIntervalId);
              pollIntervalId = null;
              set({ isProcessing: false });
              toast.success('Processing completed successfully.');
              
              // Fetch results
              const resResponse = await fetch(`/api/v1/urban-engine/jobs/${jobId}/result`);
              if (resResponse.ok) {
                const resData = await resResponse.json();
                set({ activeResult: resData });
                await loadJobLayersToMap(jobId, resData.artifacts);
              }
            } else if (updatedJob.status === 'failed') {
              clearInterval(pollIntervalId);
              pollIntervalId = null;
              set({ isProcessing: false });
              toast.error('Processing job failed', {
                description: updatedJob.error_message || 'Unknown error occurred.',
              });
            } else if (updatedJob.status === 'cancelled') {
              clearInterval(pollIntervalId);
              pollIntervalId = null;
              set({ isProcessing: false });
              toast.info('Job was cancelled.');
            }
          } catch (err) {
            console.error('Polling error:', err);
          }
        }, 1200);
      } else {
        set({ isProcessing: false });
      }
    } catch (error: any) {
      toast.error('Failed to load job details', {
        description: error.message,
      });
    } finally {
      set({ isLoading: false });
    }
  },

  clearActiveJob: () => {
    if (pollIntervalId) {
      clearInterval(pollIntervalId);
      pollIntervalId = null;
    }
    set({ activeJob: null, activeResult: null, isProcessing: false });
  },
}));
