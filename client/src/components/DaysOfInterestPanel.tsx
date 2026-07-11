import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createDayOfInterest, listDaysOfInterest, type DayOfInterest } from "@/lib/daysOfInterestApi";

export function DaysOfInterestPanel({ canCreate }: { canCreate: boolean }) {
  const [items, setItems] = useState<DayOfInterest[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [multiplier, setMultiplier] = useState("1.5");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function refresh() {
    const data = await listDaysOfInterest();
    setItems(data);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    try {
      await createDayOfInterest({
        name,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        expectedMultiplier: Number(multiplier),
        note: note || undefined,
      });
      setName("");
      setStartDate("");
      setEndDate("");
      setMultiplier("1.5");
      setNote("");
      await refresh();
      toast.success("Day of interest added");
    } catch {
      toast.error("Could not add day of interest");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No days of interest configured.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <div key={item.id} className="rounded-lg border border-border/60 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">{item.name}</span>
                <span className="text-xs uppercase text-muted-foreground">{item.scope}</span>
              </div>
              <p className="text-muted-foreground">
                {new Date(item.startDate).toLocaleDateString()} –{" "}
                {new Date(item.endDate).toLocaleDateString()} · ×{item.expectedMultiplier}
              </p>
              {item.note && <p className="mt-1 text-muted-foreground">{item.note}</p>}
            </div>
          ))}
        </div>
      )}

      {canCreate && (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-2 rounded-lg border border-border/60 p-3"
        >
          <p className="text-xs font-medium text-muted-foreground">
            Add a day of interest for your block
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              placeholder="Name (e.g. Local fair)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Input
              type="number"
              step="0.1"
              min="0.1"
              placeholder="Expected multiplier"
              value={multiplier}
              onChange={(e) => setMultiplier(e.target.value)}
              required
            />
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
          </div>
          <Input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button type="submit" size="sm" disabled={submitting} className="self-start">
            {submitting ? "Adding..." : "Add"}
          </Button>
        </form>
      )}
    </div>
  );
}
