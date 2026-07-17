export type SheetCellValue = string | number | boolean | null;

export interface SheetRangeValues {
  range: string;
  values: readonly (readonly SheetCellValue[])[];
}

export interface SheetValuesGateway {
  resolveWorksheetTitle(worksheetId: number): Promise<string>;
  readRanges(ranges: readonly string[]): Promise<readonly SheetRangeValues[]>;
  writeCell(input: { range: string; value: SheetCellValue }): Promise<void>;
}
