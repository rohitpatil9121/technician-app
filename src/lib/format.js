// Small formatting helpers shared across screens.

export const rupee = (n) =>
  n === 0 || n === "0"
    ? "Free"
    : "₹" + Number(n || 0).toLocaleString("en-IN");

export const rupeeAmt = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");

export const todayLabel = () =>
  new Date().toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
