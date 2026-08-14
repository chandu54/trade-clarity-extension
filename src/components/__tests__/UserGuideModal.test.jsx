import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import UserGuideModal from '../UserGuideModal';

describe('UserGuideModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onOpenModal: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders correctly and defaults to the Quick Start / Onboarding tab', () => {
    render(<UserGuideModal {...defaultProps} />);
    expect(screen.getByText('User Manual')).toBeDefined();
    expect(screen.getByRole('heading', { name: /Quick Start & Onboarding Guide/i })).toBeDefined();
    expect(screen.getByText(/Step 1: Region & Custom Watchlists Setup/i)).toBeDefined();
    expect(screen.getByText(/Step 2: Define Trading Parameters, Sectors & Rules/i)).toBeDefined();
    expect(screen.getByText(/Step 3: Add & Import Stocks into Your Watchlist/i)).toBeDefined();
    expect(screen.getByText(/Step 4: Evaluate Setup Checks & Metrics in the Interactive Grid/i)).toBeDefined();
    expect(screen.getByText(/Step 5: Set Up AI Keys & Proprietary AI Analysis/i)).toBeDefined();
    expect(screen.getByText(/Step 6: Execute & Audit Trades in the Trading Journal/i)).toBeDefined();
    expect(screen.getByText(/Step 7: Live TradingView Overlay & Hands-Free Dictation/i)).toBeDefined();
  });

  it('switches between tabs when menu items are clicked', () => {
    render(<UserGuideModal {...defaultProps} />);
    
    // Click All Settings
    fireEvent.click(screen.getByRole('button', { name: /All Settings/i }));
    expect(screen.getByRole('heading', { name: /Settings & Configurations/i })).toBeDefined();

    // Click AI & Strategy Library
    fireEvent.click(screen.getByRole('button', { name: /AI & Strategy Library/i }));
    expect(screen.getByRole('heading', { name: /AI Configurations & Prompt Library/i })).toBeDefined();

    // Click Market Pulse
    fireEvent.click(screen.getByRole('button', { name: /Market Pulse/i }));
    expect(screen.getByRole('heading', { name: /Market Pulse Guide/i })).toBeDefined();

    // Click Trading Journal
    fireEvent.click(screen.getByRole('button', { name: /Trading Journal/i }));
    expect(screen.getByRole('heading', { name: /Trading Journal Guide/i })).toBeDefined();

    // Click Quick Start / Onboarding back
    fireEvent.click(screen.getByRole('button', { name: /Quick Start \/ Onboarding/i }));
    expect(screen.getByRole('heading', { name: /Quick Start & Onboarding Guide/i })).toBeDefined();
  });

  it('triggers action button navigation callbacks', () => {
    render(<UserGuideModal {...defaultProps} />);

    const actionBtn = screen.getByRole('button', { name: /Manage Watchlists →/i });
    fireEvent.click(actionBtn);

    expect(defaultProps.onClose).toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(defaultProps.onOpenModal).toHaveBeenCalledWith('watchlists');
  });
});
