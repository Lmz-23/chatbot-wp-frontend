'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as dagre from '@dagrejs/dagre';
import {
  addEdge,
  Background,
  Controls,
  Handle,
  ReactFlow,
  type Connection,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
  useEdgesState,
  useNodesState,
  getBezierPath,
} from '@xyflow/react';
import { apiClient } from '@/lib/api/apiClient';
import { useAuth } from '@/hooks';

type NodeKind = 'start' | 'normal' | 'fallback' | 'escalate_agent' | 'escalate_urgent';
type EditorNodeKind = 'normal' | 'fallback' | 'escalate';

type BotTransition = {
  keywords: string[];
  next: string;
};

type BotNode = {
  id: string;
  message: string;
  transitions: BotTransition[];
  default: string;
  kind?: NodeKind;
};

type FlowNodeData = {
  id: string;
  message: string;
  kind: NodeKind;
  rune: string;
};

type FlowEdgeData = {
  kind: 'branch' | 'default';
  keywords?: string[];
};

type NewNodeDraft = {
  id: string;
  message: string;
  kind: EditorNodeKind;
};

const STONE_NODE_WIDTH = 120;
const STONE_NODE_HEIGHT = 140;
const DEFAULT_EDGE_TARGET = 'fallback';
const COMPILED_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const runeMap: Record<string, string> = {
  A: 'ᚨ',
  B: 'ᛒ',
  C: 'ᚲ',
  D: 'ᛞ',
  E: 'ᛖ',
  F: 'ᚠ',
  G: 'ᚷ',
  H: 'ᚺ',
  I: 'ᛁ',
  J: 'ᛃ',
  K: 'ᚲ',
  L: 'ᛚ',
  M: 'ᛗ',
  N: 'ᚾ',
  O: 'ᛟ',
  P: 'ᛈ',
  Q: 'ᚲ',
  R: 'ᚱ',
  S: 'ᛊ',
  T: 'ᛏ',
  U: 'ᚢ',
  V: 'ᚹ',
  W: 'ᚹ',
  X: 'ᚷ',
  Y: 'ᛃ',
  Z: 'ᛉ',
};

const starterGraph: BotNode[] = [
  {
    id: 'start',
    kind: 'start',
    message: 'Bienvenido al reino de Replai. ¿Qué piedra quieres activar?',
    transitions: [
      { keywords: ['precio', 'costo', 'tarifa'], next: 'pricing_rune' },
      { keywords: ['humano', 'agente', 'asesor'], next: 'escalate_agent' },
    ],
    default: 'pricing_rune',
  },
  {
    id: 'pricing_rune',
    kind: 'normal',
    message: 'Puedo ayudarte con planes, precios y alcance del servicio.',
    transitions: [{ keywords: ['más', 'detalles', 'info'], next: 'fallback_rune' }],
    default: 'fallback_rune',
  },
  {
    id: 'fallback_rune',
    kind: 'fallback',
    message: 'No comprendí esa señal. ¿Quieres reformular tu consulta?',
    transitions: [{ keywords: ['si', 'claro', 'otra vez'], next: 'pricing_rune' }],
    default: 'start',
  },
  {
    id: 'escalate_agent',
    kind: 'escalate_agent',
    message: 'Voy a derivarte con un agente para continuar el ritual.',
    transitions: [],
    default: 'start',
  },
];

function normalizeText(value: string) {
  return value.trim();
}

function parseKeywords(value: string) {
  return value
    .split(',')
    .map((keyword) => normalizeText(keyword))
    .filter(Boolean);
}

function createUniqueId(baseId: string, existingIds: string[]) {
  const normalized = normalizeText(baseId) || 'nuevo_nodo';
  if (!existingIds.includes(normalized)) return normalized;

  let suffix = 2;
  let candidate = `${normalized}_${suffix}`;
  while (existingIds.includes(candidate)) {
    suffix += 1;
    candidate = `${normalized}_${suffix}`;
  }

  return candidate;
}

function getRuneFromId(nodeId: string) {
  const first = normalizeText(nodeId).charAt(0).toUpperCase();
  if (!first) return 'ᚷ';
  return runeMap[first] || 'ᚷ';
}

function getNodeKindFromId(nodeId: string): NodeKind {
  const normalized = normalizeText(nodeId).toLowerCase();
  if (normalized === 'start') return 'start';
  if (normalized.startsWith('fallback')) return 'fallback';
  if (normalized.startsWith('escalate_urgent')) return 'escalate_urgent';
  if (normalized.startsWith('escalate')) return 'escalate_agent';
  return 'normal';
}

function normalizeNodeKind(rawKind: unknown, nodeId: string): NodeKind {
  if (rawKind === 'start') return 'start';
  if (rawKind === 'normal') return 'normal';
  if (rawKind === 'fallback') return 'fallback';
  if (rawKind === 'escalate_agent') return 'escalate_agent';
  if (rawKind === 'escalate_urgent') return 'escalate_urgent';
  return getNodeKindFromId(nodeId);
}

function getNodeAccent(kind: NodeKind) {
  if (kind === 'start') {
    return {
      base: '#C9A84C',
      border: '#E7D39B',
      glow: 'rgba(201, 168, 76, 0.55)',
      fill: 'rgba(201, 168, 76, 0.16)',
      ink: '#F3E3B2',
    };
  }

  if (kind === 'fallback') {
    return {
      base: '#8B6914',
      border: '#C19A38',
      glow: 'rgba(139, 105, 20, 0.45)',
      fill: 'rgba(139, 105, 20, 0.2)',
      ink: '#F2D58A',
    };
  }

  if (kind === 'escalate_agent' || kind === 'escalate_urgent') {
    return {
      base: '#6B2737',
      border: '#A94A5E',
      glow: 'rgba(107, 39, 55, 0.45)',
      fill: 'rgba(107, 39, 55, 0.2)',
      ink: '#F0B6C0',
    };
  }

  return {
    base: '#2A3F5F',
    border: '#378ADD',
    glow: 'rgba(55, 138, 221, 0.42)',
    fill: 'rgba(42, 63, 95, 0.24)',
    ink: '#C6E2FF',
  };
}

