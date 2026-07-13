declare module 'xlsx' {
  export interface WorkBook {
    SheetNames: string[];
    Sheets: Record<string, WorkSheet>;
  }

  export interface WorkSheet {
    [key: string]: unknown;
  }

  export function read(data: Buffer, options: { type: 'buffer' }): WorkBook;

  export const utils: {
    sheet_to_json<T = unknown[]>(
      worksheet: WorkSheet,
      options: { header: 1; defval: string },
    ): T[];
  };
}
