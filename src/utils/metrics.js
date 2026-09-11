import { getActualParamKeyAndDef } from "./paramUtils";

export function mapAdrBucket(avgAdr, adrDef) {
  if (adrDef?.type === "number") {
    return avgAdr.toFixed(2);
  } else if (adrDef?.type === "select" && Array.isArray(adrDef.options) && adrDef.options.length > 0) {
     const targetVal = Math.round(avgAdr);
     let closestDiff = Infinity;
     let closestOpt = adrDef.options[0];
     
     for (const opt of adrDef.options) {
         const optNum = Number(opt);
         if (!isNaN(optNum)) {
             const diff = Math.abs(optNum - targetVal);
             if (diff < closestDiff) {
                 closestDiff = diff;
                 closestOpt = opt;
             }
         }
     }
     return closestOpt;
  } else {
     return Math.min(Math.max(Math.round(avgAdr), 1), 10);
  }
}

export function mapLiquidityBucket(liquidityValue, liqDef, country) {
  let targetNumVal;
  if (country === "IN") {
     targetNumVal = liquidityValue / 10000000; // Convert to Crores
  } else {
     targetNumVal = liquidityValue / 1000000; // Convert to Millions for others
  }

  if (liqDef?.type === "number") {
     return country === "IN" ? `${targetNumVal.toFixed(2)}Cr` : `${targetNumVal.toFixed(2)}M`;
  } else if (liqDef?.type === "select" && Array.isArray(liqDef.options) && liqDef.options.length > 0) {
     let matchedBucket = null;
     
     const parsedOptions = liqDef.options.map(opt => {
         const str = String(opt);
         const numbers = str.match(/\d*\.?\d+/g); 
         let maxInStr = numbers && numbers.length > 0 ? Math.max(...numbers.map(Number)) : Infinity;
         
         const isLessThan = str.includes("<") || str.toLowerCase().includes("under");
         const isGreaterThan = str.includes(">") || str.includes("+") || str.toLowerCase().includes("over");
         
         return { original: opt, max: maxInStr, isLessThan, isGreaterThan, numbers };
     }).sort((a,b) => a.max - b.max);

     let bestGreaterThanMatch = null;

     for (const opt of parsedOptions) {
        if (opt.isLessThan) {
           if (targetNumVal <= opt.max) {
               matchedBucket = opt.original;
               break;
           }
        } else if (opt.isGreaterThan) {
           if (targetNumVal >= opt.max) {
               bestGreaterThanMatch = opt.original;
           }
        } else if (opt.numbers && opt.numbers.length >= 2) {
           const min = Math.min(...opt.numbers.map(Number));
           const max = Math.max(...opt.numbers.map(Number));
           if (targetNumVal >= min && targetNumVal <= max) {
               matchedBucket = opt.original;
               break;
           }
        } else {
           if (targetNumVal <= opt.max) {
               matchedBucket = opt.original;
               break;
           }
        }
     }

     if (!matchedBucket && bestGreaterThanMatch) {
         matchedBucket = bestGreaterThanMatch;
     }

     if (!matchedBucket && parsedOptions.length > 0) {
         matchedBucket = parsedOptions[parsedOptions.length - 1].original;
     }
     return matchedBucket;
  } else {
     // Fallback
     if (country === "IN") {
         if (targetNumVal <= 20) return "<=20Cr";
         else if (targetNumVal <= 49) return "21 to 49Cr";
         else if (targetNumVal <= 99) return "50 to 99Cr";
         else if (targetNumVal <= 199) return "100Cr to 199Cr";
         else if (targetNumVal <= 499) return "200Cr to 499Cr";
         else if (targetNumVal <= 999) return "500Cr+";
         else if (targetNumVal <= 1499) return "1000Cr+";
         else if (targetNumVal <= 1999) return "1500Cr+";
         else return "2000Cr+";
     } else {
      return `${targetNumVal.toFixed(2)}M`;
    }
  }
}

