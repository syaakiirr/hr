import { createContext, useContext, useState, type ReactNode } from "react";

export const DATE_FILTERS = [
  { label: "Today", value: "today" },
  { label: "This Week", value: "week" },
  { label: "This Month", value: "month" },
  { label: "3 Months", value: "3months" },
  { label: "6 Months", value: "6months" },
  { label: "1 Year", value: "year" },
  { label: "All Time", value: "all" },
  { label: "Custom Range", value: "custom" },
];

export function getDateRange(filter: string, customFrom?: string, customTo?: string): { from?: string; to?: string } {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  const today = fmt(now);

  if (filter === "custom" && customFrom && customTo) {
    return { from: customFrom, to: customTo };
  }

  switch (filter) {
    case "today": return { from: today, to: today };
    case "week": {
      const start = new Date(now); start.setDate(now.getDate() - now.getDay());
      return { from: fmt(start), to: today };
    }
    case "month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: fmt(start), to: today };
    }
    case "3months": {
      const start = new Date(now); start.setMonth(now.getMonth() - 3);
      return { from: fmt(start), to: today };
    }
    case "6months": {
      const start = new Date(now); start.setMonth(now.getMonth() - 6);
      return { from: fmt(start), to: today };
    }
    case "year": {
      const start = new Date(now); start.setFullYear(now.getFullYear() - 1);
      return { from: fmt(start), to: today };
    }
    default: return {};
  }
}

interface DateFilterContextValue {
  filter: string;
  setFilter: (filter: string) => void;
  customFrom: string;
  setCustomFrom: (from: string) => void;
  customTo: string;
  setCustomTo: (to: string) => void;
}

const STORAGE_KEY = "globalDateFilter";
const CUSTOM_FROM_KEY = "globalCustomFrom";
const CUSTOM_TO_KEY = "globalCustomTo";

const DateFilterContext = createContext<DateFilterContextValue>({
  filter: "month", setFilter: () => {},
  customFrom: "", setCustomFrom: () => {},
  customTo: "", setCustomTo: () => {},
});

export function DateFilterProvider({ children }: { children: ReactNode }) {
  const [filter, setFilterState] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return DATE_FILTERS.some((f) => f.value === saved) ? saved! : "month";
  });
  const [customFrom, setCustomFrom] = useState(() => localStorage.getItem(CUSTOM_FROM_KEY) || "");
  const [customTo, setCustomTo] = useState(() => localStorage.getItem(CUSTOM_TO_KEY) || "");

  const setFilter = (value: string) => {
    setFilterState(value);
    localStorage.setItem(STORAGE_KEY, value);
  };

  const handleCustomFrom = (value: string) => {
    setCustomFrom(value);
    localStorage.setItem(CUSTOM_FROM_KEY, value);
  };

  const handleCustomTo = (value: string) => {
    setCustomTo(value);
    localStorage.setItem(CUSTOM_TO_KEY, value);
  };

  return (
    <DateFilterContext.Provider value={{ filter, setFilter, customFrom, setCustomFrom: handleCustomFrom, customTo, setCustomTo: handleCustomTo }}>
      {children}
    </DateFilterContext.Provider>
  );
}

export function useDateFilter() {
  return useContext(DateFilterContext);
}
