import { getStockCheckSummary } from "./paramUtils";

export function calculateCheckStats(stocks, paramDefinitions) {
  let passed80 = 0;
  let passed60 = 0;

  stocks.forEach((stock) => {
    const { ratio } = getStockCheckSummary(stock, paramDefinitions);
    const percent = ratio * 100;

    if (percent >= 80) passed80++;
    else if (percent >= 60) passed60++;
  });

  return {
    totalStocks: stocks.length,
    passed80,
    passed60,
  };
}
