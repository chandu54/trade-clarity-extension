/**
 * Constants used throughout the application
 */

export const EMPTY_DATA = {
  weeks: {},
  paramDefinitions: {},
  uiConfig: {},
};

export const MODAL_TYPES = {
  PARAMS: "params",
  FILTER: "filter",
  RULES: "rules",
  COLUMNS: "columns",
  SECTORS: "sectors",
};

export const CONFIRMATION_MESSAGES = {
  CLEAR_WEEK: "Clear all stocks for this week?",
  CLEAR_ALL: "⚠️ This will delete ALL data. Continue?",
  DELETE_PARAM: "Delete parameter?",
  DELETE_STOCK: (symbol) => `Delete ${symbol}?`,
  DELETE_SECTOR: "Delete sector?",
};
