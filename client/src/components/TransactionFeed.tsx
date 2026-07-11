import type { AgentTransaction } from "@/lib/agentsApi";

const STATUS_STYLES: Record<AgentTransaction["status"], string> = {
  success: "bg-green-500/15 text-green-500",
  failed: "bg-red-500/15 text-red-500",
  pending: "bg-yellow-500/15 text-yellow-500",
};

export function TransactionFeed({ transactions }: { transactions: AgentTransaction[] }) {
  if (transactions.length === 0) {
    return <p className="text-sm text-muted-foreground">No recent transactions.</p>;
  }

  return (
    <div className="scrollbar-thin max-h-96 overflow-y-auto overflow-x-auto rounded-lg border border-border/60">
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 border-b border-border/60 bg-background text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-2">Time</th>
            <th className="px-4 py-2">Type</th>
            <th className="px-4 py-2">Provider</th>
            <th className="px-4 py-2">Counterparty</th>
            <th className="px-4 py-2 text-right">Amount</th>
            <th className="px-4 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => (
            <tr key={tx.id} className="border-b border-border/40 last:border-0">
              <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">
                {new Date(tx.occurredAt).toLocaleString()}
              </td>
              <td className="px-4 py-2 capitalize">{tx.type.replace(/_/g, " ")}</td>
              <td className="px-4 py-2 uppercase text-muted-foreground">{tx.provider}</td>
              <td className="px-4 py-2 text-muted-foreground">{tx.partyName ?? "—"}</td>
              <td className="px-4 py-2 text-right">৳{Number(tx.amount).toLocaleString()}</td>
              <td className="px-4 py-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[tx.status]}`}>
                  {tx.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
