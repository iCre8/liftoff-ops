export class SheetVersionConflictError extends Error {
  override readonly name = 'SheetVersionConflictError';
}

export class SheetAuthorityConflictError extends Error {
  override readonly name = 'SheetAuthorityConflictError';
}

export class SheetRecordNotFoundError extends Error {
  override readonly name = 'SheetRecordNotFoundError';
}
