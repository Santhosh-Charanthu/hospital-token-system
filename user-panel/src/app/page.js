"use client";

import { useEffect, useState } from "react";
import io from "socket.io-client";
import { motion, AnimatePresence } from "framer-motion";
import "../../styles/UserPanel.css";

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

const socket = io(BASE_URL);

export default function UserPanel() {
  const [activeToken, setActiveToken] = useState(null);
  const [upcomingTokens, setUpcomingTokens] = useState([]);

  const fetchInitialData = async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/tokens/current`);
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

    return () => socket.off("TOKEN_UPDATE");
  }, []);

  return (
    <div className="screen">
      {/* 🧭 NAVBAR */}
      <header className="navbar">
        <div className="navbar-left">
          <h1>HOPE HOMOEOPATHY, Malakpet</h1>
          <p>OPD Timings: 9:00 AM – 6:00 PM</p>
        </div>

        <div className="navbar-right">
          <span className="live-dot" />
          <span>Live Token Status</span>
        </div>
      </header>

      {/* 📺 MAIN CONTENT */}
      <main className="container">
        <h1 className="title">Now Serving</h1>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeToken?.tokenNumber || "none"}
            className="current-token"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            {activeToken ? activeToken.tokenNumber : "--"}
          </motion.div>
        </AnimatePresence>

        <h2 className="subtitle">Next Tokens</h2>

        <div className="upcoming">
          <AnimatePresence>
            {upcomingTokens.length > 0 ? (
              upcomingTokens.map((token) => (
                <motion.span
                  key={token._id}
                  className="token"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25 }}
                >
                  {token.tokenNumber}
                </motion.span>
              ))
            ) : (
              <p>No tokens in queue</p>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

// "use client";

// import { useEffect, useState } from "react";
// import io from "socket.io-client";
// import { motion, AnimatePresence } from "framer-motion";
// import "../../styles/UserPanel.css";

// const socket = io("http://localhost:5000");

// export default function UserPanel() {
//   const [activeToken, setActiveToken] = useState(null);
//   const [upcomingTokens, setUpcomingTokens] = useState([]);

//   const fetchInitialData = async () => {
//     try {
//       const res = await fetch("http://localhost:5000/api/tokens/current");
//       const data = await res.json();
//       setActiveToken(data.activeToken);
//       setUpcomingTokens(data.upcomingTokens);
//     } catch (err) {
//       console.error("Failed to fetch initial token state", err);
//     }
//   };

//   useEffect(() => {
//     fetchInitialData();

//     socket.on("TOKEN_UPDATE", (data) => {
//       setActiveToken(data.activeToken);
//       setUpcomingTokens(data.upcomingTokens);
//     });

//     return () => socket.off("TOKEN_UPDATE");
//   }, []);

//   return (
//     <div className="page">
//       <div className="panel">
//         {/* 🏥 Clinic Header */}
//         <header className="clinic-header">
//           <h1>HOPE HOMOEOPATHY. Malakpet</h1>
//           <p>OPD Timings: 9:00 AM – 6:00 PM</p>
//           <div className="live-status">
//             <span className="dot" />
//             Live Token Status
//           </div>
//         </header>

//         {/* 🎯 Now Serving */}
//         <section className="now-serving">
//           <span className="label">Now Serving</span>

//           <AnimatePresence mode="wait">
//             <motion.div
//               key={activeToken?.tokenNumber || "none"}
//               className="token-number"
//               initial={{ opacity: 0, y: 20, scale: 0.95 }}
//               animate={{ opacity: 1, y: 0, scale: 1 }}
//               exit={{ opacity: 0, y: -20, scale: 0.95 }}
//               transition={{ duration: 0.35 }}
//             >
//               {activeToken ? activeToken.tokenNumber : "--"}
//             </motion.div>
//           </AnimatePresence>
//         </section>

//         {/* ⏭ Upcoming Tokens */}
//         <section className="upcoming-section">
//           <h2>Next in Queue</h2>

//           <div className="upcoming-list">
//             <AnimatePresence>
//               {upcomingTokens.length > 0 ? (
//                 upcomingTokens.map((token) => (
//                   <motion.span
//                     key={token._id}
//                     className="upcoming-token"
//                     initial={{ opacity: 0, scale: 0.8 }}
//                     animate={{ opacity: 1, scale: 1 }}
//                     exit={{ opacity: 0, scale: 0.8 }}
//                     transition={{ duration: 0.25 }}
//                   >
//                     {token.tokenNumber}
//                   </motion.span>
//                 ))
//               ) : (
//                 <p className="empty">No tokens in queue</p>
//               )}
//             </AnimatePresence>
//           </div>
//         </section>

//         {/* ℹ️ Footer */}
//         <footer className="footer">
//           <p>Please wait for your token to be called</p>
//           <p>Kindly maintain silence inside the clinic</p>
//         </footer>
//       </div>
//     </div>
//   );
// }
