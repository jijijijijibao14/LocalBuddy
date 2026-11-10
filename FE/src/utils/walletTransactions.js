export function transactionDirection(transaction) {
  if (transaction.type === "Escrow") {
    return transaction.status === "Held" ? "in" : "out";
  }
  if (["Booking", "Withdrawal"].includes(transaction.type)) return "out";
  if (["TopUp", "Refund", "Earning", "Commission"].includes(transaction.type)) return "in";
  return null;
}

export function transactionAmountPrefix(transaction) {
  if (transaction.status === "Failed" || (transaction.type !== "Escrow" && transaction.status === "Pending" && transaction.type !== "Withdrawal")) {
    return "";
  }
  const direction = transactionDirection(transaction);
  return direction === "in" ? "+" : direction === "out" ? "−" : "";
}

export function filterTransactions(transactions, { date = "", direction = "" }) {
  return transactions.filter((transaction) => {
    if (date) {
      if (!transaction.createdAt) return false;
      const timestamp = new Date(transaction.createdAt);
      if (Number.isNaN(timestamp.getTime())) return false;
      const localDate = [
        timestamp.getFullYear(),
        String(timestamp.getMonth() + 1).padStart(2, "0"),
        String(timestamp.getDate()).padStart(2, "0"),
      ].join("-");
      if (localDate !== date) return false;
    }
    if (direction) {
      const prefix = transactionAmountPrefix(transaction);
      if (direction === "in" && prefix !== "+") return false;
      if (direction === "out" && prefix !== "−") return false;
    }
    return true;
  });
}
