/**
 * TradeClarity - Macro Trend-Wave & Recency-Aware Stock Attitude Engine
 * 
 * Evaluates stock character at the institutional Trend-Leg level:
 * - Identifies Major Macro Uptrend Waves (filtering out 3-day micro-noise).
 * - Analyzes "Push & Pause" staircase behavior vs violent shakeouts.
 * - Compares Proven Historical DNA (Best Trend Wave) against Recent Leg Character.
 * - Assesses Current Pullback / Base Health.
 * 
 * Usage:
 *   node scripts/testStockAttitude.js <SYMBOL> [LOOKBACK_OR_DATES]
 *   npm run test:attitude -- <SYMBOL> [LOOKBACK_OR_DATES]
 * 
 * Examples:
 *   node scripts/testStockAttitude.js STLTECH.NS 1y
 *   node scripts/testStockAttitude.js NVDA 1y
 *   node scripts/testStockAttitude.js TRENT.NS 1y
 *   node scripts/testStockAttitude.js TSLA 1y
 */

// Helper to parse relative or absolute start/end dates
function parseDateInput(inputStr, isStart = true) {
  if (!inputStr) return null;
  const s = inputStr.trim().toLowerCase();

  const relMatch = s.match(/^(\d+)\s*([dmy]|mo|months?|years?|days?)$/);
  if (relMatch) {
    const num = parseInt(relMatch[1], 10);
    const unit = relMatch[2][0];
    const now = new Date();
    if (unit === 'd') now.setDate(now.getDate() - num);
    else if (unit === 'm') now.setMonth(now.getMonth() - num);
    else if (unit === 'y') now.setFullYear(now.getFullYear() - num);
    return now.toISOString().split('T')[0];
  }

  return inputStr;
}

// Fetch Yahoo Finance OHLCV bars
async function fetchYahooBars(symbol, startDateStr, endDateStr) {
  let ticker = symbol.toUpperCase().trim();
  if (
    !ticker.includes('.') &&
    !ticker.startsWith('^') &&
    ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'TRENT', 'DIXON', 'BSE', 'ZEEL', 'PAYTM', 'COCHINSHIP', 'TATAMOTORS', 'STLTECH'].includes(ticker)
  ) {
    ticker = `${ticker}.NS`;
  }

  const parsedStart = parseDateInput(startDateStr, true);
  const parsedEnd = parseDateInput(endDateStr, false);

  const period1 = parsedStart
    ? Math.floor(new Date(parsedStart).getTime() / 1000)
    : Math.floor((Date.now() - 365 * 24 * 3600 * 1000) / 1000);
  const period2 = parsedEnd
    ? Math.floor(new Date(parsedEnd).getTime() / 1000)
    : Math.floor(Date.now() / 1000);

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?period1=${period1}&period2=${period2}&interval=1d`;

  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch ${ticker}: HTTP ${res.status}`);
  }

  const data = await res.json();
  const result = data.chart?.result?.[0];
  if (!result || !result.timestamp || !result.indicators?.quote?.[0]) {
    throw new Error(`No chart data returned for ${ticker}`);
  }

  const timestamps = result.timestamp;
  const quote = result.indicators.quote[0];
  const opens = quote.open || [];
  const highs = quote.high || [];
  const lows = quote.low || [];
  const closes = quote.close || [];
  const volumes = quote.volume || [];

  const bars = [];
  for (let i = 0; i < timestamps.length; i++) {
    if (
      closes[i] != null &&
      opens[i] != null &&
      highs[i] != null &&
      lows[i] != null &&
      !isNaN(closes[i])
    ) {
      bars.push({
        date: new Date(timestamps[i] * 1000).toISOString().split('T')[0],
        timestamp: timestamps[i],
        open: parseFloat(opens[i].toFixed(2)),
        high: parseFloat(highs[i].toFixed(2)),
        low: parseFloat(lows[i].toFixed(2)),
        close: parseFloat(closes[i].toFixed(2)),
        volume: volumes[i] || 0
      });
    }
  }

  return { ticker, bars };
}

// Exponential Moving Average (EMA)
function calculateEMA(values, period) {
  const k = 2 / (period + 1);
  const emaArray = [];
  let ema = null;

  for (let i = 0; i < values.length; i++) {
    const val = values[i];
    if (i < period - 1) {
      emaArray.push(null);
    } else if (i === period - 1) {
      const slice = values.slice(0, period);
      ema = slice.reduce((a, b) => a + b, 0) / period;
      emaArray.push(ema);
    } else {
      ema = val * k + ema * (1 - k);
      emaArray.push(ema);
    }
  }
  return emaArray;
}

