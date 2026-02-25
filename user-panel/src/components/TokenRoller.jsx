"use client";
import { useEffect, useRef, useState } from "react";
import "../../styles/TokenRoller.css";

export default function TokenRoller({
  startToken,
  endToken,
  onSelect,
  defaultValue,
}) {
  const containerRef = useRef(null);
  const [selected, setSelected] = useState(defaultValue || startToken);

  const tokens = [];
  for (let i = startToken; i <= endToken; i++) tokens.push(i);

  // Detect which number is in the center
  const handleScroll = () => {
    const container = containerRef.current;
    const items = [...container.children];

    let closest = null;
    let closestOffset = Infinity;

    const center = container.scrollTop + container.clientHeight / 2;

    items.forEach((item) => {
      const itemCenter = item.offsetTop + item.clientHeight / 2;
      const offset = Math.abs(center - itemCenter);

      if (offset < closestOffset) {
        closestOffset = offset;
        closest = item;
      }
    });

    if (closest) {
      const value = Number(closest.dataset.value);
      setSelected(value);
      onSelect(value);
    }
  };

  // Auto scroll to default
  useEffect(() => {
    const container = containerRef.current;
    const index = tokens.indexOf(defaultValue || startToken);

    setTimeout(() => {
      container.scrollTo({
        top: index * 50,
        behavior: "smooth",
      });
    }, 100);
  }, []);

  return (
    <div className="roller-wrapper">
      <div className="highlight-line" />

      <div
        className="roller-container"
        ref={containerRef}
        onScroll={handleScroll}
      >
        {/* TOP SPACER */}
        <div className="roller-spacer" />

        {tokens.map((t) => (
          <div
            key={t}
            className={`roller-item ${selected === t ? "active" : ""}`}
            data-value={t}
          >
            {t}
          </div>
        ))}

        {/* BOTTOM SPACER */}
        <div className="roller-spacer" />
      </div>
    </div>
  );
}
