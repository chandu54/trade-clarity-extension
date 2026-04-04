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
  let targetNumVal = liquidityValue;
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