function getNodeKindLabel(kind: NodeKind) {
  if (kind === 'start') return 'Inicio';
  if (kind === 'fallback') return 'Fallback';
  if (kind === 'escalate_agent' || kind === 'escalate_urgent') return 'Escalate';
  return 'Normal';
}

function seededStarValue(seed: number) {
  const value = Math.sin(seed * 127.1) * 43758.5453123;
  return value - Math.floor(value);
}

function createStarField(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const base = index + 1;
    const left = Math.round(seededStarValue(base * 1.13) * 10000) / 100;
    const top = Math.round(seededStarValue(base * 2.19) * 10000) / 100;
    const size = 1 + Math.floor(seededStarValue(base * 3.31) * 3);
    const duration = 3.4 + seededStarValue(base * 4.47) * 5.2;
    const delay = seededStarValue(base * 5.59) * 8;
    const opacity = 0.18 + seededStarValue(base * 6.71) * 0.48;

    return {
      id: `star-${index}`,
      left,
      top,
      size,
      duration,
      delay,
      opacity,
    };
  });
}

function sanitizeBotNodes(rawData: unknown): BotNode[] {
  const rawNodes = Array.isArray(rawData)
    ? rawData
    : Array.isArray((rawData as { nodes?: unknown } | null)?.nodes)
      ? ((rawData as { nodes: unknown[] }).nodes as unknown[])
      : [];

  const nodes = rawNodes
    .map((item) => {
      const candidate = item as Partial<BotNode> & { type?: unknown };
      const id = typeof candidate.id === 'string' ? normalizeText(candidate.id) : '';
      if (!id) return null;

      const transitionMap = new Map<string, BotTransition>();
      if (Array.isArray(candidate.transitions)) {
        candidate.transitions.forEach((transition) => {
          const next = typeof transition?.next === 'string' ? normalizeText(transition.next) : '';
          if (!next) return;

          const keywords = Array.isArray(transition?.keywords)
            ? transition.keywords.map((keyword) => normalizeText(String(keyword))).filter(Boolean)
            : [];
          const transitionKey = `${next}::${keywords.join('|')}`;
          if (!transitionMap.has(transitionKey)) {
            transitionMap.set(transitionKey, {
              keywords,
              next,
            });
          }
        });
      }

      const transitions = Array.from(transitionMap.values());

      const defaultTarget = typeof candidate.default === 'string' && normalizeText(candidate.default)
        ? normalizeText(candidate.default)
        : DEFAULT_EDGE_TARGET;

      return {
        id,
        message: typeof candidate.message === 'string' ? candidate.message : '',
        transitions: transitions as BotTransition[],
        default: defaultTarget,
        kind: normalizeNodeKind(candidate.kind ?? candidate.type, id),
      } satisfies BotNode;
    })
    .filter(Boolean) as BotNode[];

  if (nodes.length === 0) {
    return [...starterGraph];
  }

  return nodes;
}

function buildBotNodes(flowNodes: Node<FlowNodeData>[], flowEdges: Edge<FlowEdgeData>[]) {
  return flowNodes.map((node) => {
    const nodeTransitions = flowEdges
      .filter((edge) => edge.source === node.id && edge.data?.kind === 'branch')
      .map((edge) => ({
        keywords: edge.data?.keywords ? [...edge.data.keywords] : [],
        next: edge.target,
      }));

    const defaultTarget = flowEdges.find((edge) => edge.source === node.id && edge.data?.kind === 'default')?.target;

    return {
      id: node.id,
      message: node.data.message,
      transitions: nodeTransitions,
      default: defaultTarget || DEFAULT_EDGE_TARGET,
      kind: node.data.kind,
    } satisfies BotNode;
  });
}

function layoutGraph(
  inputNodes: Node<FlowNodeData>[],
  inputEdges: Edge<FlowEdgeData>[]
): { nodes: Node<FlowNodeData>[]; edges: Edge<FlowEdgeData>[] } {
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: 'TB',
    ranksep: 120,
    nodesep: 80,
    marginx: 48,
    marginy: 48,
  });

  inputNodes.forEach((node) => {
    graph.setNode(node.id, {
      width: STONE_NODE_WIDTH,
      height: STONE_NODE_HEIGHT,
    });
  });

  inputEdges.forEach((edge) => {
    graph.setEdge(edge.source, edge.target);
  });

  dagre.layout(graph);

  const positionedNodes = inputNodes.map((node) => {
    const layoutNode = graph.node(node.id) as { x?: number; y?: number } | undefined;
    const x = layoutNode?.x ?? 0;
    const y = layoutNode?.y ?? 0;

    return {
      ...node,
      position: {
        x: x - STONE_NODE_WIDTH / 2,
        y: y - STONE_NODE_HEIGHT / 2,
      },
      sourcePosition: 'bottom',
      targetPosition: 'top',
    } satisfies Node<FlowNodeData>;
  });

  return {
    nodes: positionedNodes,
    edges: inputEdges,
  };
}

function buildFlowState(rawData: unknown) {
  const botNodes = sanitizeBotNodes(rawData);
  const nodeIds = new Set(botNodes.map((node) => node.id));
  const nodeList: Node<FlowNodeData>[] = botNodes.map((node) => ({
    id: node.id,
    type: 'yggdrasilStone',
    position: { x: 0, y: 0 },
    data: {
      id: node.id,
      message: node.message,
      kind: normalizeNodeKind(node.kind, node.id),
      rune: getRuneFromId(node.id),
    },
    sourcePosition: 'bottom',
    targetPosition: 'top',
  }));

  const edgeList: Edge<FlowEdgeData>[] = [];
  const edgeKeySet = new Set<string>();

  botNodes.forEach((node) => {
    node.transitions.forEach((transition, index) => {
      if (!nodeIds.has(transition.next)) {
        return;
      }

      const branchKey = `branch|${node.id}|${transition.next}|${transition.keywords.join('|')}`;
      if (edgeKeySet.has(branchKey)) {
        return;
      }
      edgeKeySet.add(branchKey);

      edgeList.push({
        id: `branch-${node.id}-${transition.next}-${index}`,
        source: node.id,
        target: transition.next,
        type: 'bezier',
        data: {
          kind: 'branch',
          keywords: [...transition.keywords],
        },
      });
    });

    if (node.default && nodeIds.has(node.default)) {
      const defaultKey = `default|${node.id}|${node.default}`;
      if (edgeKeySet.has(defaultKey)) {
        return;
      }
      edgeKeySet.add(defaultKey);

      edgeList.push({
        id: `default-${node.id}`,
        source: node.id,
        target: node.default,
        type: 'bezier',
        data: {
          kind: 'default',
        },
      });
    }
  });

  const laidOutState = layoutGraph(nodeList, edgeList);
  console.log('[BotSettings] nodes after dagre:', laidOutState.nodes.map((n) => ({ id: n.id, x: n.position?.x, y: n.position?.y })));
  console.log('[BotSettings] React Flow nodes after build:', laidOutState.nodes);
  console.log('[BotSettings] React Flow edges after build:', laidOutState.edges);
  return laidOutState;
}

