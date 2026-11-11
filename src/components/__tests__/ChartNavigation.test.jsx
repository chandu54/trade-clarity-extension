import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MiniCandlestickChart from '../MiniCandlestickChart';
import * as yahooFinanceMap from '../../utils/yahooFinanceMap';
import * as storage from '../../services/storage';

// Mock storage
vi.mock('../../services/storage', async () => {
  const actual = await vi.importActual('../../services/storage');
  return {
    ...actual,
    getDrawingsForSymbol: vi.fn().mockResolvedValue([]),
    saveDrawingForSymbol: vi.fn().mockResolvedValue([]),
    deleteDrawingForSymbol: vi.fn().mockResolvedValue([]),
    clearDrawingsForSymbol: vi.fn().mockResolvedValue([]),
  };
});

// Mock lightweight-charts
let createdChartOptions = null;
let registeredRangeChangeCb = null;
let mockTimeScale = null;
let mockSeries = null;

vi.mock('lightweight-charts', () => {
  return {
    createChart: vi.fn((_container, options) => {
      createdChartOptions = options;
      mockTimeScale = {
        applyOptions: vi.fn(),
        fitContent: vi.fn(),
        getVisibleLogicalRange: vi.fn(() => ({ from: 0, to: 50 })),
        setVisibleLogicalRange: vi.fn(),
        subscribeVisibleLogicalRangeChange: vi.fn((cb) => {
          registeredRangeChangeCb = cb;
        }),
        subscribeVisibleTimeScaleChange: vi.fn(),
        unsubscribeVisibleTimeScaleChange: vi.fn(),
        timeToCoordinate: vi.fn(() => 100),
        coordinateToTime: vi.fn(() => 1700000000),
      };
      mockSeries = {
        setData: vi.fn(),
        applyOptions: vi.fn(),
        createPriceLine: vi.fn(),
        priceToCoordinate: vi.fn(() => 50),
        coordinateToPrice: vi.fn(() => 650),
      };
      return {
        applyOptions: vi.fn(),
        timeScale: vi.fn(() => mockTimeScale),
        addSeries: vi.fn(() => mockSeries),
        removeSeries: vi.fn(),
        remove: vi.fn(),
      };
    }),
    CandlestickSeries: 'CandlestickSeries',
    LineSeries: 'LineSeries',
    CrosshairMode: { Magnet: 1 },
  };
});

