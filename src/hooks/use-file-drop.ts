import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useDataStore } from '@/stores/data-store';
import { processDataset } from '@/core/data/processors/data-processor';
import { DATASET_COLORS } from '@/core/colors/constants';

export function useFileDrop() {
  const [isDragOver, setIsDragOver] = useState(false);
  const addDataset = useDataStore((s) => s.addDataset);
  const datasets = useDataStore((s) => s.datasets);

  const processFile = useCallback(
    async (file: File) => {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      if (fileExtension !== 'csv' && fileExtension !== 'geojson' && fileExtension !== 'json') {
        toast.error(`Unsupported file type: .${fileExtension}`, {
          description: 'Please upload only CSV or GeoJSON files.',
        });
        return;
      }

      const format = fileExtension === 'csv' ? 'csv' : 'geojson';
      
      // Determine the next color badge allocation
      const colorIndex = Object.keys(datasets).length % DATASET_COLORS.length;
      const allocatedColor = DATASET_COLORS[colorIndex].bgClass; // we can use the full object or class

      const reader = new FileReader();
      
      reader.onload = (e) => {
        const text = e.target?.result;
        if (typeof text !== 'string') {
          toast.error('Could not read file content');
          return;
        }

        try {
          const datasetName = file.name;
          const processed = processDataset(datasetName, text, format, allocatedColor);
          
          if (processed.rowCount === 0) {
            toast.warning(`Dataset "${file.name}" is empty`);
            return;
          }

          addDataset(processed);
          toast.success(`Imported "${file.name}" successfully`, {
            description: `${processed.rowCount} rows processed, bounds parsed.`,
          });
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          toast.error(`Failed to parse "${file.name}"`, {
            description: errMsg,
          });
        }
      };

      reader.onerror = () => {
        toast.error(`Failed to read file "${file.name}"`);
      };

      reader.readAsText(file);
    },
    [addDataset, datasets]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        processFile(file);
      }
    },
    [processFile]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        const file = e.target.files[0];
        processFile(file);
      }
    },
    [processFile]
  );

  return {
    isDragOver,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFileChange,
    processFile, // Also export so we can load samples directly
  };
}