// Simple Moving Average (SMA)
function calculateSMA(values, period) {
  const smaArray = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      smaArray.push(null);
    } else {
      const slice = values.slice(i - period + 1, i + 1);
      const avg = slice.reduce((a, b) => a + b, 0) / period;
      smaArray.push(avg);
    }
  }
  return smaArray;
}

// Average Daily Range (ADR %)
function calculateADR(bars, length = 20) {
  if (!bars || bars.length < length) return 3.5;
  const slice = bars.slice(-length);
  const drPcts = slice.map(b => ((b.high - b.low) / b.low) * 100);
  return drPcts.reduce((a, b) => a + b, 0) / length;
}

/**
 * Detects Major Macro Uptrend Waves (Trend Legs):
 * Filters out minor 3-day blips and captures overarching trend moves (e.g., 20%+ to 100%+ runs)
 * that span weeks to months.
 */
function detectMacroTrendWaves(bars, adrPct = 3.5) {
  const minGainPct = Math.max(18, adrPct * 3.5); // Minimum gain for a macro wave (e.g. >= 18-22%)
  const closes = bars.map(b => b.close);
  const ema10 = calculateEMA(closes, 10);
  const ema21 = calculateEMA(closes, 21);
  const sma50 = calculateSMA(closes, 50);

  const waves = [];
  let i = 0;

  while (i < bars.length - 12) {
    // Find potential wave inception:
    // A swing low where 10 EMA is turning up or price starts an expansion above 21 EMA
    const startIdx = i;
    const startBar = bars[startIdx];
    const startLow = startBar.low;

    let peakIdx = startIdx;
    let peakHigh = startBar.high;
    let waveEndIdx = startIdx;
    let consecBelowEma21 = 0;

    // Advance forward tracking the wave
    for (let j = startIdx + 1; j < bars.length; j++) {
      const currentBar = bars[j];

      if (currentBar.high > peakHigh) {
        peakHigh = currentBar.high;
        peakIdx = j;
        consecBelowEma21 = 0;
      } else {
        // Track if price has structurally broken below the 21 EMA / 50 SMA
        const e21 = ema21[j];
        if (e21 != null && currentBar.close < e21) {
          consecBelowEma21++;
        } else {
          consecBelowEma21 = Math.max(0, consecBelowEma21 - 1);
        }

        // Calculate current drawdown from peak high
        const ddFromPeakPct = ((peakHigh - currentBar.low) / peakHigh) * 100;

        // Wave termination conditions:
        // 1. Drawdown from peak exceeds 24% and price has closed below 21 EMA for 6+ sessions
        // 2. Or price drops heavily below 50 SMA
        // 3. Or wave has stalled for 25+ trading days without new highs and pulled back >= 18%
        const daysSincePeak = j - peakIdx;
        const s50 = sma50[j];
        const belowSma50 = s50 != null && currentBar.close < s50;

        if (
          (ddFromPeakPct >= 22 && consecBelowEma21 >= 5 && daysSincePeak >= 6) ||
          (ddFromPeakPct >= 28 && daysSincePeak >= 10) ||
          (belowSma50 && ddFromPeakPct >= 20 && daysSincePeak >= 6)
        ) {
          waveEndIdx = j;
          break;
        }
      }
      waveEndIdx = j;
    }

    const waveGainPct = ((peakHigh - startLow) / startLow) * 100;
    const waveDurationDays = peakIdx - startIdx + 1;

    // Check if this qualifies as a legitimate Major Trend Leg
    if (waveGainPct >= minGainPct && waveDurationDays >= 8) {
      // Measure the subsequent consolidation / pullback from this peak
      const pauseEndIdx = Math.min(peakIdx + 15, bars.length - 1);
      const pauseBars = bars.slice(peakIdx + 1, pauseEndIdx + 1);

      let pauseMinLow = peakHigh;
      for (const pb of pauseBars) {
        if (pb.low < pauseMinLow) {
          pauseMinLow = pb.low;
        }
      }

      const waveDollarMove = peakHigh - startLow;
      const retraceDollarMove = peakHigh - pauseMinLow;
      const retracementPct = waveDollarMove > 0 ? (retraceDollarMove / waveDollarMove) * 100 : 0;
      const peakDrawdownPct = ((peakHigh - pauseMinLow) / peakHigh) * 100;

      waves.push({
        waveNumber: waves.length + 1,
        startIdx,
        startDate: bars[startIdx].date,
        startLow,
        peakIdx,
        peakDate: bars[peakIdx].date,
        peakHigh,
        gainPct: parseFloat(waveGainPct.toFixed(1)),
        durationDays: waveDurationDays,
        pauseEndIdx,
        pauseEndDate: bars[pauseEndIdx]?.date || bars[peakIdx].date,
        pauseMinLow: parseFloat(pauseMinLow.toFixed(2)),
        retracementPct: parseFloat(retracementPct.toFixed(1)),
        peakDrawdownPct: parseFloat(peakDrawdownPct.toFixed(1)),
        isRecent: (bars.length - 1 - peakIdx) <= 90 // Occurred in the last ~3-4 months
      });

      // Jump forward past this wave's peak to find the next structural base
      i = Math.max(peakIdx + 5, waveEndIdx);
    } else {
      i++;
    }
  }

  return { waves, ema10, ema21, sma50 };
}

