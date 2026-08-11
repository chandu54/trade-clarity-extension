/**
 * FIFO Position Matcher Engine
 * Groups raw buy/sell order executions by symbol into completed (Closed) or active (Open) position objects.
 */


/**
 * Calculates holding period in days between two YYYY-MM-DD date strings
 */
export function calculateHoldingDays(startDateStr, endDateStr) {
  if (!startDateStr || !endDateStr) return 0;
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
  return diffDays;
}

/**
 * Main FIFO Matcher function
 * @param {Array} executions - List of { symbol, type ('Buy'|'Sell'), qty, price, date, setup, notes }
 * @param {Object} options - { defaultRiskPct: 0.05, defaultSetup: 'Imported Trade', excludeEtfs: true }
 */
// Helper: Identify Liquid Cash Collateral ETFs (LIQUIDCASE, LIQUIDBEES, LIQUIDETF, etc.)
export function isLiquidEtf(symbol) {
  if (!symbol) return false;
  const sym = String(symbol).toUpperCase().trim();
  const liquidKeywords = [
    'LIQUIDCASE',
    'LIQUIDBEES',
    'LIQUIDETF',
    'LIQUIDNAV',
    'LIQUIDIETF',
    'LIQUID1',
    'ICICILIQ',
    'HDFCLIQUID',
    'AXISLIQUID',
    'SETF10GILT',
    'GILT5YBEES'
  ];
  return liquidKeywords.some(kw => sym.includes(kw)) || (sym.startsWith('LIQUID') && !sym.includes('LIQUIDATION'));
}

export function matchExecutionsToPositions(executions, options = {}) {
  const {
    defaultRiskPct = 0.05,
    defaultSetup = 'Imported Trade',
    excludeEtfs = true
  } = options;

  if (!Array.isArray(executions) || executions.length === 0) {
    return [];
  }

  // Filter non-stock/liquid cash ETFs if enabled
  const filteredExecutions = executions.filter(exec => {
    if (!exec || !exec.symbol) return false;
    if (excludeEtfs && isLiquidEtf(exec.symbol)) {
      return false;
    }
    return true;
  });

  // Group by symbol
  const symbolMap = {};
  filteredExecutions.forEach(exec => {
    const sym = exec.symbol.toUpperCase();
    if (!symbolMap[sym]) symbolMap[sym] = [];
    symbolMap[sym].push(exec);
  });

  const positions = [];

  for (const [symbol, execList] of Object.entries(symbolMap)) {
    // Sort chronologically by date
    execList.sort((a, b) => new Date(a.date) - new Date(b.date));

    let activeBuys = [];
    let activeSells = [];
    let posCount = 1;

    for (let i = 0; i < execList.length; i++) {
      const exec = execList[i];

      if (exec.type === 'Buy') {
        activeBuys.push(exec);
      } else if (exec.type === 'Sell') {
        activeSells.push(exec);
      }

      const totalBought = activeBuys.reduce((sum, b) => sum + Number(b.qty || 0), 0);
      const totalSold = activeSells.reduce((sum, s) => sum + Number(s.qty || 0), 0);
      const openQty = totalBought - totalSold;

      // If all shares bought have been sold (or if this is the last execution for this symbol), form position
      const isLastExec = (i === execList.length - 1);
      const isPositionClosed = openQty <= 0 && totalSold > 0;

      if (isPositionClosed || (isLastExec && (totalBought > 0 || totalSold > 0))) {
        const totalBuyCost = activeBuys.reduce((sum, b) => sum + (Number(b.price) * Number(b.qty)), 0);
        const avgEntryPrice = totalBought > 0 ? (totalBuyCost / totalBought) : (activeSells[0]?.price || 0);

        const totalSellProceeds = activeSells.reduce((sum, s) => sum + (Number(s.price) * Number(s.qty)), 0);
        const avgExitPrice = totalSold > 0 ? (totalSellProceeds / totalSold) : 0;

        const realizedPnL = totalSold > 0 ? (totalSellProceeds - (avgEntryPrice * totalSold)) : 0;
        const pnlPct = avgEntryPrice > 0 ? (realizedPnL / (avgEntryPrice * (totalSold > 0 ? totalSold : totalBought))) * 100 : 0;

        // Holding days from first buy date to last sell date
        const entryDate = activeBuys[0]?.date || activeSells[0]?.date || new Date().toISOString().split('T')[0];
        const exitDate = activeSells.length > 0 ? activeSells[activeSells.length - 1].date : entryDate;
        const holdingDays = calculateHoldingDays(entryDate, exitDate);

        // Initial Stop Loss calculation
        let initialStopLoss = null;
        if (defaultRiskPct > 0 && avgEntryPrice > 0) {
          initialStopLoss = Number((avgEntryPrice * (1 - defaultRiskPct)).toFixed(2));
        }

        // R-Multiple calculation
        let rMultiple = 0;
        if (initialStopLoss !== null && avgEntryPrice > initialStopLoss) {
          const riskPerShare = avgEntryPrice - initialStopLoss;
          const totalRisk = riskPerShare * (totalSold > 0 ? totalSold : totalBought);
          if (totalRisk > 0) {
            rMultiple = Number((realizedPnL / totalRisk).toFixed(2));
          }
        }

        // Format transaction list
        const transactions = [
          ...activeBuys.map((b, idx) => ({
            id: `tx-imp-buy-${symbol}-${posCount}-${idx}-${Date.now().toString(36)}`,
            type: 'Buy',
            price: Number(b.price),
            qty: Number(b.qty),
            date: b.date,
            reason: b.notes || 'Imported Buy Execution'
          })),
          ...activeSells.map((s, idx) => ({
            id: `tx-imp-sell-${symbol}-${posCount}-${idx}-${Date.now().toString(36)}`,
            type: 'Sell',
            price: Number(s.price),
            qty: Number(s.qty),
            date: s.date,
            reason: s.notes || 'Imported Sell Execution'
          }))
        ];

        // Is scaling position? (has multiple buy or sell transactions)
        const isScaling = transactions.length > 2 || activeBuys.length > 1 || activeSells.length > 1;

        positions.push({
          id: `pos-imp-${symbol}-${posCount}-${Date.now().toString(36)}`,
          symbol,
          setup: activeBuys[0]?.setup || defaultSetup,
          initialStopLoss,
          currentStopLoss: null,
          notes: activeBuys[0]?.notes || `Imported ${isPositionClosed ? 'Closed' : 'Open'} Position`,
          chartUrl: '',
          isScaling,
          openQty: Math.max(0, openQty),
          totalBought,
          totalSold,
          avgEntryPrice,
          avgExitPrice,
          realizedPnL,
          pnlPct,
          holdingDays,
          rMultiple,
          isClosed: openQty <= 0,
          transactions
        });

        // Reset queues for next position for this symbol
        activeBuys = [];
        activeSells = [];
        posCount++;
      }
    }
  }

  return positions;
}
