/**
 * Canonical Institutional Macro Themes Catalog & Normalization
 *
 * Defines the standardized high-level institutional investment baskets
 * and supply-chain CapEx cycles.
 */

export const CANONICAL_MACRO_THEMES = [
  // 1. AI & Advanced Computing
  "AI & Data Centers",
  "AI & Computing Infrastructure",
  "Digital Transformation & Cloud Modernization",
  "Enterprise SaaS & Cloud Platforms",
  "Cloud Resiliency & Cybersecurity",
  "Semiconductor Equipment, EDA & Fabless IP",
  "Electronics Manufacturing & Semiconductor OSAT",
  "Autonomous Robotics & Edge AI",
  "Space Tech & Satellite Communication",

  // 2. Power, Energy & Utilities
  "Power Grid & Transmission",
  "Power & Grid Modernization",
  "Renewable Energy & Clean Tech",
  "Green Hydrogen & Clean Fuels",
  "Battery Energy Storage & Microgrids",
  "Nuclear Energy & SMR CapEx",
  "Smart Metering & Grid Edge Automation",
  "Hydrocarbon Security & Gas Grid Expansion",

  // 3. Defense, Aerospace & Security
  "Aerospace & Defense",
  "Defense Modernization & Aerospace",
  "Defense Indigenization & Export Supercycle",
  "Defense Tech & Autonomous Systems",
  "Drones & Autonomous Defense",
  "Shipbuilding & Marine Logistics",

  // 4. Mobility & Transportation
  "EV & Clean Mobility",
  "Automotive & EV Supply Chain",
  "Auto Components & Ancillaries",
  "Railways & Modern Logistics",
  "Railways & High-Speed Transit",
  "Port Terminals & Maritime Shipping",
  "Logistics, Warehousing & Supply Chain",

  // 5. Industrials, Engineering & Materials
  "Industrial Automation & Precision Engineering",
  "Industrial Reshoring & Capital Goods",
  "Specialty Chemicals & Advanced Materials",
  "Critical Minerals & Energy Transition Metals",
  "Mining, Metals & Steel Processing",
  "Paper, Packaging & Containerboard",
  "Water Treatment & Environmental Engineering",

  // 6. Infrastructure & Construction
  "Infrastructure, Real Estate & Construction",
  "Infrastructure, Building Materials & Construction",
  "Residential Homebuilding & Building Products",
  "Cement & Building Products",

  // 7. Healthcare & Life Sciences
  "Pharma, API & CDMO",
  "Healthcare, Pharmaceuticals & CDMO",
  "Biotech, Genomics & Rare Diseases",
  "GLP-1 Obesity & Metabolic Supercycle",
  "Hospital Healthcare & Diagnostics",
  "Medical Devices & Life Science Tech",

  // 8. Banking, Financial Services & Capital Markets
  "Banking & Credit Expansion",
  "Financial Services & Wealth Ecosystem",
  "Capital Markets & Wealth Ecosystem",
  "Capital Markets & Financialization Supercycle",
  "Commercial Vehicle & Capex Credit Expansion",
  "Housing & Mortgage Credit Expansion",
  "Financial Inclusion & Micro-Credit",
  "Fintech Lending, Payments & Digital Wallets",
  "Fintech, Payments & Neobanking",

  // 9. Consumer, Retail & Lifestyle
  "Consumer & Retail",
  "Consumer, Retail & Lifestyle",
  "Consumer Brands & FMCG",
  "Branded Jewellery Formalization",
  "Direct-to-Consumer Clean Beauty",
  "Urban Discretionary Premiumization",
  "Hospitality, Travel & Aviation",
  "Textiles, Apparel & Contract Manufacturing",
  "Media, Entertainment & Digital AdTech",
  "Digital AdTech, Streaming & Connected Media",
  "Agricultural Inputs & Food Security",
  "Clean Fuels, Biofuels & Ag Commodities",
  "Ethanol, Biofuels & Sugar Diversification",
  "Waste Management & Circular Economy",
  "Telecom & Digital Networks",
];