/**
 * Scores a Major Trend Wave (0 to 100 points) based on institutional trend character
 */
function scoreTrendWave(wave, bars, ema10, ema21, sma50) {
  const waveBars = bars.slice(wave.startIdx, wave.peakIdx + 1);
  const totalDays = waveBars.length;

  // 1. Staircase "Push & Pause" Quality (0 to 35 pts)
  // Evaluates whether the pauses/pullbacks within the wave were orderly
  let pushPauseScore = 0;
  const retrace = wave.retracementPct;
  if (retrace <= 25) pushPauseScore = 35; // Pristine high-and-tight pauses
  else if (retrace <= 35) pushPauseScore = 30; // Orderly, healthy digestion
  else if (retrace <= 45) pushPauseScore = 22; // Moderate correction
  else if (retrace <= 55) pushPauseScore = 14; // Deep pullback
  else if (retrace <= 70) pushPauseScore = 6;  // Violent shakeout
  else pushPauseScore = 0; // Full round-trip

  // 2. Thrust Follow-Through & Green Persistence (0 to 25 pts)
  let greenCount = 0;
  let maxConsecutiveGreen = 0;
  let currConsec = 0;

  waveBars.forEach(b => {
    if (b.close >= b.open) {
      greenCount++;
      currConsec++;
      if (currConsec > maxConsecutiveGreen) maxConsecutiveGreen = currConsec;
    } else {
      currConsec = 0;
    }
  });

  const greenRatio = (greenCount / totalDays) * 100;
  let followThroughScore = 0;
  if (greenRatio >= 75) followThroughScore = 20;
  else if (greenRatio >= 65) followThroughScore = 16;
  else if (greenRatio >= 55) followThroughScore = 12;
  else if (greenRatio >= 45) followThroughScore = 8;
  else followThroughScore = 3;

  if (maxConsecutiveGreen >= 5) followThroughScore = Math.min(25, followThroughScore + 5);
  else if (maxConsecutiveGreen >= 4) followThroughScore = Math.min(25, followThroughScore + 3);

  // 3. Moving Average Respect: 10 EMA & 21 EMA (0 to 20 pts)
  let daysAboveEma21 = 0;
  let daysAboveEma10 = 0;
  for (let idx = wave.startIdx; idx <= wave.peakIdx; idx++) {
    const e21 = ema21[idx];
    const e10 = ema10[idx];
    if (e21 != null && bars[idx].close >= e21) daysAboveEma21++;
    if (e10 != null && bars[idx].close >= e10) daysAboveEma10++;
  }

  const ema21Ratio = (daysAboveEma21 / totalDays) * 100;
  const ema10Ratio = (daysAboveEma10 / totalDays) * 100;

  let maScore = 0;
  if (ema21Ratio >= 85 && ema10Ratio >= 65) maScore = 20; // Rides 10 & 21 EMA like a champion
  else if (ema21Ratio >= 75) maScore = 16;
  else if (ema21Ratio >= 60) maScore = 11;
  else maScore = 5;

  // 4. Candle Integrity & Close Location Value (0 to 20 pts)
  let sumCLV = 0;
  waveBars.forEach(b => {
    const range = b.high - b.low;
    if (range > 0) sumCLV += (b.close - b.low) / range;
    else sumCLV += 0.5;
  });
  const avgCLV = (sumCLV / totalDays) * 100;

  let candleScore = 0;
  if (avgCLV >= 70) candleScore = 20;
  else if (avgCLV >= 60) candleScore = 16;
  else if (avgCLV >= 50) candleScore = 12;
  else candleScore = 5;

  const totalScore = Math.min(100, pushPauseScore + followThroughScore + maScore + candleScore);

  let diagnosis = '';
  if (pushPauseScore >= 30 && maScore >= 16) {
    diagnosis = 'Elite Staircase: pristine push & pause, cleanly rides rising moving averages.';
  } else if (pushPauseScore >= 22) {
    diagnosis = 'Solid Trend Wave: dependable momentum with orderly intermediate pullbacks.';
  } else if (retrace >= 55) {
    diagnosis = 'Deep Giveback: large gain accompanied by heavy stop-triggering retracements.';
  } else {
    diagnosis = 'Choppy Trend: frequent mid-bar closes and moving average violations.';
  }

  return {
    wave,
    score: totalScore,
    greenRatio: parseFloat(greenRatio.toFixed(1)),
    consecutiveGreenDays: maxConsecutiveGreen,
    ema21Ratio: parseFloat(ema21Ratio.toFixed(1)),
    avgCLV: parseFloat(avgCLV.toFixed(1)),
    diagnosis,
    subScores: {
      pushPause: pushPauseScore,
      followThrough: followThroughScore,
      maRespect: maScore,
      candleIntegrity: candleScore
    }
  };
}

