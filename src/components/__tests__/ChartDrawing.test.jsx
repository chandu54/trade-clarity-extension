import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MiniCandlestickChart from '../MiniCandlestickChart';
import ChartDrawingToolbar from '../ChartDrawingToolbar';
import * as storage from '../../services/storage';

// Mock storage functions
vi.mock('../../services/storage', async () => {
  const actual = await vi.importActual('../../services/storage');
  return {
    ...actual,
    getDrawingsForSymbol: vi.fn(),
    saveDrawingForSymbol: vi.fn(),
    deleteDrawingForSymbol: vi.fn(),
    clearDrawingsForSymbol: vi.fn(),
  };
});

// Mock lightweight-charts
vi.mock('lightweight-charts', () => {
  return {
    createChart: vi.fn(() => ({
      applyOptions: vi.fn(),
      timeScale: vi.fn(() => ({
        fitContent: vi.fn(),
        subscribeVisibleLogicalRangeChange: vi.fn(),
        subscribeVisibleTimeScaleChange: vi.fn(),
        unsubscribeVisibleTimeScaleChange: vi.fn(),
        timeToCoordinate: vi.fn((t) => (t === 1700000000 ? 100 : 200)),
        coordinateToTime: vi.fn((_x) => 1700000000),
      })),
      addSeries: vi.fn(() => ({
        setData: vi.fn(),
        applyOptions: vi.fn(),
        createPriceLine: vi.fn(),
        priceToCoordinate: vi.fn((p) => (p === 650 ? 50 : 120)),
        coordinateToPrice: vi.fn((_y) => 650),
      })),
      removeSeries: vi.fn(),
      remove: vi.fn(),
    })),
    CandlestickSeries: 'CandlestickSeries',
    LineSeries: 'LineSeries',
    CrosshairMode: { Normal: 0 },
  };
});

describe('Global Chart Drawings & ChartDrawingToolbar Unit Tests', () => {
  const mockChartData = {
    symbol: 'AARTIPHARM',
    longName: 'Aarti Pharmalabs Ltd.',
    currentPrice: 650.0,
    prevClose: 640.0,
    periodChangePct: 1.56,
    candlesticks: [
      { time: 1700000000, open: 640, high: 660, low: 635, close: 650 },
      { time: 1700086400, open: 650, high: 670, low: 645, close: 665 },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    storage.getDrawingsForSymbol.mockResolvedValue([]);
    storage.saveDrawingForSymbol.mockResolvedValue([]);
    storage.deleteDrawingForSymbol.mockResolvedValue([]);
    storage.clearDrawingsForSymbol.mockResolvedValue([]);
  });

  describe('ChartDrawingToolbar Component UI', () => {
    it('renders dropdown tool selector, style popover trigger, and clear button', () => {
      const onToolChange = vi.fn();
      const onColorChange = vi.fn();
      const onWidthChange = vi.fn();
      const onStyleChange = vi.fn();
      const onClearAll = vi.fn();

      render(
        <ChartDrawingToolbar
          activeTool="select"
          onToolChange={onToolChange}
          selectedColor="#3b82f6"
          onColorChange={onColorChange}
          selectedWidth={2}
          onWidthChange={onWidthChange}
          selectedStyle="solid"
          onStyleChange={onStyleChange}
          onClearAll={onClearAll}
          drawingCount={2}
        />
      );

      // Verify tool dropdown trigger
      expect(screen.getByText('Draw Tool')).toBeInTheDocument();
      expect(screen.getByText('2px')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();

      // Open tool dropdown
      fireEvent.click(screen.getByText('Draw Tool'));
      expect(screen.getByText('Horizontal Line')).toBeInTheDocument();
      expect(screen.getByText('Trendline')).toBeInTheDocument();

      // Select Horizontal Line
      fireEvent.click(screen.getByText('Horizontal Line'));
      expect(onToolChange).toHaveBeenCalledWith('horizontal');

      // Clear all
      fireEvent.click(screen.getByTitle('Clear all 2 drawings on this symbol'));
      expect(onClearAll).toHaveBeenCalled();
    });
  });

  describe('MiniCandlestickChart Drawings Integration', () => {
    it('fetches and renders global stored drawings automatically on mount', async () => {
      const mockSavedDrawings = [
        {
          id: 'h1',
          type: 'horizontal',
          price: 650.0,
          color: '#ef4444',
          width: 2,
          style: 'solid',
        },
      ];
      storage.getDrawingsForSymbol.mockResolvedValue(mockSavedDrawings);

      render(
        <MiniCandlestickChart
          data={mockChartData}
          country="IN"
          interactive={true}
        />
      );

      // Verify global storage was queried for symbol
      await waitFor(() => {
        expect(storage.getDrawingsForSymbol).toHaveBeenCalledWith('AARTIPHARM');
      });

      // Verify SVG price tag badge rendered
      await waitFor(() => {
        expect(screen.getByText('650.00')).toBeInTheDocument();
      });
    });

    it('renders delete handle and triggers deleteDrawingForSymbol when clicked', async () => {
      const mockSavedDrawings = [
        {
          id: 'h1',
          type: 'horizontal',
          price: 650.0,
          color: '#ef4444',
          width: 2,
          style: 'solid',
        },
      ];
      storage.getDrawingsForSymbol.mockResolvedValue(mockSavedDrawings);

      render(
        <MiniCandlestickChart
          data={mockChartData}
          country="IN"
          interactive={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('650.00')).toBeInTheDocument();
      });

      // Click delete button handle '×'
      const deleteBtn = screen.getByText('×');
      fireEvent.click(deleteBtn);

      expect(storage.deleteDrawingForSymbol).toHaveBeenCalledWith('AARTIPHARM', 'h1');
    });

    it('triggers saveDrawingForSymbol when user clicks canvas with horizontal tool active', async () => {
      storage.saveDrawingForSymbol.mockResolvedValue([
        { id: 'h2', type: 'horizontal', price: 650, color: '#3b82f6', width: 2, style: 'solid' },
      ]);

      render(
        <MiniCandlestickChart
          data={mockChartData}
          country="IN"
          interactive={true}
        />
      );

      await waitFor(() => {
        expect(storage.getDrawingsForSymbol).toHaveBeenCalledWith('AARTIPHARM');
      });

      // Open tool dropdown & select Horizontal
      fireEvent.click(screen.getByText('Draw Tool'));
      fireEvent.click(screen.getByText('Horizontal Line'));

      // Click on chart container
      const canvasContainer = screen.getByText('AARTIPHARM').closest('.mini-chart-card').querySelector('.chart-canvas-container');
      fireEvent.click(canvasContainer, { clientX: 100, clientY: 50 });

      expect(storage.saveDrawingForSymbol).toHaveBeenCalledWith('AARTIPHARM', expect.objectContaining({
        type: 'horizontal',
        price: 650,
      }));
    });

    it('renders ChartDrawingToolbar even when hideHeaders is true if interactive is true', async () => {
      render(
        <MiniCandlestickChart
          data={mockChartData}
          country="IN"
          interactive={true}
          hideHeaders={true}
        />
      );

      // Verify drawing toolbar dropdown trigger is present
      expect(screen.getByText('Draw Tool')).toBeInTheDocument();
    });
  });
});
