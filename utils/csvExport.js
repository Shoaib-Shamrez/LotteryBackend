import { stringify } from 'csv-stringify';

// Protect against spreadsheet formula injection by prefixing dangerous leading characters
function protectFormula(value) {
  if (typeof value !== 'string') return value;
  // If value starts with = + - @, prefix a single quote
  if (/^[=+\-@]/.test(value)) {
    return "'" + value;
  }
  return value;
}

/**
 * Generate CSV string from rows and header definitions.
 * @param {Array<Array<any>>} dataRows - 2‑D array of cell values
 * @param {Array<string>} headers - column names
 * @returns {Promise<string>} CSV content
 */
export async function generateCsv(dataRows, headers) {
  const safeRows = dataRows.map(row => row.map(cell => protectFormula(String(cell))));
  return new Promise((resolve, reject) => {
    stringify(safeRows, { header: true, columns: headers }, (err, output) => {
      if (err) reject(err);
      else resolve(output);
    });
  });
}