// Display aliases or common variants mapping to canonical themes
const THEME_ALIASES = {
  // AI & Data Centers
  "ai & data centers": "AI & Data Centers",
  "ai & data center": "AI & Data Centers",
  "data centers & ai": "AI & Data Centers",
  "data center infrastructure": "AI & Data Centers",
  "data center & building electrification": "AI & Data Centers",
  "ai data center cooling & thermal management": "AI & Data Centers",
  "data center cooling & thermal management": "AI & Data Centers",
  "ai cooling & power": "AI & Data Centers",
  "ai & computing infrastructure": "AI & Data Centers",
  "ai & computing": "AI & Data Centers",
  "ai infrastructure": "AI & Data Centers",
  "computing infrastructure": "AI & Data Centers",
  "cloud & data center infrastructure": "AI & Data Centers",
  "cloud infrastructure": "AI & Data Centers",
  "global cloud": "AI & Data Centers",
  "ai foundation compute & accelerators": "AI & Data Centers",
  "ai compute & accelerators": "AI & Data Centers",
  "ai & hyperscale data center infrastructure": "AI & Data Centers",

  // Power Grid & Transmission
  "power grid & transmission": "Power Grid & Transmission",
  "power & grid modernization": "Power Grid & Transmission",
  "power & grid infrastructure": "Power Grid & Transmission",
  "power transmission & distribution": "Power Grid & Transmission",
  "power transmission & distribution infrastructure": "Power Grid & Transmission",
  "power transmission": "Power Grid & Transmission",
  "grid modernization": "Power Grid & Transmission",
  "grid infrastructure": "Power Grid & Transmission",
  "power infrastructure": "Power Grid & Transmission",
  "power grid 765kv & transmission supercycle": "Power Grid & Transmission",
  "power grid 765kv & transmission": "Power Grid & Transmission",
  "power grid modernization & t&d": "Power Grid & Transmission",
  "power grid t&d": "Power Grid & Transmission",
  "renewable energy grid integration": "Power Grid & Transmission",

  // Aerospace & Defense
  "aerospace & defense": "Aerospace & Defense",
  "defense & aerospace": "Aerospace & Defense",
  "defense modernization & aerospace": "Aerospace & Defense",
  "defense modernization": "Aerospace & Defense",
  "defense equipment": "Aerospace & Defense",
  "defense indigenization & export supercycle": "Aerospace & Defense",
  "defense indigenization & aerospace": "Aerospace & Defense",
  "defense indigenization": "Aerospace & Defense",
  "autonomous defense & mission ai": "Aerospace & Defense",
  "autonomous defense": "Aerospace & Defense",

  // EV & Clean Mobility
  "ev & clean mobility": "EV & Clean Mobility",
  "ev and clean mobility": "EV & Clean Mobility",
  "clean mobility": "EV & Clean Mobility",
  "electric vehicles": "EV & Clean Mobility",
  "electric vehicle": "EV & Clean Mobility",
  "ev supply chain": "EV & Clean Mobility",
  "automotive & ev supply chain": "EV & Clean Mobility",
  "auto & ev supply chain": "EV & Clean Mobility",
  "auto components & ev supply chain": "EV & Clean Mobility",
  "clean energy & mobility transition": "EV & Clean Mobility",
  "clean energy & mobility": "EV & Clean Mobility",

  // Renewable Energy & Clean Tech
  "renewable energy & clean tech": "Renewable Energy & Clean Tech",
  "utility-scale renewable power": "Renewable Energy & Clean Tech",
  "utility-scale renewable": "Renewable Energy & Clean Tech",
  "utility-scale solar": "Renewable Energy & Clean Tech",
  "utility-scale solar power": "Renewable Energy & Clean Tech",
  "utility-scale power": "Renewable Energy & Clean Tech",
  "utility-scale": "Renewable Energy & Clean Tech",
  "renewable power": "Renewable Energy & Clean Tech",
  "renewable power generation": "Renewable Energy & Clean Tech",
  "renewable energy": "Renewable Energy & Clean Tech",
  "clean energy": "Renewable Energy & Clean Tech",
  "clean power": "Renewable Energy & Clean Tech",
  "green power": "Renewable Energy & Clean Tech",
  "energy transition infrastructure": "Renewable Energy & Clean Tech",
  "energy transition": "Renewable Energy & Clean Tech",
  "green energy": "Renewable Energy & Clean Tech",
  "solar energy": "Renewable Energy & Clean Tech",
  "wind energy": "Renewable Energy & Clean Tech",

  // Pharma, API & CDMO
  "pharma, api & cdmo": "Pharma, API & CDMO",
  "healthcare, pharmaceuticals & cdmo": "Pharma, API & CDMO",
  "healthcare & lifesciences": "Pharma, API & CDMO",
  "pharmaceuticals & healthcare": "Pharma, API & CDMO",
  "healthcare & pharma": "Pharma, API & CDMO",
  "cdmo & pharmaceuticals": "Pharma, API & CDMO",
  "pharmaceutical research": "Pharma, API & CDMO",
  "global pharma cdmo": "Pharma, API & CDMO",
  "pharma cdmo": "Pharma, API & CDMO",
  "api & drug": "Pharma, API & CDMO",
  "api & intermediates": "Pharma, API & CDMO",
  "glp-1 obesity & metabolic supercycle": "GLP-1 Obesity & Metabolic Supercycle",
  "glp-1 obesity": "GLP-1 Obesity & Metabolic Supercycle",
  "glp-1 metabolic": "GLP-1 Obesity & Metabolic Supercycle",

  // Specialty Chemicals & Advanced Materials
  "specialty chemicals & advanced materials": "Specialty Chemicals & Advanced Materials",
  "specialty chemicals & materials": "Specialty Chemicals & Advanced Materials",
  "specialty chemicals": "Specialty Chemicals & Advanced Materials",
  "advanced materials & chemicals": "Specialty Chemicals & Advanced Materials",
  "specialized chemical synthesis": "Specialty Chemicals & Advanced Materials",
  "chemical synthesis": "Specialty Chemicals & Advanced Materials",
  "industrial & automotive lubrication": "Specialty Chemicals & Advanced Materials",
  "industrial lubrication": "Specialty Chemicals & Advanced Materials",
  "industrial components": "Specialty Chemicals & Advanced Materials",

  // Railways & High-Speed Transit
  "railways & high-speed transit": "Railways & High-Speed Transit",
  "railways & modern logistics": "Railways & High-Speed Transit",
  "railways & logistics": "Railways & High-Speed Transit",
  "railway infrastructure & logistics": "Railways & High-Speed Transit",
  "railways & freight": "Railways & High-Speed Transit",
  "freight & logistics": "Railways & High-Speed Transit",
  "railway modernization & high-speed transit": "Railways & High-Speed Transit",
  "railway modernization & kavach safety": "Railways & High-Speed Transit",
  "kavach & railway modernization": "Railways & High-Speed Transit",

  // Telecom & Digital Networks
  "telecom & digital networks": "Telecom & Digital Networks",
  "telecom & network infrastructure": "Telecom & Digital Networks",
  "telecom infrastructure": "Telecom & Digital Networks",
  "digital communication": "Telecom & Digital Networks",
  "digital communication infrastructure": "Telecom & Digital Networks",
  "digital infrastructure": "Telecom & Digital Networks",
  "optical fiber & telecom": "Telecom & Digital Networks",

  // Industrial Automation & Engineering
  "industrial automation & precision engineering": "Industrial Automation & Precision Engineering",
  "industrial automation & engineering": "Industrial Automation & Precision Engineering",
  "industrial automation": "Industrial Automation & Precision Engineering",
  "precision engineering & automation": "Industrial Automation & Precision Engineering",
  "precision engineering": "Industrial Automation & Precision Engineering",
  "specialty engineering products": "Industrial Automation & Precision Engineering",
  "specialty engineering": "Industrial Automation & Precision Engineering",
  "industrial reshoring & electrification": "Industrial Reshoring & Capital Goods",
  "industrial reshoring & capital goods": "Industrial Reshoring & Capital Goods",

  // Electronics & Semiconductors
  "electronics manufacturing & semiconductor osat": "Electronics Manufacturing & Semiconductor OSAT",
  "electronics manufacturing & semiconductors": "Electronics Manufacturing & Semiconductor OSAT",
  "electronics manufacturing services": "Electronics Manufacturing & Semiconductor OSAT",
  "electronics manufacturing": "Electronics Manufacturing & Semiconductor OSAT",
  "semiconductors & electronics manufacturing": "Electronics Manufacturing & Semiconductor OSAT",
  "semiconductor & ems": "Electronics Manufacturing & Semiconductor OSAT",
  "semiconductors & ems": "Electronics Manufacturing & Semiconductor OSAT",
  "semiconductors": "Electronics Manufacturing & Semiconductor OSAT",
  "semiconductor manufacturing": "Electronics Manufacturing & Semiconductor OSAT",
  "ems & electronics": "Electronics Manufacturing & Semiconductor OSAT",
  "electronics hardware": "Electronics Manufacturing & Semiconductor OSAT",

  // Infrastructure & Construction
  "infrastructure, real estate & construction": "Infrastructure, Real Estate & Construction",
  "infrastructure, building materials & construction": "Infrastructure, Real Estate & Construction",
  "infrastructure & construction": "Infrastructure, Real Estate & Construction",
  "building materials & infrastructure": "Infrastructure, Real Estate & Construction",
  "building & construction": "Infrastructure, Real Estate & Construction",
  "building & infrastructure": "Infrastructure, Real Estate & Construction",
  "civil infrastructure": "Infrastructure, Real Estate & Construction",
  "water & sanitation infrastructure": "Infrastructure, Real Estate & Construction",
  "water & sanitation": "Infrastructure, Real Estate & Construction",
  "sanitation infrastructure": "Infrastructure, Real Estate & Construction",

  // Financial Services & Banking
  "banking & credit expansion": "Banking & Credit Expansion",
  "banking": "Banking & Credit Expansion",
  "banks": "Banking & Credit Expansion",
  "bank": "Banking & Credit Expansion",
  "commercial banks": "Banking & Credit Expansion",
  "private banks": "Banking & Credit Expansion",
  "psu banks": "Banking & Credit Expansion",
  "financial services & wealth ecosystem": "Financial Services & Wealth Ecosystem",
  "financial services & lending": "Financial Services & Wealth Ecosystem",
  "financial services & fintech": "Financial Services & Wealth Ecosystem",
  "financial services": "Financial Services & Wealth Ecosystem",
  "banking & financial services": "Banking & Credit Expansion",
  "finance": "Financial Services & Wealth Ecosystem",
  "nbfc": "Financial Services & Wealth Ecosystem",
  "nbfcs": "Financial Services & Wealth Ecosystem",
  "lending": "Financial Services & Wealth Ecosystem",
  "diversified financials": "Financial Services & Wealth Ecosystem",
  "capital markets & wealth ecosystem": "Capital Markets & Wealth Ecosystem",
  "wealth & capital markets": "Capital Markets & Wealth Ecosystem",
  "capital markets & financialization supercycle": "Capital Markets & Wealth Ecosystem",
  "financialization of household savings": "Capital Markets & Wealth Ecosystem",
  "commercial vehicle & capex credit expansion": "Commercial Vehicle & Capex Credit Expansion",
  "commercial vehicle & capex credit": "Commercial Vehicle & Capex Credit Expansion",
  "commercial vehicle credit": "Commercial Vehicle & Capex Credit Expansion",

  // Consumer & Retail
  "consumer & retail": "Consumer & Retail",
  "consumer retail": "Consumer & Retail",
  "consumer discretionary": "Consumer & Retail",
  "consumer, retail & lifestyle": "Consumer, Retail & Lifestyle",
  "branded jewellery formalization": "Branded Jewellery Formalization",
  "branded jewellery": "Branded Jewellery Formalization",
  "fine jewellery retail": "Branded Jewellery Formalization",
  "direct-to-consumer clean beauty": "Direct-to-Consumer Clean Beauty",
  "digital-first consumer brands & d2c": "Direct-to-Consumer Clean Beauty",
  "digital-first consumer brands": "Direct-to-Consumer Clean Beauty",
  "digital-first brands": "Direct-to-Consumer Clean Beauty",
  "d2c consumer brands": "Direct-to-Consumer Clean Beauty",
  "d2c clean beauty": "Direct-to-Consumer Clean Beauty",
  "clean beauty & personal care": "Direct-to-Consumer Clean Beauty",
  "urban discretionary premiumization": "Urban Discretionary Premiumization",

  // Critical Minerals & Energy Transition Metals
  "critical minerals & energy transition metals": "Critical Minerals & Energy Transition Metals",
  "critical minerals & materials": "Critical Minerals & Energy Transition Metals",
  "critical minerals": "Critical Minerals & Energy Transition Metals",
  "metals, mining & critical materials": "Critical Minerals & Energy Transition Metals",
  "metals & mining": "Critical Minerals & Energy Transition Metals",
  "mining & critical minerals": "Critical Minerals & Energy Transition Metals",
  "energy transition metals": "Critical Minerals & Energy Transition Metals",
  "metals & materials": "Critical Minerals & Energy Transition Metals",

  // Hydrocarbon Security
  "hydrocarbon security & gas grid expansion": "Hydrocarbon Security & Gas Grid Expansion",
  "hydrocarbon security & energy infrastructure": "Hydrocarbon Security & Gas Grid Expansion",
  "hydrocarbons & energy infrastructure": "Hydrocarbon Security & Gas Grid Expansion",
  "oil, gas & energy infrastructure": "Hydrocarbon Security & Gas Grid Expansion",
  "oil & gas infrastructure": "Hydrocarbon Security & Gas Grid Expansion",
  "oil, gas & energy utilities": "Hydrocarbon Security & Gas Grid Expansion",
  "gas grid infrastructure": "Hydrocarbon Security & Gas Grid Expansion",
  "gas grid expansion": "Hydrocarbon Security & Gas Grid Expansion",
  "oil & gas": "Hydrocarbon Security & Gas Grid Expansion",
  "oil and gas": "Hydrocarbon Security & Gas Grid Expansion",

  // Digital Transformation
  "digital transformation & cloud modernization": "Digital Transformation & Cloud Modernization",
  "digital transformation & cloud": "Digital Transformation & Cloud Modernization",
  "digital transformation": "Digital Transformation & Cloud Modernization",
  "cloud modernization": "Digital Transformation & Cloud Modernization",
  "enterprise tech & cloud services": "Digital Transformation & Cloud Modernization",
  "it services & digital transformation": "Digital Transformation & Cloud Modernization",
  "it services & cloud": "Digital Transformation & Cloud Modernization",
  "it & digital services": "Digital Transformation & Cloud Modernization",
  "it services": "Digital Transformation & Cloud Modernization",

  // Enterprise SaaS & Cloud Platforms
  "enterprise saas & cloud platforms": "Enterprise SaaS & Cloud Platforms",
  "enterprise saas": "Enterprise SaaS & Cloud Platforms",
  "enterprise software & saas": "Enterprise SaaS & Cloud Platforms",
  "b2b saas": "Enterprise SaaS & Cloud Platforms",
  "cloud saas": "Enterprise SaaS & Cloud Platforms",
  "cloud application software": "Enterprise SaaS & Cloud Platforms",
  "enterprise application software": "Enterprise SaaS & Cloud Platforms",
  "saas & cloud software": "Enterprise SaaS & Cloud Platforms",
  "b2b cloud platforms": "Enterprise SaaS & Cloud Platforms",
  "cloud software": "Enterprise SaaS & Cloud Platforms",
  "cloud & enterprise software": "Enterprise SaaS & Cloud Platforms",
  "enterprise software": "Enterprise SaaS & Cloud Platforms",
  "saas": "Enterprise SaaS & Cloud Platforms",

  // Cloud Resiliency & Cybersecurity
  "cloud resiliency & cybersecurity": "Cloud Resiliency & Cybersecurity",
  "cybersecurity": "Cloud Resiliency & Cybersecurity",
  "cloud security": "Cloud Resiliency & Cybersecurity",
  "cybersecurity & cloud resiliency": "Cloud Resiliency & Cybersecurity",
  "cyber security": "Cloud Resiliency & Cybersecurity",
  "information security": "Cloud Resiliency & Cybersecurity",
  "infosec": "Cloud Resiliency & Cybersecurity",
  "infosec & cybersecurity": "Cloud Resiliency & Cybersecurity",
  "network security": "Cloud Resiliency & Cybersecurity",
  "zero trust security": "Cloud Resiliency & Cybersecurity",

  // Semiconductor Equipment, EDA & Fabless IP
  "semiconductor equipment, eda & fabless ip": "Semiconductor Equipment, EDA & Fabless IP",
  "semiconductor equipment": "Semiconductor Equipment, EDA & Fabless IP",
  "semiconductor capital equipment": "Semiconductor Equipment, EDA & Fabless IP",
  "semiconductor wfe": "Semiconductor Equipment, EDA & Fabless IP",
  "wafer fab equipment": "Semiconductor Equipment, EDA & Fabless IP",
  "eda software": "Semiconductor Equipment, EDA & Fabless IP",
  "semiconductor design & eda": "Semiconductor Equipment, EDA & Fabless IP",
  "fabless semiconductor": "Semiconductor Equipment, EDA & Fabless IP",
  "fabless chip design": "Semiconductor Equipment, EDA & Fabless IP",
  "semiconductor ip & eda": "Semiconductor Equipment, EDA & Fabless IP",
  "lithography & wafer fab": "Semiconductor Equipment, EDA & Fabless IP",
  "chip design & eda": "Semiconductor Equipment, EDA & Fabless IP",

  // Biotech, Genomics & Rare Diseases
  "biotech, genomics & rare diseases": "Biotech, Genomics & Rare Diseases",
  "biotechnology & genomics": "Biotech, Genomics & Rare Diseases",
  "biotech & genomics": "Biotech, Genomics & Rare Diseases",
  "genomic medicine": "Biotech, Genomics & Rare Diseases",
  "gene therapy & genomics": "Biotech, Genomics & Rare Diseases",
  "gene editing & crispr": "Biotech, Genomics & Rare Diseases",
  "rare disease therapeutics": "Biotech, Genomics & Rare Diseases",
  "mrna therapeutics": "Biotech, Genomics & Rare Diseases",
  "biotechnology": "Biotech, Genomics & Rare Diseases",
  "biotech": "Biotech, Genomics & Rare Diseases",

  // Digital AdTech, Streaming & Connected Media
  "digital adtech, streaming & connected media": "Digital AdTech, Streaming & Connected Media",
  "digital adtech": "Digital AdTech, Streaming & Connected Media",
  "adtech & digital media": "Digital AdTech, Streaming & Connected Media",
  "adtech": "Digital AdTech, Streaming & Connected Media",
  "programmatic advertising": "Digital AdTech, Streaming & Connected Media",
  "digital advertising & adtech": "Digital AdTech, Streaming & Connected Media",
  "digital advertising": "Digital AdTech, Streaming & Connected Media",
  "streaming media & digital adtech": "Digital AdTech, Streaming & Connected Media",
  "streaming media": "Digital AdTech, Streaming & Connected Media",
  "connected tv & streaming": "Digital AdTech, Streaming & Connected Media",

  // Defense Tech & Autonomous Systems
  "defense tech & autonomous systems": "Defense Tech & Autonomous Systems",
  "defense tech": "Defense Tech & Autonomous Systems",
  "defense technology & autonomous systems": "Defense Tech & Autonomous Systems",
  "defense technology": "Defense Tech & Autonomous Systems",
  "autonomous defense & robotics": "Defense Tech & Autonomous Systems",
  "munitions replenishment & defense tech": "Defense Tech & Autonomous Systems",
  "defense software & mission autonomy": "Defense Tech & Autonomous Systems",
  "defense software": "Defense Tech & Autonomous Systems",

  // Residential Homebuilding & Building Products
  "residential homebuilding & building products": "Residential Homebuilding & Building Products",
  "residential homebuilding": "Residential Homebuilding & Building Products",
  "homebuilding & construction": "Residential Homebuilding & Building Products",
  "homebuilders & residential construction": "Residential Homebuilding & Building Products",
  "homebuilders": "Residential Homebuilding & Building Products",
  "homebuilding": "Residential Homebuilding & Building Products",
  "single-family homebuilding": "Residential Homebuilding & Building Products",
  "residential housing & homebuilding": "Residential Homebuilding & Building Products",

  // Fintech Lending, Payments & Digital Wallets
  "fintech lending, payments & digital wallets": "Fintech Lending, Payments & Digital Wallets",
  "fintech lending": "Fintech Lending, Payments & Digital Wallets",
  "payments & digital wallets": "Fintech Lending, Payments & Digital Wallets",
  "payment processing & digital wallets": "Fintech Lending, Payments & Digital Wallets",
  "payment processing": "Fintech Lending, Payments & Digital Wallets",
  "digital payments & wallets": "Fintech Lending, Payments & Digital Wallets",
  "digital payments": "Fintech Lending, Payments & Digital Wallets",
  "buy now pay later": "Fintech Lending, Payments & Digital Wallets",
  "bnpl & alternative credit": "Fintech Lending, Payments & Digital Wallets",
  "bnpl": "Fintech Lending, Payments & Digital Wallets",
  "payment gateway & acquiring": "Fintech Lending, Payments & Digital Wallets",
};

