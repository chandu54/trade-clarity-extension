import * as XLSX from 'xlsx';

/**
 * Converts binary Excel (.xlsx, .xls) ArrayBuffer into CSV text
 */
export function convertWorkbookToCSV(arrayBuffer) {
  if (!arrayBuffer) return '';
  const data = new Uint8Array(arrayBuffer);
  const workbook = XLSX.read(data, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return '';
  const worksheet = workbook.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_csv(worksheet);
}

// Helper to sanitize text strings (removes HTML tags & prevents CSV injection formula execution)
export function sanitizeString(val) {
  if (!val) return '';
  let str = String(val).trim();
  // Strip any script/style block tags and their inner content
  str = str.replace(/<script\b[^<]*>(?:[\s\S]*?)<\/script>/gi, '');
  str = str.replace(/<style\b[^<]*>(?:[\s\S]*?)<\/style>/gi, '');
  // Strip remaining HTML tags
  str = str.replace(/<[^>]*>?/gm, '');
  // Prevent CSV Injection formulas starting with =, +, -, @, or tab/CR
  if (/^[=+\-@\t\r]/.test(str)) {
    str = str.replace(/^[=+\-@\t\r]+/, "'");
  }
  return str;
}

// Helper to sanitize numeric values safely
export function sanitizeNumber(val, defaultVal = 0) {
  if (val === null || val === undefined || val === '') return defaultVal;
  // Remove commas, currency symbols, spaces
  const clean = String(val).replace(/[^0-9.-]/g, '');
  const num = parseFloat(clean);
  return isNaN(num) ? defaultVal : num;
}

// Clean Indian stock symbol suffixes (e.g., "RELIANCE INDUSTRIES LTD" -> "RELIANCE", "TATAMOTORS - EQ" -> "TATAMOTORS")
export function normalizeSymbol(rawSymbol) {
  if (!rawSymbol) return '';
  let sym = sanitizeString(rawSymbol).toUpperCase();
  // Strip Common Company Suffixes
  sym = sym
    .replace(/\s*-\s*EQ$/i, '')
    .replace(/\s*-\s*BE$/i, '')
    .replace(/\s+LIMITED$/i, '')
    .replace(/\s+LTD\.?$/i, '')
    .replace(/\s+INDUSTRIES$/i, '')
    .replace(/\.NS$/i, '')
    .replace(/\.BO$/i, '')
    .trim();
  // Extract first word if it contains special characters
  const parts = sym.split(/[\s,]+/);
  return parts[0] || sym;
}

/**
 * Robust CSV Line Splitter with Escaped Quote Handling
 * Converts raw CSV string into a 2D Array of sanitized string cells.
 */
export function parseCSVToRows(csvText) {
  if (!csvText || typeof csvText !== 'string') return [];
  // Limit max file length (e.g. 10MB limit check)
  if (csvText.length > 10 * 1024 * 1024) {
    throw new Error('CSV file exceeds maximum size limit (10MB).');
  }

  const lines = csvText.split(/\r\n|\n|\r/);
  const result = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const row = [];
    let insideQuotes = false;
    let currentToken = '';

    for (let c = 0; c < line.length; c++) {
      const char = line[c];
      if (char === '"' || char === "'") {
        insideQuotes = !insideQuotes;
      } else if (char === ',' && !insideQuotes) {
        row.push(currentToken.trim());
        currentToken = '';
      } else {
        currentToken += char;
      }
    }
    row.push(currentToken.trim());
    if (row.some(cell => cell.length > 0)) {
      result.push(row);
    }
  }

  return result;
}

/**
 * Header Scanner: Finds the header row index in CSVs containing leading metadata lines (e.g. Zerodha Client ID)
 */
export function findHeaderRowIndex(rows, targetKeywords = ['symbol', 'stock name', 'trade date', 'buy value']) {
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const rowStr = rows[i].map(c => c.toLowerCase()).join(' ');
    let matches = 0;
    for (const kw of targetKeywords) {
      if (rowStr.includes(kw)) matches++;
    }
    if (matches >= 2) {
      return i;
    }
  }
  return 0; // default to first row
}

/**
 * Strategy 1: Zerodha Tradebook Parser (Raw Order Executions)
 * Headers: Symbol, ISIN, Trade Date, Exchange, Segment, Series, Trade Type, Quantity, Price, Order Execution Time
 */
