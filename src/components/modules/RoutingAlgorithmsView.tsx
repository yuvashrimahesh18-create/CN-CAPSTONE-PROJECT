import React, { useMemo, useState } from 'react';
import { Play, RotateCcw } from 'lucide-react';

interface GraphEdge {
  id: string;
  u: string;
  v: string;
  cost: number;
  up: boolean;
}

const ROUTERS = [
  { id: 'R1', x: 120, y: 180 },
  { id: 'R2', x: 340, y: 80 },
  { id: 'R3', x: 340, y: 280 },
  { id: 'R4', x: 580, y: 80 },
  { id: 'R5', x: 580, y: 280 },
  { id: 'R6', x: 800, y: 180 },
];

const INITIAL_EDGES: GraphEdge[] = [
  { id: 'e1', u: 'R1', v: 'R2', cost: 2, up: true },
  { id: 'e2', u: 'R1', v: 'R3', cost: 5, up: true },
  { id: 'e3', u: 'R2', v: 'R3', cost: 2, up: true },
  { id: 'e4', u: 'R2', v: 'R4', cost: 4, up: true },
  { id: 'e5', u: 'R3', v: 'R5', cost: 3, up: true },
  { id: 'e6', u: 'R4', v: 'R5', cost: 1, up: true },
  { id: 'e7', u: 'R4', v: 'R6', cost: 6, up: true },
  { id: 'e8', u: 'R5', v: 'R6', cost: 2, up: true },
];

