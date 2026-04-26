declare module '@xyflow/react' {
  import * as React from 'react';

  export type Position = 'top' | 'right' | 'bottom' | 'left';

  export type Connection = {
    source?: string | null;
    target?: string | null;
    sourceHandle?: string | null;
    targetHandle?: string | null;
  };

  export type Node<Data = unknown> = {
    id: string;
    type?: string;
    position: { x: number; y: number };
    data: Data;
    sourcePosition?: Position;
    targetPosition?: Position;
  };

  export type Edge<Data = unknown> = {
    id: string;
    source: string;
    target: string;
    type?: string;
    data?: Data;
  };

  export type NodeProps<Data = unknown> = {
    id: string;
    data: Data;
    selected?: boolean;
  };

  export type EdgeProps<Data = unknown> = {
    id: string;
    sourceX: number;
    sourceY: number;
    targetX: number;
    targetY: number;
    sourcePosition: Position;
    targetPosition: Position;
    data?: Data;
  };

  export type ReactFlowInstance<NodeData = unknown, EdgeData = unknown> = {
    fitView: (options?: {
      padding?: number;
      duration?: number;
      includeHiddenNodes?: boolean;
      minZoom?: number;
      maxZoom?: number;
    }) => void;
  };

  export function addEdge<EdgeData = unknown>(edge: Edge<EdgeData>, edges: Edge<EdgeData>[]): Edge<EdgeData>[];
  export function getBezierPath(args: {
    sourceX: number;
    sourceY: number;
    targetX: number;
    targetY: number;
    sourcePosition: Position;
    targetPosition: Position;
    curvature?: number;
  }): [string, number, number, number, number];
  export function useNodesState<NodeData = unknown>(initialNodes: Node<NodeData>[]): [
    Node<NodeData>[],
    React.Dispatch<React.SetStateAction<Node<NodeData>[]>>,
    (changes: unknown) => void,
  ];
  export function useEdgesState<EdgeData = unknown>(initialEdges: Edge<EdgeData>[]): [
    Edge<EdgeData>[],
    React.Dispatch<React.SetStateAction<Edge<EdgeData>[]>>,
    (changes: unknown) => void,
  ];

  export const Background: React.ComponentType<any>;
  export const Controls: React.ComponentType<any>;
  export const Handle: React.ComponentType<any>;
  export const ReactFlow: React.ComponentType<any>;
}
