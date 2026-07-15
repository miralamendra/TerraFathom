export interface SampleDatasetOption {
  id: string;
  name: string;
  format: 'csv';
  path: string;
  description: string;
}

export const SAMPLE_DATASETS: SampleDatasetOption[] = [
  {
    id: 'sample-earthquakes',
    name: 'Earthquakes',
    format: 'csv',
    path: '/data/Earthqueks/data.csv',
    description: 'Global seismic events & magnitudes',
  },
  {
    id: 'sample-pittsburgh-movement',
    name: 'Pittsburgh Transit',
    format: 'csv',
    path: '/data/Movement_Pittasburge/data.csv',
    description: 'Uber travel times & speeds',
  },
  {
    id: 'sample-nyc-taxi',
    name: 'NYC Taxi Trips',
    format: 'csv',
    path: '/data/NYC/data.csv',
    description: 'Yellow cab trip pick & drop-offs',
  },
];
