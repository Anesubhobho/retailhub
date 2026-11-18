import { useCallback, useEffect, useState } from "react";
import {
  CalendarDays,
  RefreshCw,
  FileText,
  TrendingUp,
  TrendingDown,
  Wallet,
  ShoppingBag,
  Receipt,
  AlertCircle,
} from "lucide-react";
import { supabase } from "../../services/supabase";
import { useAuth } from "../../context/AuthContext";

function localDate(date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function currency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value || 0));
}

function timestampBounds(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  end.setDate(end.getDate() + 1);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

function SummaryCard({ title, value, icon: Icon, color }) {
  const styles = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    orange: "bg-orange-50 text-orange-600",
    red: "bg-red-50 text-red-600",
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-900">{value}</h2>
        </div>
        <div className={`rounded-xl p-3 ${styles[color]}`}>
          <Icon size={24} />
        </div>
      </div>
    </div>
  );
}

export default function Reports() {
  const { profile } = useAuth();

  const today = localDate(new Date());

  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  const [summary, setSummary] = useState(null);
  const [sales, setSales] = useState([]);
  const [cancelledSales, setCancelledSales] = useState([]);
  const [expenses, setExpenses] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadReport = useCallback(async () => {
    if (profile?.role !== "owner" || !profile?.shop_id) return;

    if (!startDate || !endDate || startDate > endDate) {
      setError("Please select a valid reporting date range.");
      return;
    }

    setLoading(true);
    setError("");

    const bounds = timestampBounds(startDate, endDate);

    const [summaryResult, salesResult, cancelledResult, expensesResult] =
      await Promise.all([
        supabase.rpc("get_shop_financial_summary", {
          p_start_date: startDate,
          p_end_date: endDate,
        }),

        supabase
          .from("sales")
          .select("id, receipt_number, total_amount, status, created_at")
          .eq("shop_id", profile.shop_id)
          .eq("status", "completed")
          .is("cancelled_at", null)
          .gte("created_at", bounds.start)
          .lt("created_at", bounds.end)
          .order("created_at", { ascending: false }),

        supabase
          .from("sales")
          .select(
            "id, receipt_number, total_amount, cancellation_reason, cancelled_at, created_at",
          )
          .eq("shop_id", profile.shop_id)
          .eq("status", "cancelled")
          .gte("created_at", bounds.start)
          .lt("created_at", bounds.end)
          .order("created_at", { ascending: false }),

        supabase
          .from("expenses")
          .select(
            "id, expense_date, category, description, amount, payment_method, reference",
          )
          .eq("shop_id", profile.shop_id)
          .gte("expense_date", startDate)
          .lte("expense_date", endDate)
          .order("expense_date", { ascending: false }),
      ]);

    const failed = [
      summaryResult.error,
      salesResult.error,
      cancelledResult.error,
      expensesResult.error,
    ].filter(Boolean);

    if (failed.length) {
      setError(failed.map((item) => item.message).join(" | "));
      setSummary(null);
      setSales([]);
      setCancelledSales([]);
      setExpenses([]);
    } else {
      setSummary(summaryResult.data?.[0] || null);
      setSales(salesResult.data || []);
      setCancelledSales(cancelledResult.data || []);
      setExpenses(expensesResult.data || []);
    }

    setLoading(false);
  }, [profile?.role, profile?.shop_id, startDate, endDate]);

  useEffect(() => {
    if (profile?.role === "owner") {
      loadReport();
    }
  }, [profile?.role, loadReport]);

  function selectPeriod(period) {
    const now = new Date();
    const end = localDate(now);
    const start = new Date(now);

    if (period === "week") {
      start.setDate(now.getDate() - 6);
    } else if (period === "month") {
      start.setDate(1);
    } else if (period === "year") {
      start.setMonth(0, 1);
    }

    setStartDate(period === "today" ? end : localDate(start));
    setEndDate(end);
  }

  const report = summary || {
    total_revenue: 0,
    cost_of_goods: 0,
    gross_profit: 0,
    operating_expenses: 0,
    net_profit: 0,
    completed_sales: 0,
    units_sold: 0,
  };

  const expenseTotal = expenses.reduce(
    (total, expense) => total + Number(expense.amount || 0),
    0,
  );

  const completedSalesTotal = sales.reduce(
    (total, sale) => total + Number(sale.total_amount || 0),
    0,
  );

  if (profile?.role !== "owner") {
    return (
      <div className="rounded-xl bg-white p-8 text-center">
        <h2 className="font-bold text-red-600">Access denied</h2>
        <p className="mt-2 text-sm text-slate-500">
          Only shop owners can access reports.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Heading */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Business Reports
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Review sales, expenses and profitability for any reporting period.
          </p>
        </div>

        <button
          onClick={loadReport}
          disabled={loading}
          className="flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
          Refresh Report
        </button>
      </div>

      {/* Date selection */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <CalendarDays size={20} className="text-blue-600" />
          <h2 className="font-semibold text-slate-800">Reporting Period</h2>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {[
            ["today", "Today"],
            ["week", "Last 7 days"],
            ["month", "This month"],
            ["year", "This year"],
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() => selectPeriod(value)}
              className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700"
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Start date
            </label>
            <input
              type="date"
              value={startDate}
              max={endDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              End date
            </label>
            <input
              type="date"
              value={endDate}
              min={startDate}
              max={today}
              onChange={(event) => setEndDate(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mr-2 inline" size={18} />
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500">
          <RefreshCw size={25} className="mx-auto mb-3 animate-spin" />
          Preparing your report...
        </div>
      ) : (
        <>
          {/* Financial summary */}
          <div>
            <h2 className="mb-4 text-lg font-bold text-slate-900">
              Financial Summary
            </h2>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <SummaryCard
                title="Sales Revenue"
                value={currency(report.total_revenue)}
                icon={ShoppingBag}
                color="blue"
              />

              <SummaryCard
                title="Cost of Goods Sold"
                value={currency(report.cost_of_goods)}
                icon={Receipt}
                color="orange"
              />

              <SummaryCard
                title="Gross Profit"
                value={currency(report.gross_profit)}
                icon={TrendingUp}
                color="green"
              />

              <SummaryCard
                title="Operating Expenses"
                value={currency(report.operating_expenses)}
                icon={Wallet}
                color="orange"
              />

              <SummaryCard
                title="Net Profit / Loss"
                value={currency(report.net_profit)}
                icon={report.net_profit >= 0 ? TrendingUp : TrendingDown}
                color={report.net_profit >= 0 ? "green" : "red"}
              />

              <SummaryCard
                title="Completed Transactions"
                value={Number(report.completed_sales || 0).toLocaleString()}
                icon={FileText}
                color="blue"
              />
            </div>
          </div>

          {/* Sales records */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5">
              <div>
                <h2 className="font-bold text-slate-900">Completed Sales</h2>
                <p className="mt-1 text-xs text-slate-500">
                  {sales.length} transaction(s)
                </p>
              </div>
              <span className="font-bold text-blue-700">
                {currency(completedSalesTotal)}
              </span>
            </div>

            {sales.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-400">
                No completed sales for this period.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-5 py-4">Receipt</th>
                      <th className="px-5 py-4">Date & Time</th>
                      <th className="px-5 py-4">Status</th>
                      <th className="px-5 py-4 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sales.map((sale) => (
                      <tr key={sale.id}>
                        <td className="px-5 py-4 font-medium">
                          {sale.receipt_number}
                        </td>
                        <td className="px-5 py-4 text-slate-600">
                          {new Date(sale.created_at).toLocaleString()}
                        </td>
                        <td className="px-5 py-4">
                          <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
                            Completed
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right font-semibold">
                          {currency(sale.total_amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Expense records */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5">
              <div>
                <h2 className="font-bold text-slate-900">Operating Expenses</h2>
                <p className="mt-1 text-xs text-slate-500">
                  {expenses.length} expense record(s)
                </p>
              </div>
              <span className="font-bold text-orange-600">
                {currency(expenseTotal)}
              </span>
            </div>

            {expenses.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-400">
                No expenses recorded for this period.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[650px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-5 py-4">Date</th>
                      <th className="px-5 py-4">Category</th>
                      <th className="px-5 py-4">Description</th>
                      <th className="px-5 py-4">Payment</th>
                      <th className="px-5 py-4 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {expenses.map((expense) => (
                      <tr key={expense.id}>
                        <td className="px-5 py-4">{expense.expense_date}</td>
                        <td className="px-5 py-4 font-medium">
                          {expense.category}
                        </td>
                        <td className="px-5 py-4 text-slate-500">
                          {expense.description || "—"}
                        </td>
                        <td className="px-5 py-4 capitalize text-slate-600">
                          {expense.payment_method?.replaceAll("_", " ")}
                        </td>
                        <td className="px-5 py-4 text-right font-semibold">
                          {currency(expense.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Cancelled transactions */}
          <div className="overflow-hidden rounded-xl border border-amber-200 bg-white shadow-sm">
            <div className="border-b border-amber-100 bg-amber-50 p-5">
              <h2 className="font-bold text-amber-900">
                Cancelled Transactions
              </h2>
              <p className="mt-1 text-xs text-amber-700">
                Displayed separately and excluded from completed sales revenue.
              </p>
            </div>

            {cancelledSales.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-400">
                No cancelled transactions for this period.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-5 py-4">Receipt</th>
                      <th className="px-5 py-4">Date</th>
                      <th className="px-5 py-4">Cancellation Reason</th>
                      <th className="px-5 py-4 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cancelledSales.map((sale) => (
                      <tr key={sale.id}>
                        <td className="px-5 py-4 font-medium">
                          {sale.receipt_number}
                        </td>
                        <td className="px-5 py-4">
                          {new Date(sale.created_at).toLocaleString()}
                        </td>
                        <td className="px-5 py-4 text-slate-500">
                          {sale.cancellation_reason || "Not provided"}
                        </td>
                        <td className="px-5 py-4 text-right font-semibold text-red-600">
                          {currency(sale.total_amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Final totals */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Report Totals</h2>

            <div className="mt-5 space-y-4">
              <div className="flex justify-between border-b border-slate-100 pb-3 text-sm">
                <span className="text-slate-600">Total revenue</span>
                <strong>{currency(report.total_revenue)}</strong>
              </div>

              <div className="flex justify-between border-b border-slate-100 pb-3 text-sm">
                <span className="text-slate-600">Cost of goods sold</span>
                <strong>{currency(report.cost_of_goods)}</strong>
              </div>

              <div className="flex justify-between border-b border-slate-100 pb-3 text-sm">
                <span className="text-slate-600">Gross profit</span>
                <strong>{currency(report.gross_profit)}</strong>
              </div>

              <div className="flex justify-between border-b border-slate-100 pb-3 text-sm">
                <span className="text-slate-600">Operating expenses</span>
                <strong>{currency(report.operating_expenses)}</strong>
              </div>

              <div className="flex justify-between pt-1">
                <span className="font-bold text-slate-900">
                  Net profit / loss
                </span>
                <strong
                  className={
                    report.net_profit >= 0 ? "text-green-600" : "text-red-600"
                  }
                >
                  {currency(report.net_profit)}
                </strong>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-400">
            Report period: {startDate} to {endDate}. Cancelled transactions are
            shown separately. Profit calculations use the historical product
            costs recorded at checkout.
          </p>
        </>
      )}
    </div>
  );
}
