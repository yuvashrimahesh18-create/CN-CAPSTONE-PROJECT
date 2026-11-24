import React, { useState } from 'react';
import { Flame, RotateCcw, Search, Trash2 } from 'lucide-react';
import { useLab } from '../../context/LabContext';
import { CapturedPacket } from '../../types/network';

export function FaultMonitoringView() {
  const { links, updateLink, capturedPackets, clearCaptures, addReport, presetName } = useLab();
  const [protoFilter, setProtoFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPacket, setSelectedPacket] = useState<CapturedPacket | null>(null);

  const filteredPackets = capturedPackets.filter((pkt) => {
    if (protoFilter !== 'ALL' && pkt.protocol !== protoFilter) return false;
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      pkt.sourceIp.toLowerCase().includes(q) ||
      pkt.destIp.toLowerCase().includes(q) ||
      pkt.info.toLowerCase().includes(q) ||
      pkt.protocol.toLowerCase().includes(q)
    );
  });

  const faultedLinks = links.filter((l) => !l.up || l.lossPct > 0 || l.delayMs > 40);

  const injectChaosPreset = () => {
    if (links.length === 0) return;
    const target = links[Math.min(3, links.length - 1)];
    updateLink(target.id, { delayMs: 65, lossPct: 18, jitterMs: 14 });
    addReport({
      module: 'fault-monitoring',
      title: `Chaos Fault Injection on ${target.source} ↔ ${target.target}`,
      topologyName: presetName,
      summary: `Injected 65 ms propagation delay, 14 ms jitter, and 18% packet drop on link ${target.source}-${target.target}.`,
      status: 'warning',
      metrics: { 'Target Link': `${target.source}-${target.target}`, 'Delay': '65 ms', 'Loss': '18%' },
      notes: 'Observed downstream RTT spike and ICMP/TCP retransmissions.',
    });
  };

  const resetAllFaults = () => {
    links.forEach((l) => updateLink(l.id, { up: true, lossPct: 0, delayMs: 3, jitterMs: 0.4, bandwidthMbps: 500 }));
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">10. Fault Injection & Live Network Monitoring</h2>
          <p className="text-sm text-slate-600 mt-1">
            Inject real-time link failures, latency spikes, and packet drops across topology links and inspect live captured frames.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={injectChaosPreset}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-amber-600 text-white rounded-md hover:bg-amber-700 cursor-pointer whitespace-nowrap"
          >
            <Flame size={14} /> Inject Core Congestion Fault
          </button>
          <button
            onClick={resetAllFaults}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border border-slate-300 bg-white rounded-md hover:bg-slate-50 cursor-pointer whitespace-nowrap"
          >
            <RotateCcw size={14} /> Clear All Faults
          </button>
        </div>
      </div>

      {/* Per-Link Fault Controls & Live Utilization */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-900">Link QoS & Fault Matrix</span>
          <span className={`text-xs font-medium ${faultedLinks.length > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
            {faultedLinks.length > 0 ? `${faultedLinks.length} link(s) impaired` : 'All links nominal'}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <th className="py-2.5 px-4">Link Segment</th>
                <th className="py-2.5 px-4">State</th>
                <th className="py-2.5 px-4">Delay (ms)</th>
                <th className="py-2.5 px-4">Loss (%)</th>
                <th className="py-2.5 px-4">Bandwidth</th>
                <th className="py-2.5 px-4">Utilization</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono tabular-nums">
              {links.map((l) => (
                <tr key={l.id} className={!l.up ? 'bg-red-50/50' : ''}>
                  <td className="py-2.5 px-4 font-sans font-medium text-slate-900">
                    {l.source} ↔ {l.target}
                  </td>
                  <td className="py-2.5 px-4">
                    <button
                      onClick={() => updateLink(l.id, { up: !l.up })}
                      className={`px-2.5 py-1 rounded text-xs font-sans font-medium border cursor-pointer ${
                        l.up
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                          : 'border-red-300 bg-red-100 text-red-800'
                      }`}
                    >
                      {l.up ? 'UP (Cut)' : 'DOWN (Restore)'}
                    </button>
                  </td>
                  <td className="py-2.5 px-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={1}
                        max={200}
                        value={l.delayMs}
                        onChange={(e) => updateLink(l.id, { delayMs: Number(e.target.value) })}
                        className="w-24 accent-sky-600"
                      />
                      <span className="w-12">{l.delayMs}ms</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={0}
                        max={60}
                        value={l.lossPct}
                        onChange={(e) => updateLink(l.id, { lossPct: Number(e.target.value) })}
                        className="w-24 accent-amber-600"
                      />
                      <span className="w-10">{l.lossPct}%</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-4">{l.bandwidthMbps} Mbps</td>
                  <td className="py-2.5 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${l.utilizationPct > 75 ? 'bg-red-600' : 'bg-sky-600'}`}
                          style={{ width: `${l.utilizationPct}%` }}
                        />
                      </div>
                      <span>{l.utilizationPct}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live Packet Capture Inspector (Wireshark-style) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-8 bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-900">Live Packet Capture ({filteredPackets.length} frames)</h3>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Filter IP or info..."
                  className="pl-7 pr-3 py-1 text-xs border border-slate-300 rounded-md w-44"
                />
              </div>
              <select
                value={protoFilter}
                onChange={(e) => setProtoFilter(e.target.value)}
                className="px-2 py-1 text-xs border border-slate-300 rounded-md bg-white"
              >
                {['ALL', 'ICMP', 'TCP', 'UDP', 'ARP', 'DNS', 'DHCP'].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <button
                onClick={clearCaptures}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-slate-600 border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
              >
                <Trash2 size={12} /> Clear
              </button>
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-600 font-sans">
                <tr>
                  <th className="py-2 px-3">No.</th>
                  <th className="py-2 px-3">Time</th>
                  <th className="py-2 px-3">Source</th>
                  <th className="py-2 px-3">Destination</th>
                  <th className="py-2 px-3">Proto</th>
                  <th className="py-2 px-3">Info</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPackets.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 font-sans">
                      No captured packets match filter. Trigger Ping, ARP, Sliding Window, or DNS to capture live frames.
                    </td>
                  </tr>
                ) : (
                  filteredPackets.map((pkt) => (
                    <tr
                      key={pkt.id}
                      onClick={() => setSelectedPacket(pkt)}
                      className={`cursor-pointer hover:bg-sky-50/60 ${
                        selectedPacket?.id === pkt.id
                          ? 'bg-sky-100/70'
                          : pkt.status === 'dropped'
                          ? 'bg-red-50/70 text-red-800'
                          : ''
                      }`}
                    >
                      <td className="py-1.5 px-3">{pkt.no}</td>
                      <td className="py-1.5 px-3 text-slate-500">{pkt.timestamp}</td>
                      <td className="py-1.5 px-3">{pkt.sourceIp}</td>
                      <td className="py-1.5 px-3">{pkt.destIp}</td>
                      <td className="py-1.5 px-3 font-semibold text-sky-700">{pkt.protocol}</td>
                      <td className="py-1.5 px-3 font-sans truncate max-w-[260px]">{pkt.info}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Packet Header Tree Inspector */}
        <div className="xl:col-span-4 bg-white border border-slate-200 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Frame Header Decoder</h3>
          {selectedPacket ? (
            <div className="space-y-3 text-xs font-mono">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                <div className="font-sans font-semibold text-slate-800 mb-1">
                  Frame {selectedPacket.no} ({selectedPacket.length} bytes on wire)
                </div>
                <div className="text-slate-600">Arrival: {selectedPacket.timestamp} · Status: {selectedPacket.status}</div>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded space-y-1">
                <div className="font-sans font-semibold text-slate-800">Ethernet II</div>
                <div className="text-slate-600">Src MAC: {selectedPacket.sourceMac}</div>
                <div className="text-slate-600">Dst MAC: {selectedPacket.destMac}</div>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded space-y-1">
                <div className="font-sans font-semibold text-slate-800">Internet Protocol Version 4</div>
                <div className="text-slate-600">Src IP: {selectedPacket.sourceIp}</div>
                <div className="text-slate-600">Dst IP: {selectedPacket.destIp}</div>
                <div className="text-slate-600">TTL: {selectedPacket.ttl} · Protocol: {selectedPacket.protocol}</div>
              </div>
              <div className="p-3 bg-slate-900 text-slate-100 rounded">
                <div className="text-slate-400 font-sans mb-1">Payload Summary</div>
                <div>{selectedPacket.info}</div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">Click any row in the Live Packet Capture table to decode its L2/L3/L4 headers.</p>
          )}
        </div>
      </div>
    </div>
  );
}
