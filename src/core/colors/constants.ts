export interface DatasetColorOption {
  bgClass: string;
  borderClass: string;
  textClass: string;
  hex: string;
}

export const DATASET_COLORS: DatasetColorOption[] = [
  {
    bgClass: 'bg-blue-500/15',
    borderClass: 'border-blue-500/20',
    textClass: 'text-blue-400',
    hex: '#3B82F6',
  },
  {
    bgClass: 'bg-emerald-500/15',
    borderClass: 'border-emerald-500/20',
    textClass: 'text-emerald-400',
    hex: '#10B981',
  },
  {
    bgClass: 'bg-amber-500/15',
    borderClass: 'border-amber-500/20',
    textClass: 'text-amber-400',
    hex: '#F59E0B',
  },
  {
    bgClass: 'bg-rose-500/15',
    borderClass: 'border-rose-500/20',
    textClass: 'text-rose-400',
    hex: '#F43F5E',
  },
  {
    bgClass: 'bg-violet-500/15',
    borderClass: 'border-violet-500/20',
    textClass: 'text-violet-400',
    hex: '#8B5CF6',
  },
  {
    bgClass: 'bg-orange-500/15',
    borderClass: 'border-orange-500/20',
    textClass: 'text-orange-400',
    hex: '#F97316',
  },
];
