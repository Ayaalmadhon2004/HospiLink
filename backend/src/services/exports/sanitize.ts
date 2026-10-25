// backend/src/services/exports/sanitize.ts
//
// Spreadsheet formula injection: a cell that starts with = + - @ (or a tab / carriage return) is executed as a formula
// by Excel/LibreOffice. Free text such as a patient's name or a diagnosis is user input, so it is neutralised by
// prefixing an apostrophe, which spreadsheets render as plain text.
const FORMULA_START = /^[=+\-@\t\r]/;

export const sanitizeCell = (value: string): string => (FORMULA_START.test(value) ? `'${value}` : value);