export function parseZerodhaTradebook(rows, headerIdx) {
  const headers = rows[headerIdx].map(h => h.toLowerCase().trim());
  const symbolCol = headers.findIndex(h => h === 'symbol');
  const typeCol = headers.findIndex(h => h.includes('trade type') || h === 'type');
  const qtyCol = headers.findIndex(h => h === 'quantity' || h === 'qty');
  const priceCol = headers.findIndex(h => h === 'price');
  const dateCol = headers.findIndex(h => h.includes('execution time') || h.includes('trade date') || h === 'date');

  if (symbolCol === -1 || typeCol === -1 || qtyCol === -1 || priceCol === -1) {
    return null; // Not Zerodha Tradebook format
  }

  const executions = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length <= Math.max(symbolCol, typeCol, qtyCol, priceCol)) continue;

    const rawSym = row[symbolCol];
    const symbol = normalizeSymbol(rawSym);
    if (!symbol) continue;

    const rawType = row[typeCol] ? row[typeCol].toLowerCase() : '';
    const type = (rawType === 'buy' || rawType === 'b') ? 'Buy' : (rawType === 'sell' || rawType === 's') ? 'Sell' : null;
    if (!type) continue;

    const qty = Math.abs(sanitizeNumber(row[qtyCol], 0));
    const price = sanitizeNumber(row[priceCol], 0);
    if (qty <= 0 || price <= 0) continue;

    let dateStr = row[dateCol] ? row[dateCol].split('T')[0].split(' ')[0] : new Date().toISOString().split('T')[0];
    // Ensure YYYY-MM-DD
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts[0].length === 4) dateStr = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      else if (parts[2].length === 4) dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }

    executions.push({
      symbol,
      type,
      qty,
      price,
      date: sanitizeString(dateStr),
      rawSymbol: sanitizeString(rawSym)
    });
  }

  return executions.length > 0 ? { type: 'executions', data: executions } : null;
}

/**
 * Strategy 2: Zerodha Tax P&L Statement Parser (Pre-Summarized Positions)
 * Headers: Symbol, ISIN, Quantity, Buy Value, Sell Value, Realized P&L, Open Quantity...
 */
export function parseZerodhaPnLStatement(rows, headerIdx) {
  const headers = rows[headerIdx].map(h => h.toLowerCase().trim());
  const symbolCol = headers.findIndex(h => h === 'symbol');
  const buyValueCol = headers.findIndex(h => h === 'buy value');
  const sellValueCol = headers.findIndex(h => h === 'sell value');
  const qtyCol = headers.findIndex(h => h === 'quantity');
  const openQtyCol = headers.findIndex(h => h.includes('open quantity') || h.includes('open qty') || h.includes('open position'));
  const realizedPnlCol = headers.findIndex(h => h.includes('realized p&l') || h.includes('realized pnl') || h.includes('p&l'));

  if (symbolCol === -1 || buyValueCol === -1 || sellValueCol === -1) {
    return null; // Not Zerodha P&L format
  }

  const positions = [];
  const currentDate = new Date().toISOString().split('T')[0];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length <= Math.max(symbolCol, buyValueCol, sellValueCol)) continue;

    const rawSym = row[symbolCol];
    const symbol = normalizeSymbol(rawSym);
    if (!symbol) continue;

    const totalQty = Math.abs(sanitizeNumber(row[qtyCol], 0));
    const openQty = Math.abs(sanitizeNumber(openQtyCol >= 0 ? row[openQtyCol] : 0, 0));
    const buyVal = sanitizeNumber(row[buyValueCol], 0);
    const sellVal = sanitizeNumber(row[sellValueCol], 0);
    const realizedPnL = sanitizeNumber(realizedPnlCol >= 0 ? row[realizedPnlCol] : 0, sellVal - buyVal);

    if (totalQty <= 0 && openQty <= 0 && buyVal <= 0 && sellVal <= 0) continue;

    const avgEntryPrice = totalQty > 0 ? (buyVal / totalQty) : (buyVal > 0 ? buyVal : 0);
    const avgExitPrice = totalQty > 0 ? (sellVal / totalQty) : 0;
    const isClosed = openQty <= 0;

    // Create normalized position draft
    positions.push({
      symbol,
      rawSymbol: sanitizeString(rawSym),
      isClosed,
      openQty,
      totalBought: totalQty > 0 ? totalQty : openQty,
      totalSold: isClosed ? totalQty : Math.max(0, totalQty - openQty),
      avgEntryPrice,
      avgExitPrice,
      realizedPnL,
      pnlPct: buyVal > 0 ? (realizedPnL / buyVal) * 100 : 0,
      holdingDays: null,
      transactions: [
        {
          id: `tx-imp-buy-${i}-${Date.now().toString(36)}`,
          type: 'Buy',
          price: avgEntryPrice,
          qty: totalQty > 0 ? totalQty : openQty,
          date: currentDate,
          reason: 'Imported P&L Entry'
        },
        ...(sellVal > 0 ? [{
          id: `tx-imp-sell-${i}-${Date.now().toString(36)}`,
          type: 'Sell',
          price: avgExitPrice,
          qty: isClosed ? totalQty : Math.max(0, totalQty - openQty),
          date: currentDate,
          reason: 'Imported P&L Exit'
        }] : [])
      ]
    });
  }

  return positions.length > 0 ? { type: 'positions', data: positions } : null;
}

