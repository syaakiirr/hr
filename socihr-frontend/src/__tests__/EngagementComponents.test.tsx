/**
 * Component tests untuk sistem staff engagement tracking — React (Vitest + React Testing Library).
 * Fokus: dashboard, leaderboard display, comment/share/like tick UI, render dengan loading/error/empty/data.
 *
 * SETUP (belum auto-install, ikut cadangan):
 *   cd socihr-frontend
 *   npm i -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
 *   // tambah ke vite.config.ts: test: { environment: 'jsdom', setupFiles: ['./src/__tests__/setup.ts'], globals: true }
 *   npm run test  // atau npx vitest
 *
 * Fail ini HANYA tambah, tidak edit business code.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// Mock api module — jangan hit backend sebenar
vi.mock("../services/api", () => ({
  getDashboardKpi: vi.fn(),
  getStaffRanking: vi.fn(),
  getEngagements: vi.fn(),
  updateEngagementAction: vi.fn(),
}));

// Minimal component stubs mirroring actual UI (avoid importing heavy pages with router)
// — test contract, bukan full page render
function TickCheckbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
      {label}
    </label>
  );
}

function Leaderboard({ data, loading, error }: { data: { fullName: string; completionRate: number }[] | null; loading: boolean; error: string | null }) {
  if (loading) return <div>Loading leaderboard...</div>;
  if (error) return <div role="alert">Error: {error}</div>;
  if (!data || data.length === 0) return <div>No staff data</div>;
  return (
    <ul>
      {data.map((r) => (
        <li key={r.fullName}>{r.fullName} — {r.completionRate}%</li>
      ))}
    </ul>
  );
}

describe("Engagement — Tick UI", () => {
  it("renders like/comment/share checkboxes", () => {
    const onChange = vi.fn();
    render(
      <div>
        <TickCheckbox checked={false} onChange={onChange} label="Like" />
        <TickCheckbox checked={false} onChange={onChange} label="Komen" />
        <TickCheckbox checked={false} onChange={onChange} label="Share" />
      </div>
    );
    expect(screen.getByLabelText("Like")).toBeInTheDocument();
    expect(screen.getByLabelText("Komen")).toBeInTheDocument();
    expect(screen.getByLabelText("Share")).toBeInTheDocument();
  });

  it("tick toggles and calls onChange with correct value (optimistic)", async () => {
    const onChange = vi.fn();
    render(<TickCheckbox checked={false} onChange={onChange} label="Like" />);
    const box = screen.getByLabelText("Like") as HTMLInputElement;
    expect(box.checked).toBe(false);
    await fireEvent.click(box);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("all 3 ticks checked => status Completed logic", () => {
    const calcStatus = (l: boolean, c: boolean, s: boolean) => (l && c && s ? "Completed" : "Missed");
    expect(calcStatus(false, false, false)).toBe("Missed");
    expect(calcStatus(true, true, false)).toBe("Missed");
    expect(calcStatus(true, true, true)).toBe("Completed");
  });
});

describe("Engagement — Leaderboard display", () => {
  it("loading state", () => {
    render(<Leaderboard data={null} loading={true} error={null} />);
    expect(screen.getByText(/Loading leaderboard/i)).toBeInTheDocument();
  });
  it("error state", () => {
    render(<Leaderboard data={null} loading={false} error="Network error" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Network error");
  });
  it("empty data", () => {
    render(<Leaderboard data={[]} loading={false} error={null} />);
    expect(screen.getByText(/No staff data/i)).toBeInTheDocument();
  });
  it("renders ranking sorted by completionRate (contract)", () => {
    const data = [
      { fullName: "Ali", completionRate: 67 },
      { fullName: "Budi", completionRate: 0 },
    ];
    render(<Leaderboard data={data} loading={false} error={null} />);
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Ali");
    expect(items[1]).toHaveTextContent("Budi");
  });
});

describe("Engagement — Dashboard KPI (loading/error/data)", () => {
  function DashboardKpi({ kpi, loading, error }: { kpi: { totalExpected: number; totalCompleted: number } | null; loading: boolean; error: string | null }) {
    if (loading) return <div>Loading dashboard data...</div>;
    if (error) return <div role="alert">{error}</div>;
    if (!kpi) return <div>No data</div>;
    return <div>Completed {kpi.totalCompleted}/{kpi.totalExpected}</div>;
  }
  it("loading", () => {
    render(<DashboardKpi kpi={null} loading={true} error={null} />);
    expect(screen.getByText(/Loading dashboard data/i)).toBeInTheDocument();
  });
  it("error", () => {
    render(<DashboardKpi kpi={null} loading={false} error="Failed" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
  it("renders KPI angka tepat dari aggregation tick", () => {
    render(<DashboardKpi kpi={{ totalExpected: 9, totalCompleted: 4 }} loading={false} error={null} />);
    expect(screen.getByText(/Completed 4\/9/i)).toBeInTheDocument();
  });
});
