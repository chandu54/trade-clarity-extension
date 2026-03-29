import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';
import CategoryAnalysisView from '../CategoryAnalysisView';
import DeepViewAi from '../DeepViewAi';
import MiniCandlestickChart from '../MiniCandlestickChart';

// Mock the AI service
vi.mock('../../services/ai', () => ({
  getAiAnalysis: vi.fn(() => Promise.resolve({ rawText: "Mock Analysis Report" }))
}));

const mockStockData = [
  { symbol: 'ABB', currentPrice: 5000, periodChangePct: 12.5, isAdvancing: true },
  { symbol: 'NTPC', currentPrice: 200, periodChangePct: -4.2, isAdvancing: false },
  { symbol: 'RELIANCE', currentPrice: 2500, periodChangePct: 8.0, isAdvancing: true },
];

const mockTimeframe = '3mo';

describe('Category Intelligence Suite', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('CategoryAnalysisView (UI & Logic)', () => {
    it('correctly calculates breadth metrics (Advancers/Decliners)', () => {
      render(
        <CategoryAnalysisView 
          isOpen={true} 
          onClose={() => {}} 
          categoryName="Infrastructure" 
          symbols={['ABB', 'NTPC', 'RELIANCE']}
          stockData={mockStockData}
          timeframe={mockTimeframe}
        />
      );

      // Verify the breadth bar labels
      expect(screen.getByText(/Adv: 2/)).toBeInTheDocument();
      expect(screen.getByText(/Dec: 1/)).toBeInTheDocument();
    });

    it('identifies the absolute performance leader in the "Top Picks" section', () => {
      render(
        <CategoryAnalysisView 
          isOpen={true} 
          onClose={() => {}} 
          categoryName="Infrastructure" 
          symbols={['ABB', 'NTPC', 'RELIANCE']}
          stockData={mockStockData}
          timeframe={mockTimeframe}
        />
      );

      // ABB is the leader with +12.5% vs RELIANCE +8.0%
      const picks = screen.getByText(/Top Picks:/);
      expect(picks.parentElement.textContent).toContain('ABB');
      expect(picks.parentElement.textContent).toContain('12.5%');
    });
  });

  describe('DeepViewAi (Intelligence logic)', () => {
    it('maps stockData to stockMetrics correctly for the AI payload', async () => {
      const { getAiAnalysis } = await import('../../services/ai');
      
      render(
        <DeepViewAi 
          categoryName="Infrastructure" 
          symbols={['ABB', 'NTPC']}
          stockData={mockStockData}
          weekData={{}}
          aiSettings={{ apiKey: 'test-key', model: 'gemini' }}
          timeframe={mockTimeframe}
        />
      );

      // Verify getAiAnalysis was called with correctly mapped data
      expect(getAiAnalysis).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'Infrastructure',
          stockMetrics: expect.objectContaining({
            ABB: expect.objectContaining({ performance: '12.5%' }),
            NTPC: expect.objectContaining({ performance: '-4.2%' })
          })
        }),
        null,
        expect.stringContaining('Lead Institutional Research Analyst'),
        true
      );
    });

    it('enforces "No Tables" instruction in the prompt', async () => {
      const { getAiAnalysis } = await import('../../services/ai');

      render(
        <DeepViewAi 
          categoryName="Infrastructure" 
          symbols={['ABB']}
          stockData={mockStockData}
          weekData={{}}
          aiSettings={{ apiKey: 'test-key', model: 'gemini' }}
          timeframe={mockTimeframe}
        />
      );

      const sentPrompt = getAiAnalysis.mock.calls[0][2];
      expect(sentPrompt).toContain('DO NOT USE TABLES');
      expect(sentPrompt).toContain('Leadership Tier');
    });

    it('Scenario: Leadership Identification - accurately passes a single dominant leader to the AI', async () => {
      const { getAiAnalysis } = await import('../../services/ai');
      const leadershipData = [
        { symbol: 'LEADER', currentPrice: 100, periodChangePct: 25.0, isAdvancing: true },
        { symbol: 'LAGGARD_A', currentPrice: 50, periodChangePct: 1.0, isAdvancing: true },
        { symbol: 'LAGGARD_B', currentPrice: 50, periodChangePct: 0.5, isAdvancing: true },
      ];

      render(
        <DeepViewAi 
          categoryName="Growth" 
          symbols={['LEADER', 'LAGGARD_A', 'LAGGARD_B']}
          stockData={leadershipData}
          weekData={{}}
          aiSettings={{ apiKey: 'test-key', model: 'gemini' }}
        />
      );

      const payload = getAiAnalysis.mock.calls[0][0];
      expect(payload.stockMetrics['LEADER'].performance).toBe('25.0%');
      expect(payload.stockMetrics['LAGGARD_A'].performance).toBe('1.0%');
    });

    it('Scenario: Sector Trap - accurately passes a group-wide crash to the AI', async () => {
      const { getAiAnalysis } = await import('../../services/ai');
      const crashData = [
        { symbol: 'STOCK_A', currentPrice: 100, periodChangePct: -12.0, isAdvancing: false },
        { symbol: 'STOCK_B', currentPrice: 100, periodChangePct: -15.0, isAdvancing: false },
        { symbol: 'STOCK_C', currentPrice: 100, periodChangePct: -10.0, isAdvancing: false },
      ];

      render(
        <DeepViewAi 
          categoryName="Crashing Sector" 
          symbols={['STOCK_A', 'STOCK_B', 'STOCK_C']}
          stockData={crashData}
          weekData={{}}
          aiSettings={{ apiKey: 'test-key', model: 'gemini' }}
        />
      );

      const payload = getAiAnalysis.mock.calls[0][0];
      expect(payload.stockMetrics['STOCK_B'].performance).toBe('-15.0%');
      expect(payload.stockMetrics['STOCK_B'].isUp).toBe(false);
    });

    it('Scenario: Anomaly Detection - accurately passes a "Decoupled" stock to the AI', async () => {
      const { getAiAnalysis } = await import('../../services/ai');
      const anomalyData = [
        { symbol: 'ANOMALY', currentPrice: 100, periodChangePct: 8.5, isAdvancing: true },
        { symbol: 'WEAK_A', currentPrice: 100, periodChangePct: -4.0, isAdvancing: false },
        { symbol: 'WEAK_B', currentPrice: 100, periodChangePct: -5.0, isAdvancing: false },
      ];

      render(
        <DeepViewAi 
          categoryName="Weak Sector" 
          symbols={['ANOMALY', 'WEAK_A', 'WEAK_B']}
          stockData={anomalyData}
          weekData={{}}
          aiSettings={{ apiKey: 'test-key', model: 'gemini' }}
        />
      );

      const payload = getAiAnalysis.mock.calls[0][0];
      expect(payload.stockMetrics['ANOMALY'].performance).toBe('8.5%');
      expect(payload.stockMetrics['WEAK_A'].performance).toBe('-4.0%');
    });

    it('Scenario: Empty State - displays graceful error when no symbols are present', () => {
      render(
        <DeepViewAi 
          categoryName="Empty Category" 
          symbols={[]}
          stockData={[]}
          weekData={{}}
          aiSettings={{ apiKey: 'test-key', model: 'gemini' }}
        />
      );

      expect(screen.getByText(/No stocks available for analysis/)).toBeInTheDocument();
    });

    it('Scenario: API Failure - displays descriptive error when the service fails', async () => {
      const { getAiAnalysis } = await import('../../services/ai');
      getAiAnalysis.mockRejectedValueOnce(new Error("Network Timeout"));

      render(
        <DeepViewAi 
          categoryName="Infrastructure" 
          symbols={['ABB']}
          stockData={mockStockData}
          weekData={{}}
          aiSettings={{ apiKey: 'test-key', model: 'gemini' }}
        />
      );

      const errorMessage = await screen.findByText(/Network Timeout/);
      expect(errorMessage).toBeInTheDocument();
    });
  });

  describe('MiniCandlestickChart (SVGs)', () => {
    it('calculates trend path logic correctly based on price points', () => {
      const prices = [100, 110, 105, 120];
      const { container } = render(
        <MiniCandlestickChart symbol="TEST" prices={prices} timeframe="1m" />
      );

      const path = container.querySelector('.trend-path');
      expect(path).toBeDefined();
      expect(path.getAttribute('d')).toContain('M'); // Should be a valid path
    });

    it('applies green class for positive trend and red for negative', () => {
      // Positive trend (100 -> 120)
      const { container: upContainer, unmount: unmountUp } = render(
        <MiniCandlestickChart symbol="UP" prices={[100, 120]} timeframe="1m" />
      );
      expect(upContainer.querySelector('.chart-svg.up')).toBeDefined();
      unmountUp();

      // Negative trend (100 -> 80)
      const { container: downContainer } = render(
        <MiniCandlestickChart symbol="DOWN" prices={[100, 80]} timeframe="1m" />
      );
      expect(downContainer.querySelector('.chart-svg.down')).toBeDefined();
    });
  });
});
