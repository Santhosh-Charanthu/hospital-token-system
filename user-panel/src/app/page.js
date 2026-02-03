"use client";

import { useEffect, useState } from "react";
import io from "socket.io-client";

const socket = io("http://localhost:5000");

export default function UserPanel() {
  const [activeToken, setActiveToken] = useState(null);
  const [upcomingTokens, setUpcomingTokens] = useState([]);

  // 🔥 Fetch initial state on load
  const fetchInitialData = async () => {
    try {
      const res = await fetch(
        "https://hospital-token-system-backend.vercel.app/api/tokens/current",
      );
      const data = await res.json();
      setActiveToken(data.activeToken);
      setUpcomingTokens(data.upcomingTokens);
    } catch (err) {
      console.error("Failed to fetch initial token state", err);
    }
  };

  useEffect(() => {
    fetchInitialData();

    socket.on("TOKEN_UPDATE", (data) => {
      setActiveToken(data.activeToken);
      setUpcomingTokens(data.upcomingTokens);
    });

    return () => {
      socket.off("TOKEN_UPDATE");
    };
  }, []);

  return (
    <div className="container">
      <h1 className="title">Now Serving</h1>

      <div className="current-token">
        {activeToken ? activeToken.tokenNumber : "--"}
      </div>

      <h2 className="subtitle">Next Tokens</h2>

      <div className="upcoming">
        {upcomingTokens.length > 0 ? (
          upcomingTokens.map((token) => (
            <span key={token._id} className="token">
              {token.tokenNumber}
            </span>
          ))
        ) : (
          <p>No tokens in queue</p>
        )}
      </div>
    </div>
  );
}
