import { describe, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
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
    expect(screen.getByText('AI Analysis')).toBeDefined();
    expect(screen.getByText('Ready to generate trading insights.')).toBeDefined();
  });

  it('calls getAiAnalysis and updates data on successful generation', async () => {
    const mockAnalysis = { marketBias: 'Bullish', topSectors: [], actionableSetups: [], keyRisks: [] };
    aiService.getAiAnalysis.mockResolvedValue(mockAnalysis);

    renderWithContext(<AnalyzeModal {...props} />);
    
    const generateBtn = screen.getByRole('button', { name: /Generate Analysis/i });
    fireEvent.click(generateBtn);

    expect(screen.getByText('Generating AI Analysis...')).toBeDefined();

    await waitFor(() => {
      expect(aiService.getAiAnalysis).toHaveBeenCalled();
    });
    expect(props.setData).toHaveBeenCalled();
  });

  it('shows error toast if generation fails', async () => {
    aiService.getAiAnalysis.mockRejectedValue(new Error('API Error'));

    renderWithContext(<AnalyzeModal {...props} />);
    
    fireEvent.click(screen.getByRole('button', { name: /Generate Analysis/i }));

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('API Error', 'error');
    });
  });

  it('filters stocks by watchlist if selectedWatchlistId is set', async () => {
    aiService.getAiAnalysis.mockResolvedValue({ text: 'Done' });
    const propsWithWl = { ...props, selectedWatchlistId: 'wl1' };
    
    renderWithContext(<AnalyzeModal {...propsWithWl} />);
    
    fireEvent.click(screen.getByRole('button', { name: /Generate Analysis/i }));

    await waitFor(() => {
        expect(aiService.getAiAnalysis).toHaveBeenCalled();
    });

    // Verify that the payload passed to getAiAnalysis contained the correct stocks
    // 3rd argument is weekData (index 2)
    const callArgs = aiService.getAiAnalysis.mock.calls[0][2];
    expect(Object.keys(callArgs.stocks)).toContain('AAPL');
  });

  it('allows viewing and closing the prompt instructions', () => {
    renderWithContext(<AnalyzeModal {...props} />);
    
    fireEvent.click(screen.getByTitle('View Prompt Content'));
    expect(screen.getByText('Prompt Instructions')).toBeDefined();
    expect(screen.getByText('Swing prompt')).toBeDefined();
    
    fireEvent.click(screen.getByText('Dismiss'));
    expect(screen.queryByText('Prompt Instructions')).toBeNull();
  });
});
