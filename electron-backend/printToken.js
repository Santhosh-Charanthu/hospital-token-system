const { PosPrinter } = require("electron-pos-printer");

module.exports = async function printToken(tokenNumber) {
  // const options = {
  //   preview: process.env.NODE_ENV !== "production",
  //   silent: process.env.NODE_ENV === "production",
  //   pageSize: "80mm",
  // };

  const options = {
    preview: true,
    silent: true,
    // printerName: "XP-80C", // 🔴 EXACT printer name from system
    pageSize: "80mm",
    margin: "0 0 0 0",
    copies: 1,
    timeOutPerLine: 400,
  };

  const data = [
    {
      type: "text",
      value: "HOSPITAL TOKEN",
      style: { textAlign: "center", fontSize: "22px", fontWeight: "700" },
    },
    {
      type: "text",
      value: String(tokenNumber),
      style: { textAlign: "center", fontSize: "48px", margin: "20px 0" },
    },
    {
      type: "text",
      value: "Please wait for your turn",
      style: { textAlign: "center", fontSize: "14px" },
    },
  ];

  await PosPrinter.print(data, options);

  // 🔥 IMPORTANT: Explicit success
  return { success: true };
};
