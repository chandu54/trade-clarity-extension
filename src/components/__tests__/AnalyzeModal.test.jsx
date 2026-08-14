import { describe, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AnalyzeModal from '../AnalyzeModal';
import { ToastContext } from '../ToastContext';
import * as aiService from '../../services/ai';

// Mock AI service
vi.mock('../../services/ai', () => ({
  getAiAnalysis: vi.fn(),
  PROMPT_TEMPLATES: [
    { value: 'swing', label: 'Swing Trading (Default)', text: 'Swing prompt' },
    { value: 'day', label: 'Day Trading Focus', text: 'Day prompt' }
  ]
}));

const mockShowToast = vi.fn();

const renderWithContext = (ui) => {
  return render(
    <ToastContext.Provider value={{ showToast: mockShowToast }}>
      {ui}
    </ToastContext.Provider>
  );
};

describe('AnalyzeModal', () => {
  const mockData = {
    aiSettings: {
      apiKey: 'test-key',
      model: 'test-model',
      systemPrompt: 'Swing prompt',
      customPrompts: []
    },
    weeks: {
      US: {
        '2024-03-17': {
          stocks: { AAPL: { symbol: 'AAPL', watchlists: ['wl1'] } },
          analysis: null
        }
      }
    },
    paramDefinitions: {}
  };

  const props = {
    isOpen: true,
    onClose: vi.fn(),
    data: mockData,
    setData: vi.fn(),
    weekKey: '2024-03-17',
    country: 'US',
    selectedWatchlistId: 'all'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly when open', () => {
    renderWithContext(<AnalyzeModal {...props} />);
    expect(screen.getByText(/AI Watchlist Intelligence Briefing/)).toBeDefined();
    expect(screen.getByText('Ready to generate decision intelligence briefing.')).toBeDefined();
  });

  it('calls getAiAnalysis and updates data on successful generation', async () => {
    const mockAnalysis = { marketBias: 'Bullish', topSectors: [], actionableSetups: [], keyRisks: [] };
    aiService.getAiAnalysis.mockResolvedValue(mockAnalysis);

    renderWithContext(<AnalyzeModal {...props} />);
    
    const generateBtn = screen.getByRole('button', { name: /Run Analysis/i });
    fireEvent.click(generateBtn);

    expect(screen.getByText('Compiling Decision Intelligence Briefing...')).toBeDefined();

    await waitFor(() => {
      expect(aiService.getAiAnalysis).toHaveBeenCalled();
    });
    expect(props.setData).toHaveBeenCalled();
  });

  it('renders the 5 decision intelligence pillars and opens in-modal thesis drawer', async () => {
    const mockStructuredAnalysis = {
      watchlistDiagnosis: {
        stance: 'Full Position Sizing on Base Breakouts',
        score: 84,
        percentAbove20EMA: 78,
        percentAbove50EMA: 70,
        institutionalTone: 'Persistent accumulation in defense',
        allocationGuidance: 'Focus 70% capital allocation on high-RS base breakouts'
      },
      sectorMatrix: [{ sector: 'Defense & Aerospace', stockCount: 6, status: 'Leading', narrativeDriver: 'Strong order book expansion' }],
      focusCandidates: [{ symbol: 'SOLARINDS', rsRank: 94, pattern: 'VCP Breakout', pivotTrigger: 'Cross above 7,150', stopLoss: '6,850', targetPrice: '8,800', riskReward: '1:3.8', thesis: 'RS line making new highs before price' }],
      actionTriage: {
        buyZone: [{ symbol: 'SOLARINDS', notes: 'Tight VCP base' }],
        extended: [],
        avoidCut: []
      },
      watchouts: ['Earnings releases in 14 days']
    };

    const dataWithAnalysis = {
      ...mockData,
      weeks: {
        US: {
          '2024-03-17': {
            stocks: { AAPL: { symbol: 'AAPL' } },
            analysis: mockStructuredAnalysis
          }
        }
      }
    };

    renderWithContext(<AnalyzeModal {...props} data={dataWithAnalysis} />);

    expect(screen.getByText('Market Breadth & Allocation Stance')).toBeDefined();
    expect(screen.getByText('Full Position Sizing on Base Breakouts')).toBeDefined();
    expect(screen.getByText('Defense & Aerospace')).toBeDefined();
    expect(screen.getAllByText('SOLARINDS')[0]).toBeDefined();

    // Click candidate card to open in-modal deep dive thesis drawer
    fireEvent.click(screen.getByText('Deep Dive Thesis →'));
    expect(screen.getByText('Tactical Setup Thesis: SOLARINDS')).toBeDefined();
    expect(screen.getAllByText('RS line making new highs before price')[0]).toBeDefined();

    // Close thesis drawer
    fireEvent.click(screen.getByText('Close Deep Dive'));
    expect(screen.queryByText('Tactical Setup Thesis: SOLARINDS')).toBeNull();
  });

  it('shows error toast if generation fails', async () => {
    aiService.getAiAnalysis.mockRejectedValue(new Error('API Error'));

    renderWithContext(<AnalyzeModal {...props} />);
    
    fireEvent.click(screen.getByRole('button', { name: /Run Analysis/i }));

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('API Error', 'error');
    });
  });

  it('filters stocks by watchlist if selectedWatchlistId is set', async () => {
    aiService.getAiAnalysis.mockResolvedValue({ text: 'Done' });
    const propsWithWl = { ...props, selectedWatchlistId: 'wl1' };
    
    renderWithContext(<AnalyzeModal {...propsWithWl} />);
    
    fireEvent.click(screen.getByRole('button', { name: /Run Analysis/i }));

    await waitFor(() => {
        expect(aiService.getAiAnalysis).toHaveBeenCalled();
    });

    const callArgs = aiService.getAiAnalysis.mock.calls[0][2];
    expect(Object.keys(callArgs.stocks)).toContain('AAPL');
  });

  it('allows viewing and closing the prompt instructions', () => {
    renderWithContext(<AnalyzeModal {...props} />);
    
    fireEvent.click(screen.getByTitle('View Strategy Prompt Instructions'));
    expect(screen.getByText('Strategy Instructions')).toBeDefined();
    
    fireEvent.click(screen.getByText('Close'));
    expect(screen.queryByText('Strategy Instructions')).toBeNull();
  });
});