/**
 * Strategy 3: Paytm Money / Groww / Generic CSV Parser
 */
export function parseGenericBrokerCSV(rows, headerIdx) {
  const headers = rows[headerIdx].map(h => h.toLowerCase().trim());
  const symbolCol = headers.findIndex(h => h.includes('symbol') || h.includes('stock') || h.includes('company'));
  const typeCol = headers.findIndex(h => h.includes('type') || h.includes('action') || h.includes('transaction'));
  const qtyCol = headers.findIndex(h => h.includes('qty') || h.includes('quantity'));
  const priceCol = headers.findIndex(h => h.includes('price') || h.includes('avg'));
  const dateCol = headers.findIndex(h => h.includes('date') || h.includes('time'));
  const setupCol = headers.findIndex(h => h.includes('setup') || h.includes('strategy'));
  const notesCol = headers.findIndex(h => h.includes('notes') || h.includes('comment'));

  if (symbolCol === -1 || typeCol === -1 || qtyCol === -1 || priceCol === -1) {
    return null;
  }

  const executions = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length <= Math.max(symbolCol, typeCol, qtyCol, priceCol)) continue;

    const rawSym = row[symbolCol];
    const symbol = normalizeSymbol(rawSym);
    if (!symbol) continue;

    const rawType = row[typeCol] ? row[typeCol].toLowerCase() : '';
    const isBuy = rawType.includes('buy') || rawType.includes('b') || rawType.includes('purchase');
    const isSell = rawType.includes('sell') || rawType.includes('s') || rawType.includes('sale');
    const type = isBuy ? 'Buy' : isSell ? 'Sell' : null;
    if (!type) continue;

    const qty = Math.abs(sanitizeNumber(row[qtyCol], 0));
    const price = sanitizeNumber(row[priceCol], 0);
    if (qty <= 0 || price <= 0) continue;

    const dateStr = dateCol >= 0 && row[dateCol] ? sanitizeString(row[dateCol].split('T')[0]) : new Date().toISOString().split('T')[0];
    const setup = setupCol >= 0 ? sanitizeString(row[setupCol]) : '';
    const notes = notesCol >= 0 ? sanitizeString(row[notesCol]) : '';

    executions.push({
      symbol,
      type,
      qty,
      price,
      date: dateStr,
      setup,
      notes,
      rawSymbol: sanitizeString(rawSym)
    });
  }

  return executions.length > 0 ? { type: 'executions', data: executions } : null;
}

/**
 * Main Auto-Detection Parser Pipeline
 */
export function autoDetectAndParseCSV(csvText) {
  const rows = parseCSVToRows(csvText);
  if (rows.length === 0) {
    throw new Error('The uploaded CSV file is empty.');
  }

  const headerIdx = findHeaderRowIndex(rows);

  // 1. Try Zerodha Tax P&L Statement first
  const pnlResult = parseZerodhaPnLStatement(rows, headerIdx);
  if (pnlResult) return pnlResult;

  // 2. Try Zerodha Tradebook
  const tbResult = parseZerodhaTradebook(rows, headerIdx);
  if (tbResult) return tbResult;

  // 3. Try Generic / Paytm / Groww CSV
  const genResult = parseGenericBrokerCSV(rows, headerIdx);
  if (genResult) return genResult;

  // Header found but no matching strategy
  return { type: 'unrecognized', rows, headerIdx };
}
