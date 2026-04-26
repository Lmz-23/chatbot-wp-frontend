declare module '@dagrejs/dagre' {
  export interface DagreGraph {
    setDefaultEdgeLabel: (factory: () => unknown) => void;
    setGraph: (value: Record<string, unknown>) => void;
    setNode: (id: string, value: Record<string, unknown>) => void;
    setEdge: (source: string, target: string) => void;
    node: (id: string) => { x?: number; y?: number } | undefined;
  }

  export const graphlib: {
    Graph: new () => DagreGraph;
  };

  export function layout(graph: DagreGraph): void;
}
