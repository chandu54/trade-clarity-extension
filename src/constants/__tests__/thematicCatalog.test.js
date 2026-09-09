import { describe, it, expect } from "vitest";
import {
  CANONICAL_MACRO_THEMES,
  normalizeMacroTheme,
  normalizeThematicVector,
  normalizeThematicVectors,
  extractStockThematicThemes,
  extractStockThematicVectors,
} from "../thematicCatalog";

describe("thematicCatalog", () => {
  it("should export comprehensive canonical macro themes including AI & Data Centers", () => {
    expect(CANONICAL_MACRO_THEMES.length).toBeGreaterThanOrEqual(40);
    expect(CANONICAL_MACRO_THEMES).toContain("AI & Data Centers");
    expect(CANONICAL_MACRO_THEMES).toContain("Power Grid & Transmission");
    expect(CANONICAL_MACRO_THEMES).toContain("Aerospace & Defense");
    expect(CANONICAL_MACRO_THEMES).toContain("EV & Clean Mobility");
    expect(CANONICAL_MACRO_THEMES).toContain("Pharma, API & CDMO");
    expect(CANONICAL_MACRO_THEMES).toContain("Railways & High-Speed Transit");
    expect(CANONICAL_MACRO_THEMES).toContain("Specialty Chemicals & Advanced Materials");
    expect(CANONICAL_MACRO_THEMES).toContain("Electronics Manufacturing & Semiconductor OSAT");
    expect(CANONICAL_MACRO_THEMES).toContain("Banking & Credit Expansion");
    expect(CANONICAL_MACRO_THEMES).toContain("Capital Markets & Wealth Ecosystem");
    expect(CANONICAL_MACRO_THEMES).toContain("Telecom & Digital Networks");
  });

  it("should normalize verbose model themes into canonical themes via aliases and clustering", () => {
    // AI & Data Centers
    expect(normalizeMacroTheme("AI Infrastructure Development")).toBe("AI & Data Centers");
    expect(normalizeMacroTheme("Data Center Infrastructure Solutions")).toBe("AI & Data Centers");
    expect(normalizeMacroTheme("AI & Data Centers")).toBe("AI & Data Centers");
    expect(normalizeMacroTheme("AI & Computing Infrastructure")).toBe("AI & Data Centers");
    expect(normalizeMacroTheme("Data Center & Building Electrification")).toBe("AI & Data Centers");
    expect(normalizeMacroTheme("AI GPU Server Infrastructure")).toBe("AI & Data Centers");
    expect(normalizeMacroTheme("Data Center Connectivity (Optical)")).toBe("AI & Data Centers");

    // Power Grid & Transmission
    expect(normalizeMacroTheme("Power Transmission & Distribution Infrastructure")).toBe("Power Grid & Transmission");
    expect(normalizeMacroTheme("Power Grid 765kV & Transmission Supercycle")).toBe("Power Grid & Transmission");
    expect(normalizeMacroTheme("Power & Grid Modernization")).toBe("Power Grid & Transmission");
    expect(normalizeMacroTheme("Renewable Energy Grid Integration")).toBe("Power Grid & Transmission");

    // Aerospace & Defense
    expect(normalizeMacroTheme("Defense Modernization & Aerospace")).toBe("Aerospace & Defense");
    expect(normalizeMacroTheme("Aerospace & Defense")).toBe("Aerospace & Defense");
    expect(normalizeMacroTheme("Missile Optics & Racks")).toBe("Aerospace & Defense");
    expect(normalizeMacroTheme("Liquid Rocket Engines")).toBe("Aerospace & Defense");
    expect(normalizeMacroTheme("Boeing/GE Turbine Blades")).toBe("Aerospace & Defense");

    // EV & Clean Mobility
    expect(normalizeMacroTheme("EV & Clean Mobility")).toBe("EV & Clean Mobility");
    expect(normalizeMacroTheme("EV Traction Motors")).toBe("EV & Clean Mobility");
    expect(normalizeMacroTheme("EV 2-Wheelers")).toBe("EV & Clean Mobility");
    expect(normalizeMacroTheme("PVDF Battery Electrolyte")).toBe("EV & Clean Mobility");

    // Pharma, API & CDMO
    expect(normalizeMacroTheme("API & Drug")).toBe("Pharma, API & CDMO");
    expect(normalizeMacroTheme("Pharmaceutical Research & Manufacturing")).toBe("Pharma, API & CDMO");
    expect(normalizeMacroTheme("Global Pharma CDMO")).toBe("Pharma, API & CDMO");
    expect(normalizeMacroTheme("GLP-1 Obesity & Metabolic Supercycle")).toBe("GLP-1 Obesity & Metabolic Supercycle");

    // Specialty Chemicals & Materials
    expect(normalizeMacroTheme("Specialized Chemical Synthesis")).toBe("Specialty Chemicals & Advanced Materials");
    expect(normalizeMacroTheme("Industrial & Automotive Lubrication")).toBe("Specialty Chemicals & Advanced Materials");
    expect(normalizeMacroTheme("Industrial Lubrication")).toBe("Specialty Chemicals & Advanced Materials");
    expect(normalizeMacroTheme("Specialty Chemicals & Materials")).toBe("Specialty Chemicals & Advanced Materials");

    // Railways & Transit
    expect(normalizeMacroTheme("Railways & Modern Logistics")).toBe("Railways & High-Speed Transit");
    expect(normalizeMacroTheme("Railways & Logistics")).toBe("Railways & High-Speed Transit");
    expect(normalizeMacroTheme("Railway Modernization & Kavach Safety")).toBe("Railways & High-Speed Transit");

    // Finance & Lending
    expect(normalizeMacroTheme("Banking & Financial Services")).toBe("Banking & Credit Expansion");
    expect(normalizeMacroTheme("Commercial Vehicle & Capex Credit")).toBe("Commercial Vehicle & Capex Credit Expansion");
    expect(normalizeMacroTheme("Capital Markets & Financialization Supercycle")).toBe("Capital Markets & Wealth Ecosystem");

    // Other Core Categories
    expect(normalizeMacroTheme("Digital Communication Infrastructure Development")).toBe("Telecom & Digital Networks");
    expect(normalizeMacroTheme("Building & Infrastructure Development")).toBe("Infrastructure, Real Estate & Construction");
    expect(normalizeMacroTheme("Semiconductors & Electronics Manufacturing")).toBe("Electronics Manufacturing & Semiconductor OSAT");
    expect(normalizeMacroTheme("Branded Jewellery")).toBe("Branded Jewellery Formalization");
  });

  it("should cluster APARINDS, ANTHEM, and ACMESOLAR vectors into proper canonical macro themes", () => {
    // APARINDS raw model themes
    expect(normalizeMacroTheme("Power Grid 765kV & Transmission Supercycle")).toBe("Power Grid & Transmission");
    expect(normalizeMacroTheme("Renewable Energy Grid Integration")).toBe("Power Grid & Transmission");
    expect(normalizeMacroTheme("Industrial & Automotive Lubrication")).toBe("Specialty Chemicals & Advanced Materials");
    expect(normalizeMacroTheme("Data Center & Building Electrification")).toBe("AI & Data Centers");

    // ANTHEM raw model themes
    expect(normalizeMacroTheme("API & Drug")).toBe("Pharma, API & CDMO");
    expect(normalizeMacroTheme("Specialized Chemical Synthesis")).toBe("Specialty Chemicals & Advanced Materials");

    // ACMESOLAR raw model themes (Utility-Scale Renewable Power -> Renewable Energy & Clean Tech)
    expect(normalizeMacroTheme("Utility-Scale Renewable Power")).toBe("Renewable Energy & Clean Tech");
    expect(normalizeMacroTheme("Utility-Scale Solar Power")).toBe("Renewable Energy & Clean Tech");
    expect(normalizeMacroTheme("Renewable Power Generation")).toBe("Renewable Energy & Clean Tech");
  });

  it("should preserve valid canonical themes intact", () => {
    expect(normalizeMacroTheme("AI & Data Centers")).toBe("AI & Data Centers");
    expect(normalizeMacroTheme("Aerospace & Defense")).toBe("Aerospace & Defense");
    expect(normalizeMacroTheme("Power Grid & Transmission")).toBe("Power Grid & Transmission");
    expect(normalizeMacroTheme("EV & Clean Mobility")).toBe("EV & Clean Mobility");
    expect(normalizeMacroTheme("Pharma, API & CDMO")).toBe("Pharma, API & CDMO");
    expect(normalizeMacroTheme("Electronics Manufacturing & Semiconductor OSAT")).toBe("Electronics Manufacturing & Semiconductor OSAT");
  });

  it("should strip generic filler words from custom themes and title-case them", () => {
    expect(normalizeMacroTheme("Specialized Industrial Packaging Solutions")).toBe("Specialized Industrial Packaging");
    expect(normalizeMacroTheme("Global Cloud Solutions")).toBe("AI & Data Centers");
  });

  it("should accurately normalize US and Global secular macro themes", () => {
    // Semiconductor Equipment, EDA & Fabless IP
    expect(normalizeMacroTheme("Semiconductor Capital Equipment")).toBe("Semiconductor Equipment, EDA & Fabless IP");
    expect(normalizeMacroTheme("Wafer Fab Equipment (WFE)")).toBe("Semiconductor Equipment, EDA & Fabless IP");
    expect(normalizeMacroTheme("EDA Software Tools")).toBe("Semiconductor Equipment, EDA & Fabless IP");
    expect(normalizeMacroTheme("Fabless Chip Design")).toBe("Semiconductor Equipment, EDA & Fabless IP");
    expect(normalizeMacroTheme("Lithography Equipment")).toBe("Semiconductor Equipment, EDA & Fabless IP");

    // Enterprise SaaS & Cloud Platforms
    expect(normalizeMacroTheme("Enterprise SaaS")).toBe("Enterprise SaaS & Cloud Platforms");
    expect(normalizeMacroTheme("B2B SaaS Cloud Platforms")).toBe("Enterprise SaaS & Cloud Platforms");
    expect(normalizeMacroTheme("Cloud CRM Platform Software")).toBe("Enterprise SaaS & Cloud Platforms");

    // Cloud Resiliency & Cybersecurity
    expect(normalizeMacroTheme("Cybersecurity & Zero Trust")).toBe("Cloud Resiliency & Cybersecurity");
    expect(normalizeMacroTheme("Cloud Security Architecture")).toBe("Cloud Resiliency & Cybersecurity");
    expect(normalizeMacroTheme("Endpoint Security & SIEM")).toBe("Cloud Resiliency & Cybersecurity");

    // Biotech, Genomics & Rare Diseases
    expect(normalizeMacroTheme("Biotechnology & Genomics")).toBe("Biotech, Genomics & Rare Diseases");
    expect(normalizeMacroTheme("Gene Editing & CRISPR Therapeutics")).toBe("Biotech, Genomics & Rare Diseases");
    expect(normalizeMacroTheme("mRNA Therapeutics")).toBe("Biotech, Genomics & Rare Diseases");
    expect(normalizeMacroTheme("Rare Disease Therapeutics")).toBe("Biotech, Genomics & Rare Diseases");

    // Digital AdTech, Streaming & Connected Media
    expect(normalizeMacroTheme("Digital AdTech & Programmatic Advertising")).toBe("Digital AdTech, Streaming & Connected Media");
    expect(normalizeMacroTheme("Connected TV & Streaming Media")).toBe("Digital AdTech, Streaming & Connected Media");

    // Defense Tech & Autonomous Systems
    expect(normalizeMacroTheme("Defense Tech & Mission Autonomy")).toBe("Defense Tech & Autonomous Systems");
    expect(normalizeMacroTheme("Counter-Drone Defense Systems")).toBe("Defense Tech & Autonomous Systems");
    expect(normalizeMacroTheme("Munitions Replenishment")).toBe("Defense Tech & Autonomous Systems");

    // Residential Homebuilding & Building Products
    expect(normalizeMacroTheme("Residential Homebuilding")).toBe("Residential Homebuilding & Building Products");
    expect(normalizeMacroTheme("Single-Family Home Construction")).toBe("Residential Homebuilding & Building Products");

    // Fintech Lending, Payments & Digital Wallets
    expect(normalizeMacroTheme("Buy Now Pay Later (BNPL)")).toBe("Fintech Lending, Payments & Digital Wallets");
    expect(normalizeMacroTheme("Payment Processing & Digital Wallets")).toBe("Fintech Lending, Payments & Digital Wallets");
  });

  it("should handle empty or null values gracefully", () => {
    expect(normalizeMacroTheme("")).toBe("");
    expect(normalizeMacroTheme(null)).toBe("");
    expect(normalizeMacroTheme(undefined)).toBe("");
  });

  it("should normalize thematic vectors and preserve subFocus with standardized roles/conviction", () => {
    const rawVec = {
      theme: "AI & Data Centers",
      subFocus: "Data Center Optical Cables",
      role: "enabler / supply",
      conviction: "high",
      thesis: "Supplies server busducts for AI clusters",
    };
    const norm = normalizeThematicVector(rawVec);
    expect(norm).toEqual({
      theme: "AI & Data Centers",
      subFocus: "Data Center Optical Cables",
      role: "Pick-and-Shovel Enabler",
      conviction: "High",
      thesis: "Supplies server busducts for AI clusters",
    });

    const oemVec = {
      theme: "Defense Modernization",
      subFocus: "Liquid Rocket Engines",
      role: "prime OEM manufacturer",
      conviction: "medium",
      thesis: "Builds fighter jets",
    };
    expect(normalizeThematicVector(oemVec).theme).toBe("Aerospace & Defense");
    expect(normalizeThematicVector(oemVec).role).toBe("Brand / Maker");
    expect(normalizeThematicVector(oemVec).conviction).toBe("Medium");
    expect(normalizeThematicVector(oemVec).subFocus).toBe("Liquid Rocket Engines");

    const bankVec = {
      theme: "Commercial Vehicle & Capex Credit",
      role: "commercial vehicle lender bank",
      conviction: "high",
      thesis: "Underwrites fleet capex",
    };
    expect(normalizeThematicVector(bankVec).role).toBe("Lender / Bank");

    const platformVec = {
      theme: "Automotive Tech & Secondary Marketplace",
      role: "used vehicle digital auction marketplace",
      conviction: "high",
      thesis: "Digital transaction fee platform",
    };
    expect(normalizeThematicVector(platformVec).role).toBe("Platform / Exchange");
  });

  it("should normalize an array of vectors and deduplicate identical themes", () => {
    const list = [
      { theme: "AI Infrastructure", subFocus: "AI Servers", role: "Enabler", conviction: "High", thesis: "AI servers" },
      { theme: "AI & Data Centers", subFocus: "Duplicate", role: "Component", conviction: "Medium", thesis: "Duplicate AI theme" },
      { theme: "Power & Grid Modernization", subFocus: "Transformers", role: "OEM", conviction: "High", thesis: "Transformers" },
    ];
    const normalized = normalizeThematicVectors(list);
    expect(normalized.length).toBe(2);
    expect(normalized[0].theme).toBe("AI & Data Centers");
    expect(normalized[1].theme).toBe("Power Grid & Transmission");
  });

  it("should extract stock thematic themes and vectors with backwards compatibility", () => {
    // Multi-thematic stock (e.g. APAR style)
    const multiStock = {
      macroTheme: "Power Grid 765kV & Transmission Supercycle",
      thematicVectors: [
        { theme: "Power Grid 765kV & Transmission Supercycle", subFocus: "765kV Conductors", role: "Component Supplier", conviction: "High", thesis: "Conductors" },
        { theme: "Data Center & Building Electrification", subFocus: "Busducts", role: "Pick-and-Shovel Enabler", conviction: "High", thesis: "Busducts" },
      ],
    };
    const themes = extractStockThematicThemes(multiStock);
    expect(themes).toContain("Power Grid & Transmission");
    expect(themes).toContain("AI & Data Centers");

    // Legacy stock (only has macroTheme string)
    const legacyStock = {
      macroTheme: "Power & Grid Modernization",
      dependentIndustries: ["765kV transmission"],
    };
    const legacyThemes = extractStockThematicThemes(legacyStock);
    expect(legacyThemes).toEqual(["Power Grid & Transmission"]);

    const legacyVectors = extractStockThematicVectors(legacyStock);
    expect(legacyVectors.length).toBe(1);
    expect(legacyVectors[0].theme).toBe("Power Grid & Transmission");
    expect(legacyVectors[0].role).toBe("Pick-and-Shovel Enabler");
    expect(legacyVectors[0].subFocus).toBe("765kV transmission");

    // Legacy jewelry stock with generic consumer dependentIndustries
    const kalyanLegacy = {
      symbol: "KALYANKJIL",
      name: "Kalyan Jewellers India Limited",
      sector: "Jewellery",
      dependentIndustries: ["Consumer Retail", "Luxury Goods Market"],
    };
    const kalyanVectors = extractStockThematicVectors(kalyanLegacy);
    expect(kalyanVectors[0].theme).toBe("Branded Jewellery Formalization");
    expect(kalyanVectors[0].role).toBe("Brand / Maker");
    expect(extractStockThematicThemes(kalyanLegacy)).toEqual(["Branded Jewellery Formalization"]);

    const bluestoneLegacy = {
      symbol: "BLUESTONE",
      name: "BlueStone Jewellery and Lifestyle",
      sector: "Jewellery",
      dependentIndustries: ["Consumer Discretionary", "Retail Tech"],
    };
    const bluestoneVectors = extractStockThematicVectors(bluestoneLegacy);
    expect(bluestoneVectors[0].theme).toBe("Branded Jewellery Formalization");
    expect(bluestoneVectors[0].role).toBe("Brand / Maker");
    expect(extractStockThematicThemes(bluestoneLegacy)).toEqual(["Branded Jewellery Formalization"]);
  });
});