export function calculateSMA(closes, period) {
  if (!closes || closes.length < period) return null;
  const slice = closes.slice(-period);
  const sum = slice.reduce((acc, val) => acc + (val || 0), 0);
  return sum / period;
}

export function mapMovingAverageBucket(closes, currentPrice) {
  if (!closes || closes.length === 0 || currentPrice == null) return "";

  const ma5 = calculateSMA(closes, 5);
  const ma10 = calculateSMA(closes, 10);
  const ma21 = calculateSMA(closes, 21);
  const ma50 = calculateSMA(closes, 50);
  const ma200 = calculateSMA(closes, 200);

  const above = [];
  if (ma5 !== null && currentPrice > ma5) above.push("5");
  if (ma10 !== null && currentPrice > ma10) above.push("10");
  if (ma21 !== null && currentPrice > ma21) above.push("21");
  if (ma50 !== null && currentPrice > ma50) above.push("50");
  if (ma200 !== null && currentPrice > ma200) above.push("200");

  if (above.length === 0) return "Below All MAs";
  if (above.length === 5) return "Above 5, 10, 21, 50, 200";
  
  return `Above ${above.join(", ")}`;
}

/**
 * Calculates unified ADR and Liquidity metrics from candle bars,
 * matching background.js and StockGrid canonical logic.
 * 
 * @param {Array} validDays - Array of chronological candle objects { high, low, close, volume, rawClose }
 * @param {string} country - Country code ('IN' | 'US')
 * @param {Object} paramDefs - Parameter definitions object
 * @param {number} adrDays - Window for ADR (default: 20)
 * @param {number} liquidityDays - Window for Liquidity (default: 20)
 */
export function calculateStockMetricsFromCandles(
  validDays,
  country = "IN",
  paramDefs = null,
  adrDays = 20,
  liquidityDays = 20
) {
  if (!validDays || validDays.length === 0) {
    return {
      avgAdr: 0,
      formattedAdr: "",
      liquidityValue: 0,
      turnoverCr: 0,
      formattedLiquidity: "",
      adrKey: "adr",
      liquidityKey: "liquidity",
    };
  }

  // 1. ADR Calculation (using exactly day.low as denominator, matching background.js)
  const effectiveAdrDays = Math.min(adrDays, validDays.length);
  const adrPeriod = validDays.slice(-effectiveAdrDays);
  let totalAdr = 0;
  adrPeriod.forEach((day) => {
    const high = day.high || day.close;
    const low = day.low || day.close;
    if (low > 0) {
      totalAdr += ((high - low) / low) * 100;
    }
  });
  const avgAdr = adrPeriod.length > 0 ? totalAdr / adrPeriod.length : 0;

  // 2. Liquidity Calculation (using volume * (rawClose || close), matching background.js)
  const effectiveLiqDays = Math.min(liquidityDays, validDays.length);
  const liqPeriod = validDays.slice(-effectiveLiqDays);
  let totalTurnover = 0;
  liqPeriod.forEach((day) => {
    const vol = day.volume || 0;
    const px = day.rawClose || day.close || 0;
    totalTurnover += vol * px;
  });
  const liquidityValue = liqPeriod.length > 0 ? totalTurnover / liqPeriod.length : 0;
  const turnoverCr = country === "IN" ? liquidityValue / 10000000 : liquidityValue / 1000000;

  // 3. Resolve definitions & format using canonical buckets
  const adrMatch = getActualParamKeyAndDef(paramDefs, "adr", "adr", country);
  const liqMatch = getActualParamKeyAndDef(paramDefs, "liquidity", "liquidity", country);

  const formattedAdr = mapAdrBucket(avgAdr, adrMatch?.def);
  const formattedLiquidity = mapLiquidityBucket(liquidityValue, liqMatch?.def, country);

  return {
    avgAdr,
    formattedAdr,
    liquidityValue,
    turnoverCr,
    formattedLiquidity,
    adrKey: adrMatch?.key,
    liquidityKey: liqMatch?.key,
    effectiveAdrDays,
    effectiveLiqDays,
  };
}