describe('TradingView & Zerodha-Grade Chart Navigation & Physics', () => {
  const generateCandles = (count, startSec = 1700000000) => {
    return Array.from({ length: count }, (_, i) => ({
      time: startSec + i * 86400,
      open: 100 + i,
      high: 105 + i,
      low: 95 + i,
      close: 102 + i,
      volume: 1000,
    }));
  };

  const sampleData = {
    symbol: 'RELIANCE',
    candlesticks: generateCandles(60),
    currentPrice: 162,
    prevClose: 160,
    _meta: { firstTradeDate: 1000000000 },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    createdChartOptions = null;
    registeredRangeChangeCb = null;
  });

  describe('Phase 1: Chart Configuration & Physics Standardization', () => {
    it('configures timeScale with professional bounded spacing and right offset without locking right edge', () => {
      render(
        <MiniCandlestickChart
          data={sampleData}
          country="IN"
          interactive={true}
        />
      );

      expect(createdChartOptions).toBeDefined();
      expect(createdChartOptions.timeScale).toMatchObject({
        visible: true,
        timeVisible: true,
        rightOffset: 12,
        minBarSpacing: 0.5,
        maxBarSpacing: 100,
        fixRightEdge: false,
        fixLeftEdge: false,
      });
    });

    it('enables dual-axis scaling, direct mouse wheel zoom, and double-click reset on both time and price axes', () => {
      render(
        <MiniCandlestickChart
          data={sampleData}
          country="IN"
          interactive={true}
        />
      );

      expect(createdChartOptions.handleScale).toMatchObject({
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: { time: true, price: true },
        axisDoubleClickReset: { time: true, price: true },
      });
    });

    it('smoothly clamps right-boundary if user attempts to drag candles into an excessive future void', async () => {
      render(
        <MiniCandlestickChart
          data={sampleData}
          country="IN"
          interactive={true}
        />
      );

      expect(registeredRangeChangeCb).toBeDefined();
      const totalBars = sampleData.candlesticks.length; // 60
      const span = 50;
      const maxAllowedRightOffset = Math.max(80, Math.round(span * 0.5)); // 80
      const maxAllowedTo = totalBars + maxAllowedRightOffset; // 140

      // Simulate dragging past the max right boundary: to = 150, from = 100 (span = 50)
      act(() => {
        registeredRangeChangeCb({ from: 100, to: 150 });
      });

      // Expected clamped: to = 140, from = 140 - 50 = 90
      expect(mockTimeScale.setVisibleLogicalRange).toHaveBeenCalledWith({
        from: 90,
        to: maxAllowedTo,
      });
    });
  });

  describe('Phase 2: Zero-Jitter Infinite Historical Streaming', () => {
    it('triggers pre-emptive history fetch when visible range "from" index <= 15', async () => {
      const fetchSpy = vi.spyOn(yahooFinanceMap, 'fetchStockDataByRange').mockResolvedValue({
        symbol: 'RELIANCE',
        candlesticks: generateCandles(30, 1700000000 - 30 * 86400),
      });

      render(
        <MiniCandlestickChart
          data={sampleData}
          country="IN"
          interactive={true}
        />
      );

      expect(registeredRangeChangeCb).toBeDefined();

      // Trigger pre-emptive threshold: from <= 15
      await act(async () => {
        registeredRangeChangeCb({ from: 12, to: 62 });
      });

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith(
          'RELIANCE',
          'IN',
          expect.any(Number),
          expect.any(Number),
          '1d'
        );
      });
    });

    it('atomically prepends older candles in-memory and shifts visible logical range to compensate without visual jump', async () => {
      const olderBars = generateCandles(20, 1700000000 - 20 * 86400);
      vi.spyOn(yahooFinanceMap, 'fetchStockDataByRange').mockResolvedValue({
        symbol: 'RELIANCE',
        candlesticks: olderBars,
      });

      render(
        <MiniCandlestickChart
          data={sampleData}
          country="IN"
          interactive={true}
        />
      );

      mockTimeScale.getVisibleLogicalRange.mockReturnValue({ from: 5, to: 55 });

      await act(async () => {
        registeredRangeChangeCb({ from: 5, to: 55 });
      });

      await waitFor(() => {
        expect(mockSeries.setData).toHaveBeenCalledWith(expect.arrayContaining(olderBars));
        expect(mockTimeScale.setVisibleLogicalRange).toHaveBeenCalledWith({
          from: 25, // 5 + 20
          to: 75,   // 55 + 20
        });
      });
    });
  });

  describe('Phase 3: Decoupled Timeframe Navigation', () => {
    it('adjusts camera viewport to timeframe preset without destroying the chart', async () => {
      const { rerender } = render(
        <MiniCandlestickChart
          data={sampleData}
          country="IN"
          interactive={true}
          timeframe="6mo"
        />
      );

      const initialChartInstance = mockTimeScale;

      // User clicks '1mo' preset
      rerender(
        <MiniCandlestickChart
          data={sampleData}
          country="IN"
          interactive={true}
          timeframe="1mo"
        />
      );

      // setVisibleLogicalRange called to position camera
      expect(initialChartInstance.setVisibleLogicalRange).toHaveBeenCalled();
    });

    it('does not reset camera viewport to default preset when background data updates after user has navigated', async () => {
      const { container, rerender } = render(
        <MiniCandlestickChart
          data={sampleData}
          country="IN"
          interactive={true}
          timeframe="6mo"
        />
      );

      // Simulate user interacting with the chart (mousedown + range change)
      const chartEl = container.firstChild;
      act(() => {
        chartEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        registeredRangeChangeCb({ from: 10, to: 40 });
      });

      mockTimeScale.setVisibleLogicalRange.mockClear();

      // Simulate background data update with more candles (e.g. 2y load finishes in parent)
      const updatedSampleData = {
        ...sampleData,
        candlesticks: generateCandles(120),
      };

      rerender(
        <MiniCandlestickChart
          data={updatedSampleData}
          country="IN"
          interactive={true}
          timeframe="6mo"
        />
      );

      // Camera must NOT be reset by applyTimeframeCamera since user has navigated
      expect(mockTimeScale.setVisibleLogicalRange).not.toHaveBeenCalled();
    });
  });
});