function getEdgeCurvature(sourceY: number, targetY: number) {
  if (targetY > sourceY + 28) {
    return 0.78;
  }

  if (Math.abs(targetY - sourceY) <= 60) {
    return 0.55;
  }

  return 0.66;
}

function YggdrasilStoneNode({ data, selected }: NodeProps<FlowNodeData>) {
  const accent = getNodeAccent(data.kind);

  return (
    <div
      className="relative select-none"
      style={{
        width: STONE_NODE_WIDTH,
        height: STONE_NODE_HEIGHT,
        filter: selected ? `drop-shadow(0 0 18px ${accent.glow})` : `drop-shadow(0 0 10px rgba(0, 0, 0, 0.45))`,
        transform: selected ? 'scale(1.05)' : 'scale(1)',
        transition: 'transform 220ms ease, filter 220ms ease',
      }}
    >
      <Handle type="target" position="top" className="!h-3 !w-3 !border-0 !bg-transparent opacity-0" />
      <Handle type="source" position="bottom" className="!h-3 !w-3 !border-0 !bg-transparent opacity-0" />

      <svg width={STONE_NODE_WIDTH} height={STONE_NODE_HEIGHT} viewBox="0 0 120 140" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={`stone-fill-${data.id}`} x1="16" y1="12" x2="102" y2="128" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={accent.fill} />
            <stop offset="100%" stopColor={accent.base} stopOpacity="0.95" />
          </linearGradient>
          <linearGradient id={`stone-border-${data.id}`} x1="18" y1="18" x2="98" y2="120" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={accent.border} stopOpacity="0.95" />
            <stop offset="100%" stopColor={accent.base} stopOpacity="0.7" />
          </linearGradient>
          <clipPath id={`stone-clip-${data.id}`}>
            <path d="M15 18L37 9L68 12L88 20L104 37L110 57L105 82L92 103L69 117L44 114L24 105L11 84L8 58L10 35Z" />
          </clipPath>
        </defs>

        <path
          d="M15 18L37 9L68 12L88 20L104 37L110 57L105 82L92 103L69 117L44 114L24 105L11 84L8 58L10 35Z"
          fill={`url(#stone-fill-${data.id})`}
          stroke={`url(#stone-border-${data.id})`}
          strokeWidth="1.4"
          strokeLinejoin="round"
        />

        <g clipPath={`url(#stone-clip-${data.id})`}>
          <path d="M26 27L42 36" stroke={accent.border} strokeOpacity="0.18" strokeWidth="0.8" strokeLinecap="round" />
          <path d="M36 20L32 49" stroke={accent.border} strokeOpacity="0.16" strokeWidth="0.8" strokeLinecap="round" />
          <path d="M70 22L82 49" stroke={accent.border} strokeOpacity="0.16" strokeWidth="0.8" strokeLinecap="round" />
          <path d="M79 63L96 80" stroke={accent.border} strokeOpacity="0.15" strokeWidth="0.8" strokeLinecap="round" />
          <path d="M48 72L36 94" stroke={accent.border} strokeOpacity="0.15" strokeWidth="0.8" strokeLinecap="round" />
          <path d="M60 34L56 84" stroke={accent.border} strokeOpacity="0.12" strokeWidth="0.8" strokeLinecap="round" />

          <ellipse cx="60" cy="60" rx="38" ry="44" fill="rgba(255,255,255,0.025)" />

          <text
            x="60"
            y="63"
            textAnchor="middle"
            dominantBaseline="middle"
            fill={accent.ink}
            fontSize="31"
            fontWeight="600"
            letterSpacing="0.02em"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            {data.rune}
          </text>

          <text
            x="60"
            y="98"
            textAnchor="middle"
            fill={accent.ink}
            fillOpacity="0.9"
            fontSize="9.5"
            fontWeight="500"
            letterSpacing="0.015em"
            style={{ fontFamily: "Inter, system-ui, sans-serif" }}
          >
            {data.id}
          </text>
        </g>
      </svg>

      <div
        className="pointer-events-none absolute inset-0 rounded-[22px]"
        style={{
          boxShadow: selected ? `0 0 0 1px ${accent.glow}, inset 0 0 26px rgba(255,255,255,0.04)` : `inset 0 0 22px rgba(255,255,255,0.02)`,
        }}
      />
    </div>
  );
}

function YggdrasilBezierEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<FlowEdgeData>) {
  const isDownward = targetY > sourceY;
  const curvature = getEdgeCurvature(sourceY, targetY);
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature,
  });
  const gradientId = `edge-gradient-${id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  const width = data?.kind === 'default' ? 1.8 : isDownward ? 2.25 : 2;

  return (
    <g>
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#009650" stopOpacity="0.42" />
          <stop offset="100%" stopColor="#234D9B" stopOpacity="0.28" />
        </linearGradient>
      </defs>
      <path
        d={edgePath}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={data?.kind === 'default' ? 0.7 : 0.92}
        strokeDasharray={data?.kind === 'default' ? '4 7' : 'none'}
      />
    </g>
  );
}

const nodeTypes = {
  yggdrasilStone: YggdrasilStoneNode,
};

const edgeTypes = {
  bezier: YggdrasilBezierEdge,
};

function getPreferredDefaultTarget(kind: EditorNodeKind, nodeIds: string[]) {
  const fallbackTarget = nodeIds.find((nodeId) => nodeId.startsWith('fallback')) || nodeIds.find((nodeId) => nodeId !== 'start') || nodeIds[0] || DEFAULT_EDGE_TARGET;
  const startTarget = nodeIds.find((nodeId) => nodeId === 'start') || fallbackTarget;

  if (kind === 'fallback') {
    return startTarget;
  }

  if (kind === 'escalate') {
    return fallbackTarget;
  }

  return fallbackTarget;
}

function buildInitialDraft(existingIds: string[]): NewNodeDraft {
  const baseId = createUniqueId('nuevo_nodo', existingIds);
  return {
    id: baseId,
    message: '',
    kind: 'normal',
  };
}

function makeEdgeId(prefix: string, source: string, target: string) {
  const randomPart = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${source}-${target}-${randomPart}`;
}

