import React from 'react';
import { describe, it, vi, beforeEach, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ScreenerView from '../ScreenerView';
import * as nseIpoService from '../../services/nseIpoService';
import * as usIpoService from '../../services/usIpoService';

vi.mock('../../services/nseIpoService', () => ({
  fetchNseIpoDirectory: vi.fn(),
  hydrateIpoMetricsList: vi.fn(),
}));

vi.mock('../../services/usIpoService', () => ({
  fetchUsIpoDirectory: vi.fn(),
  hydrateUsIpoMetricsList: vi.fn(),
}));

describe('ScreenerView', () => {
  const mockDirectory = [
    {
      symbol: 'BAJAJHFL',
      name: 'Bajaj Housing Finance Limited',
      series: 'EQ',
      isSme: false,
      listingDateStr: '16-SEP-2024',
      listingTimestamp: Date.now() - 10 * 86400000,
      daysAgo: 10,
      defaultTag: 'Young IPO',
    },
    {
      symbol: 'KRN',
      name: 'KRN Heat Exchanger Limited',
      series: 'EQ',
      isSme: false,
      listingDateStr: '03-OCT-2024',
      listingTimestamp: Date.now() - 5 * 86400000,
      daysAgo: 5,
      defaultTag: 'Young IPO',
    },
    {
      symbol: 'TECHSOL',
      name: 'Tech Solutions SME Limited',
      series: 'SM',
      isSme: true,
      listingDateStr: '01-JUL-2024',
      listingTimestamp: Date.now() - 80 * 86400000,
      daysAgo: 80,
      defaultTag: 'Recent Listing',
    },
  ];

  const mockHydrated = [
    {
      ...mockDirectory[0],
      price: '₹165.50',
      priceVal: 165.5,
      dailyChangePct: '+4.20%',
      dailyChangeNum: 4.2,
      adr: '4.8%',
      adrNum: 4.8,
      liquidity: '₹45.2Cr',
      turnoverCr: 45.2,
      movingAverages: 'Above 10, 21',
      above10: true,
      above21: true,
      above50: false,
      vcp: 'Tight (2.4%)',
      vcpTight: true,
      isIpoBase: true,
      ipoStatus: 'IPO Base (Breakout)',
      listingDayGainPct: '+18.5%',
      listingDayGainNum: 18.5,
      gainSinceListingPct: '+35.2%',
      gainSinceListingNum: 35.2,
    },
    {
      ...mockDirectory[1],
      price: '₹480.00',
      priceVal: 480.0,
      dailyChangePct: '-1.50%',
      dailyChangeNum: -1.5,
      adr: '5.2%',
      adrNum: 5.2,
      liquidity: '₹12.8Cr',
      turnoverCr: 12.8,
      movingAverages: 'Below All MAs',
      above10: false,
      above21: false,
      above50: false,
      vcp: 'Moderate',
      vcpTight: false,
      isIpoBase: false,
      ipoStatus: 'Young IPO',
    },
    {
      ...mockDirectory[2],
      price: '₹95.00',
      priceVal: 95.0,
      dailyChangePct: '+0.50%',
      dailyChangeNum: 0.5,
      adr: '3.1%',
      adrNum: 3.1,
      liquidity: '₹3.5Cr',
      turnoverCr: 3.5,
      movingAverages: 'Above 10, 21, 50',
      above10: true,
      above21: true,
      above50: true,
      vcp: 'Tight (3.1%)',
      vcpTight: true,
      isIpoBase: false,
      ipoStatus: 'Recent Listing',
    },
  ];

  const defaultProps = {
    country: 'IN',
    onSwitchCountry: vi.fn(),
    currentWeekKey: '2024-09-15',
    currentWeekStocks: {},
    onImportStocks: vi.fn(),
    onNavigateToWatchlist: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    nseIpoService.fetchNseIpoDirectory.mockResolvedValue(mockDirectory);
    nseIpoService.hydrateIpoMetricsList.mockResolvedValue(mockHydrated);
    usIpoService.fetchUsIpoDirectory.mockResolvedValue([
      {
        symbol: 'RDDT',
        name: 'Reddit, Inc.',
        series: 'NYSE',
        isSme: false,
        listingDateStr: '21-MAR-2024',
        listingTimestamp: Date.now() - 170 * 86400000,
        daysAgo: 170,
        defaultTag: 'Active IPO',
      },
    ]);
    usIpoService.hydrateUsIpoMetricsList.mockResolvedValue([
      {
        symbol: 'RDDT',
        name: 'Reddit, Inc.',
        series: 'NYSE',
        isSme: false,
        price: '$65.50',
        priceVal: 65.5,
        dailyChangePct: '+3.20%',
        dailyChangeNum: 3.2,
        listingDateStr: '21-MAR-2024',
        listingTimestamp: Date.now() - 170 * 86400000,
        daysAgo: 170,
        defaultTag: 'Active IPO',
        listingDayGainPct: '+48.0%',
        listingDayGainNum: 48.0,
        gainSinceListingPct: '+30.0%',
        gainSinceListingNum: 30.0,
        adr: '5.5%',
        adrNum: 5.5,
        liquidity: '$250.0M/day',
        turnoverCr: 250.0,
        isIpoBase: true,
        vcpTight: true,
        above10: true,
        above21: true,
        above50: true,
      },
    ]);
  });

  it('fetches and renders US IPO list when country is US', async () => {
    render(<ScreenerView {...defaultProps} country="US" />);
    expect(screen.getByText('IPO Master Radar')).toBeInTheDocument();
    expect(screen.getByText(/US Exchanges/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('RDDT')).toBeInTheDocument();
    });

    expect(screen.getByText('$65.50')).toBeInTheDocument();
    expect(screen.getByText('NYSE')).toBeInTheDocument();
  });

  it('fetches and renders India IPO list on mount', async () => {
    render(<ScreenerView {...defaultProps} />);

    expect(screen.getByText('IPO Master Radar')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('BAJAJHFL')).toBeInTheDocument();
      expect(screen.getByText('KRN')).toBeInTheDocument();
      expect(screen.getByText('TECHSOL')).toBeInTheDocument();
    });

    // Check hydrated metrics
    expect(screen.getByText('Liquidity')).toBeInTheDocument();
    expect(screen.getByText('Listing Gain')).toBeInTheDocument();
    expect(screen.getByText('Since Listing')).toBeInTheDocument();
    expect(screen.getByText('₹165.50')).toBeInTheDocument();
    expect(screen.getByText('+4.20%')).toBeInTheDocument();
    expect(screen.getByText('₹45.2Cr')).toBeInTheDocument();
    expect(screen.getByText('+18.5%')).toBeInTheDocument();
    expect(screen.getByText('+35.2%')).toBeInTheDocument();
    expect(screen.getByText(/IPO Base \(Breakout\)/i)).toBeInTheDocument();
  });

  it('filters by IPO Base criteria via filter drawer', async () => {
    render(<ScreenerView {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('BAJAJHFL')).toBeInTheDocument();
    });

    // Open filter drawer
    const filterDrawerBtn = screen.getByRole('button', { name: /Filters/i });
    fireEvent.click(filterDrawerBtn);

    const ipoBaseBtn = screen.getByRole('button', { name: /IPO Base Setups/i });
    fireEvent.click(ipoBaseBtn);

    // BAJAJHFL has isIpoBase: true, KRN and TECHSOL do not
    expect(screen.getByText('BAJAJHFL')).toBeInTheDocument();
    expect(screen.queryByText('KRN')).toBeNull();
    expect(screen.queryByText('TECHSOL')).toBeNull();
  });

  it('filters by Tight VCP criteria via filter drawer', async () => {
    render(<ScreenerView {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('BAJAJHFL')).toBeInTheDocument();
    });

    // Open filter drawer
    const filterDrawerBtn = screen.getByRole('button', { name: /Filters/i });
    fireEvent.click(filterDrawerBtn);

    const tightVcpBtn = screen.getByRole('button', { name: /Tight VCP/i });
    fireEvent.click(tightVcpBtn);

    // BAJAJHFL and TECHSOL are vcpTight: true, KRN is not
    expect(screen.getByText('BAJAJHFL')).toBeInTheDocument();
    expect(screen.getByText('TECHSOL')).toBeInTheDocument();
    expect(screen.queryByText('KRN')).toBeNull();
  });

  it('handles stock selection and triggers onImportStocks', async () => {
    render(<ScreenerView {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('BAJAJHFL')).toBeInTheDocument();
    });

    // Click row or checkbox for BAJAJHFL
    const bajajRow = screen.getByText('BAJAJHFL').closest('tr');
    fireEvent.click(bajajRow);

    const importBtn = screen.getByRole('button', { name: /Tag & Import \(1\) to Current Week/i });
    expect(importBtn).not.toBeDisabled();

    fireEvent.click(importBtn);

    expect(defaultProps.onImportStocks).toHaveBeenCalledTimes(1);
    expect(defaultProps.onImportStocks).toHaveBeenCalledWith([mockHydrated[0]]);
  });

  it('selects and deselects all filtered stocks with header checkbox', async () => {
    render(<ScreenerView {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('BAJAJHFL')).toBeInTheDocument();
    });

    const selectAllCheckbox = screen.getByTitle('Select all filtered stocks');
    fireEvent.click(selectAllCheckbox);

    expect(
      screen.getByRole('button', { name: /Tag & Import \(3\) to Current Week/i })
    ).toBeInTheDocument();

    // Clicking header checkbox again deselects all automatically
    fireEvent.click(selectAllCheckbox);

    expect(
      screen.getByRole('button', { name: /Tag & Import \(0\) to Current Week/i })
    ).toBeDisabled();
  });

  it('filters by interactive Advances and Declines badges', async () => {
    render(<ScreenerView {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('BAJAJHFL')).toBeInTheDocument();
    });

    // Advances badge: BAJAJHFL (+4.2%) and TECHSOL (+0.5%) are up; KRN (-1.5%) is down
    const advancesBadge = screen.getByTitle('Filter by Advances (Price Up)');
    fireEvent.click(advancesBadge);

    expect(screen.getByText('BAJAJHFL')).toBeInTheDocument();
    expect(screen.getByText('TECHSOL')).toBeInTheDocument();
    expect(screen.queryByText('KRN')).toBeNull();

    // Declines badge: click declines
    const declinesBadge = screen.getByTitle('Filter by Declines (Price Down)');
    fireEvent.click(declinesBadge);

    expect(screen.getByText('KRN')).toBeInTheDocument();
    expect(screen.queryByText('BAJAJHFL')).toBeNull();
    expect(screen.queryByText('TECHSOL')).toBeNull();
  });

  it('filters by ADR Volatility criteria via free-form input in filter drawer', async () => {
    render(<ScreenerView {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('BAJAJHFL')).toBeInTheDocument();
    });

    const filterDrawerBtn = screen.getByRole('button', { name: /Filters/i });
    fireEvent.click(filterDrawerBtn);

    // Filter by > 5 - only KRN has adrNum = 5.2
    const adrInput = screen.getByPlaceholderText(/Filter ADR/i);
    fireEvent.change(adrInput, { target: { value: '> 5' } });

    expect(screen.getByText('KRN')).toBeInTheDocument();
    expect(screen.queryByText('BAJAJHFL')).toBeNull();
    expect(screen.queryByText('TECHSOL')).toBeNull();

    // Filter by range 4-5 - only BAJAJHFL has adrNum = 4.8
    fireEvent.change(adrInput, { target: { value: '4-5' } });
    expect(screen.getByText('BAJAJHFL')).toBeInTheDocument();
    expect(screen.queryByText('KRN')).toBeNull();
    expect(screen.queryByText('TECHSOL')).toBeNull();
  });

  it('filters by Liquidity Turnover criteria via free-form input in filter drawer', async () => {
    render(<ScreenerView {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('BAJAJHFL')).toBeInTheDocument();
    });

    const filterDrawerBtn = screen.getByRole('button', { name: /Filters/i });
    fireEvent.click(filterDrawerBtn);

    // Filter by >= 20 - only BAJAJHFL has turnoverCr = 45.2
    const liqInput = screen.getByPlaceholderText(/Filter turnover/i);
    fireEvent.change(liqInput, { target: { value: '>= 20' } });

    expect(screen.getByText('BAJAJHFL')).toBeInTheDocument();
    expect(screen.queryByText('KRN')).toBeNull();
    expect(screen.queryByText('TECHSOL')).toBeNull();

    // Filter by range 10-20 - only KRN has turnoverCr = 12.8
    fireEvent.change(liqInput, { target: { value: '10-20' } });
    expect(screen.getByText('KRN')).toBeInTheDocument();
    expect(screen.queryByText('BAJAJHFL')).toBeNull();
    expect(screen.queryByText('TECHSOL')).toBeNull();
  });

  it('supports interactive column sorting directly from table headers', async () => {
    render(<ScreenerView {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('BAJAJHFL')).toBeInTheDocument();
    });

    // Click on Symbol column header to sort A-Z
    const symbolHeader = screen.getByTitle(/Click to sort by Symbol/i);
    fireEvent.click(symbolHeader);

    // Rows should be sorted alphabetically: BAJAJHFL, KRN, TECHSOL
    const cells = screen.getAllByRole('cell');
    const symbolCells = cells.filter((c) => ['BAJAJHFL', 'KRN', 'TECHSOL'].includes(c.textContent.trim()));
    expect(symbolCells[0].textContent.trim()).toBe('BAJAJHFL');
    expect(symbolCells[1].textContent.trim()).toBe('KRN');
    expect(symbolCells[2].textContent.trim()).toBe('TECHSOL');

    // Click on Symbol column header again to sort Z-A
    fireEvent.click(symbolHeader);
    const cellsDesc = screen.getAllByRole('cell');
    const symbolCellsDesc = cellsDesc.filter((c) => ['BAJAJHFL', 'KRN', 'TECHSOL'].includes(c.textContent.trim()));
    expect(symbolCellsDesc[0].textContent.trim()).toBe('TECHSOL');
    expect(symbolCellsDesc[1].textContent.trim()).toBe('KRN');
    expect(symbolCellsDesc[2].textContent.trim()).toBe('BAJAJHFL');
  });
});
