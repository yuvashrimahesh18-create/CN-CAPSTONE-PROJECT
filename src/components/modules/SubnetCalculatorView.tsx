import React, { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { allocateVlsm, calculateSubnet, ipToBinaryOctets, VlsmRequirement } from '../../utils/ipMath';

export function SubnetCalculatorView() {
  const [ipInput, setIpInput] = useState('192.168.10.65');
  const [cidr, setCidr] = useState(26);

  const [vlsmBaseIp, setVlsmBaseIp] = useState('172.16.0.0');
  const [vlsmBaseCidr, setVlsmBaseCidr] = useState(22);
  const [departments, setDepartments] = useState<VlsmRequirement[]>([
    { id: 'd1', name: 'Computer Science Lab', hosts: 120 },
    { id: 'd2', name: 'Faculty Research VLAN', hosts: 45 },
    { id: 'd3', name: 'Server DMZ', hosts: 14 },
    { id: 'd4', name: 'Router Point-to-Point', hosts: 2 },
  ]);

  const subnet = useMemo(() => calculateSubnet(ipInput, cidr), [ipInput, cidr]);
  const binaryIpOctets = useMemo(() => ipToBinaryOctets(ipInput), [ipInput]);
  const binaryMaskOctets = useMemo(() => (subnet ? ipToBinaryOctets(subnet.mask) : []), [subnet]);
  const vlsmAllocations = useMemo(
    () => allocateVlsm(vlsmBaseIp, vlsmBaseCidr, departments),
    [vlsmBaseIp, vlsmBaseCidr, departments]
  );

  const addDepartment = () => {
    setDepartments((prev) => [
      ...prev,
      { id: `d-${Date.now()}`, name: `Subnet ${prev.length + 1}`, hosts: 20 },
    ]);
  };

  return (
    <div className="space-y-6">
      {/* CIDR Subnet Calculator */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-5">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">03. IPv4 Subnet & VLSM Calculator</h2>
          <p className="text-sm text-slate-600 mt-1">
            Inspect network boundaries, bit-level network/host masks, and automatically carve non-overlapping VLSM subnets.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-5">
            <label className="block text-xs font-medium text-slate-600 mb-1">IPv4 Address</label>
            <input
              type="text"
              value={ipInput}
              onChange={(e) => setIpInput(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
              placeholder="e.g. 192.168.10.65"
            />
          </div>
          <div className="md:col-span-5">
            <div className="flex justify-between text-xs font-medium text-slate-600 mb-1">
              <span>CIDR Prefix Length</span>
              <span className="font-mono tabular-nums text-sky-700">/{cidr}</span>
            </div>
            <input
              type="range"
              min={1}
              max={32}
              value={cidr}
              onChange={(e) => setCidr(Number(e.target.value))}
              className="w-full accent-sky-600"
            />
          </div>
          <div className="md:col-span-2">
            <select
              value={cidr}
              onChange={(e) => setCidr(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-md bg-white"
            >
              {Array.from({ length: 32 }, (_, i) => i + 1).map((c) => (
                <option key={c} value={c}>
                  /{c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {subnet ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-xs text-slate-500">Network Address</div>
                <div className="mt-1 text-sm font-mono font-semibold tabular-nums text-slate-900">
                  {subnet.networkAddress}/{subnet.cidr}
                </div>
              </div>
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-xs text-slate-500">Subnet Mask</div>
                <div className="mt-1 text-sm font-mono font-semibold tabular-nums text-slate-900">
                  {subnet.mask}
                </div>
              </div>
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-xs text-slate-500">Broadcast Address</div>
                <div className="mt-1 text-sm font-mono font-semibold tabular-nums text-slate-900">
                  {subnet.broadcastAddress}
                </div>
              </div>
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-xs text-slate-500">Usable Hosts</div>
                <div className="mt-1 text-sm font-mono font-semibold tabular-nums text-sky-700">
                  {subnet.usableHosts.toLocaleString()} hosts
                </div>
              </div>
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-xs text-slate-500">First Usable Host</div>
                <div className="mt-1 text-sm font-mono font-medium tabular-nums text-slate-900">
                  {subnet.firstUsable}
                </div>
              </div>
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-xs text-slate-500">Last Usable Host</div>
                <div className="mt-1 text-sm font-mono font-medium tabular-nums text-slate-900">
                  {subnet.lastUsable}
                </div>
              </div>
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-xs text-slate-500">Wildcard Mask</div>
                <div className="mt-1 text-sm font-mono font-medium tabular-nums text-slate-900">
                  {subnet.wildcard}
                </div>
              </div>
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-xs text-slate-500">Class & Scope</div>
                <div className="mt-1 text-sm font-medium text-slate-900">
                  Class {subnet.ipClass} · {subnet.isPrivate ? 'RFC1918 Private' : 'Public'}
                </div>
              </div>
            </div>

            {/* 32-Bit Binary BitMap */}
            <div className="p-4 bg-slate-900 text-slate-100 rounded-lg border border-slate-800 space-y-2">
              <div className="flex flex-wrap items-center justify-between text-xs text-slate-400">
                <span>32-Bit Network vs Host Boundary Visualization</span>
                <div className="flex items-center gap-4">
                  <span className="text-sky-400">Blue: Network Bits ({cidr})</span>
                  <span className="text-emerald-400">Green: Host Bits ({32 - cidr})</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 font-mono text-sm">
                {binaryIpOctets.map((octet, oIdx) => (
                  <div key={oIdx} className="flex items-center gap-0.5 bg-slate-800 px-2 py-1.5 rounded">
                    {octet.split('').map((bit, bIdx) => {
                      const bitIndex = oIdx * 8 + bIdx;
                      const isNetwork = bitIndex < cidr;
                      return (
                        <span
                          key={bIdx}
                          className={`w-4 text-center rounded-sm ${
                            isNetwork ? 'text-sky-300 bg-sky-950/70' : 'text-emerald-300 bg-emerald-950/60'
                          }`}
                        >
                          {bit}
                        </span>
                      );
                    })}
                  </div>
                ))}
              </div>
              <div className="text-xs font-mono text-slate-400">
                Mask Bits: {binaryMaskOctets.join('.')}
              </div>
            </div>
          </>
        ) : (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            Enter a valid IPv4 address (for example 192.168.10.65).
          </div>
        )}
      </div>

      {/* VLSM Allocator */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Variable Length Subnet Mask (VLSM) Planner</h3>
            <p className="text-xs text-slate-500">
              Automatically sorts host requirements largest-first to allocate contiguous non-overlapping subnets.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={vlsmBaseIp}
              onChange={(e) => setVlsmBaseIp(e.target.value)}
              className="w-36 px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded-md"
            />
            <select
              value={vlsmBaseCidr}
              onChange={(e) => setVlsmBaseCidr(Number(e.target.value))}
              className="px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded-md bg-white"
            >
              {[16, 18, 20, 21, 22, 23, 24, 25].map((c) => (
                <option key={c} value={c}>
                  /{c}
                </option>
              ))}
            </select>
            <button
              onClick={addDepartment}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-sky-600 text-white rounded-md hover:bg-sky-700 cursor-pointer"
            >
              <Plus size={13} /> Add Subnet
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-4 space-y-2">
            {departments.map((dept) => (
              <div key={dept.id} className="flex items-center gap-2">
                <input
                  type="text"
                  value={dept.name}
                  onChange={(e) =>
                    setDepartments((prev) => prev.map((d) => (d.id === dept.id ? { ...d, name: e.target.value } : d)))
                  }
                  className="flex-1 px-2.5 py-1.5 text-xs border border-slate-300 rounded-md"
                />
                <input
                  type="number"
                  min={1}
                  max={4000}
                  value={dept.hosts}
                  onChange={(e) =>
                    setDepartments((prev) =>
                      prev.map((d) => (d.id === dept.id ? { ...d, hosts: Number(e.target.value) } : d))
                    )
                  }
                  className="w-20 px-2 py-1.5 text-xs font-mono tabular-nums border border-slate-300 rounded-md"
                />
                <button
                  onClick={() => setDepartments((prev) => prev.filter((d) => d.id !== dept.id))}
                  className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                  aria-label="Delete subnet requirement"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <div className="lg:col-span-8 overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <th className="py-2 px-3">Department</th>
                  <th className="py-2 px-3 text-right">Need / Cap</th>
                  <th className="py-2 px-3">Network / CIDR</th>
                  <th className="py-2 px-3">Usable Range</th>
                  <th className="py-2 px-3">Broadcast</th>
                  <th className="py-2 px-3 text-right">Efficiency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono tabular-nums">
                {vlsmAllocations.map((row) => (
                  <tr key={row.id} className={row.overflow ? 'bg-red-50' : ''}>
                    <td className="py-2 px-3 font-sans font-medium text-slate-900">{row.name}</td>
                    <td className="py-2 px-3 text-right">
                      {row.requestedHosts} / {row.allocatedHosts}
                    </td>
                    <td className="py-2 px-3 text-sky-700 font-medium">
                      {row.network}/{row.cidr}
                    </td>
                    <td className="py-2 px-3 text-slate-700">{row.range}</td>
                    <td className="py-2 px-3 text-slate-600">{row.broadcast}</td>
                    <td className="py-2 px-3 text-right">
                      {row.overflow ? (
                        <span className="text-red-700 font-sans font-medium">Overflow</span>
                      ) : (
                        `${row.utilizationPct}%`
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