export default function BotSettingsPage() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const flowRef = useRef<ReactFlowInstance<FlowNodeData, FlowEdgeData> | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdgeData>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [panelMessage, setPanelMessage] = useState<string | null>(null);
  const [isAddNodeOpen, setIsAddNodeOpen] = useState(false);
  const [draft, setDraft] = useState<NewNodeDraft>({ id: 'nuevo_nodo', message: '', kind: 'normal' });

  const requestedBusinessId = normalizeText(searchParams.get('businessId') || '');
  const isPlatformAdmin = user?.platformRole === 'PLATFORM_ADMIN';
  const isAdminScopedView = Boolean(isPlatformAdmin && requestedBusinessId);
  const botSettingsEndpoint = isAdminScopedView
    ? `/api/settings/bot?businessId=${encodeURIComponent(requestedBusinessId)}`
    : '/api/settings/bot';

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) || null,
    [nodes, selectedNodeId]
  );

  const selectedBranches = useMemo(
    () => edges.filter((edge) => edge.source === selectedNodeId && edge.data?.kind === 'branch'),
    [edges, selectedNodeId]
  );

  const selectedDefaultEdge = useMemo(
    () => edges.find((edge) => edge.source === selectedNodeId && edge.data?.kind === 'default') || null,
    [edges, selectedNodeId]
  );

  const nodeIdOptions = useMemo(() => nodes.map((node) => node.id), [nodes]);
  const starField = useMemo(() => createStarField(96), []);

  const fitViewSoon = useCallback(() => {
    if (!flowRef.current) return;
    window.requestAnimationFrame(() => {
      flowRef.current?.fitView({ padding: 0.22, duration: 500, includeHiddenNodes: false });
    });
  }, []);

  useEffect(() => {
    if (nodes.length > 0 || edges.length > 0) {
      console.log('[BotSettings] dagre layout effect running', {
        nodeCount: nodes.length,
        edgeCount: edges.length,
      });
    }
  }, [edges.length, nodes.length]);

  const applyFlowState = useCallback(
    (rawData: unknown) => {
      const nextState = buildFlowState(rawData);
      setNodes(nextState.nodes);
      setEdges(nextState.edges);
      setSelectedNodeId(nextState.nodes.find((node) => node.id === 'start')?.id || nextState.nodes[0]?.id || null);
      return nextState;
    },
    [setEdges, setNodes]
  );

  useEffect(() => {
    const loadFlow = async () => {
      setLoading(true);
      setError(null);
      setNotice(null);
      setPanelMessage(null);

      try {
        const response = await apiClient(botSettingsEndpoint);
        console.log('[BotSettings] GET /api/settings/bot response:', response);
        const nextState = applyFlowState(response);

        if (!isAdminScopedView) {
          try {
            const profile = await apiClient('/api/business/profile');
            setBusinessName(typeof profile?.name === 'string' ? profile.name : '');
          } catch (profileError) {
            setBusinessName('');
            setPanelMessage(profileError instanceof Error ? profileError.message : 'No se pudo cargar el perfil del negocio');
          }
        } else {
          setBusinessName('');
        }

        if (nextState.nodes.length > 0) {
          setNotice('Flujo cargado y dispuesto con layout jerárquico.');
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el flujo del bot');
      } finally {
        setLoading(false);
      }
    };

    loadFlow();
  }, [applyFlowState, botSettingsEndpoint, isAdminScopedView]);

  useEffect(() => {
    if (!selectedNode && nodes.length > 0) {
      setSelectedNodeId(nodes.find((node) => node.id === 'start')?.id || nodes[0].id);
    }
  }, [nodes, selectedNode]);

  useEffect(() => {
    if (nodes.length > 0) {
      fitViewSoon();
    }
  }, [fitViewSoon, nodes.length]);

  useEffect(() => {
    if (!selectedNodeId) return;
    if (selectedNode) return;

    setSelectedNodeId(nodes.find((node) => node.id === 'start')?.id || nodes[0]?.id || null);
  }, [nodes, selectedNode, selectedNodeId]);

  const updateSelectedNode = useCallback(
    (updater: (node: Node<FlowNodeData>) => Node<FlowNodeData>) => {
      if (!selectedNodeId) return;

      setNodes((current) => current.map((node) => (node.id === selectedNodeId ? updater(node) : node)));
    },
    [selectedNodeId, setNodes]
  );

  const updateBranchEdge = useCallback(
    (edgeId: string, updater: (edge: Edge<FlowEdgeData>) => Edge<FlowEdgeData>) => {
      setEdges((current) => current.map((edge) => (edge.id === edgeId ? updater(edge) : edge)));
    },
    [setEdges]
  );

  const updateDefaultEdge = useCallback(
    (targetId: string) => {
      if (!selectedNodeId) return;

      setEdges((current) => {
        const nextEdge: Edge<FlowEdgeData> = {
          id: `default-${selectedNodeId}`,
          source: selectedNodeId,
          target: targetId,
          type: 'bezier',
          data: { kind: 'default' },
        };

        const existingIndex = current.findIndex((edge) => edge.source === selectedNodeId && edge.data?.kind === 'default');
        if (existingIndex >= 0) {
          return current.map((edge) => (edge.source === selectedNodeId && edge.data?.kind === 'default' ? nextEdge : edge));
        }

        return [...current, nextEdge];
      });
    },
    [selectedNodeId, setEdges]
  );

  const handleCreateNode = useCallback(() => {
    setNodes((currentNodes) => {
      const existingIds = currentNodes.map((node) => node.id);
      const nextId = createUniqueId(draft.id, existingIds);
      const nextKind = draft.kind === 'escalate' ? 'escalate_agent' : draft.kind;
      const nextBotKind: NodeKind = nextKind === 'fallback' ? 'fallback' : nextKind === 'escalate_agent' ? 'escalate_agent' : 'normal';
      const nextDefaultTarget = getPreferredDefaultTarget(draft.kind, [...existingIds, nextId]);

      const newNode: Node<FlowNodeData> = {
        id: nextId,
        type: 'yggdrasilStone',
        position: { x: 0, y: 0 },
        data: {
          id: nextId,
          message: draft.message,
          kind: nextBotKind,
          rune: getRuneFromId(nextId),
        },
        sourcePosition: 'bottom',
        targetPosition: 'top',
      };

      setEdges((currentEdges) => {
        const nextEdges = [...currentEdges];

        if (nextDefaultTarget && nextDefaultTarget !== nextId) {
          nextEdges.push({
            id: `default-${nextId}`,
            source: nextId,
            target: nextDefaultTarget,
            type: 'bezier',
            data: { kind: 'default' },
          });
        }

        return nextEdges;
      });

      setSelectedNodeId(nextId);
      setIsAddNodeOpen(false);
      setNotice(`Nodo ${nextId} creado.`);
      setError(null);

      const nextNodes = [...currentNodes, newNode];
      const layout = layoutGraph(nextNodes, edges.filter((edge) => edge.source !== nextId));
      requestAnimationFrame(() => {
        setNodes(layout.nodes);
        fitViewSoon();
      });

      return layout.nodes;
    });
  }, [draft, edges, fitViewSoon, setEdges, setNodes]);

  const handleDeleteNode = useCallback(() => {
    if (!selectedNode || selectedNode.id === 'start') return;

    const confirmed = typeof window !== 'undefined'
      ? window.confirm(`¿Eliminar la piedra "${selectedNode.id}"?`)
      : true;

    if (!confirmed) return;

    setNodes((currentNodes) => {
      const remainingNodes = currentNodes.filter((node) => node.id !== selectedNode.id);
      const replacementId = remainingNodes.find((node) => node.id === 'fallback_rune')?.id
        || remainingNodes.find((node) => node.id.startsWith('fallback'))?.id
        || remainingNodes.find((node) => node.id === 'start')?.id
        || remainingNodes[0]?.id
        || null;

      setEdges((currentEdges) => currentEdges.filter((edge) => edge.source !== selectedNode.id && edge.target !== selectedNode.id).map((edge) => {
        if (replacementId && edge.target === selectedNode.id) {
          return {
            ...edge,
            target: replacementId,
          };
        }

        return edge;
      }));

      const nextSelected = remainingNodes.find((node) => node.id === 'start')?.id || replacementId || null;
      setSelectedNodeId(nextSelected);
      setNotice(`Nodo ${selectedNode.id} eliminado.`);

      const layout = layoutGraph(remainingNodes, edges.filter((edge) => edge.source !== selectedNode.id && edge.target !== selectedNode.id));
      requestAnimationFrame(() => {
        setNodes(layout.nodes);
        fitViewSoon();
      });

      return layout.nodes;
    });
  }, [edges, fitViewSoon, selectedNode, setEdges, setNodes]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const payload = {
        nodes: buildBotNodes(nodes, edges),
      };

      await apiClient(botSettingsEndpoint, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      setNotice('Cambios guardados correctamente.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar el flujo');
    } finally {
      setSaving(false);
    }
  }, [botSettingsEndpoint, edges, nodes]);

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;

      const nextEdge: Edge<FlowEdgeData> = {
        id: makeEdgeId('branch', connection.source, connection.target),
        source: connection.source,
        target: connection.target,
        type: 'bezier',
        data: {
          kind: 'branch',
          keywords: [],
        },
      };

      setEdges((current) => addEdge(nextEdge, current));
      setNotice('Rama creada entre piedras.');
    },
    [setEdges]
  );

  const handlePaneClick = useCallback((_: unknown) => {
    setSelectedNodeId(null);
  }, []);

  const handleFlowInit = useCallback((instance: ReactFlowInstance<FlowNodeData, FlowEdgeData>) => {
    flowRef.current = instance;
    fitViewSoon();
  }, [fitViewSoon]);

  const branchRows = useMemo(() => {
    return selectedBranches.map((edge) => ({
      id: edge.id,
      keywords: edge.data?.keywords || [],
      target: edge.target,
    }));
  }, [selectedBranches]);

  const defaultTargetValue = selectedDefaultEdge?.target || getPreferredDefaultTarget('normal', nodeIdOptions);

  const backgroundStars = useMemo(
    () => starField.map((star) => (
      <span
        key={star.id}
        className="absolute rounded-full bg-white"
        style={{
          left: `${star.left}%`,
          top: `${star.top}%`,
          width: `${star.size}px`,
          height: `${star.size}px`,
          opacity: star.opacity,
          animation: `starTwinkle ${star.duration}s ease-in-out infinite`,
          animationDelay: `${star.delay}s`,
        }}
      />
    )),
    [starField]
  );

  const auroraLayers = useMemo(
    () => [
      'aurora-band aurora-band-one',
      'aurora-band aurora-band-two',
      'aurora-band aurora-band-three',
      'aurora-band aurora-band-four',
    ],
    []
  );

  const selectedNodeLabel = selectedNode ? `${getRuneFromId(selectedNode.id)} · ${selectedNode.id}` : '';

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#04080F] text-[#E9F4FF]">
      <style jsx global>{`
        html,
        body {
          background: #04080f;
        }

        @keyframes auroraBandOne {
          0% {
            transform: translate3d(-14%, -6%, 0) scale(1.02, 1);
          }
          50% {
            transform: translate3d(12%, 5%, 0) scale(1.08, 1);
          }
          100% {
            transform: translate3d(-14%, -6%, 0) scale(1.02, 1);
          }
        }

        @keyframes auroraBandTwo {
          0% {
            transform: translate3d(10%, 2%, 0) scale(1, 1.04);
          }
          50% {
            transform: translate3d(-8%, -4%, 0) scale(1, 1.1);
          }
          100% {
            transform: translate3d(10%, 2%, 0) scale(1, 1.04);
          }
        }

        @keyframes auroraBandThree {
          0% {
            transform: translate3d(-6%, 4%, 0) scale(1.03, 1);
          }
          50% {
            transform: translate3d(8%, -7%, 0) scale(1.1, 1);
          }
          100% {
            transform: translate3d(-6%, 4%, 0) scale(1.03, 1);
          }
        }

        @keyframes auroraBandFour {
          0% {
            transform: translate3d(8%, -3%, 0) scale(1, 1.06);
          }
          50% {
            transform: translate3d(-10%, 7%, 0) scale(1, 1.12);
          }
          100% {
            transform: translate3d(8%, -3%, 0) scale(1, 1.06);
          }
        }

        @keyframes starTwinkle {
          0%,
          100% {
            opacity: 0.16;
          }
          50% {
            opacity: 0.9;
          }
        }

        @keyframes pulseGlow {
          0%,
          100% {
            opacity: 0.45;
            transform: scale(1);
          }
          50% {
            opacity: 0.9;
            transform: scale(1.08);
          }
        }

        @keyframes runeFloat {
          0%,
          100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-2px);
          }
        }

        .aurora-band {
          position: absolute;
          left: -25%;
          filter: blur(40px);
          opacity: 0.9;
          pointer-events: none;
          transform-origin: center;
          border-radius: 50%;
          mix-blend-mode: screen;
        }

        .aurora-band-one {
          top: 6%;
          width: 180%;
          height: 92px;
          background: linear-gradient(90deg, rgba(0, 255, 136, 0.06), rgba(0, 255, 136, 0.18) 42%, rgba(0, 204, 255, 0.12) 72%, transparent 100%);
          animation: auroraBandOne 20s ease-in-out infinite;
        }

        .aurora-band-two {
          top: 18%;
          width: 170%;
          height: 110px;
          background: linear-gradient(90deg, transparent 0%, rgba(0, 204, 255, 0.08) 20%, rgba(0, 255, 136, 0.16) 52%, rgba(136, 68, 255, 0.08) 78%, transparent 100%);
          animation: auroraBandTwo 28s ease-in-out infinite;
        }

        .aurora-band-three {
          top: 31%;
          width: 200%;
          height: 118px;
          background: linear-gradient(90deg, transparent 0%, rgba(136, 68, 255, 0.08) 14%, rgba(0, 255, 136, 0.1) 48%, rgba(0, 204, 255, 0.1) 70%, transparent 100%);
          animation: auroraBandThree 35s ease-in-out infinite;
        }

        .aurora-band-four {
          top: 44%;
          width: 160%;
          height: 84px;
          background: linear-gradient(90deg, transparent 0%, rgba(0, 255, 136, 0.08) 18%, rgba(136, 68, 255, 0.07) 52%, rgba(0, 204, 255, 0.08) 76%, transparent 100%);
          animation: auroraBandFour 22s ease-in-out infinite;
        }
      `}</style>

      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.03),transparent_34%),linear-gradient(180deg,rgba(4,8,15,0.92),rgba(4,8,15,1))]" />
        {auroraLayers.map((className) => (
          <div key={className} className={className} />
        ))}
        {backgroundStars}
      </div>

      <header className="fixed inset-x-0 top-0 z-40 border-b border-[#378ADD]/20 bg-[rgba(4,8,15,0.95)] backdrop-blur-md">
        <div className="flex h-[56px] items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-[#378ADD]/30 bg-[rgba(55,138,221,0.12)]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <rect x="4" y="5" width="16" height="12" rx="2" stroke="#C6E2FF" strokeWidth="1.8" />
                <path d="M8 9H16" stroke="#C6E2FF" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M8 13H13" stroke="#C6E2FF" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-[15px] font-medium leading-none text-[#F3F7FB]">Replai</span>
              <span className="mt-1 text-[11px] font-normal leading-none text-[#7C93AE]">Editor de flujo conversacional</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-[#378ADD]/20 bg-[rgba(55,138,221,0.08)] px-4 text-[12px] font-medium text-[#D7E9FF] transition-colors hover:border-[#378ADD]/35 hover:bg-[rgba(55,138,221,0.12)]"
            >
              ← Inicio
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 mt-[56px] h-[calc(100vh-56px)]">
        <div className="absolute inset-0 left-0 right-0 md:right-[280px]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,200,100,0.05),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(55,100,255,0.06),transparent_30%)]" />
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={handleConnect}
            onNodeClick={(_: unknown, node: Node<FlowNodeData>) => setSelectedNodeId(node.id)}
            onPaneClick={handlePaneClick}
            fitView
            onInit={handleFlowInit}
            className="h-full w-full"
            style={{ width: '100%', height: '100%', position: 'absolute' }}
            nodesDraggable
            nodesConnectable
            elementsSelectable
            selectNodesOnDrag={false}
            zoomOnScroll
            panOnDrag
            panOnScroll
            minZoom={0.28}
            maxZoom={1.65}
            defaultEdgeOptions={{
              type: 'bezier',
            }}
            fitViewOptions={{ padding: 0.22, minZoom: 0.35, maxZoom: 1.5 }}
          >
            <Background gap={34} size={1.1} color="rgba(103, 137, 181, 0.08)" />
            <Controls position="bottom-left" showInteractive={false} className="!rounded-[14px] !border !border-[#378ADD]/20 !bg-[rgba(4,8,15,0.72)] !text-[#D7E9FF]" />
          </ReactFlow>
        </div>

        <aside className="fixed right-0 top-[56px] z-30 flex h-[calc(100vh-56px)] w-full flex-col overflow-y-auto border-l border-[#378ADD]/18 bg-[rgba(4,8,15,0.92)] px-4 py-4 backdrop-blur-md md:w-[280px]">
          {panelMessage ? (
            <div className="mb-3 rounded-[12px] border border-[#F4C266]/18 bg-[rgba(139,105,20,0.12)] px-3 py-2 text-[12px] leading-5 text-[#F8E1A0]">
              {panelMessage}
            </div>
          ) : null}

          {!selectedNode ? (
            <div className="flex flex-1 items-center justify-center text-center">
              <div>
                <p className="text-[14px] font-medium text-[#D7E9FF]">Selecciona una piedra para editar</p>
                <p className="mt-2 text-[12px] leading-5 text-[#7C93AE]">
                  Haz clic en cualquier nodo del árbol para abrir su mensaje, ramas y salida por defecto.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
              <div className="rounded-[18px] border border-[#378ADD]/16 bg-[rgba(12,18,28,0.76)] p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#C9A84C]/28 bg-[rgba(201,168,76,0.1)] px-3 py-1 text-[12px] font-medium text-[#F2D58A]">
                    <span className="text-[15px]">{getRuneFromId(selectedNode.id)}</span>
                    <span>{selectedNode.id}</span>
                  </div>
                  <span className="rounded-full border border-[#378ADD]/18 bg-[rgba(55,138,221,0.08)] px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-[#8FAAD0]">
                    {getNodeKindLabel(selectedNode.data.kind)}
                  </span>
                </div>

                <label className="mt-4 block text-[12px] font-medium text-[#D7E9FF]">
                  Mensaje del bot
                  <textarea
                    value={selectedNode.data.message}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      updateSelectedNode((node) => ({
                        ...node,
                        data: {
                          ...node.data,
                          message: nextValue,
                        },
                      }));
                    }}
                    rows={6}
                    className="mt-2 w-full resize-none rounded-[14px] border border-[#378ADD]/16 bg-[rgba(6,10,16,0.92)] px-3 py-3 text-[13px] leading-5 text-[#DCEBFF] outline-none placeholder:text-[#557192] focus:border-[#378ADD]/35"
                    placeholder="Escribe el mensaje del nodo"
                  />
                </label>

                <div className="mt-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[12px] font-medium text-[#D7E9FF]">Ramas</p>
                    <button
                      type="button"
                      onClick={() => {
                        const nextTarget = nodeIdOptions.find((nodeId) => nodeId !== selectedNode.id) || selectedNode.id;
                        setEdges((current) => ([
                          ...current,
                          {
                            id: makeEdgeId('branch', selectedNode.id, nextTarget),
                            source: selectedNode.id,
                            target: nextTarget,
                            type: 'bezier',
                            data: {
                              kind: 'branch',
                              keywords: [],
                            },
                          },
                        ]));
                      }}
                      className="rounded-full border border-dashed border-[#378ADD]/28 px-3 py-1 text-[11px] font-medium text-[#CDE3FF] transition-colors hover:border-[#378ADD]/45 hover:bg-[rgba(55,138,221,0.08)]"
                    >
                      + Agregar rama
                    </button>
                  </div>

                  <div className="mt-3 space-y-3">
                    {branchRows.length === 0 ? (
                      <div className="rounded-[14px] border border-[#378ADD]/14 bg-[rgba(6,10,16,0.8)] px-3 py-3 text-[12px] text-[#7C93AE]">
                        Aún no hay ramas definidas para esta piedra.
                      </div>
                    ) : (
                      branchRows.map((row, index) => (
                        <div key={row.id} className="rounded-[14px] border border-[#378ADD]/14 bg-[rgba(6,10,16,0.8)] p-3">
                          <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                            <input
                              value={row.keywords.join(', ')}
                              onChange={(event) => {
                                const nextKeywords = parseKeywords(event.target.value);
                                updateBranchEdge(row.id, (edge) => ({
                                  ...edge,
                                  data: {
                                    ...(edge.data || { kind: 'branch' }),
                                    kind: 'branch',
                                    keywords: nextKeywords,
                                  },
                                }));
                              }}
                              className="rounded-[12px] border border-[#378ADD]/16 bg-[rgba(4,8,15,0.92)] px-3 py-2 text-[12px] text-[#DCEBFF] outline-none placeholder:text-[#557192] focus:border-[#378ADD]/35"
                              placeholder="palabras clave"
                            />

                            <select
                              value={row.target}
                              onChange={(event) => {
                                const nextTarget = event.target.value;
                                updateBranchEdge(row.id, (edge) => ({
                                  ...edge,
                                  target: nextTarget,
                                }));
                              }}
                              className="rounded-[12px] border border-[#378ADD]/16 bg-[rgba(4,8,15,0.92)] px-3 py-2 text-[12px] text-[#DCEBFF] outline-none focus:border-[#378ADD]/35"
                            >
                              {nodeIdOptions.map((nodeId) => (
                                <option key={nodeId} value={nodeId}>
                                  {nodeId}
                                </option>
                              ))}
                            </select>

                            <button
                              type="button"
                              onClick={() => {
                                setEdges((current) => current.filter((edge) => edge.id !== row.id));
                              }}
                              className="rounded-[12px] border border-[#6B2737]/28 bg-[rgba(107,39,55,0.12)] px-2 py-2 text-[11px] font-medium text-[#F0B6C0] transition-colors hover:border-[#6B2737]/42 hover:bg-[rgba(107,39,55,0.2)]"
                            >
                              Eliminar
                            </button>
                          </div>

                          <p className="mt-2 text-[10px] uppercase tracking-[0.16em] text-[#7C93AE]">
                            Rama {index + 1}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-[12px] font-medium text-[#D7E9FF]">
                    Si no coincide, ir a:
                    <select
                      value={selectedDefaultEdge?.target || defaultTargetValue}
                      onChange={(event) => updateDefaultEdge(event.target.value)}
                      className="mt-2 w-full rounded-[12px] border border-[#378ADD]/16 bg-[rgba(6,10,16,0.92)] px-3 py-2 text-[12px] text-[#DCEBFF] outline-none focus:border-[#378ADD]/35"
                    >
                      {nodeIdOptions.map((nodeId) => (
                        <option key={nodeId} value={nodeId}>
                          {nodeId}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="mt-4 grid gap-2">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex h-10 items-center justify-center rounded-[12px] bg-[#C9A84C] px-4 text-[13px] font-medium text-[#16202F] transition-colors hover:bg-[#D8BA61] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? 'Guardando...' : 'Guardar cambios'}
                  </button>

                  {selectedNode.id !== 'start' ? (
                    <button
                      type="button"
                      onClick={handleDeleteNode}
                      className="inline-flex h-10 items-center justify-center rounded-[12px] border border-[#6B2737]/26 bg-[rgba(107,39,55,0.1)] px-4 text-[13px] font-medium text-[#F0B6C0] transition-colors hover:border-[#6B2737]/42 hover:bg-[rgba(107,39,55,0.18)]"
                    >
                      Eliminar nodo
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          )}
        </aside>

        <button
          type="button"
          onClick={() => {
            const existingIds = nodes.map((node) => node.id);
            setDraft(buildInitialDraft(existingIds));
            setIsAddNodeOpen(true);
          }}
          className="fixed bottom-6 left-6 z-40 inline-flex h-14 items-center gap-3 rounded-full border border-[#C9A84C]/28 bg-[rgba(201,168,76,0.12)] px-5 text-[14px] font-medium text-[#F6E7BC] shadow-[0_0_0_1px_rgba(201,168,76,0.08)] transition-all hover:border-[#C9A84C]/42 hover:bg-[rgba(201,168,76,0.16)]"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[#C9A84C]/25 bg-[rgba(201,168,76,0.12)] text-[18px]" style={{ animation: 'pulseGlow 2.8s ease-in-out infinite' }}>
            +
          </span>
          Agregar nodo
        </button>

        {loading ? (
          <div className="pointer-events-none fixed inset-x-0 top-[56px] z-20 flex justify-center px-4 pt-4">
            <div className="rounded-full border border-[#378ADD]/18 bg-[rgba(4,8,15,0.82)] px-4 py-2 text-[12px] text-[#D7E9FF]">
              Cargando árbol rúnico...
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="pointer-events-none fixed inset-x-0 top-[88px] z-20 flex justify-center px-4">
            <div className="rounded-[14px] border border-[#6B2737]/30 bg-[rgba(107,39,55,0.22)] px-4 py-3 text-[12px] text-[#F4C6CF]">
              {error}
            </div>
          </div>
        ) : null}

        {notice ? (
          <div className="pointer-events-none fixed inset-x-0 top-[88px] z-20 flex justify-center px-4">
            <div className="rounded-[14px] border border-[#C9A84C]/28 bg-[rgba(201,168,76,0.14)] px-4 py-3 text-[12px] text-[#F6E7BC]">
              {notice}
            </div>
          </div>
        ) : null}

        <div className="fixed bottom-6 right-[296px] z-20 hidden max-w-[280px] rounded-[14px] border border-[#378ADD]/18 bg-[rgba(4,8,15,0.72)] px-4 py-3 text-[11px] leading-5 text-[#8EA9C6] shadow-[0_0_0_1px_rgba(55,138,221,0.04)] md:block">
          {businessName ? (
            <p className="text-[#CFE5FF]">{businessName}</p>
          ) : (
            <p className="text-[#CFE5FF]">Configuración del bot</p>
          )}
          <p className="mt-1">Arrastra las piedras, crea ramas y guarda el JSONB del flujo desde este editor.</p>
        </div>
      </main>

      {isAddNodeOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(1,4,8,0.72)] px-4 backdrop-blur-sm">
          <div className="w-full max-w-[420px] rounded-[24px] border border-[#378ADD]/18 bg-[rgba(4,8,15,0.96)] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[16px] font-medium text-[#F3F7FB]">Agregar nodo</p>
                <p className="mt-1 text-[12px] text-[#7C93AE]">Crea una nueva piedra y conecta su mensaje al árbol.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddNodeOpen(false)}
                className="rounded-full border border-[#378ADD]/16 bg-[rgba(55,138,221,0.08)] px-3 py-1 text-[12px] text-[#D7E9FF]"
              >
                Cerrar
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block text-[12px] font-medium text-[#D7E9FF]">
                ID del nodo
                <div className="mt-2 flex items-center gap-3">
                  <input
                    value={draft.id}
                    onChange={(event) => {
                      const nextId = normalizeText(event.target.value);
                      setDraft((current) => ({
                        ...current,
                        id: nextId,
                      }));
                    }}
                    className="flex-1 rounded-[14px] border border-[#378ADD]/16 bg-[rgba(6,10,16,0.92)] px-3 py-2 text-[13px] text-[#DCEBFF] outline-none focus:border-[#378ADD]/35"
                    placeholder="nuevo_nodo"
                  />
                  <div className="flex h-10 min-w-10 items-center justify-center rounded-full border border-[#C9A84C]/26 bg-[rgba(201,168,76,0.1)] px-3 text-[22px] text-[#F2D58A]">
                    {getRuneFromId(draft.id)}
                  </div>
                </div>
              </label>

              <label className="block text-[12px] font-medium text-[#D7E9FF]">
                Mensaje inicial
                <textarea
                  value={draft.message}
                  onChange={(event) => {
                    const nextMessage = event.target.value;
                    setDraft((current) => ({
                      ...current,
                      message: nextMessage,
                    }));
                  }}
                  rows={5}
                  className="mt-2 w-full resize-none rounded-[14px] border border-[#378ADD]/16 bg-[rgba(6,10,16,0.92)] px-3 py-3 text-[13px] leading-5 text-[#DCEBFF] outline-none focus:border-[#378ADD]/35"
                  placeholder="Mensaje que se mostrará al entrar en este nodo"
                />
              </label>

              <label className="block text-[12px] font-medium text-[#D7E9FF]">
                Tipo del nodo
                <select
                  value={draft.kind}
                  onChange={(event) => {
                    const nextKind = event.target.value as EditorNodeKind;
                    setDraft((current) => ({
                      ...current,
                      kind: nextKind,
                    }));
                  }}
                  className="mt-2 w-full rounded-[14px] border border-[#378ADD]/16 bg-[rgba(6,10,16,0.92)] px-3 py-2 text-[13px] text-[#DCEBFF] outline-none focus:border-[#378ADD]/35"
                >
                  <option value="normal">Normal</option>
                  <option value="fallback">Fallback</option>
                  <option value="escalate">Escalate</option>
                </select>
              </label>

              <button
                type="button"
                onClick={handleCreateNode}
                className="inline-flex h-11 w-full items-center justify-center rounded-[14px] bg-[#C9A84C] px-4 text-[13px] font-medium text-[#16202F] transition-colors hover:bg-[#D8BA61]"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
