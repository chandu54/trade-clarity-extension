import { useState, useEffect } from "react";

export default function GlobalTooltip() {
  const [tooltip, setTooltip] = useState(null);

  useEffect(() => {
    const handleMouseOver = (e) => {
      const target = e.target.closest("[title], [data-tooltip]");
      if (!target) return;

      // Swap title to data-tooltip to prevent native browser tooltip
      const title = target.getAttribute("title");
      if (title) {
        target.setAttribute("data-tooltip", title);
        target.removeAttribute("title");
      }

      const text = target.getAttribute("data-tooltip");
      if (!text) return;

      const rect = target.getBoundingClientRect();
      setTooltip({
        text,
        x: rect.left + rect.width / 2,
        y: rect.bottom + 8, // Position slightly below the element
      });
    };

    const handleMouseOut = (e) => {
      const target = e.target.closest("[data-tooltip]");
      // Only hide if we are actually leaving the element (not moving to a child)
      if (target && !target.contains(e.relatedTarget)) {
        setTooltip(null);
      }
    };

    const handleScroll = () => {
      if (tooltip) setTooltip(null);
    };

    document.addEventListener("mouseover", handleMouseOver);
    document.addEventListener("mouseout", handleMouseOut);
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      document.removeEventListener("mouseover", handleMouseOver);
      document.removeEventListener("mouseout", handleMouseOut);
      window.removeEventListener("scroll", handleScroll, true);
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
