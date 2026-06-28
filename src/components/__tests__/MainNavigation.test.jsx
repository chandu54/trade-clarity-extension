import React from 'react';
import { describe, it, vi, beforeEach, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MainNavigation from '../MainNavigation';

describe('MainNavigation', () => {
  const props = {
    activeTab: 'watchlists',
    onTabChange: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all navigation tabs', () => {
    render(<MainNavigation {...props} />);
    expect(screen.getByText('Watchlists')).toBeInTheDocument();
    expect(screen.getByText('Market Pulse')).toBeInTheDocument();
    expect(screen.getByText('Journal')).toBeInTheDocument();
  });

  it('highlights the active tab', () => {
    render(<MainNavigation {...props} />);
    const watchlistsTab = screen.getByRole('button', { name: /Watchlists/i });
    expect(watchlistsTab.className).toContain('active');
  });

  it('calls onTabChange on tab click', () => {
    render(<MainNavigation {...props} />);
    const journalTab = screen.getByRole('button', { name: /Journal/i });
    
    fireEvent.click(journalTab);
    
    expect(props.onTabChange).toHaveBeenCalledWith('journal');
  });
});
