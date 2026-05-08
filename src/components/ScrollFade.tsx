import React, { useEffect, useRef, useState, useCallback } from "react";

interface ScrollFadeProps {
  children: React.ReactNode;
  fadeSize?: number;
  direction?: "horizontal" | "vertical";
  fadeMode?: "scroll" | "toggle";
  alwaysShowFade?: boolean;
  animateFade?: boolean;
  className?: string;
}

const ScrollFade: React.FC<ScrollFadeProps> = ({
  children,
  fadeSize = 40,
  direction = "horizontal",
  fadeMode = "scroll",
  alwaysShowFade = false,
  animateFade = true,
  className = "",
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const scrollElRef = useRef<HTMLElement | null>(null);

  const [startFade, setStartFade] = useState(0);
  const [endFade, setEndFade] = useState(0);

  const isHorizontal = direction === "horizontal";

  const updateScrollState = useCallback(() => {
    const el = scrollElRef.current;
    if (!el) return;

    const scrollPos = isHorizontal ? el.scrollLeft : el.scrollTop;
    const scrollSize = isHorizontal ? el.scrollWidth : el.scrollHeight;
    const clientSize = isHorizontal ? el.clientWidth : el.clientHeight;

    const maxScroll = scrollSize - clientSize;

    if (fadeMode === "scroll") {
      // Dynamic fade based on proximity to edges
      const start = Math.min(scrollPos, fadeSize);
      const end = Math.min(maxScroll - scrollPos, fadeSize);

      setStartFade(start);
      setEndFade(end);
    } else {
      // Binary fade with optional animation
      const canStart = scrollPos > 0;
      const canEnd = scrollPos < maxScroll - 1;

      setStartFade(alwaysShowFade ? fadeSize : canStart ? fadeSize : 0);
      setEndFade(alwaysShowFade ? fadeSize : canEnd ? fadeSize : 0);
    }
  }, [isHorizontal, fadeMode, fadeSize, alwaysShowFade]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    // Find first scrollable child
    const scrollChild = wrapper.firstElementChild as HTMLElement | null;
    if (!scrollChild) return;

    scrollElRef.current = scrollChild;

    updateScrollState();

    scrollChild.addEventListener("scroll", updateScrollState);

    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(scrollChild);

    return () => {
      scrollChild.removeEventListener("scroll", updateScrollState);
      resizeObserver.disconnect();
    };
  }, [updateScrollState, children]);

  const mask = isHorizontal
    ? `linear-gradient(to right, transparent 0px, black var(--start-fade), black calc(100% - var(--end-fade)), transparent 100%)`
    : `linear-gradient(to bottom, transparent 0px, black var(--start-fade), black calc(100% - var(--end-fade)), transparent 100%)`;

  return (
    <div
      ref={wrapperRef}
      className={`relative overflow-hidden ${className}`}
      style={{
        WebkitMaskImage: mask,
        maskImage: mask,
        transition:
          animateFade && fadeMode === "toggle"
            ? "--start-fade 300ms cubic-bezier(0.4,0,0.2,1), --end-fade 300ms cubic-bezier(0.4,0,0.2,1)"
            : undefined,
        // These get dynamically updated:
        ["--start-fade" as any]: `${startFade}px`,
        ["--end-fade" as any]: `${endFade}px`,
      }}
    >
      {children}
    </div>
  );
};

export default ScrollFade;