/**
 * Assesses the Current/Latest State of the Stock relative to its recent leg
 */
function evaluateCurrentState(latestBar, recentWave, ema10, ema21, sma50, barsCount) {
  if (!recentWave) {
    return {
      status: 'No Active Trend',
      statusColor: 'text-amber-400',
      description: 'Stock has been rangebound with no major qualified trend leg.'
    };
  }

  const currentPrice = latestBar.close;
  const peakHigh = recentWave.wave.peakHigh;
  const currentDrawdownPct = ((peakHigh - currentPrice) / peakHigh) * 100;
  const daysSincePeak = barsCount - 1 - recentWave.wave.peakIdx;

  const lastE10 = ema10[barsCount - 1];
  const lastE21 = ema21[barsCount - 1];
  const lastS50 = sma50[barsCount - 1];

  let status = 'Consolidating';
  let statusColor = 'text-emerald-400';
  let description = '';

  if (currentDrawdownPct <= 10 && currentPrice >= (lastE10 || 0)) {
    status = 'Active Momentum Leader (Near Highs)';
    statusColor = 'text-emerald-400';
    description = `Holding tightly within -${currentDrawdownPct.toFixed(1)}% of all-time high; strictly above 10 EMA.`;
  } else if (currentDrawdownPct <= 22 && currentPrice >= (lastE21 || 0)) {
    status = 'Orderly Digestion / Base Formation';
    statusColor = 'text-emerald-400';
    description = `Consolidating normally (-${currentDrawdownPct.toFixed(1)}% from high); respecting the 21 EMA.`;
  } else if (currentDrawdownPct <= 35 && currentPrice >= (lastS50 || 0)) {
    status = 'Late-Stage Pullback / Testing 50 SMA';
    statusColor = 'text-amber-400';
    description = `Corrected -${currentDrawdownPct.toFixed(1)}% from peak high ($${peakHigh}); testing key support around the 50 SMA ($${lastS50 ? lastS50.toFixed(1) : 'N/A'}).`;
  } else {
    status = 'Deep Correction / Distribution Phase';
    statusColor = 'text-rose-400';
    description = `Severe drawdown of -${currentDrawdownPct.toFixed(1)}% from peak; trading below key moving averages.`;
  }

  return {
    status,
    statusColor,
    description,
    currentPrice,
    currentDrawdownPct: parseFloat(currentDrawdownPct.toFixed(1)),
    daysSincePeak
  };
}

/**
 * Main Trend-Wave & Recency-Aware Attitude Evaluator
 */