export function RoutingAlgorithmsView() {
  const [algo, setAlgo] = useState<'dijkstra' | 'bellman-ford'>('dijkstra');
  const [sourceRouter, setSourceRouter] = useState('R1');
  const [targetRouter, setTargetRouter] = useState('R6');
  const [edges, setEdges] = useState<GraphEdge[]>(INITIAL_EDGES);
  const [stepLimit, setStepLimit] = useState<number>(99);

  const computation = useMemo(() => {
    const dist: Record<string, number> = {};
    const prev: Record<string, string | null> = {};
    const logs: string[] = [];
    const activeEdges = edges.filter((e) => e.up);

    ROUTERS.forEach((r) => {
      dist[r.id] = r.id === sourceRouter ? 0 : Infinity;
      prev[r.id] = null;
    });

    let steps = 0;

    if (algo === 'dijkstra') {
      const visited = new Set<string>();
      while (visited.size < ROUTERS.length && steps < stepLimit) {
        let u: string | null = null;
        let best = Infinity;
        for (const r of ROUTERS) {
          if (!visited.has(r.id) && dist[r.id] < best) {
            best = dist[r.id];
            u = r.id;
          }
        }
        if (!u) break;
        visited.add(u);
        steps++;
        logs.push(`Step ${steps}: Settled ${u} (cost ${dist[u]}). Relaxing outgoing neighbors.`);

        for (const edge of activeEdges) {
          const nb = edge.u === u ? edge.v : edge.v === u ? edge.u : null;
          if (!nb || visited.has(nb)) continue;
          const alt = dist[u] + edge.cost;
          if (alt < dist[nb]) {
            dist[nb] = alt;
            prev[nb] = u;
            logs.push(`  Relaxed ${u} -> ${nb}: updated cost to ${alt}`);
          }
        }
      }
    } else {
      // Bellman-Ford Distance Vector iterations
      for (let round = 1; round <= ROUTERS.length - 1 && steps < stepLimit; round++) {
        let changed = false;
        steps++;
        for (const edge of activeEdges) {
          if (dist[edge.u] !== Infinity && dist[edge.u] + edge.cost < dist[edge.v]) {
            dist[edge.v] = dist[edge.u] + edge.cost;
            prev[edge.v] = edge.u;
            changed = true;
          }
          if (dist[edge.v] !== Infinity && dist[edge.v] + edge.cost < dist[edge.u]) {
            dist[edge.u] = dist[edge.v] + edge.cost;
            prev[edge.u] = edge.v;
            changed = true;
          }
        }
        logs.push(
          `Round ${round} (DV Exchange): ${changed ? 'Routing tables updated across neighbors.' : 'Converged — no further updates.'}`
        );
        if (!changed) break;
      }
    }

    // Reconstruct path to targetRouter
    const pathNodes: string[] = [];
    const pathEdgeIds: string[] = [];
    if (dist[targetRouter] !== Infinity) {
      let curr: string | null = targetRouter;
      while (curr) {
        pathNodes.unshift(curr);
        const p: string | null = prev[curr] ?? null;
        if (p) {
          const edge = activeEdges.find(
            (e) => (e.u === p && e.v === curr) || (e.v === p && e.u === curr)
          );
          if (edge) pathEdgeIds.push(edge.id);
        }
        curr = p;
      }
    }

    return { dist, prev, logs, pathNodes, pathEdgeIds, totalSteps: steps };
  }, [algo, sourceRouter, targetRouter, edges, stepLimit]);

  const getNextHop = (dest: string) => {
    if (dest === sourceRouter) return 'Local';
    if (computation.dist[dest] === Infinity) return 'Unreachable';
    let curr: string | null = dest;
    let lastHop = dest;
    while (curr && curr !== sourceRouter) {
      lastHop = curr;
      curr = computation.prev[curr];
    }
    return curr === sourceRouter ? lastHop : 'Unreachable';
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">07. Routing Algorithms (Dijkstra & Bellman-Ford)</h2>
          <p className="text-sm text-slate-600 mt-1">
            Compare Link-State (OSPF / Dijkstra) and Distance-Vector (RIP / Bellman-Ford) convergence, link weights, and failover paths.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              onClick={() => {
                setAlgo('dijkstra');
                setStepLimit(99);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                algo === 'dijkstra' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              Dijkstra (Link-State)
            </button>
            <button
              onClick={() => {
                setAlgo('bellman-ford');
                setStepLimit(99);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                algo === 'bellman-ford' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              Bellman-Ford (Distance-Vector)
            </button>
          </div>

          <button
            onClick={() => setStepLimit((s) => (s >= 6 ? 1 : s + 1))}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-sky-600 text-white rounded-md hover:bg-sky-700 cursor-pointer"
          >
            <Play size={14} /> {stepLimit >= 6 ? 'Step From Start' : `Next Step (${stepLimit})`}
          </button>
          <button
            onClick={() => {
              setEdges(INITIAL_EDGES);
              setStepLimit(99);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-slate-300 bg-white rounded-md hover:bg-slate-50 cursor-pointer"
          >
            <RotateCcw size={14} /> Reset Weights
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-8 space-y-4">
          {/* Interactive Weighted Graph SVG */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <svg viewBox="0 0 920 360" className="w-full h-80">
              {edges.map((e) => {
                const u = ROUTERS.find((r) => r.id === e.u)!;
                const v = ROUTERS.find((r) => r.id === e.v)!;
                const onPath = computation.pathEdgeIds.includes(e.id);
                const mx = (u.x + v.x) / 2;
                const my = (u.y + v.y) / 2;
                return (
                  <g key={e.id}>
                    <line
                      x1={u.x}
                      y1={u.y}
                      x2={v.x}
                      y2={v.y}
                      stroke={!e.up ? '#dc2626' : onPath ? '#0284c7' : '#94a3b8'}
                      strokeWidth={onPath ? 4 : 2}
                      strokeDasharray={!e.up ? '6 5' : undefined}
                    />
                    <g
                      transform={`translate(${mx}, ${my})`}
                      onClick={() =>
                        setEdges((prev) => prev.map((ed) => (ed.id === e.id ? { ...ed, up: !ed.up } : ed)))
                      }
                      className="cursor-pointer"
                    >
                      <rect
                        x={-24}
                        y={-12}
                        width={48}
                        height={24}
                        rx={4}
                        fill="#ffffff"
                        stroke={onPath ? '#0284c7' : '#cbd5e1'}
                      />
                      <text textAnchor="middle" dy="4" className="font-mono text-xs font-semibold fill-slate-800">
                        {e.up ? `w=${e.cost}` : 'DOWN'}
                      </text>
                    </g>
                  </g>
                );
              })}

              {ROUTERS.map((r) => {
                const isSrc = r.id === sourceRouter;
                const isDst = r.id === targetRouter;
                const d = computation.dist[r.id];
                return (
                  <g key={r.id} transform={`translate(${r.x}, ${r.y})`}>
                    <circle
                      r={28}
                      fill="#ffffff"
                      stroke={isSrc ? '#059669' : isDst ? '#0284c7' : '#64748b'}
                      strokeWidth={isSrc || isDst ? 3 : 1.5}
                    />
                    <text textAnchor="middle" dy="-2" className="text-xs font-bold fill-slate-900">
                      {r.id}
                    </text>
                    <text textAnchor="middle" dy="14" className="font-mono text-[10px] fill-slate-500">
                      {d === Infinity ? '∞' : `cost:${d}`}
                    </text>
                  </g>
                );
              })}
            </svg>
            <div className="flex flex-wrap items-center justify-between text-xs text-slate-600 px-2 pt-2 border-t border-slate-200">
              <span>Click any edge weight label to toggle link UP / DOWN and watch routes reconverge.</span>
              <span className="font-mono font-semibold text-sky-700">
                Best Path ({sourceRouter} → {targetRouter}):{' '}
                {computation.pathNodes.length ? computation.pathNodes.join(' → ') : 'Unreachable'} (Cost:{' '}
                {computation.dist[targetRouter] === Infinity ? '∞' : computation.dist[targetRouter]})
              </span>
            </div>
          </div>

          {/* Convergence Log */}
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-2">Algorithm Execution Trace</h3>
            <div className="font-mono text-xs space-y-1 text-slate-700 max-h-40 overflow-y-auto">
              {computation.logs.map((l, i) => (
                <div key={i}>{l}</div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Router Selector, Weights & Forwarding Table */}
        <div className="xl:col-span-4 space-y-4">
          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">Source & Destination</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-600 mb-1">Source Router</label>
                <select
                  value={sourceRouter}
                  onChange={(e) => setSourceRouter(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
                >
                  {ROUTERS.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.id}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Target Router</label>
                <select
                  value={targetRouter}
                  onChange={(e) => setTargetRouter(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
                >
                  {ROUTERS.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.id}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Computed Forwarding Table */}
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">
              Forwarding Table on {sourceRouter}
            </h3>
            <table className="w-full text-xs font-mono tabular-nums text-left">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-sans">
                  <th className="py-1.5">Destination</th>
                  <th className="py-1.5">Next Hop</th>
                  <th className="py-1.5 text-right">Metric</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ROUTERS.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2 font-semibold text-slate-900">{r.id}</td>
                    <td className="py-2 text-sky-700">{getNextHop(r.id)}</td>
                    <td className="py-2 text-right">
                      {computation.dist[r.id] === Infinity ? '∞' : computation.dist[r.id]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Link Weight Editor */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-2">
            <h3 className="text-sm font-semibold text-slate-900 mb-2">Link Metric Weights</h3>
            {edges.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="font-mono text-slate-700 w-16">
                  {e.u}–{e.v}
                </span>
                <input
                  type="range"
                  min={1}
                  max={15}
                  value={e.cost}
                  onChange={(ev) =>
                    setEdges((prev) => prev.map((ed) => (ed.id === e.id ? { ...ed, cost: Number(ev.target.value) } : ed)))
                  }
                  className="flex-1 accent-sky-600"
                />
                <span className="font-mono tabular-nums w-6 text-right">{e.cost}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
