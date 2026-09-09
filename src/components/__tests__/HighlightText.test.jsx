import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import HighlightText from "../HighlightText";

describe("HighlightText Component", () => {
  it("renders null if text is null or undefined", () => {
    const { container: c1 } = render(<HighlightText text={null} highlight="test" />);
    expect(c1.firstChild).toBeNull();

    const { container: c2 } = render(<HighlightText text={undefined} highlight="test" />);
    expect(c2.firstChild).toBeNull();
  });

  it("renders plain text without wrapping mark if highlight is empty or whitespace", () => {
    const { container } = render(<HighlightText text="Cyber Security" highlight="" />);
    expect(container.textContent).toBe("Cyber Security");
    expect(container.querySelector("mark")).toBeNull();

    const { container: c2 } = render(<HighlightText text="Cyber Security" highlight="   " />);
    expect(c2.textContent).toBe("Cyber Security");
    expect(c2.querySelector("mark")).toBeNull();
  });

  it("highlights matching search terms with default ai-search-highlight class", () => {
    const { container } = render(<HighlightText text="Cyber Security Solutions" highlight="securit" />);
    expect(container.textContent).toBe("Cyber Security Solutions");
    const mark = container.querySelector("mark");
    expect(mark).not.toBeNull();
    expect(mark.textContent).toBe("Securit");
    expect(mark.className).toBe("ai-search-highlight");
  });

  it("handles case-insensitive and multi-word token matches", () => {
    const { container } = render(
      <HighlightText text="Advanced AI & Data Centers Infrastructure" highlight="ai data" />
    );
    expect(container.textContent).toBe("Advanced AI & Data Centers Infrastructure");
    const marks = container.querySelectorAll("mark");
    expect(marks.length).toBe(2);
    expect(marks[0].textContent).toBe("AI");
    expect(marks[1].textContent).toBe("Data");
  });

  it("safely handles regex special characters in search query", () => {
    const { container } = render(
      <HighlightText text="Special (Chemicals) & Materials + Tech" highlight="(Chemicals) +" />
    );
    expect(container.textContent).toBe("Special (Chemicals) & Materials + Tech");
    const marks = container.querySelectorAll("mark");
    expect(marks.length).toBe(2);
    expect(marks[0].textContent).toBe("(Chemicals)");
    expect(marks[1].textContent).toBe("+");
  });

  it("applies custom className and highlightClassName", () => {
    const { container } = render(
      <HighlightText
        text="Titan Company Limited"
        highlight="Titan"
        className="custom-container"
        highlightClassName="custom-mark"
      />
    );
    const wrapper = container.querySelector(".custom-container");
    expect(wrapper).not.toBeNull();
    const mark = container.querySelector(".custom-mark");
    expect(mark).not.toBeNull();
    expect(mark.textContent).toBe("Titan");
  });
});
