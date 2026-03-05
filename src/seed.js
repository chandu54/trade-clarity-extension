export const DEFAULT_DATA = {
  sectors: [
    "IT",
    "Banking",
    "Finance",
    "Pharma",
    "FMCG",
    "Metals",
    "Energy",
    "Infra",
    "Auto",
    "Realty",
    "Defence",
  ],

  paramDefinitions: {
    stage: {
      label: "Stage",
      type: "select",
      options: ["Stage 1", "Stage 2", "Stage 3", "Stage 4"],
      filterable: true,
      isCheck: true,
      idealValues: ["Stage 2"],
    },

    rs: {
      label: "Relative Strength",
      type: "select",
      options: ["Weak", "Neutral", "Strong"],
      filterable: true,
      isCheck: true,
      idealValues: ["Strong"],
    },

    symmetry: {
      label: "Symmetry",
      type: "select",
      options: ["Yes", "No", "Not Applicable"],
      filterable: true,
      isCheck: false,
    },
    fractals: {
      label: "Fractals",
      type: "checkbox",
      filterable: true,
      isCheck: false,
    },

    attitude: {
      label: "Attitude",
      type: "select",
      options: ["Poor", "Average", "Good", "Excellent"],
      filterable: true,
      isCheck: true,
      idealValues: ["Good", "Excellent"],
    },

    liquidity: {
      label: "Liquidity",
      type: "select",
      options: [
        "<=20Cr",
        "21 to 49Cr",
        "50 to 99Cr",
        "100Cr to 199Cr",
        "200Cr to 499Cr",
        "500Cr+",
        "1000Cr+",
        "1500Cr+",
        "2000Cr+",
      ],
      filterable: true,
      isCheck: true,
      idealValues: [
        "100Cr to 199Cr",
        "200Cr to 499Cr",
        "500Cr+",
        "1000Cr+",
        "1500Cr+",
        "2000Cr+",
      ],
    },
  },

  weeks: {},
  uiConfig: {
    readOnlyPastWeeks: true,
    columnVisibility: {
      // locked columns (always true)
      __stock__: true,
      __checks__: true,
      __tradable__: true,
      // dynamic params will be injected automatically
    },
    sectors: [
      "IT",
      "Finance",
      "Banking",
      "Healthcare",
      "Pharma",
      "Auto",
      "Minerals/Metals",
      "Infrastructure",
      "Defence",
      "Misccellaneous",
    ],
    sectorFilterable: true,
    tradableFilterable: true,
  },
};
