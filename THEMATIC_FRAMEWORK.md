# TradeClarity Thematic Architecture & Investment Framework

## 1. The Core Problem: Why Traditional Sectors Are Not Enough

In conventional market dashboards, stocks are classified strictly by textbook industry silos:
- A data center liquid cooling supplier is categorized as **Capital Goods / HVAC**.
- An optical transceiver and fiber manufacturer is categorized as **Telecom Equipment**.
- A high-power transformer and switchgear fabricator is categorized as **Electricals**.
- A GPU cloud cluster host is categorized as **IT / Software Services**.

### The Blind Spot
When institutional capital enters a major multi-year capital expenditure (CapEx) wave, money does **not** flow along rigid textbook sector lines. Instead, institutions allocate capital into **Thematic Baskets (Macro Themes)** that span across multiple traditional sectors.

If a trader looks only at textbook sectors, these companies appear disconnected. But to an institutional analyst, they all participate in the exact same economic wave and share interconnected order books.

---

## 2. The 3-Tier Thematic Architecture

TradeClarity organizes market intelligence into three distinct, non-overlapping tiers:

```
┌──────────────────────────────────────────────────────────────────┐
│                   TIER 1: SECTOR (Industry Silo)                 │
│         Standard textbook classification (IT, Pharma, Auto)      │
└────────────────────────────────┬─────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│            TIER 2: MACRO THEME (Institutional Basket)            │
│  2-4 words in Title Case. The overarching CapEx/Economic cycle.  │
│  Clusters multi-sector suppliers into a single investment bucket. │
└────────────────────────────────┬─────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│             TIER 3: BUSINESS SCOPE & SUB-CATALYSTS               │
│  • Business Scope: Factual commercial products and services      │
│  • Downstream Catalysts: Second-order demand triggers & orders   │
└──────────────────────────────────────────────────────────────────┘
```

### Tier 1: Sector
- **Definition**: The traditional industry domain (e.g. IT, Chemicals, Capital Goods, Telecom, Healthcare, Finance, Textiles).
- **Purpose**: Provides broad classification and accounting consistency.

### Tier 2: Macro Theme
- **Definition**: An overarching institutional investment basket (2–4 words in Title Case).
- **Purpose**: Clusters 3 to 15 diverse companies across the portfolio that share a common macro demand driver or CapEx cycle.
- **The "Goldilocks" Rule of Abstraction**:
  - **Not too broad**: Do not use vague umbrella terms like `"General Technology"`, `"Industry"`, or `"Business"`.
  - **Not too narrow**: Do not use micro-level project actions, temporary drivers, or single-customer protocols (e.g. do not use `"5G Rollout"`, `"Digital Transformation"`, or `"Retail Credit Growth"` as the Macro Theme — those are Sub-Catalysts).
  - **Institutional Grade**: It should read like an institutional investment basket (e.g. overarching structural themes like computing infrastructure, defense modernization, clean energy transition, healthcare delivery).

### Tier 3: Business Scope & Downstream Catalysts
- **Business Scope**: Verifiable commercial products, manufacturing lines, components, or services (min 3, up to 8–10 items). Grounded strictly in active commercial reality, not marketing buzzwords.
- **Downstream Catalysts (Dependent Industries)**: The second-order demand drivers, end-user applications, or specific commercial cycles that create order books for those products.

---

## 3. Guiding Principles for Dynamic Classification (Zero Hardcoding)

To maintain robustness across global markets (US, India, Europe, Asia) and changing economic eras, the classification is **never hardcoded into fixed enum lists**:

1. **Supply-Chain Value Tracing**:
   - Trace who the ultimate end-buyer is and what broader CapEx cycle funds their purchase.
   - Example principle: If a manufacturer produces components specifically utilized in high-density computing infrastructure, their macro theme reflects that compute/data center investment cycle, even if their textbook sector is electricals or telecom.

2. **Honesty for Traditional & Cyclical Businesses**:
   - If a company operates in traditional lines (e.g. standard cotton yarn, basic packaging corrugated boxes, commodity cement), keep it strictly honest with its real economic drivers (e.g. consumer spending, freight logistics, housing & construction).
   - Never artificially force high-tech themes onto traditional businesses.

3. **Dynamic Discovery**:
   - As new global industries emerge (e.g. commercial spaceflight, quantum computing, grid storage, synthetic biology), the AI formulates the appropriate Macro Theme dynamically from the company's verified business activities, rather than selecting from a static, outdated pre-programmed list.
