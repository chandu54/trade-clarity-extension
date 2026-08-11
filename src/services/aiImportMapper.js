/**
 * AI Schema Identification Service for Trade Importing
 * Uses Gemini AI to infer CSV column mappings for unknown / custom broker CSV files.
 */

import { sanitizeString, sanitizeNumber, normalizeSymbol } from '../utils/tradeImportParser';

/**
 * Sends CSV snippet to Gemini AI to identify column mapping schema
 */
export async function analyzeCSVWithAI(csvSnippet, aiSettings = {}) {
  const apiKey = aiSettings?.apiKey || process.env.VITE_GEMINI_API_KEY || '';
  const model = aiSettings?.model || 'gemini-2.5-flash';

  if (!apiKey) {
    throw new Error('Gemini API key is missing. Please set your API key in Settings > AI Assistant.');
  }

  const promptText = `
You are a financial data engineering assistant specializing in parsing stock trade CSV export files from brokers.
Given the following raw CSV header and sample rows:

--- CSV START ---
${csvSnippet}
--- CSV END ---

Identify the column headers and map them to our target trade position schema.
Target Schema Fields to identify:
1. symbolCol: column header name for Stock Ticker / Symbol / Company Name
2. typeCol: column header name for Transaction Type (BUY/SELL or B/S)
3. qtyCol: column header name for Quantity / Vol
4. priceCol: column header name for Execution Price / Average Price
5. dateCol: column header name for Date / Time
6. buyValueCol: (optional) column header name for Buy Value / Cost
7. sellValueCol: (optional) column header name for Sell Value / Proceeds
8. realizedPnLCol: (optional) column header name for Realized P&L
9. buyKeywords: array of string values indicating a BUY transaction (e.g. ["BUY", "B", "PURCHASE"])
10. sellKeywords: array of string values indicating a SELL transaction (e.g. ["SELL", "S", "SALE"])
11. fileType: either "tradebook" (individual execution logs) or "pnl_summary" (pre-calculated PnL by symbol)

Return ONLY a valid JSON object matching this exact structure:
{
  "symbolCol": "string or null",
  "typeCol": "string or null",
  "qtyCol": "string or null",
  "priceCol": "string or null",
  "dateCol": "string or null",
  "buyValueCol": "string or null",
  "sellValueCol": "string or null",
  "realizedPnLCol": "string or null",
  "buyKeywords": ["BUY", "B"],
  "sellKeywords": ["SELL", "S"],
  "fileType": "tradebook"
}
Do NOT include markdown backticks or any conversational text outside the JSON object.
`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1024
          }
        })
      }
    );

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson.error?.message || `AI Request Failed with status ${response.status}`);
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Extract JSON from output
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('AI output did not return a valid JSON mapping structure.');
    }

    const mapping = JSON.parse(jsonMatch[0]);
    return mapping;
  } catch (error) {
    console.error('AI Schema Identification Error:', error);
    throw error;
  }
}

/**
 * Parses raw CSV rows using an AI-derived mapping structure
 */
export function parseCSVWithAIMapping(rows, headerIdx, mapping) {
  if (!rows || rows.length <= headerIdx + 1 || !mapping) {
    return [];
  }

  const headers = rows[headerIdx].map(h => h.trim());
  const findIdx = (colName) => colName ? headers.findIndex(h => h.toLowerCase() === colName.toLowerCase()) : -1;

  const symbolCol = findIdx(mapping.symbolCol);
  const typeCol = findIdx(mapping.typeCol);
  const qtyCol = findIdx(mapping.qtyCol);
  const priceCol = findIdx(mapping.priceCol);
  const dateCol = findIdx(mapping.dateCol);
  const buyValCol = findIdx(mapping.buyValueCol);

  if (symbolCol === -1 || (typeCol === -1 && buyValCol === -1)) {
    throw new Error('Required columns (Symbol, Transaction Type, or Buy Value) could not be mapped.');
  }

  const buyKws = (mapping.buyKeywords || ['BUY', 'B']).map(k => k.toLowerCase());
  const sellKws = (mapping.sellKeywords || ['SELL', 'S']).map(k => k.toLowerCase());

  const executions = [];
  const currentDate = new Date().toISOString().split('T')[0];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length <= symbolCol) continue;

    const rawSym = row[symbolCol];
    const symbol = normalizeSymbol(rawSym);
    if (!symbol) continue;

    // Execution tradebook format
    if (typeCol >= 0 && qtyCol >= 0 && priceCol >= 0) {
      const rawType = row[typeCol] ? row[typeCol].toLowerCase() : '';
      const isBuy = buyKws.some(k => rawType.includes(k));
      const isSell = sellKws.some(k => rawType.includes(k));
      const type = isBuy ? 'Buy' : isSell ? 'Sell' : null;
      if (!type) continue;

      const qty = Math.abs(sanitizeNumber(row[qtyCol], 0));
      const price = sanitizeNumber(row[priceCol], 0);
      if (qty <= 0 || price <= 0) continue;

      const dateStr = dateCol >= 0 && row[dateCol] ? sanitizeString(row[dateCol].split('T')[0]) : currentDate;

      executions.push({
        symbol,
        type,
        qty,
        price,
        date: dateStr,
        rawSymbol: sanitizeString(rawSym)
      });
    }
  }

  return executions;
}
