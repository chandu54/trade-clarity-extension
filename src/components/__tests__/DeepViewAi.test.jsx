import { describe, it, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import DeepViewAi from '../DeepViewAi';
import * as aiService from '../../services/ai';

// Mock the AI service
vi.mock('../../services/ai', () => ({
  getAiAnalysis: vi.fn(),
  PROMPT_TEMPLATES: []
}));

describe('DeepViewAi', () => {
  const props = {
    categoryName: 'Tech',
    symbols: ['AAPL', 'MSFT'],
    weekData: { US: {} },
    aiSettings: { apiKey: 'test-key' },
    stockData: [
      { symbol: 'AAPL', periodChangePct: 5.2, isAdvancing: true },
      { symbol: 'MSFT', periodChangePct: -1.2, isAdvancing: false }
    ]
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', async () => {
    // Return a promise that doesn't resolve immediately
    aiService.getAiAnalysis.mockReturnValue(new Promise(() => {}));
    
    render(<DeepViewAi {...props} />);
    expect(screen.getByText(/Generating Research for Tech/i)).toBeDefined();
  });

  it('renders analysis text correctly after loading', async () => {
    const mockResponse = { rawText: '### Executive Summary\n\n- Point 1\n- Point 2\n\n**Bold Text**' };
    aiService.getAiAnalysis.mockResolvedValue(mockResponse);

    await act(async () => {
      render(<DeepViewAi {...props} />);
    });

    expect(screen.getByText('Executive Summary')).toBeDefined();
    expect(screen.getByText('Point 1')).toBeDefined();
    expect(screen.getByText('Bold Text')).toBeDefined();
    expect(screen.queryByText(/Generating Research/i)).toBeNull();
  });

  it('renders error message if AI analysis fails', async () => {
    aiService.getAiAnalysis.mockRejectedValue(new Error('AI overlap error'));

    await act(async () => {
      render(<DeepViewAi {...props} />);
    });

    expect(screen.getByText('Analysis Failed')).toBeDefined();
    expect(screen.getByText('AI overlap error')).toBeDefined();
  });

  it('shows error if no symbols provided', async () => {
    render(<DeepViewAi {...props} symbols={[]} />);
    expect(screen.getByText(/No stocks available for analysis/i)).toBeDefined();
  });
});