/**
 * Intelligent Cluster Match Patterns
 * Evaluated in order when exact and alias matches fail.
 */
const CLUSTER_PATTERNS = [
  // 1. Power Grid & Transmission
  {
    target: "Power Grid & Transmission",
    patterns: [
      /765\s*kv/i,
      /\btransmission\b/i,
      /\bconductors?\b/i,
      /\btransformer\s*oils?\b/i,
      /\bpower\s*grid\b/i,
      /\bsubstations?\b/i,
      /\bswitchgears?\b/i,
      /\bpower\s*t&d\b/i,
      /\bgrid\s*modernization\b/i,
      /\bgrid\s*integration\b/i,
      /\bhv\s*cables?\b/i,
    ],
  },
  // 2. AI & Data Centers
  {
    target: "AI & Data Centers",
    patterns: [
      /\bdata\s*centers?\b/i,
      /\bhyperscal/i,
      /\bgpu\s*server/i,
      /\bcloud\s*cluster/i,
      /\bai\s*compute/i,
      /\bai\s*foundation/i,
      /\bai\s*accelerator/i,
      /\bai\s*cooling/i,
      /\bthermal\s*management/i,
      /\boptical\s*interconnect/i,
      /\bdatacenter/i,
    ],
  },
  // 3. Defense Tech & Autonomous Systems
  {
    target: "Defense Tech & Autonomous Systems",
    patterns: [
      /\bdefense\s*tech\b/i,
      /\bdefence\s*tech\b/i,
      /\bautonomous\s*defense\b/i,
      /\bcounter-drone\b/i,
      /\bloitering\s*munition/i,
      /\bdefense\s*software\b/i,
      /\bmission\s*autonomy\b/i,
      /\bmunitions?\s*replenishment\b/i,
    ],
  },
  // 3b. Aerospace & Defense
  {
    target: "Aerospace & Defense",
    patterns: [
      /\bmissiles?\b/i,
      /\bdefense\b/i,
      /\bdefence\b/i,
      /\baerospace\b/i,
      /\bavionics\b/i,
      /\bradar\b/i,
      /\brockets?\b/i,
      /\bturbine\s*blades?\b/i,
      /\barmaments?\b/i,
      /\bammunition\b/i,
      /\bartillery\b/i,
      /\bnaval\s*defense\b/i,
      /\bwarfare\b/i,
    ],
  },
  // 4. EV & Clean Mobility
  {
    target: "EV & Clean Mobility",
    patterns: [
      /\belectric\s*vehicles?\b/i,
      /\bclean\s*mobility\b/i,
      /\btraction\s*motors?\b/i,
      /\bbattery\s*electrolyte\b/i,
      /\bev\s*2-wheelers?\b/i,
      /\bev\s*supply\b/i,
      /\bev\s*powertrain\b/i,
      /\bev\s*charging\b/i,
      /\bev\s*components?\b/i,
    ],
  },
  // 5. Renewable Energy & Clean Tech
  {
    target: "Renewable Energy & Clean Tech",
    patterns: [
      /\brenewable/i,
      /\butility-scale/i,
      /\bsolar\b/i,
      /\bwind\b/i,
      /\bclean\s*(energy|power)\b/i,
      /\bgreen\s*(energy|power)\b/i,
      /\bgreen\s*hydrogen\b/i,
      /\belectrolyzers?\b/i,
      /\bphotovoltaic\b/i,
      /\bbess\b/i,
      /\bdecarbonization\b/i,
    ],
  },
  // 6. Biotech, Genomics & Rare Diseases
  {
    target: "Biotech, Genomics & Rare Diseases",
    patterns: [
      /\bbiotech(nology)?\b/i,
      /\bgenom(ics?|e)\b/i,
      /\bgene\s*(therapy|editing)\b/i,
      /\bmrna\b/i,
      /\bcrispr\b/i,
      /\brare\s*diseas(e|es)\b/i,
      /\bbiopharma\b/i,
      /\bmonoclonal\s*antibod/i,
    ],
  },
  // 6b. Pharma, API & CDMO
  {
    target: "Pharma, API & CDMO",
    patterns: [
      /\bapi\s*(&|and)\s*drug/i,
      /\bcdmo\b/i,
      /\bcrmo\b/i,
      /\bactive\s*pharmaceutical/i,
      /\bpharma\b/i,
      /\bpharmaceutical/i,
      /\bglp-?1\b/i,
      /\bformulations?\b/i,
      /\bdrug\s*discovery\b/i,
      /\bclinical\s*research\b/i,
    ],
  },
  // 7. Specialty Chemicals & Advanced Materials
  {
    target: "Specialty Chemicals & Advanced Materials",
    patterns: [
      /\blubricat/i,
      /\bspecialty\s*chem/i,
      /\bperformance\s*chem/i,
      /\bfluorochem/i,
      /\bchemical\s*synthesis\b/i,
      /\badvanced\s*materials?\b/i,
      /\bagrochem/i,
      /\bactive\s*ingredients?\b/i,
      /\bspeciality\s*chem/i,
      /\bindustrial\s*lubrication\b/i,
    ],
  },
  // 8. Railways & High-Speed Transit
  {
    target: "Railways & High-Speed Transit",
    patterns: [
      /\bkavach\b/i,
      /\brailways?\b/i,
      /\brail\b/i,
      /\blocTrans/i,
      /\blocmot/i,
      /\brolling\s*stock\b/i,
      /\bmetro\s*coach/i,
      /\bvande\s*bharat/i,
      /\bhigh-?speed\s*transit/i,
      /\bfreight\s*corridor/i,
      /\bwagons?\b/i,
    ],
  },
  // 9a. Semiconductor Equipment, EDA & Fabless IP
  {
    target: "Semiconductor Equipment, EDA & Fabless IP",
    patterns: [
      /\bwafer\s*fab\s*(equipment|tools?)\b/i,
      /\bwfe\b/i,
      /\blithograph/i,
      /\bsemiconductor\s*(equipment|capital|tools?|eda|design|ip)\b/i,
      /\bchip\s*design\b/i,
      /\bfabless\b/i,
      /\beda\s*(software|tools?)\b/i,
      /\basml\b/i,
      /\bapplied\s*materials\b/i,
      /\blam\s*research\b/i,
      /\bkla\s*corp/i,
      /\bsynopsys\b/i,
      /\bcadence\b/i,
    ],
  },
  // 9b. Electronics Manufacturing & Semiconductor OSAT
  {
    target: "Electronics Manufacturing & Semiconductor OSAT",
    patterns: [
      /\bsemiconductors?\b/i,
      /\bosat\b/i,
      /\batmp\b/i,
      /\bpcba?\b/i,
      /\bwafer\b/i,
      /\belectronics\s*manufacturing\b/i,
      /\bcontract\s*manufacturing\b/i,
      /\bems\b/i,
      /\bbox-?build\b/i,
    ],
  },
  // 10. Industrial Automation & Precision Engineering
  {
    target: "Industrial Automation & Precision Engineering",
    patterns: [
      /\bindustrial\s*automation\b/i,
      /\bprecision\s*engineering\b/i,
      /\bspecialty\s*engineering\b/i,
      /\brobotics?\b/i,
      /\bmotion\s*control\b/i,
      /\bcnc\b/i,
      /\bbearings?\b/i,
      /\bhydraulics?\b/i,
    ],
  },
  // 11. Telecom & Digital Networks
  {
    target: "Telecom & Digital Networks",
    patterns: [
      /\btelecom/i,
      /\boptical\s*fiber\b/i,
      /\b5g\b/i,
      /\bbroadband\b/i,
      /\bwireless\s*network/i,
    ],
  },
  // 12a. Fintech Lending, Payments & Digital Wallets
  {
    target: "Fintech Lending, Payments & Digital Wallets",
    patterns: [
      /\bbnpl\b/i,
      /\bbuy\s*now\s*pay\s*later\b/i,
      /\bdigital\s*wallets?\b/i,
      /\bpayment\s*gateway\b/i,
      /\bpayment\s*processing\b/i,
      /\bpayment\s*networks?\b/i,
      /\bmerchant\s*acquiring\b/i,
      /\bfintech\s*lending\b/i,
      /\balternative\s*lending\b/i,
    ],
  },
  // 12. Banking & Credit Expansion
  {
    target: "Banking & Credit Expansion",
    patterns: [
      /\bcommercial\s*bank/i,
      /\bcredit\s*expansion\b/i,
      /\bretail\s*lending\b/i,
      /\bcorporate\s*lending\b/i,
      /\bcredit\s*growth\b/i,
      /\bbanking\b/i,
      /\bbanks?\b/i,
    ],
  },
  // 12b. Financial Services & Wealth Ecosystem
  {
    target: "Financial Services & Wealth Ecosystem",
    patterns: [
      /\bfinancial\s*services\b/i,
      /\bfinance\b/i,
      /\bnbfcs?\b/i,
      /\blending\b/i,
      /\bdiversified\s*financial/i,
    ],
  },
  // 13. Capital Markets & Wealth Ecosystem
  {
    target: "Capital Markets & Wealth Ecosystem",
    patterns: [
      /\bcapital\s*markets?\b/i,
      /\bwealth\s*management\b/i,
      /\bamc\b/i,
      /\bdepositor(y|ies)\b/i,
      /\bstock\s*broker/i,
      /\bfinancialization\b/i,
    ],
  },
  // 14a. Residential Homebuilding & Building Products
  {
    target: "Residential Homebuilding & Building Products",
    patterns: [
      /\bhomebuild(er|ers|ing)?\b/i,
      /\bsingle-family\s*home/i,
      /\bresidential\s*construction\b/i,
      /\bhome\s*improvement\b/i,
      /\bhousing\s*construction\b/i,
    ],
  },
  // 14. Infrastructure, Real Estate & Construction
  {
    target: "Infrastructure, Real Estate & Construction",
    patterns: [
      /\bcement\b/i,
      /\bconstruction\b/i,
      /\bbuilding\s*materials?\b/i,
      /\bcivil\s*infra/i,
      /\breal\s*estate\b/i,
      /\bheavy\s*civil\b/i,
      /\bwater\s*(&|and)?\s*sanitation\b/i,
      /\bsanitation\s*infra/i,
      /\bwater\s*supply\b/i,
    ],
  },
  // 15. Critical Minerals & Energy Transition Metals
  {
    target: "Critical Minerals & Energy Transition Metals",
    patterns: [
      /\bcritical\s*minerals?\b/i,
      /\btransition\s*metals?\b/i,
      /\bcopper\b/i,
      /\baluminium\b/i,
      /\blithium\b/i,
      /\brare\s*earths?\b/i,
      /\bmining\s*(&|and)\s*minerals?\b/i,
    ],
  },
  // 16. Hydrocarbon Security & Gas Grid Expansion
  {
    target: "Hydrocarbon Security & Gas Grid Expansion",
    patterns: [
      /\bgas\s*grid\b/i,
      /\bhydrocarbon/i,
      /\blng\s*terminal/i,
      /\boil\s*(&|and)\s*gas\b/i,
      /\bcity\s*gas\b/i,
      /\bpipeline\s*infra/i,
    ],
  },
  // 17. Branded Jewellery Formalization
  {
    target: "Branded Jewellery Formalization",
    patterns: [
      /\bjeweller(y|ies)\b/i,
      /\bgold\s*retail\b/i,
      /\bdiamond\b/i,
    ],
  },
  // 18. Direct-to-Consumer Clean Beauty
  {
    target: "Direct-to-Consumer Clean Beauty",
    patterns: [
      /\bclean\s*beauty\b/i,
      /\bpersonal\s*care\b/i,
      /\bcosmetics?\b/i,
      /\bd2c\b/i,
      /\bdirect-to-consumer\b/i,
      /\bdigital-first\b/i,
    ],
  },
  // 19. Shipbuilding & Marine Logistics
  {
    target: "Shipbuilding & Marine Logistics",
    patterns: [
      /\bshipbuild/i,
      /\bdrydock/i,
      /\bmarine\s*logistics\b/i,
      /\bnaval\s*vessel/i,
    ],
  },
  // 20. Commercial Vehicle & Capex Credit Expansion
  {
    target: "Commercial Vehicle & Capex Credit Expansion",
    patterns: [
      /\bcommercial\s*vehicle\s*credit\b/i,
      /\bcv\s*credit\b/i,
      /\bfleet\s*credit\b/i,
      /\bfleet\s*finance\b/i,
      /\bcapex\s*credit\b/i,
    ],
  },
  // 20a. Digital AdTech, Streaming & Connected Media
  {
    target: "Digital AdTech, Streaming & Connected Media",
    patterns: [
      /\badtech\b/i,
      /\bdigital\s*ad(vertising)?\b/i,
      /\bprogrammatic\s*ad/i,
      /\bconnected\s*tv\b/i,
      /\bctv\b/i,
      /\bstreaming\s*(media|video|entertainment)\b/i,
      /\bdigital\s*streaming\b/i,
    ],
  },
  // 21. Hospital Healthcare & Diagnostics
  {
    target: "Hospital Healthcare & Diagnostics",
    patterns: [
      /\bhospitals?\b/i,
      /\bdiagnostics?\b/i,
      /\bpatholog/i,
      /\bmedical\s*devices?\b/i,
    ],
  },
  // 22a. Cloud Resiliency & Cybersecurity
  {
    target: "Cloud Resiliency & Cybersecurity",
    patterns: [
      /\bcybersecurity\b/i,
      /\bcyber\s*security\b/i,
      /\binfosec\b/i,
      /\bcloud\s*security\b/i,
      /\bzero\s*trust\b/i,
      /\bendpoint\s*security\b/i,
      /\bnetwork\s*security\b/i,
      /\bcloud\s*resiliency\b/i,
      /\bsiem\b/i,
      /\bidentity\s*security\b/i,
    ],
  },
  // 22b. Enterprise SaaS & Cloud Platforms
  {
    target: "Enterprise SaaS & Cloud Platforms",
    patterns: [
      /\bsaas\b/i,
      /\bsoftware-as-a-service\b/i,
      /\benterprise\s*saas\b/i,
      /\bb2b\s*saas\b/i,
      /\bcloud\s*software\b/i,
      /\benterprise\s*software\b/i,
      /\bcrm\s*(platform|software)\b/i,
      /\bhcm\s*(platform|software)\b/i,
      /\berp\s*software\b/i,
      /\bcloud\s*applications?\b/i,
    ],
  },
  // 22c. Digital Transformation & Cloud Modernization
  {
    target: "Digital Transformation & Cloud Modernization",
    patterns: [
      /\bdigital\s*transformation\b/i,
      /\bcloud\s*modernization\b/i,
      /\bit\s*services\b/i,
      /\bit\s*consulting\b/i,
      /\bsystem\s*integration\b/i,
      /\btechnology\s*services\b/i,
    ],
  },
];

