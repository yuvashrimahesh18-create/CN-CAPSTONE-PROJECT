import React, { useState } from 'react';
import { Play, Plus, RotateCcw, Square, Trash2 } from 'lucide-react';
import { useLab } from '../../context/LabContext';
import { NodeType } from '../../types/network';
import { TOPOLOGY_PRESETS } from '../../utils/networkEngine';
import { TopologyMap } from '../TopologyMap';

export function LabAutomationView() {
  const {
    presetId,
    labStatus,
    nodes,
    links,
    animatedPackets,
    trafficHistory,
    deployPreset,
    startLab,
    stopLab,
    restartLab,
    updateNode,
    addNode,
    removeNode,
    updateLink,
    addLink,
    removeLink,
  } = useLab();

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(nodes[0]?.id ?? null);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [newNodeType, setNewNodeType] = useState<NodeType>('host');
  const [newNodeConnectTo, setNewNodeConnectTo] = useState<string>(nodes[0]?.id ?? 's1');
  const [linkSrc, setLinkSrc] = useState<string>(nodes[0]?.id ?? '');
  const [linkDst, setLinkDst] = useState<string>(nodes[1]?.id ?? '');

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;
  const selectedLink = links.find((l) => l.id === selectedLinkId) || null;

  const upNodes = nodes.filter((n) => n.status === 'up').length;
  const upLinks = links.filter((l) => l.up).length;
  const latestTraffic = trafficHistory[trafficHistory.length - 1] || {
    throughputMbps: 0,
    packetRate: 0,
    lossRate: 0,
    avgRttMs: 0,
  };

  // SVG chart scaling for traffic history
  const maxThroughput = Math.max(60, ...trafficHistory.map((t) => t.throughputMbps));
  const chartW = 540;
  const chartH = 140;
  const points = trafficHistory
    .map((sample, idx) => {
      const x = trafficHistory.length <= 1 ? 0 : (idx / (trafficHistory.length - 1)) * chartW;
      const y = chartH - (sample.throughputMbps / maxThroughput) * (chartH - 16) - 8;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const areaPoints = `0,${chartH} ${points} ${chartW},${chartH}`;

  const handleAddNode = () => {
    const prefix = newNodeType === 'router' ? 'r' : newNodeType === 'switch' ? 's' : 'h';
    let idx = 1;
    while (nodes.some((n) => n.id === `${prefix}${idx}`)) idx++;
    const id = `${prefix}${idx}`;
    const targetNode = nodes.find((n) => n.id === newNodeConnectTo);
    const octets = (targetNode?.ip || '10.0.1.1').split('.');
    const nextLast = Math.min(250, 20 + idx * 3);
    const ip = `${octets[0]}.${octets[1]}.${octets[2]}.${nextLast}`;

    addNode(
      {
        id,
        label: id,
        type: newNodeType,
        x: Math.min(900, Math.max(100, (targetNode?.x ?? 500) + (Math.random() * 140 - 70))),
        y: Math.min(440, Math.max(80, (targetNode?.y ?? 260) + (Math.random() * 140 - 70))),
        ip,
        cidr: targetNode?.cidr ?? 24,
        gateway: targetNode?.gateway ?? `${octets[0]}.${octets[1]}.${octets[2]}.1`,
        mac: `00:00:00:00:${String(idx).padStart(2, '0')}:${String(Math.floor(Math.random() * 89 + 10))}`,
        iface: `${id}-eth0`,
        mtu: 1500,
        status: labStatus === 'running' ? 'up' : 'down',
        cpuLoad: labStatus === 'running' ? 9 : 0,
        role: `Dynamic ${newNodeType}`,
      },
      newNodeConnectTo || undefined
    );
    setSelectedNodeId(id);
    setSelectedLinkId(null);
  };

  return (
    <div className="space-y-6">
      {/* Orchestration Header & Controls */}
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">01. Lab Automation Engine & Live Topology</h2>
            <p className="text-sm text-slate-600 mt-1">
              Deploy virtual network topologies, manage node lifecycle states, and inspect real-time packet traffic without external VMs.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={startLab}
              disabled={labStatus === 'running' || labStatus === 'deploying'}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-45 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Play size={15} />
              Start Lab
            </button>
            <button
              onClick={restartLab}
              disabled={labStatus === 'deploying' || labStatus === 'stopping'}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-45 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw size={15} />
              Reboot Nodes
            </button>
            <button
              onClick={stopLab}
              disabled={labStatus === 'stopped' || labStatus === 'stopping'}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-45 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Square size={15} />
              Shutdown Lab
            </button>
          </div>
        </div>

        {/* Topology Preset Selector */}
        <div className="mt-5 pt-4 border-t border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-3">
          {TOPOLOGY_PRESETS.map((preset) => {
            const active = preset.id === presetId;
            return (
              <button
                key={preset.id}
                onClick={() => {
                  deployPreset(preset.id);
                  setSelectedNodeId(preset.nodes[0]?.id ?? null);
                  setSelectedLinkId(null);
                }}
                className={`text-left p-3.5 rounded-lg border transition-colors cursor-pointer ${
                  active
                    ? 'border-sky-600 bg-sky-50/70'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-900">{preset.name}</span>
                  <span className={`text-xs font-medium ${active ? 'text-sky-700' : 'text-slate-500'}`}>
                    {active ? 'Active' : 'Deploy'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1 line-clamp-2">{preset.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">Lab Engine State</div>
          <div className="mt-1 flex items-center gap-2">
            <span
              className={`text-lg font-semibold capitalize ${
                labStatus === 'running'
                  ? 'text-emerald-700'
                  : labStatus === 'stopped'
                  ? 'text-red-700'
                  : 'text-amber-700'
              }`}
            >
              {labStatus}
            </span>
            <span className="text-xs text-slate-500 tabular-nums">
              · {upNodes}/{nodes.length} nodes up
            </span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">Aggregate Throughput</div>
          <div className="mt-1 text-lg font-semibold font-mono tabular-nums text-slate-900">
            {labStatus === 'running' ? latestTraffic.throughputMbps.toFixed(1) : '0.0'} Mbps
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">Simulated Packet Rate</div>
          <div className="mt-1 text-lg font-semibold font-mono tabular-nums text-slate-900">
            {labStatus === 'running' ? latestTraffic.packetRate : 0} pkt/s
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">Active Links & Mean RTT</div>
          <div className="mt-1 text-lg font-semibold font-mono tabular-nums text-slate-900">
            {upLinks}/{links.length} · {labStatus === 'running' ? latestTraffic.avgRttMs.toFixed(1) : '0.0'} ms
          </div>
        </div>
      </div>

      {/* Main Split: Topology Stage + Inspector & Traffic Analytics */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-8 space-y-4">
          <TopologyMap
            nodes={nodes}
            links={links}
            animatedPackets={animatedPackets}
            selectedNodeId={selectedNodeId}
            selectedLinkId={selectedLinkId}
            onSelectNode={(id) => {
              setSelectedNodeId(id);
              setSelectedLinkId(null);
            }}
            onSelectLink={(id) => {
              setSelectedLinkId(id);
              setSelectedNodeId(null);
            }}
            onMoveNode={(id, x, y) => updateNode(id, { x, y })}
          />

          {/* Live Simulated Traffic Analytics Chart */}
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Real-Time Simulated Network Traffic</h3>
                <p className="text-xs text-slate-500">
                  Live throughput (Mbps) and packet rate across active virtual links
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono tabular-nums text-slate-600">
                <span>Peak: {Math.max(...trafficHistory.map((t) => t.throughputMbps)).toFixed(1)} Mbps</span>
                <span>Avg Loss: {latestTraffic.lossRate.toFixed(1)}%</span>
              </div>
            </div>
            <div className="w-full overflow-hidden">
              <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-36 bg-slate-50 rounded border border-slate-200">
                <line x1="0" y1={chartH * 0.25} x2={chartW} y2={chartH * 0.25} stroke="#e2e8f0" strokeDasharray="4 4" />
                <line x1="0" y1={chartH * 0.5} x2={chartW} y2={chartH * 0.5} stroke="#e2e8f0" strokeDasharray="4 4" />
                <line x1="0" y1={chartH * 0.75} x2={chartW} y2={chartH * 0.75} stroke="#e2e8f0" strokeDasharray="4 4" />
                <polygon points={areaPoints} fill="rgba(2, 132, 199, 0.12)" />
                <polyline points={points} fill="none" stroke="#0284c7" strokeWidth="2.2" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>

        {/* Right Panel: Node/Link Inspector & Provisioning */}
        <div className="xl:col-span-4 space-y-4">
          {/* Selected Node or Link Inspector */}
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">
              {selectedNode
                ? `Node Inspector: ${selectedNode.label}`
                : selectedLink
                ? `Link Inspector: ${selectedLink.source} ↔ ${selectedLink.target}`
                : 'Topology Inspector'}
            </h3>

            {selectedNode ? (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                    <div className="text-slate-500">Type & Role</div>
                    <div className="font-medium text-slate-900 capitalize mt-0.5">
                      {selectedNode.type} · {selectedNode.role || 'Node'}
                    </div>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                    <div className="text-slate-500">Status & CPU</div>
                    <div className="font-mono tabular-nums font-medium text-slate-900 mt-0.5">
                      {selectedNode.status.toUpperCase()} · {selectedNode.cpuLoad}%
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">IPv4 Address</label>
                  <input
                    type="text"
                    value={selectedNode.ip}
                    onChange={(e) => updateNode(selectedNode.id, { ip: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm font-mono border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">CIDR Prefix</label>
                    <input
                      type="number"
                      min={8}
                      max={30}
                      value={selectedNode.cidr}
                      onChange={(e) => updateNode(selectedNode.id, { cidr: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 text-sm font-mono border border-slate-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Default Gateway</label>
                    <input
                      type="text"
                      value={selectedNode.gateway}
                      onChange={(e) => updateNode(selectedNode.id, { gateway: e.target.value })}
                      className="w-full px-3 py-1.5 text-sm font-mono border border-slate-300 rounded-md"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                  <button
                    onClick={() =>
                      updateNode(selectedNode.id, {
                        status: selectedNode.status === 'up' ? 'down' : 'up',
                        cpuLoad: selectedNode.status === 'up' ? 0 : 12,
                      })
                    }
                    className="px-3 py-1.5 text-xs font-medium rounded border border-slate-300 hover:bg-slate-50 cursor-pointer"
                  >
                    {selectedNode.status === 'up' ? 'Disable Interface' : 'Enable Interface'}
                  </button>
                  {nodes.length > 2 && (
                    <button
                      onClick={() => {
                        removeNode(selectedNode.id);
                        setSelectedNodeId(null);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 rounded cursor-pointer"
                    >
                      <Trash2 size={13} />
                      Remove Node
                    </button>
                  )}
                </div>
              </div>
            ) : selectedLink ? (
              <div className="space-y-3 text-sm">
                <div>
                  <div className="flex justify-between text-xs text-slate-600 mb-1">
                    <span>Bandwidth Capacity</span>
                    <span className="font-mono tabular-nums">{selectedLink.bandwidthMbps} Mbps</span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={1000}
                    step={10}
                    value={selectedLink.bandwidthMbps}
                    onChange={(e) => updateLink(selectedLink.id, { bandwidthMbps: Number(e.target.value) })}
                    className="w-full accent-sky-600"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs text-slate-600 mb-1">
                    <span>Propagation Delay</span>
                    <span className="font-mono tabular-nums">{selectedLink.delayMs} ms</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={150}
                    value={selectedLink.delayMs}
                    onChange={(e) => updateLink(selectedLink.id, { delayMs: Number(e.target.value) })}
                    className="w-full accent-sky-600"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs text-slate-600 mb-1">
                    <span>Packet Loss Rate</span>
                    <span className="font-mono tabular-nums">{selectedLink.lossPct}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={50}
                    value={selectedLink.lossPct}
                    onChange={(e) => updateLink(selectedLink.id, { lossPct: Number(e.target.value) })}
                    className="w-full accent-amber-600"
                  />
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                  <button
                    onClick={() => updateLink(selectedLink.id, { up: !selectedLink.up })}
                    className={`px-3 py-1.5 text-xs font-medium rounded border cursor-pointer ${
                      selectedLink.up
                        ? 'border-red-300 text-red-700 hover:bg-red-50'
                        : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                    }`}
                  >
                    {selectedLink.up ? 'Cut Link (Down)' : 'Restore Link (Up)'}
                  </button>
                  <button
                    onClick={() => {
                      removeLink(selectedLink.id);
                      setSelectedLinkId(null);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 rounded cursor-pointer"
                  >
                    <Trash2 size={13} />
                    Delete Link
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">Click any node or link on the topology map to edit its interface or QoS parameters.</p>
            )}
          </div>

          {/* Dynamic Topology Builder */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900">Provision Node or Link</h3>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={newNodeType}
                  onChange={(e) => setNewNodeType(e.target.value as NodeType)}
                  className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
                >
                  <option value="host">Host (Workstation)</option>
                  <option value="server">Server</option>
                  <option value="switch">OVS Switch</option>
                  <option value="router">L3 Router</option>
                </select>
                <select
                  value={newNodeConnectTo}
                  onChange={(e) => setNewNodeConnectTo(e.target.value)}
                  className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
                >
                  {nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      Uplink → {n.label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleAddNode}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-sky-600 text-white rounded-md hover:bg-sky-700 transition-colors cursor-pointer"
              >
                <Plus size={14} />
                Add & Auto-Wire Node
              </button>
            </div>

            <div className="pt-3 border-t border-slate-200 space-y-2">
              <div className="text-xs font-medium text-slate-600">Add Redundant Link</div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={linkSrc}
                  onChange={(e) => setLinkSrc(e.target.value)}
                  className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
                >
                  {nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      From: {n.label}
                    </option>
                  ))}
                </select>
                <select
                  value={linkDst}
                  onChange={(e) => setLinkDst(e.target.value)}
                  className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
                >
                  {nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      To: {n.label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => addLink(linkSrc, linkDst)}
                className="w-full px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Connect Link
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
