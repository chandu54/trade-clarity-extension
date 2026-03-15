import { useState, useEffect } from "react";

export default function GlobalTooltip() {
  const [tooltip, setTooltip] = useState(null);

  useEffect(() => {
    const handleMouseOver = (e) => {
      const target = e.target.closest("[title], [data-tooltip]");
      if (!target) {
        setTooltip(null);
        return;
      }

      // Swap title to data-tooltip to prevent native browser tooltip
      const title = target.getAttribute("title");
      if (title) {
        target.setAttribute("data-tooltip", title);
        target.removeAttribute("title");
      }

      const text = target.getAttribute("data-tooltip");
      if (!text) {
        setTooltip(null);
        return;
      }

      const rect = target.getBoundingClientRect();
      setTooltip({
        text,
        x: rect.left + rect.width / 2,
        y: rect.bottom + 8, // Position slightly below the element
        target // Store target reference for cleanup
      });
    };

    const handleMouseOut = (e) => {
      if (!tooltip) return;
      
      const target = e.target.closest("[data-tooltip]");
      // If we moved off the element (or the element disappeared under us), clear it.
      if (!target || !target.contains(e.relatedTarget)) {
        setTooltip(null);
      }
    };

    const handleScroll = () => {
      if (tooltip) setTooltip(null);
    };

    const handleKeyDown = (e) => {
      // Clear on escape or any typing for safety
      if (tooltip && (e.key === "Escape" || document.activeElement.tagName === "INPUT")) {
        setTooltip(null);
      }
    };

    // If the element providing the tooltip is removed from the DOM completely (e.g. React unmounts it),
    // we need to kill the tooltip or it will stick forever.
    const observer = new MutationObserver(() => {
      if (tooltip && tooltip.target && !document.contains(tooltip.target)) {
        setTooltip(null);
      }
    });

    if (tooltip && tooltip.target) {
      observer.observe(document.body, { childList: true, subtree: true });
    }

    document.addEventListener("mouseover", handleMouseOver);
    document.addEventListener("mouseout", handleMouseOut);
    window.addEventListener("scroll", handleScroll, true);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mouseover", handleMouseOver);
      document.removeEventListener("mouseout", handleMouseOut);
      window.removeEventListener("scroll", handleScroll, true);
      document.removeEventListener("keydown", handleKeyDown);
      observer.disconnect();
    };
  }, [tooltip]);

  if (!tooltip) return null;

  return (
    <div
      className="global-tooltip"
      style={{
        left: tooltip.x,
        top: tooltip.y,
      }}
    >
      {tooltip.text}
    </div>
  );
}
