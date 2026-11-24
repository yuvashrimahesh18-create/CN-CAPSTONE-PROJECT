import React, { useRef, useState } from 'react';
import { Monitor, Router as RouterIcon, Server, Share2 } from 'lucide-react';
import { AnimatedPacket, NetworkLink, NetworkNode } from '../types/network';

interface TopologyMapProps {
  nodes: NetworkNode[];
  links: NetworkLink[];
  animatedPackets?: AnimatedPacket[];
  selectedNodeId?: string | null;
  selectedLinkId?: string | null;
  highlightedLinkIds?: string[];
  highlightedNodeIds?: string[];
  onSelectNode?: (nodeId: string) => void;
  onSelectLink?: (linkId: string) => void;
  onMoveNode?: (nodeId: string, x: number, y: number) => void;
  heightClass?: string;
}

export function TopologyMap({
  nodes,
  links,
  animatedPackets = [],
  selectedNodeId,
  selectedLinkId,
  highlightedLinkIds = [],
  highlightedNodeIds = [],
  onSelectNode,
  onSelectLink,
  onMoveNode,
  heightClass = 'h-[430px]',
}: TopologyMapProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!draggingId || !onMoveNode || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = Math.max(55, Math.min(945, ((e.clientX - rect.left) / rect.width) * 1000));
    const y = Math.max(55, Math.min(465, ((e.clientY - rect.top) / rect.height) * 520));
    onMoveNode(draggingId, Math.round(x), Math.round(y));
  };

  const handlePointerUp = () => {
    setDraggingId(null);
  };

  const renderNodeIcon = (type: NetworkNode['type'], stroke: string) => {
    const props = { size: 18, color: stroke, strokeWidth: 2 };
    if (type === 'router') return <RouterIcon {...props} />;
    if (type === 'switch') return <Share2 {...props} />;
    if (type === 'server') return <Server {...props} />;
    return <Monitor {...props} />;
  };

  return (
    <div className={`relative w-full ${heightClass} bg-slate-50 border border-slate-200 rounded-lg overflow-hidden select-none`}>
      <svg
        ref={svgRef}
        viewBox="0 0 1000 520"
        className="w-full h-full"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <defs>
          <pattern id="netlab-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e2e8f0" strokeWidth="0.8" />
          </pattern>
        </defs>
        <rect width="1000" height="520" fill="url(#netlab-grid)" />

        {/* Links */}
        {links.map((link) => {
          const src = nodes.find((n) => n.id === link.source);
          const dst = nodes.find((n) => n.id === link.target);
          if (!src || !dst) return null;

          const isSelected = selectedLinkId === link.id;
          const isHighlighted = highlightedLinkIds.includes(link.id);
          const hasFault = !link.up || link.lossPct > 0 || link.delayMs > 40;

          let stroke = '#cbd5e1';
          let strokeWidth = 2.5;
          let strokeDasharray: string | undefined = undefined;

          if (!link.up) {
            stroke = '#dc2626';
            strokeWidth = 2.5;
            strokeDasharray = '6 5';
          } else if (isHighlighted || isSelected) {
            stroke = '#0284c7';
            strokeWidth = 3.5;
          } else if (link.lossPct > 0 || link.delayMs > 40) {
            stroke = '#d97706';
            strokeWidth = 2.5;
          } else {
            stroke = '#94a3b8';
          }

          const midX = (src.x + dst.x) / 2;
          const midY = (src.y + dst.y) / 2;

          return (
            <g
              key={link.id}
              onClick={() => onSelectLink?.(link.id)}
              className="cursor-pointer"
            >
              {/* Wider invisible hit target */}
              <line x1={src.x} y1={src.y} x2={dst.x} y2={dst.y} stroke="transparent" strokeWidth={16} />
              <line
                x1={src.x}
                y1={src.y}
                x2={dst.x}
                y2={dst.y}
                stroke={stroke}
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeLinecap="round"
              />
              {/* Link metric label */}
              <g transform={`translate(${midX}, ${midY})`}>
                <rect
                  x={-36}
                  y={-11}
                  width={72}
                  height={22}
                  rx={4}
                  fill="#ffffff"
                  stroke={hasFault ? stroke : '#e2e8f0'}
                  strokeWidth={1}
                />
                <text
                  textAnchor="middle"
                  dy="4"
                  className="font-mono text-[10px] fill-slate-700"
                >
                  {!link.up
                    ? 'LINK DOWN'
                    : link.lossPct > 0
                    ? `${link.delayMs}ms · ${link.lossPct}%`
                    : `${link.delayMs}ms · ${link.bandwidthMbps}M`}
                </text>
              </g>
            </g>
          );
        })}

        {/* Animated Packets */}
        {animatedPackets.map((pkt) => {
          if (pkt.progress < 0 || pkt.progress > 1) return null;
          const link = links.find((l) => l.id === pkt.linkId);
          if (!link || !link.up) return null;
          const src = nodes.find((n) => n.id === link.source);
          const dst = nodes.find((n) => n.id === link.target);
          if (!src || !dst) return null;

          const t = pkt.reverse ? 1 - pkt.progress : pkt.progress;
          const cx = src.x + (dst.x - src.x) * t;
          const cy = src.y + (dst.y - src.y) * t;

          return (
            <g key={pkt.id} transform={`translate(${cx}, ${cy})`} className="pointer-events-none">
              <circle r={6} fill={pkt.color} stroke="#ffffff" strokeWidth={2} />
              <text
                y={-10}
                textAnchor="middle"
                className="font-mono text-[9px] font-semibold"
                fill={pkt.color}
              >
                {pkt.protocol}
              </text>
            </g>
          );
        })}

        {/* Nodes */}
        {nodes.map((node) => {
          const isSelected = selectedNodeId === node.id;
          const isHighlighted = highlightedNodeIds.includes(node.id);
          const isUp = node.status === 'up';
          const isBooting = node.status === 'booting';

          const ringStroke = isSelected
            ? '#0284c7'
            : isHighlighted
            ? '#059669'
            : isUp
            ? '#cbd5e1'
            : isBooting
            ? '#d97706'
            : '#e2e8f0';

          const iconColor = !isUp
            ? '#94a3b8'
            : node.type === 'router'
            ? '#0284c7'
            : node.type === 'switch'
            ? '#4f46e5'
            : node.type === 'server'
            ? '#059669'
            : '#0f172a';

          return (
            <g
              key={node.id}
              transform={`translate(${node.x}, ${node.y})`}
              onPointerDown={(e) => {
                e.stopPropagation();
                onSelectNode?.(node.id);
                if (onMoveNode) setDraggingId(node.id);
              }}
              className={onMoveNode ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}
            >
              <circle
                r={26}
                fill="#ffffff"
                stroke={ringStroke}
                strokeWidth={isSelected || isHighlighted ? 2.5 : 1.5}
              />
              <foreignObject x={-9} y={-9} width={18} height={18} className="pointer-events-none">
                <div className="w-full h-full flex items-center justify-center">
                  {renderNodeIcon(node.type, iconColor)}
                </div>
              </foreignObject>

              {/* Node label + IP */}
              <text
                y={41}
                textAnchor="middle"
                className="text-[12px] font-semibold fill-slate-900"
              >
                {node.label} ({node.type})
              </text>
              <text
                y={55}
                textAnchor="middle"
                className="font-mono text-[10px] fill-slate-500"
              >
                {node.ip}/{node.cidr}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Corner legend (unboxed inline metadata) */}
      <div className="absolute bottom-3 left-4 flex flex-wrap items-center gap-4 text-xs text-slate-600 bg-white/90 px-3 py-1.5 rounded border border-slate-200">
        <span>Drag nodes to reposition</span>
        <span aria-hidden="true">·</span>
        <span>Click node or link to inspect</span>
        <span aria-hidden="true">·</span>
        <span className="text-sky-700 font-medium">Blue: Active Path</span>
        <span className="text-amber-700 font-medium">Amber: Loss / High Delay</span>
        <span className="text-red-700 font-medium">Red Dashed: Link Down</span>
      </div>
    </div>
  );
}
