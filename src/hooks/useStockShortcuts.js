import { useEffect } from "react";

export function useStockShortcuts({
  stock,
  country = "IN",
  enabled = true,
  onToggleWatchlistModal,
  onCycleFlagColor,
  onToggleTagDropdown,
  onToggleTradable,
  onCopySymbol,
  onOpenTradingView,
  onQuickLog,
  onAnalyzeStock,
  onEditStock,
  onDeleteStock,
}) {
  useEffect(() => {
    if (!enabled || !stock) return;

    const handleKeyDown = (e) => {
      // Never hijack if the user is typing in an input, textarea, or select
      const activeTag = document.activeElement?.tagName;
      if (activeTag === "INPUT" || activeTag === "TEXTAREA" || activeTag === "SELECT") {
        return;
      }
      if (document.activeElement?.isContentEditable) {
        return;
      }

      // If holding Ctrl or Cmd or Alt, skip (allow standard OS or app shortcuts like Ctrl+S, Alt+S, etc.)
      if (e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }

      const key = e.key.toLowerCase();

      if (key === "w" && onToggleWatchlistModal) {
        e.preventDefault();
        onToggleWatchlistModal(stock);
      } else if (key === "f" && onCycleFlagColor) {
        e.preventDefault();
        onCycleFlagColor(stock.symbol);
      } else if (key === "g" && onToggleTagDropdown) {
        e.preventDefault();
        onToggleTagDropdown(stock.symbol);
      } else if (key === "t" && onToggleTradable) {
        e.preventDefault();
        onToggleTradable(stock.symbol);
      } else if (key === "c" && onCopySymbol) {
        e.preventDefault();
        onCopySymbol(stock.symbol);
      } else if (key === "o" && onOpenTradingView) {
        e.preventDefault();
        onOpenTradingView(stock.symbol, country);
      } else if (key === "l" && onQuickLog) {
        e.preventDefault();
        onQuickLog(stock.symbol);
      } else if (key === "a" && onAnalyzeStock) {
        e.preventDefault();
        onAnalyzeStock(stock);
      } else if ((key === "e" || key === "enter") && onEditStock) {
        e.preventDefault();
        onEditStock(stock);
      } else if ((key === "delete" || key === "backspace") && onDeleteStock) {
        e.preventDefault();
        onDeleteStock(stock.symbol);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    stock,
    country,
    enabled,
    onToggleWatchlistModal,
    onCycleFlagColor,
    onToggleTagDropdown,
    onToggleTradable,
    onCopySymbol,
    onOpenTradingView,
    onQuickLog,
    onAnalyzeStock,
    onEditStock,
    onDeleteStock,
  ]);
}
