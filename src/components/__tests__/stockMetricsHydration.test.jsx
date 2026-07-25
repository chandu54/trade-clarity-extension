import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import React, { useState, useEffect, useRef } from 'react';

describe('Stock Metrics Hydration & Deep Merging', () => {
  it('should deeply merge background-hydrated stock metrics without wiping params', () => {
    let storageChangeListener = null;
    global.chrome = {
      storage: {
        onChanged: {
          addListener: (fn) => { storageChangeListener = fn; },
          removeListener: (fn) => { if (storageChangeListener === fn) storageChangeListener = null; }
        },
        local: {
          set: vi.fn(),
          get: vi.fn()
        }
      }
    };

    const initialData = {
      weeks: {
        US: {
          '2026-07-19': {
            stocks: {
              AAPL: {
                symbol: 'AAPL',
                params: {}
              }
            }
          }
        }
      }
    };

    let latestDataState = null;

    function MockApp() {
      const [data, setData] = useState(initialData);
      const isSyncingFromStorageRef = useRef(false);
      const hasLoaded = useRef(true);

      latestDataState = data;

      useEffect(() => {
        if (!hasLoaded.current || !data) return;
        if (isSyncingFromStorageRef.current) {
          isSyncingFromStorageRef.current = false;
          return;
        }
        chrome.storage.local.set({ trading_app_data: data });
      }, [data]);

      useEffect(() => {
        if (typeof chrome === "undefined" || !chrome.storage?.onChanged) return;

        const handleStorageChange = (changes, namespace) => {
          if (namespace === "local" && changes["trading_app_data"]) {
            const newData = changes["trading_app_data"].newValue;
            if (newData && hasLoaded.current) {
              setData((currentData) => {
                if (!currentData) {
                  isSyncingFromStorageRef.current = true;
                  return newData;
                }

                isSyncingFromStorageRef.current = true;

                const mergedWeeks = { ...currentData.weeks };
                if (newData.weeks) {
                  Object.keys(newData.weeks).forEach((cKey) => {
                    mergedWeeks[cKey] = { ...(mergedWeeks[cKey] || {}) };
                    Object.keys(newData.weeks[cKey]).forEach((wKey) => {
                      const currWeek = mergedWeeks[cKey][wKey] || { stocks: {} };
                      const newWeek = newData.weeks[cKey][wKey] || { stocks: {} };
                      const mergedStocks = { ...(currWeek.stocks || {}) };

                      if (newWeek.stocks) {
                        Object.keys(newWeek.stocks).forEach((sKey) => {
                          const currStock = mergedStocks[sKey] || {};
                          const newStock = newWeek.stocks[sKey] || {};
                          mergedStocks[sKey] = {
                            ...currStock,
                            ...newStock,
                            params: {
                              ...(currStock.params || {}),
                              ...(newStock.params || {}),
                            },
                          };
                        });
                      }

                      mergedWeeks[cKey][wKey] = {
                        ...currWeek,
                        ...newWeek,
                        stocks: mergedStocks,
                      };
                    });
                  });
                }

                return {
                  ...currentData,
                  ...newData,
                  weeks: mergedWeeks,
                };
              });
            }
          }
        };

        chrome.storage.onChanged.addListener(handleStorageChange);
        return () => chrome.storage.onChanged.removeListener(handleStorageChange);
      }, []);

      return <div>Test App</div>;
    }

    render(<MockApp />);

    // Verify initial stock has empty params
    expect(latestDataState.weeks.US['2026-07-19'].stocks.AAPL.params).toEqual({});

    // Simulate background script completing ADR/MAs/Liquidity fetch and updating chrome.storage.local
    const backgroundUpdatedData = {
      weeks: {
        US: {
          '2026-07-19': {
            stocks: {
              AAPL: {
                symbol: 'AAPL',
                params: {
                  'us.adr': '4.5%',
                  'us.liquidity': '$2.5B',
                  'movingAverages': 'Above 50 MA'
                }
              }
            }
          }
        }
      }
    };

    act(() => {
      storageChangeListener(
        { trading_app_data: { newValue: backgroundUpdatedData } },
        'local'
      );
    });

    // Verify parameters were merged into state correctly
    expect(latestDataState.weeks.US['2026-07-19'].stocks.AAPL.params).toEqual({
      'us.adr': '4.5%',
      'us.liquidity': '$2.5B',
      'movingAverages': 'Above 50 MA'
    });
  });
});
