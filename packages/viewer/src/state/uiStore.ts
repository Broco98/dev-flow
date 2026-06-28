import { create } from "zustand"; // v5: named import only (no default export)

interface GraphUiState {
  selectedId: string | null;
  expanded: Set<string>;
  select: (id: string | null) => void;
  toggleExpanded: (id: string) => void;
}

export const useGraphUi = create<GraphUiState>()((set) => ({
  selectedId: null,
  expanded: new Set<string>(),
  select: (id) => set({ selectedId: id }),
  toggleExpanded: (id) =>
    set((state) => {
      const next = new Set(state.expanded); // new ref -> triggers re-render
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { expanded: next };
    }),
}));
