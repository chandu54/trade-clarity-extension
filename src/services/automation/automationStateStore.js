/**
 * Global In-Memory Automation State Store
 * Maintains running automation progress across modal open/close cycles
 */

const listeners = new Set();

let runningAutomationsState = {
  // [taskId]: { isRunning, currentStage, pct, statusText, result, error, startTime }
};

export const getAutomationStates = () => runningAutomationsState;

export const getAutomationState = (taskId) => {
  return runningAutomationsState[taskId] || {
    isRunning: false,
    currentStage: 0,
    pct: 0,
    statusText: "",
    result: null,
    error: null,
  };
};

export const setAutomationState = (taskId, update) => {
  runningAutomationsState = {
    ...runningAutomationsState,
    [taskId]: {
      ...(runningAutomationsState[taskId] || {}),
      ...(typeof update === "function" ? update(runningAutomationsState[taskId]) : update),
    },
  };
  notifyListeners();
};

export const subscribeAutomationState = (listener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const notifyListeners = () => {
  listeners.forEach((fn) => {
    try {
      fn(runningAutomationsState);
    } catch (e) {
      console.error("Error notifying automation listener:", e);
    }
  });
};

/**
 * Check if any automation task is actively running
 */
export const getActiveRunningAutomation = () => {
  const activeEntries = Object.entries(runningAutomationsState).filter(
    ([, state]) => state?.isRunning
  );
  if (activeEntries.length === 0) return null;
  return {
    taskId: activeEntries[0][0],
    ...activeEntries[0][1],
  };
};
