import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Wand2 } from 'lucide-react';
import { useLab } from '../../context/LabContext';
import { calculateSubnet, isValidIpv4, sameSubnet } from '../../utils/ipMath';

export function IpConfigView() {
  const { nodes, updateNode, addReport, presetName } = useLab();
  const [selectedNodeId, setSelectedNodeId] = useState<string>(nodes[0]?.id ?? '');
  const [baseNet, setBaseNet] = useState('10.10.0.0');
  const [baseCidr, setBaseCidr] = useState(24);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const diagnostics = useMemo(() => {
    const ipCounts = new Map<string, number>();
    nodes.forEach((n) => ipCounts.set(n.ip, (ipCounts.get(n.ip) || 0) + 1));

    return nodes.map((n) => {
      const validIp = isValidIpv4(n.ip);
      const validGw = isValidIpv4(n.gateway);
      const duplicate = (ipCounts.get(n.ip) || 0) > 1;
      const gwSameSub = validIp && validGw ? sameSubnet(n.ip, n.cidr, n.gateway, n.cidr) : false;
      const details = validIp ? calculateSubnet(n.ip, n.cidr) : null;
      const isNetOrBcast = details && (n.ip === details.networkAddress || n.ip === details.broadcastAddress);

      const issues: string[] = [];
      if (!validIp) issues.push('Malformed IPv4');
      if (duplicate) issues.push('IP Conflict');
      if (isNetOrBcast) issues.push('Reserved Network/Broadcast IP');
      if ((n.type === 'host' || n.type === 'server') && !gwSameSub) issues.push('Gateway Outside Subnet');

      return { nodeId: n.id, valid: issues.length === 0, issues };
    });
  }, [nodes]);

  const conflictCount = diagnostics.filter((d) => !d.valid).length;
  const activeNode = nodes.find((n) => n.id === selectedNodeId) || nodes[0];

  const handleAutoProvision = () => {
    const parts = baseNet.split('.').map(Number);
    if (parts.length !== 4 || !isValidIpv4(baseNet)) return;
    const gw = `${parts[0]}.${parts[1]}.${parts[2]}.1`;
    nodes.forEach((n, idx) => {
      if (n.type === 'router') {
        updateNode(n.id, { ip: gw, cidr: baseCidr, gateway: gw });
      } else {
        updateNode(n.id, {
          ip: `${parts[0]}.${parts[1]}.${parts[2]}.${10 + idx}`,
          cidr: baseCidr,
          gateway: gw,
        });
      }
    });
    setSavedMsg(`Auto-addressed ${nodes.length} interfaces in ${parts[0]}.${parts[1]}.${parts[2]}.0/${baseCidr}`);
    setTimeout(() => setSavedMsg(null), 3000);
  };

  const handleSaveAudit = () => {
    addReport({
      module: 'ip-config',
      title: `IPv4 Interface Audit (${presetName})`,
      topologyName: presetName,
      summary:
        conflictCount === 0
          ? `All ${nodes.length} interfaces validated with unique IPv4 addresses and consistent gateways.`
          : `Detected ${conflictCount} interface configuration warnings requiring correction.`,
      status: conflictCount === 0 ? 'passed' : 'warning',
      metrics: {
        'Interfaces': nodes.length,
        'Valid': nodes.length - conflictCount,
        'Warnings': conflictCount,
      },
      notes: 'Validated via IP Address Configuration engine.',
    });
    setSavedMsg('IP configuration audit saved to Experiment History.');
    setTimeout(() => setSavedMsg(null), 3000);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">02. IP Address Configuration & Interface Validation</h2>
          <p className="text-sm text-slate-600 mt-1">
            Assign IPv4 addresses, CIDR prefixes, default gateways, MACs, and MTUs directly on live topology nodes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={baseNet}
            onChange={(e) => setBaseNet(e.target.value)}
            aria-label="Base Network"
            className="w-36 px-3 py-1.5 text-sm font-mono border border-slate-300 rounded-md"
          />
          <select
            value={baseCidr}
            onChange={(e) => setBaseCidr(Number(e.target.value))}
            className="px-2.5 py-1.5 text-sm font-mono border border-slate-300 rounded-md bg-white"
          >
            {[16, 20, 22, 24, 25, 26, 27, 28].map((c) => (
              <option key={c} value={c}>
                /{c}
              </option>
            ))}
          </select>
          <button
            onClick={handleAutoProvision}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-sky-600 text-white rounded-md hover:bg-sky-700 cursor-pointer whitespace-nowrap"
          >
            <Wand2 size={14} />
            Auto-Assign Flat Subnet
          </button>
          <button
            onClick={handleSaveAudit}
            className="px-3.5 py-2 text-xs font-medium border border-slate-300 rounded-md bg-white hover:bg-slate-50 cursor-pointer whitespace-nowrap"
          >
            Save Config Audit
          </button>
        </div>
      </div>

      {savedMsg && (
        <div className="bg-sky-50 border border-sky-200 text-sky-900 text-sm px-4 py-2.5 rounded-lg">
          {savedMsg}
        </div>
      )}

      {/* Interface Configuration Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-900">Node Interface Table</span>
          <span className={`text-xs font-medium ${conflictCount === 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
            {conflictCount === 0 ? 'All interfaces valid' : `${conflictCount} configuration warning(s)`}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                <th className="py-2.5 px-4">Node / Interface</th>
                <th className="py-2.5 px-4">IPv4 Address</th>
                <th className="py-2.5 px-4">CIDR</th>
                <th className="py-2.5 px-4">Default Gateway</th>
                <th className="py-2.5 px-4">MAC Address</th>
                <th className="py-2.5 px-4 text-right">MTU</th>
                <th className="py-2.5 px-4">Validation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {nodes.map((node) => {
                const diag = diagnostics.find((d) => d.nodeId === node.id)!;
                return (
                  <tr
                    key={node.id}
                    onClick={() => setSelectedNodeId(node.id)}
                    className={`hover:bg-slate-50 transition-colors cursor-pointer ${
                      activeNode?.id === node.id ? 'bg-sky-50/40' : ''
                    }`}
                  >
                    <td className="py-2.5 px-4 font-medium text-slate-900 whitespace-nowrap">
                      {node.label} <span className="font-mono text-xs text-slate-500">({node.iface})</span>
                    </td>
                    <td className="py-2 px-4">
                      <input
                        type="text"
                        value={node.ip}
                        onChange={(e) => updateNode(node.id, { ip: e.target.value })}
                        className="w-36 px-2.5 py-1 text-xs font-mono border border-slate-300 rounded bg-white"
                      />
                    </td>
                    <td className="py-2 px-4">
                      <input
                        type="number"
                        min={8}
                        max={30}
                        value={node.cidr}
                        onChange={(e) => updateNode(node.id, { cidr: Number(e.target.value) })}
                        className="w-16 px-2 py-1 text-xs font-mono tabular-nums border border-slate-300 rounded bg-white"
                      />
                    </td>
                    <td className="py-2 px-4">
                      <input
                        type="text"
                        value={node.gateway}
                        onChange={(e) => updateNode(node.id, { gateway: e.target.value })}
                        className="w-36 px-2.5 py-1 text-xs font-mono border border-slate-300 rounded bg-white"
                      />
                    </td>
                    <td className="py-2 px-4">
                      <input
                        type="text"
                        value={node.mac}
                        onChange={(e) => updateNode(node.id, { mac: e.target.value })}
                        className="w-40 px-2.5 py-1 text-xs font-mono border border-slate-300 rounded bg-white"
                      />
                    </td>
                    <td className="py-2 px-4 text-right">
                      <input
                        type="number"
                        min={576}
                        max={9000}
                        step={100}
                        value={node.mtu}
                        onChange={(e) => updateNode(node.id, { mtu: Number(e.target.value) })}
                        className="w-20 px-2 py-1 text-xs font-mono tabular-nums text-right border border-slate-300 rounded bg-white"
                      />
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      {diag.valid ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                          <CheckCircle2 size={14} /> Valid
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                          <AlertTriangle size={14} /> {diag.issues.join(' · ')}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Linux iproute2 CLI Preview */}
      {activeNode && (
        <div className="bg-slate-900 text-slate-100 rounded-lg p-5 border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
            <span>Virtual Kernel Interface Output — {activeNode.label}</span>
            <span className="font-mono">ip addr show dev {activeNode.iface}</span>
          </div>
          <pre className="font-mono text-xs leading-relaxed overflow-x-auto text-slate-200">
{`2: ${activeNode.iface}@if11: <BROADCAST,MULTICAST,${activeNode.status === 'up' ? 'UP,LOWER_UP' : 'DOWN'}> mtu ${activeNode.mtu} qdisc noqueue state ${activeNode.status.toUpperCase()}
    link/ether ${activeNode.mac} brd ff:ff:ff:ff:ff:ff
    inet ${activeNode.ip}/${activeNode.cidr} brd ${calculateSubnet(activeNode.ip, activeNode.cidr)?.broadcastAddress || '0.0.0.0'} scope global ${activeNode.iface}
       valid_lft forever preferred_lft forever
default via ${activeNode.gateway} dev ${activeNode.iface} proto static`}
          </pre>
        </div>
      )}
    </div>
  );
}
