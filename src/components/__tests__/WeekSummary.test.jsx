import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WeekSummary from '../WeekSummary';

describe('WeekSummary', () => {
  const mockData = {
    paramDefinitions: {
      volume: { type: 'number', filterable: true, isCheck: true },
      rs: { type: 'number', filterable: true, isCheck: true }
    },
    uiConfig: {
      columnVisibility: { volume: true, rs: true }
    },
    weeks: {
      US: {
        '2026-06-21': {
          stocks: {
            AAPL: { symbol: 'AAPL', sector: 'Technology', params: { volume: 100, rs: 85 }, tradable: true },
            MSFT: { symbol: 'MSFT', sector: 'Technology', params: { volume: 50, rs: 40 }, tradable: false }
          }
        }
      }
    }
  };

  const props = {
    data: mockData,
    weekKey: '2026-06-21',
    country: 'US'
  };

  it('calculates and renders advances, declines, and check summaries correctly in the popup', () => {
    render(<WeekSummary {...props} />);
    
    // The popup should be closed initially
    expect(screen.queryByText('Weekly Summary')).toBeNull();
    
    // Hover/Click icon to open popup
    const icon = screen.getByTitle('Weekly Summary');
    fireEvent.click(icon);
    
    // Check popup content
    expect(screen.getByText('Weekly Summary')).toBeInTheDocument();
    expect(screen.getByText('Top Sectors Summary')).toBeInTheDocument();
    expect(screen.getByText('Technology - 2 stocks')).toBeInTheDocument();
  });
});
