export function calculateCheckStats(stocks, paramDefinitions) {
  const checkParams = Object.values(paramDefinitions).filter(
    (p) => p.isCheck !== false,
  );

  const totalChecks = checkParams.length;

  let passed80 = 0;
  let passed60 = 0;

  stocks.forEach((stock) => {
    let passed = 0;

    checkParams.forEach((p, index) => {
      const value = stock.params?.[Object.keys(paramDefinitions)[index]];

      if (p.type === "checkbox" && value === true) passed++;
      if (p.type === "select" && p.idealValues?.includes(value)) passed++;
      if (p.type === "text" && p.idealValues?.includes(value)) passed++;
    });

    const percent = totalChecks === 0 ? 0 : (passed / totalChecks) * 100;

    if (percent >= 80) passed80++;
    else if (percent >= 60) passed60++;
  });

  return {
    totalStocks: stocks.length,
    passed80,
    passed60,
  };
}