/**
 * Valid Value Chain Roles for Institutional Thematic Vectors
 */
export const VALID_VALUE_CHAIN_ROLES = [
  "Brand / Maker",
  "Equipment Maker",
  "Parts Supplier",
  "Lender / Bank",
  "Platform / Exchange",
  "Utility / Grid",
  // Backwards compatibility mappings
  "Direct OEM",
  "Pick-and-Shovel Enabler",
  "Component Supplier",
  "Infrastructure Provider",
  "Financier / Capital Provider",
  "Platform / Marketplace",
];

export const VALID_CONVICTIONS = ["High", "Medium", "Secondary"];

/**
 * Normalizes verbose LLM outputs into clean, standardized institutional baskets.
 * 1. Checks exact match against canonical themes and known aliases.
 * 2. Applies intelligent semantic keyword pattern clustering.
 * 3. Strips filler suffixes (Development, Growth, Solutions, etc.) and re-checks.
 * 4. Preserves novel first-principles themes cleanly in Title Case.
 */
export function normalizeMacroTheme(rawTheme) {
  if (!rawTheme || typeof rawTheme !== "string") return "";
  let theme = rawTheme.trim();
  const rawLower = theme.toLowerCase();

  // 1. Direct match in aliases on raw input (prioritize specific aliasing)
  if (THEME_ALIASES[rawLower]) {
    return THEME_ALIASES[rawLower];
  }

  // 2. Exact canonical match on raw input
  const exact = CANONICAL_MACRO_THEMES.find((c) => c.toLowerCase() === rawLower);
  if (exact) return exact;

  // 3. Intelligent Cluster Pattern Matching (semantic keyword clustering)
  for (const cluster of CLUSTER_PATTERNS) {
    for (const pattern of cluster.patterns) {
      if (pattern.test(rawLower)) {
        return cluster.target;
      }
    }
  }

  // 4. Strip generic filler suffixes often appended by LLMs
  theme = theme
    .replace(/\s+(Development|Growth|Transition|Manufacturing|Solutions|Initiatives|Expansion|Ecosystem|Services)$/i, "")
    .replace(/\s+(&|and|-)\s*$/i, "")
    .trim();

  const cleanedLower = theme.toLowerCase();

  if (THEME_ALIASES[cleanedLower]) {
    return THEME_ALIASES[cleanedLower];
  }

  const cleanedExact = CANONICAL_MACRO_THEMES.find((c) => c.toLowerCase() === cleanedLower);
  if (cleanedExact) return cleanedExact;

  for (const cluster of CLUSTER_PATTERNS) {
    for (const pattern of cluster.patterns) {
      if (pattern.test(cleanedLower)) {
        return cluster.target;
      }
    }
  }

  // 5. Dynamic formatting: Convert to clean Title Case, preserving novel first-principles themes
  const words = theme.split(/\s+/).filter(Boolean);
  const cappedWords = words.length > 6 ? words.slice(0, 5) : words;

  return cappedWords
    .map((w) => {
      const lower = w.toLowerCase();
      if (lower === "&" || lower === "and") return "&";
      if (lower === "of" || lower === "for" || lower === "in" || lower === "to") return lower;
      // Preserve acronyms, numbers, and technical terms like AI, EV, GLP-1, 765kV, OSAT, CDMO
      if (/^[A-Z0-9-]+$/i.test(w) && (w === w.toUpperCase() || w.includes("-") || /\d/.test(w))) {
        return w;
      }
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
}

/**
 * Normalizes a single thematic exposure vector object.
 * Returns null if invalid.
 */
export function normalizeThematicVector(vec) {
  if (!vec || typeof vec !== "object") return null;
  const rawTheme = typeof vec.theme === "string" ? vec.theme.trim() : "";
  if (!rawTheme) return null;

  const normalizedTheme = normalizeMacroTheme(rawTheme) || rawTheme;

  // Standardize Role: Preserve exact valid role if present, otherwise map to clean role
  let role = typeof vec.role === "string" ? vec.role.trim() : "";
  const exactRole = VALID_VALUE_CHAIN_ROLES.find((r) => r.toLowerCase() === role.toLowerCase());
  if (exactRole) {
    role = exactRole;
  } else {
    const roleLower = role.toLowerCase();
    if (roleLower.includes("lender") || roleLower.includes("bank") || roleLower.includes("credit") || roleLower.includes("financier") || roleLower.includes("capital")) {
      role = "Lender / Bank";
    } else if (roleLower.includes("platform") || roleLower.includes("exchange") || roleLower.includes("marketplace") || roleLower.includes("depository") || roleLower.includes("auction")) {
      role = "Platform / Exchange";
    } else if (roleLower.includes("enabler") || roleLower.includes("pick") || roleLower.includes("shovel")) {
      role = "Pick-and-Shovel Enabler";
    } else if (roleLower.includes("equipment") || roleLower.includes("generator") || roleLower.includes("machine") || roleLower.includes("chiller") || roleLower.includes("plant")) {
      role = "Equipment Maker";
    } else if (roleLower.includes("part") || roleLower.includes("component") || roleLower.includes("supplier") || roleLower.includes("cable") || roleLower.includes("wire") || roleLower.includes("subsystem")) {
      role = "Parts Supplier";
    } else if (roleLower.includes("utility") || roleLower.includes("grid") || roleLower.includes("transmission line") || roleLower.includes("pipeline") || roleLower.includes("infra")) {
      role = "Utility / Grid";
    } else if (roleLower.includes("brand") || roleLower.includes("maker") || roleLower.includes("oem") || roleLower.includes("manufacturer") || roleLower.includes("retailer") || roleLower.includes("prime")) {
      role = "Brand / Maker";
    } else {
      role = "Parts Supplier";
    }
  }

  // Standardize Conviction
  let conviction = typeof vec.conviction === "string" ? vec.conviction.trim() : "High";
  const convLower = conviction.toLowerCase();
  if (convLower.includes("high")) conviction = "High";
  else if (convLower.includes("med")) conviction = "Medium";
  else if (convLower.includes("sec") || convLower.includes("low")) conviction = "Secondary";
  else conviction = "High";

  const thesis = typeof vec.thesis === "string" ? vec.thesis.trim() : "";
  const subFocus = typeof vec.subFocus === "string" ? vec.subFocus.trim() : "";

  return {
    theme: normalizedTheme,
    subFocus,
    role,
    conviction,
    thesis,
  };
}

/**
 * Normalizes an array of thematic vectors, deduplicating duplicate themes.
 */
export function normalizeThematicVectors(vectors) {
  if (!Array.isArray(vectors)) return [];
  const seen = new Set();
  const normalized = [];

  for (const v of vectors) {
    const norm = normalizeThematicVector(v);
    if (norm && norm.theme) {
      const key = norm.theme.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        normalized.push(norm);
      }
    }
  }
  return normalized;
}

/**
 * Extracts or synthesizes a normalized list of thematic vectors for a stock.
 * Guaranteed to return an array of { theme, subFocus, role, conviction, thesis }.
 */
export function extractStockThematicVectors(stock) {
  if (!stock) return [];
  if (Array.isArray(stock.thematicVectors) && stock.thematicVectors.length > 0) {
    const rawVectors = stock.thematicVectors;
    const catalysts = Array.isArray(stock.dependentIndustries)
      ? stock.dependentIndustries
      : typeof stock.dependentIndustries === "string"
      ? stock.dependentIndustries.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    return normalizeThematicVectors(
      rawVectors.map((v, idx) => {
        // Infer subFocus if not explicitly provided
        let subFocus = v.subFocus || "";
        if (!subFocus && catalysts[idx]) {
          subFocus = catalysts[idx];
        } else if (!subFocus && catalysts[0]) {
          subFocus = catalysts[0];
        } else if (!subFocus && stock.businessScope && stock.businessScope[0]) {
          subFocus = stock.businessScope[0];
        }
        return {
          ...v,
          subFocus,
        };
      })
    );
  }

  // Graceful fallback synthesis for stocks without multi-thematic vectors (legacy/cached data)
  let candidateTheme = stock.macroTheme || "";

  // Check if stock.sector normalizes to a specific canonical theme
  const sectorNormalized = stock.sector ? normalizeMacroTheme(stock.sector) : "";

  // If candidateTheme is missing OR is a generic blunt umbrella bucket,
  // but stock.sector normalizes to a specific thematic cluster, prefer the specific sector cluster
  const isGenericBucket =
    !candidateTheme ||
    candidateTheme.toLowerCase() === "consumer discretionary" ||
    candidateTheme.toLowerCase() === "consumer retail" ||
    candidateTheme.toLowerCase() === "consumer & retail" ||
    candidateTheme.toLowerCase() === "consumer, retail & lifestyle" ||
    candidateTheme.toLowerCase() === "consumer goods" ||
    candidateTheme.toLowerCase() === "retail" ||
    candidateTheme.toLowerCase() === "financial services" ||
    candidateTheme.toLowerCase() === "industrials" ||
    candidateTheme.toLowerCase() === "services";

  if (isGenericBucket && sectorNormalized && sectorNormalized !== stock.sector && sectorNormalized !== "Consumer & Retail") {
    candidateTheme = sectorNormalized;
  } else if (!candidateTheme) {
    if (sectorNormalized && sectorNormalized !== stock.sector) {
      candidateTheme = sectorNormalized;
    } else if (Array.isArray(stock.dependentIndustries) && stock.dependentIndustries[0]) {
      candidateTheme = stock.dependentIndustries[0];
    } else {
      candidateTheme = stock.sector || "";
    }
  }

  if (candidateTheme && candidateTheme.trim()) {
    const normalized = normalizeMacroTheme(candidateTheme.trim()) || candidateTheme.trim();
    const catalyst = Array.isArray(stock.dependentIndustries) && stock.dependentIndustries.length > 0
      ? stock.dependentIndustries.join(", ")
      : "";
    const subFocus = (Array.isArray(stock.dependentIndustries) && stock.dependentIndustries[0]) ||
      (Array.isArray(stock.businessScope) && stock.businessScope[0]) ||
      "";

    let role = "Pick-and-Shovel Enabler";
    if (
      normalized === "Branded Jewellery Formalization" ||
      normalized === "Consumer Brands & FMCG" ||
      normalized === "Direct-to-Consumer Clean Beauty" ||
      normalized === "Hospitality, Travel & Aviation"
    ) {
      role = "Brand / Maker";
    } else if (
      normalized.includes("Bank") ||
      normalized.includes("Credit") ||
      normalized === "Financial Services & Wealth Ecosystem"
    ) {
      role = "Lender / Bank";
    }

    return [{
      theme: normalized,
      subFocus,
      role,
      conviction: "High",
      thesis: catalyst ? `Primary exposure driven by ${catalyst}` : `Core commercial exposure to ${normalized}`,
    }];
  }

  return [];
}

/**
 * Extracts all unique normalized macro theme names associated with a stock
 * (combining both primary macroTheme and any connected thematicVectors).
 */
export function extractStockThematicThemes(stock) {
  if (!stock) return [];
  const vectors = extractStockThematicVectors(stock);
  if (vectors && vectors.length > 0) {
    return Array.from(new Set(vectors.map((v) => v.theme).filter(Boolean)));
  }
  return [];
}
