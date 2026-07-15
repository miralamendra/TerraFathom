export type FilterValue = [number, number] | (string | number | boolean | null)[];

export interface Filter {
  id: string;
  datasetId: string;
  fieldName: string;
  type: 'range' | 'value';
  value: FilterValue;
  active: boolean;
}
