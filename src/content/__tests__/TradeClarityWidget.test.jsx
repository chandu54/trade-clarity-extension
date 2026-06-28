import React from 'react';
import { describe, it, vi, beforeEach, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TradeClarityWidget from '../TradeClarityWidget';

describe('TradeClarityWidget', () => {
  const mockAppData = {
    paramDefinitions: {
      volume: { type: 'number', filterable: true, label: 'Volume' },
      rs: { type: 'number', filterable: true, label: 'RS' }
    },
    uiConfig: {
      columnVisibility: { volume: true, rs: true }
    },
    weeks: {
      IN: {
        '2026-06-21': {
          stocks: {
            RELIANCE: {
              symbol: 'RELIANCE',
              sector: 'Energy',
              params: { volume: 100, rs: 85 },
              notes: 'Watch breakout'
            }
          }
        }
      }
    }
  };

  beforeEach(() => {
    document.title = "RELIANCE - Reliance Industries Ltd."; // Set page title matching ticker symbol format
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders and defaults to minimized toggle button', () => {
    const { container } = render(<TradeClarityWidget />);
    const toggleBtn = container.querySelector('.trade-clarity-fab-fixed');
    expect(toggleBtn).toBeInTheDocument();
  });

  it('opens panel and displays loading states or fallback message', () => {
    const { container } = render(<TradeClarityWidget />);
    const toggleBtn = container.querySelector('.trade-clarity-fab-fixed');
    fireEvent.click(toggleBtn);

    // Verify workspace is opened
    expect(screen.getByText('TradeClarity')).toBeInTheDocument();
    // Default symbol is from document.title, which matches "RELIANCE"
    expect(screen.getByText('RELIANCE')).toBeInTheDocument();
  });

  it('supports localStorage fallback when chrome storage is not defined (negative scenario)', () => {
    localStorage.setItem('trading_app_data', JSON.stringify(mockAppData));
    const { container } = render(<TradeClarityWidget />);
    
    const toggleBtn = container.querySelector('.trade-clarity-fab-fixed');
    fireEvent.click(toggleBtn);

    // Should render loaded RELIANCE stock data directly from fallback localStorage
    expect(screen.getByText('RELIANCE')).toBeInTheDocument();
    expect(screen.getByText('Watch breakout')).toBeInTheDocument();
  });
});
