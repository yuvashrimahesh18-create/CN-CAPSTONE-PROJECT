import React, { useState } from 'react';
import { RefreshCw, Send, ShieldAlert } from 'lucide-react';
import { useLab } from '../../context/LabContext';
import { sameSubnet } from '../../utils/ipMath';
import { findShortestPath } from '../../utils/networkEngine';
import { TopologyMap } from '../TopologyMap';

interface ArpEntry {
  ip: string;
  mac: string;
  iface: string;
  type: 'dynamic' | 'gratuitous' | 'spoofed';
  ttl: number;
}

interface SwitchMacEntry {
  mac: string;
  nodeLabel: string;
  port: string;
}

export function ArpSimulatorView() {
  const { nodes, links, labStatus, animatedPackets, injectPacketOnPath } = useLab();
  const endpoints = nodes.filter((n) => n.type === 'host' || n.type === 'server');

  const [srcId, setSrcId] = useState(endpoints[0]?.id || nodes[0]?.id || '');
  const [dstId, setDstId] = useState(endpoints[1]?.id || nodes[1]?.id || '');
  const [arpTable, setArpTable] = useState<ArpEntry[]>([
    { ip: '10.0.1.1', mac: '00:00:00:00:00:21', iface: 'h1-eth0', type: 'dynamic', ttl: 120 },
  ]);
  const [macTable, setMacTable] = useState<SwitchMacEntry[]>([]);
  const [arpSteps, setArpSteps] = useState<string[]>([
    'Select a source and target node, then resolve L2 MAC address via ARP Request / Reply.',
  ]);
  const [activeLinks, setActiveLinks] = useState<string[]>([]);

  const resolveArp = (gratuitous = false, spoof = false) => {
    const src = nodes.find((n) => n.id === srcId);
    const dst = nodes.find((n) => n.id === dstId);
    if (!src || !dst) return;

    const path = findShortestPath(src.id, dst.id, nodes, links, labStatus === 'running');
    setActiveLinks(path.linkIds);

    const sameL2 = sameSubnet(src.ip, src.cidr, dst.ip, dst.cidr);
    // If different subnet, ARP resolves the default gateway's MAC!
    const gatewayNode = nodes.find((n) => n.ip === src.gateway) || nodes.find((n) => n.type === 'router');
    const resolvedTarget = sameL2 ? dst : gatewayNode || dst;

    const logs: string[] = [];
    if (gratuitous) {
      logs.push(`1. [Gratuitous ARP] ${src.label} (${src.ip}) broadcasts WHO-HAS ${src.ip} to announce MAC ${src.mac}.`);
      logs.push(`2. Switches update CAM table for ${src.mac} on port ${src.iface}.`);
      setArpTable((prev) => [
        { ip: src.ip, mac: src.mac, iface: src.iface, type: 'gratuitous', ttl: 120 },
        ...prev.filter((e) => e.ip !== src.ip),
      ]);
      injectPacketOnPath(path.linkIds, 'ARP', `Gratuitous ARP ${src.ip} is at ${src.mac}`, src, dst);
    } else if (spoof) {
      const fakeMac = 'de:ad:be:ef:00:99';
      logs.push(`1. [ARP Spoof Demo] Attacker sends unsolicited ARP Reply claiming ${resolvedTarget.ip} is at ${fakeMac}.`);
      logs.push(`2. ${src.label} overwrites its ARP cache entry for ${resolvedTarget.ip} -> ${fakeMac} (MITM warning!).`);
      setArpTable((prev) => [
        { ip: resolvedTarget.ip, mac: fakeMac, iface: src.iface, type: 'spoofed', ttl: 60 },
        ...prev.filter((e) => e.ip !== resolvedTarget.ip),
      ]);
      injectPacketOnPath(path.linkIds, 'ARP', `SPOOFED ARP Reply ${resolvedTarget.ip} is-at ${fakeMac}`, dst, src, 'retransmitted');
    } else {
      if (!sameL2 && gatewayNode) {
        logs.push(
          `1. [L3 Subnet Check] ${dst.ip} is in a different subnet than ${src.ip}/${src.cidr}. ${src.label} must ARP for its Default Gateway (${gatewayNode.ip}).`
        );
      } else {
        logs.push(`1. [L2 Check] ${dst.ip} is on the local subnet. ${src.label} checks ARP cache — cache miss.`);
      }
      logs.push(
        `2. [ARP Request · Broadcast] ${src.label} (${src.mac}) -> FF:FF:FF:FF:FF:FF: "Who has ${resolvedTarget.ip}? Tell ${src.ip}".`
      );
      logs.push(
        `3. [Switch Learning] Access switch records ${src.mac} (${src.label}) in CAM table and floods broadcast.`
      );
      logs.push(
        `4. [ARP Reply · Unicast] ${resolvedTarget.label} responds directly to ${src.mac}: "${resolvedTarget.ip} is at ${resolvedTarget.mac}".`
      );
      logs.push(`5. [Cache Updated] ${src.label} stores ${resolvedTarget.ip} -> ${resolvedTarget.mac} (TTL 120s).`);

      setArpTable((prev) => [
        { ip: resolvedTarget.ip, mac: resolvedTarget.mac, iface: src.iface, type: 'dynamic', ttl: 120 },
        ...prev.filter((e) => e.ip !== resolvedTarget.ip),
      ]);

      setMacTable((prev) => {
        const next = prev.filter((m) => m.mac !== src.mac && m.mac !== resolvedTarget.mac);
        return [
          { mac: src.mac, nodeLabel: src.label, port: 'eth1' },
          { mac: resolvedTarget.mac, nodeLabel: resolvedTarget.label, port: 'eth2' },
          ...next,
        ];
      });

      if (path.linkIds.length > 0) {
        injectPacketOnPath(
          path.linkIds,
          'ARP',
          `ARP Who-has ${resolvedTarget.ip}? Tell ${src.ip}`,
          src,
          resolvedTarget
        );
      }
    }

    setArpSteps(logs);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">06. Address Resolution Protocol (ARP) Simulator</h2>
          <p className="text-sm text-slate-600 mt-1">
            Simulate Broadcast ARP Requests, Unicast ARP Replies, Switch CAM MAC learning, and Gateway vs Direct L2 resolution.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => resolveArp(false, false)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-sky-600 text-white rounded-md hover:bg-sky-700 cursor-pointer whitespace-nowrap"
          >
            <Send size={14} /> Run ARP Resolution
          </button>
          <button
            onClick={() => resolveArp(true, false)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border border-slate-300 bg-white rounded-md hover:bg-slate-50 cursor-pointer whitespace-nowrap"
          >
            <RefreshCw size={14} /> Gratuitous ARP
          </button>
          <button
            onClick={() => resolveArp(false, true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border border-amber-300 bg-amber-50 text-amber-800 rounded-md hover:bg-amber-100 cursor-pointer whitespace-nowrap"
          >
            <ShieldAlert size={14} /> Simulate ARP Spoof
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-5 space-y-4">
          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900">Endpoints</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Requester Node</label>
                <select
                  value={srcId}
                  onChange={(e) => setSrcId(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
                >
                  {endpoints.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.label} ({n.ip})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Target IP Node</label>
                <select
                  value={dstId}
                  onChange={(e) => setDstId(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
                >
                  {endpoints.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.label} ({n.ip})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <div className="text-xs font-semibold text-slate-700">Resolution Trace</div>
              <div className="bg-slate-50 border border-slate-200 rounded-md p-3 space-y-1.5 text-xs text-slate-700">
                {arpSteps.map((step, i) => (
                  <div key={i} className="leading-relaxed">
                    {step}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-900">Host ARP Cache (arp -n)</h3>
              <button
                onClick={() => setArpTable([])}
                className="text-xs text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                Flush Cache
              </button>
            </div>
            <table className="w-full text-xs text-left font-mono tabular-nums">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-sans">
                  <th className="py-1.5">IP Address</th>
                  <th className="py-1.5">HW Address (MAC)</th>
                  <th className="py-1.5">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {arpTable.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-3 text-center text-slate-400 font-sans">
                      ARP cache is empty. Run resolution to populate.
                    </td>
                  </tr>
                ) : (
                  arpTable.map((entry, idx) => (
                    <tr key={idx}>
                      <td className="py-2 text-slate-900">{entry.ip}</td>
                      <td className="py-2 text-slate-700">{entry.mac}</td>
                      <td className="py-2 font-sans">
                        <span
                          className={
                            entry.type === 'spoofed'
                              ? 'text-red-700 font-semibold'
                              : entry.type === 'gratuitous'
                              ? 'text-sky-700'
                              : 'text-emerald-700'
                          }
                        >
                          {entry.type}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="xl:col-span-7 space-y-4">
          <TopologyMap
            nodes={nodes}
            links={links}
            animatedPackets={animatedPackets}
            highlightedLinkIds={activeLinks}
            heightClass="h-[340px]"
          />

          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Switch L2 MAC / CAM Learning Table</h3>
            <table className="w-full text-xs text-left font-mono">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-sans">
                  <th className="py-1.5">Learned MAC</th>
                  <th className="py-1.5">Host</th>
                  <th className="py-1.5">Switch Port</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {macTable.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-3 text-center text-slate-400 font-sans">
                      No MAC frames learned yet. Trigger ARP Request to populate switch CAM table.
                    </td>
                  </tr>
                ) : (
                  macTable.map((m, i) => (
                    <tr key={i}>
                      <td className="py-2">{m.mac}</td>
                      <td className="py-2 font-sans text-slate-800">{m.nodeLabel}</td>
                      <td className="py-2 text-sky-700">{m.port}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
