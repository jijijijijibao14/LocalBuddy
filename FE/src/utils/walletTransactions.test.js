import test from "node:test";
import assert from "node:assert/strict";
import { filterTransactions, transactionAmountPrefix } from "./walletTransactions.js";
import { paginate } from "./pagination.js";

test("wallet history displays direction for credits, debits and pending payments", () => {
  assert.equal(transactionAmountPrefix({ type: "Escrow", status: "Held" }), "+");
  assert.equal(transactionAmountPrefix({ type: "Escrow", status: "Completed" }), "−");
  assert.equal(transactionAmountPrefix({ type: "Escrow", status: "Refunded" }), "−");
  assert.equal(transactionAmountPrefix({ type: "Commission", status: "Completed" }), "+");
  assert.equal(transactionAmountPrefix({ type: "Earning", status: "Completed" }), "+");
  assert.equal(transactionAmountPrefix({ type: "Booking", status: "Completed" }), "−");
  assert.equal(transactionAmountPrefix({ type: "Withdrawal", status: "Pending" }), "−");
  assert.equal(transactionAmountPrefix({ type: "Withdrawal", status: "Failed" }), "");
  assert.equal(transactionAmountPrefix({ type: "Booking", status: "Pending" }), "");
});

test("history filters by local calendar day and displayed money direction", () => {
  const date = (day, hour = 12) => new Date(2026, 10, day, hour).toISOString();
  const transactions = [
    { type: "TopUp", status: "Completed", createdAt: date(10) },
    { type: "Booking", status: "Completed", createdAt: date(10, 23) },
    { type: "Escrow", status: "Held", createdAt: date(10) },
    { type: "Escrow", status: "Refunded", createdAt: date(10) },
    { type: "TopUp", status: "Pending", createdAt: date(10) },
    { type: "Withdrawal", status: "Failed", createdAt: date(10) },
    { type: "Withdrawal", status: "Pending", createdAt: date(11) },
    { type: "TopUp", status: "Completed", createdAt: null },
  ];
  assert.deepEqual(filterTransactions(transactions, { date: "2026-11-10", direction: "in" }),
    [transactions[0], transactions[2]]);
  assert.deepEqual(filterTransactions(transactions, { date: "2026-11-10", direction: "out" }),
    [transactions[1], transactions[3]]);
  assert.deepEqual(filterTransactions(transactions, { date: "2026-11-11" }), [transactions[6]]);
  assert.equal(filterTransactions(transactions, {}).length, transactions.length);
  assert.deepEqual(filterTransactions(transactions, { date: "2026-11-12" }), []);
});

test("filtered history pages contain at most five items and clamp after changes", () => {
  const transactions = Array.from({ length: 12 }, (_, i) => ({
    type: "TopUp", status: "Completed", createdAt: new Date(2026, 10, i < 7 ? 10 : 11).toISOString(),
  }));
  const filtered = filterTransactions(transactions, { date: "2026-11-10", direction: "in" });
  assert.equal(paginate(filtered, 1).items.length, 5);
  assert.equal(paginate(filtered, 2).items.length, 2);
  assert.equal(paginate(filtered, 3).page, 2);
  assert.equal(paginate([], 2).page, 1);
});