export async function evaluateStockAttitude(symbol, startDateStr, endDateStr) {
  const { ticker, bars } = await fetchYahooBars(symbol, startDateStr, endDateStr);
  if (bars.length < 25) {
    return {
      symbol: ticker,
      attitude: 'Insufficient Data',
      score: 0,
      wavesCount: 0,
      summary: `Only ${bars.length} daily bars available.`
    };
  }

  const adrPct = calculateADR(bars, 20);
  const { waves, ema10, ema21, sma50 } = detectMacroTrendWaves(bars, adrPct);

  if (waves.length === 0) {
    return {
      symbol: ticker,
      period: `${bars[0].date} to ${bars[bars.length - 1].date}`,
      attitude: 'Choppy',
      score: 40,
      wavesCount: 0,
      bestWave: null,
      recentWave: null,
      summary: 'No major macro trend waves (>= 18% gain) detected in this period. Stock was rangebound or declining.',
      barsCount: bars.length,
      adrPct: parseFloat(adrPct.toFixed(2))
    };
  }

  // Score each detected macro trend wave
  const scoredWaves = waves.map(w => scoreTrendWave(w, bars, ema10, ema21, sma50));

  // 1. Proven Historical DNA = Best Wave Score
  const sortedByScore = [...scoredWaves].sort((a, b) => b.score - a.score);
  const bestWave = sortedByScore[0];

  // 2. Recent Leg = Latest Wave
  const recentWave = scoredWaves[scoredWaves.length - 1];

  // 3. Current State / Health relative to peak
  const latestBar = bars[bars.length - 1];
  const currentState = evaluateCurrentState(latestBar, recentWave, ema10, ema21, sma50, bars.length);

  // 4. Composite Score: 50% Proven Historical DNA + 50% Recent Leg
  // With penalty if current state is in severe deep breakdown
  let compositeScore = Math.round(bestWave.score * 0.5 + recentWave.score * 0.5);
  if (currentState.currentDrawdownPct > 35 && compositeScore > 65) {
    compositeScore -= 8; // Mild penalty for late-stage steep correction
  }

  // Final Attitude Classification
  let attitude = 'Choppy';
  if (compositeScore >= 82) attitude = 'Very Good';
  else if (compositeScore >= 68) attitude = 'Good';
  else if (compositeScore >= 45) attitude = 'Choppy';
  else if (compositeScore >= 25) attitude = 'Bad';
  else attitude = 'Very Bad';

  return {
    symbol: ticker,
    period: `${bars[0].date} to ${bars[bars.length - 1].date}`,
    attitude,
    score: compositeScore,
    dnaScore: bestWave.score,
    recentScore: recentWave.score,
    wavesCount: waves.length,
    bestWave,
    recentWave,
    allWaves: scoredWaves,
    currentState,
    adrPct: parseFloat(adrPct.toFixed(2)),
    barsCount: bars.length
  };
}

