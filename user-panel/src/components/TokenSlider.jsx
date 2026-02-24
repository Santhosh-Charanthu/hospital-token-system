"use client";

import { useEffect, useMemo, useState } from "react";
import "../../styles/TokenSlider.css";

export default function TokenSlider({
  activeToken,
  lastTokenNumber,
  onChange,
}) {
  const [value, setValue] = useState(0);

  // compute range
  const { min, max } = useMemo(() => {
    if (!activeToken) return { min: 0, max: 0 };

    return {
      min: activeToken.tokenNumber,
      max: lastTokenNumber ?? activeToken.tokenNumber,
    };
  }, [activeToken, lastTokenNumber]);

  useEffect(() => {
    if (min === 0 && max === 0) return;

    setValue((prev) => {
      if (prev < min) return min;
      if (prev > max) return max;
      return prev;
    });
  }, [min, max]);

  const handleChange = (e) => {
    const val = Number(e.target.value);
    setValue(val);
    onChange(val);
  };

  return (
    <div className="token-slider-container">
      <div className="selected-token-number">{value}</div>

      <div className="slider-wrapper">
        <input
          key={`${min}-${max}`} // 🔥 VERY IMPORTANT
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={handleChange}
          className="token-slider"
        />
      </div>

      <div className="range-labels">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}