// Detailed Reporting
function printDetailedReport(res) {
  if (!res.bestWave) {
    console.log(`Symbol:       ${res.symbol}`);
    console.log(`Attitude:     ${res.attitude} (Score: ${res.score}/100)`);
    console.log(`Summary:      ${res.summary}`);
    return;
  }

  const b = res.bestWave;
  const r = res.recentWave;
  const cs = res.currentState;

  const badgeEmoji =
    res.attitude === 'Very Good' ? '🟢 🌟' :
    res.attitude === 'Good' ? '🟢 ✅' :
    res.attitude === 'Choppy' ? '🟡 🔀' :
    res.attitude === 'Bad' ? '🟠 ⚠️' : '🔴 ❌';

  console.log(`Result:          ${badgeEmoji} ${res.attitude.toUpperCase()} (Composite Score: ${res.score}/100)`);
  console.log(`Period:          ${res.period} (${res.barsCount} daily bars, ADR: ${res.adrPct}%)`);
  console.log(`Current State:   ${cs.status}`);
  console.log(`                 ${cs.description}`);
  console.log(`Major Trend Waves: Found ${res.wavesCount} distinct Macro Trend Waves`);

  console.log(`\n📊 Major Trend Waves (Macro Uptrend Legs):`);
  console.log(`┌─────┬─────────────────────────┬──────────┬──────────┬───────────┬─────────────┬─────────────┬───────────────┐`);
  console.log(`│ Wave│ Period (Start -> Peak)  │ Gain %   │ Duration │ Green %   │ Retrace %   │ 21 EMA Hold │ Score & Class │`);
  console.log(`├─────┼─────────────────────────┼──────────┼──────────┼───────────┼─────────────┼─────────────┼───────────────┤`);

  res.allWaves.forEach((w, idx) => {
    const isBest = w === b ? '★ ' : (w === r ? '► ' : '  ');
    const num = `${isBest}Wave ${idx + 1}`.padEnd(7);
    const dateRange = `${w.wave.startDate} -> ${w.wave.peakDate}`.padEnd(23);
    const gain = `+${w.wave.gainPct}%`.padStart(8);
    const days = `${w.wave.durationDays}d`.padStart(8);
    const green = `${w.greenRatio}%`.padStart(9);
    const retrace = `${w.wave.retracementPct}%`.padStart(11);
    const emaHold = `${w.ema21Ratio}%`.padStart(11);
    const scoreText = `${w.score} pts`.padStart(13);

    console.log(`│ ${num}│ ${dateRange} │ ${gain} │ ${days} │ ${green} │ ${retrace} │ ${emaHold} │ ${scoreText} │`);
  });
  console.log(`└─────┴─────────────────────────┴──────────┴──────────┴───────────┴─────────────┴─────────────┴───────────────┘`);
  console.log(`  ★ = Proven Historical DNA (Best Wave) | ► = Most Recent Trend Leg`);

  console.log(`\n===============================================================`);
  console.log(`  💡 DUAL-LENS ATTITUDE REASONING (Proven DNA vs. Recency)`);
  console.log(`===============================================================`);

  console.log(`\n1. PROVEN HISTORICAL DNA (Score: ${res.dnaScore}/100):`);
  console.log(`   • Best Wave: ${b.wave.startDate} to ${b.wave.peakDate} (+${b.wave.gainPct}% over ${b.wave.durationDays} trading days)`);
  console.log(`   • Staircase Character: Retraced only ${b.wave.retracementPct}% during breathers (Textbook Push & Pause).`);
  console.log(`   • Moving Average Respect: Spent ${b.ema21Ratio}% of the wave strictly above the rising 21 EMA.`);
  console.log(`   • Follow-Through: ${b.greenRatio}% green candles with a streak of ${b.consecutiveGreenDays} consecutive up-days.`);

  console.log(`\n2. RECENT LEG & CURRENT STATUS (Score: ${res.recentScore}/100):`);
  if (r === b) {
    console.log(`   • The most recent leg IS the best wave! Stock is exhibiting peak institutional momentum.`);
  } else {
    console.log(`   • Recent Leg: ${r.wave.startDate} to ${r.wave.peakDate} (+${r.wave.gainPct}% over ${r.wave.durationDays} days).`);
    console.log(`   • Retracement from Recent Peak: ${r.wave.retracementPct}% giveback (Current Price: $${cs.currentPrice}, -${cs.currentDrawdownPct}% from $${r.wave.peakHigh}).`);
    console.log(`   • Recent Diagnosis: ${r.diagnosis}`);
  }

  console.log(`\n3. ACTIONABLE TRADER PLAYBOOK:`);
  if (res.attitude === 'Very Good') {
    if (cs.currentDrawdownPct <= 15) {
      console.log(`   🚀 ELITE ACTIVE RUNNER: High-conviction setup. Safe to buy valid base breakouts or tight 10/21 EMA pullbacks.`);
    } else {
      console.log(`   👀 WATCHLIST ELITE RUNNER: Proven institutional DNA (${res.dnaScore} pts), currently in healthy digestion (${cs.status}). Wait for price to find support and form a new tight base before entering.`);
    }
  } else if (res.attitude === 'Good') {
    console.log(`   👍 SOLID MOMENTUM: Consistent trend staircase. Prefer entries on orderly 21 EMA / 50 SMA tests.`);
  } else if (res.attitude === 'Choppy') {
    console.log(`   ⚠️ CAUTION / HIGH FRICTION: Lacks persistent trend waves. False breakouts and erratic shakeouts are common.`);
  } else {
    console.log(`   ⛔ AVOID: Heavy distribution and violent pullbacks make this stock unsuitable for swing trading.`);
  }
  console.log(`===============================================================\n`);
}

// CLI Execution
async function runCLI() {
  const args = process.argv.slice(2);

  if (args.length > 0) {
    const symbol = args[0];
    const startDate = args[1] || null;
    const endDate = args[2] || null;

    console.log(`\n===============================================================`);
    console.log(`  🔍 Analyzing Macro Trend-Wave Attitude: ${symbol}`);
    if (startDate) console.log(`  📅 Period: ${startDate} to ${endDate || 'Latest'}`);
    console.log(`===============================================================\n`);

    try {
      const result = await evaluateStockAttitude(symbol, startDate, endDate);
      printDetailedReport(result);
    } catch (err) {
      console.error(`❌ Error evaluating ${symbol}:`, err.message);
    }
    return;
  }

  // Default test
  try {
    const result = await evaluateStockAttitude('STLTECH.NS', '1y');
    printDetailedReport(result);
  } catch (err) {
    console.error('❌ Error testing STLTECH.NS:', err.message);
  }
}

runCLI();
