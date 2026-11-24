import React, { useState } from 'react';
import { Globe, Play, RotateCcw, Server } from 'lucide-react';
import { useLab } from '../../context/LabContext';

interface DhcpLease {
  client: string;
  mac: string;
  ip: string;
  subnet: string;
  leaseSec: number;
  state: 'BOUND' | 'OFFERED' | 'EXPIRED';
}

interface DnsRecord {
  domain: string;
  type: 'A' | 'AAAA' | 'CNAME' | 'MX';
  value: string;
  ttl: number;
}

const DNS_RECORDS: DnsRecord[] = [
  { domain: 'portal.campus.edu', type: 'A', value: '10.0.2.20', ttl: 300 },
  { domain: 'ns1.campus.edu', type: 'A', value: '10.0.2.10', ttl: 86400 },
  { domain: 'mail.campus.edu', type: 'MX', value: '10 mailserver.campus.edu', ttl: 600 },
  { domain: 'www.campus.edu', type: 'CNAME', value: 'portal.campus.edu', ttl: 300 },
  { domain: 'lab.netlab.org', type: 'A', value: '192.168.10.20', ttl: 180 },
];

export function DnsDhcpView() {
  const { nodes, logPacket } = useLab();
  const hosts = nodes.filter((n) => n.type === 'host');

  // DHCP DORA State
  const [dhcpClientId, setDhcpClientId] = useState(hosts[0]?.id || 'h1');
  const [doraStep, setDoraStep] = useState(0);
  const [leases, setLeases] = useState<DhcpLease[]>([
    { client: 'h2', mac: '00:00:00:00:01:02', ip: '10.0.1.51', subnet: '255.255.255.0', leaseSec: 3600, state: 'BOUND' },
  ]);
  const [nextPoolIp, setNextPoolIp] = useState(52);

  // DNS State
  const [queryDomain, setQueryDomain] = useState('portal.campus.edu');
  const [dnsMode, setDnsMode] = useState<'recursive' | 'iterative'>('recursive');
  const [dnsCache, setDnsCache] = useState<DnsRecord[]>([]);
  const [dnsTrace, setDnsTrace] = useState<string[]>([
    'Enter a domain name and run a DNS query to trace Root → TLD → Authoritative resolution.',
  ]);

  const doraMessages = [
    'Idle — Click Next DORA Step to begin DHCP lease negotiation.',
    '1. DHCPDISCOVER (Broadcast 0.0.0.0 → 255.255.255.255, UDP 68→67): Client requests IP lease.',
    `2. DHCPOFFER (Server 10.0.2.10 → Client): Offers 10.0.1.${nextPoolIp}/24, GW 10.0.1.1, DNS 10.0.2.10.`,
    `3. DHCPREQUEST (Broadcast): Client accepts offered IP 10.0.1.${nextPoolIp} from DHCP server.`,
    `4. DHCPACK (Unicast): Lease confirmed for 3600s. Client interface bound to 10.0.1.${nextPoolIp}.`,
  ];

  const advanceDora = () => {
    const client = nodes.find((n) => n.id === dhcpClientId);
    const next = doraStep >= 4 ? 1 : doraStep + 1;
    setDoraStep(next);

    const protoLabel = ['IDLE', 'DHCPDISCOVER', 'DHCPOFFER', 'DHCPREQUEST', 'DHCPACK'][next];
    logPacket({
      sourceIp: next % 2 === 1 ? '0.0.0.0' : '10.0.2.10',
      destIp: next % 2 === 1 ? '255.255.255.255' : `10.0.1.${nextPoolIp}`,
      sourceMac: client?.mac || '00:00:00:00:01:01',
      destMac: next % 2 === 1 ? 'ff:ff:ff:ff:ff:ff' : client?.mac || '00:00:00:00:01:01',
      protocol: 'DHCP',
      length: 342,
      ttl: 64,
      info: `${protoLabel} (Transaction ID 0x7f1a) for ${client?.label || 'h1'}`,
      status: 'delivered',
    });

    if (next === 4 && client) {
      const assignedIp = `10.0.1.${nextPoolIp}`;
      setLeases((prev) => [
        { client: client.label, mac: client.mac, ip: assignedIp, subnet: '255.255.255.0', leaseSec: 3600, state: 'BOUND' },
        ...prev.filter((l) => l.client !== client.label),
      ]);
      setNextPoolIp((p) => (p >= 200 ? 52 : p + 1));
    }
  };

  const runDnsQuery = () => {
    const clean = queryDomain.trim().toLowerCase();
    const cached = dnsCache.find((c) => c.domain === clean);
    const matched = DNS_RECORDS.find((r) => r.domain === clean);

    if (cached) {
      setDnsTrace([
        `1. [Cache Hit] Local resolver cache returned ${cached.domain} (${cached.type}) → ${cached.value} in 0.4 ms.`,
      ]);
      return;
    }

    const tld = clean.split('.').pop() || 'edu';
    const trace =
      dnsMode === 'recursive'
        ? [
            `1. [Client → Resolver] Recursive query for ${clean} sent to 10.0.2.10:53.`,
            `2. [Resolver → Root (.)] Resolver asks Root NS for .${tld} referral.`,
            `3. [Resolver → .${tld} TLD] TLD server returns NS ns1.campus.edu (10.0.2.10).`,
            `4. [Resolver → Authoritative NS] Returns ${matched ? `${matched.type} ${matched.value}` : 'NXDOMAIN (no record)'}.`,
            `5. [Resolver → Client] Cached answer (TTL ${matched?.ttl ?? 60}s) and returned to client in 14.2 ms.`,
          ]
        : [
            `1. [Client → Root (.)] Iterative query for ${clean}. Root returns referral to .${tld} TLD.`,
            `2. [Client → .${tld} TLD] Returns referral to Authoritative NS ns1.campus.edu.`,
            `3. [Client → Authoritative NS] Direct query returns ${matched ? `${matched.type} ${matched.value}` : 'NXDOMAIN'}.`,
          ];

    setDnsTrace(trace);
    if (matched) {
      setDnsCache((prev) => [matched, ...prev.filter((r) => r.domain !== matched.domain)]);
    }

    logPacket({
      sourceIp: '10.0.1.10',
      destIp: '10.0.2.10',
      sourceMac: '00:00:00:00:01:01',
      destMac: '00:00:00:00:02:01',
      protocol: 'DNS',
      length: 88,
      ttl: 62,
      info: `DNS ${dnsMode} query ${clean} → ${matched ? matched.value : 'NXDOMAIN'}`,
      status: 'delivered',
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <h2 className="text-xl font-semibold text-slate-900">09. DNS Resolution & DHCP DORA Lab</h2>
        <p className="text-sm text-slate-600 mt-1">
          Step through the 4-way DHCP DORA lease lifecycle and compare recursive vs iterative DNS resolution with live caching.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* DHCP DORA Simulator */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Server size={16} className="text-sky-600" />
              <h3 className="text-base font-semibold text-slate-900">DHCP DORA Lease Engine</h3>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={dhcpClientId}
                onChange={(e) => setDhcpClientId(e.target.value)}
                className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
              >
                {hosts.map((h) => (
                  <option key={h.id} value={h.id}>
                    Client: {h.label}
                  </option>
                ))}
              </select>
              <button
                onClick={advanceDora}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-sky-600 text-white rounded-md hover:bg-sky-700 cursor-pointer"
              >
                <Play size={13} /> {doraStep >= 4 ? 'New Lease' : 'Next DORA Step'}
              </button>
              <button
                onClick={() => setDoraStep(0)}
                className="p-1.5 border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
                aria-label="Reset DORA"
              >
                <RotateCcw size={13} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {['1. Discover', '2. Offer', '3. Request', '4. Ack'].map((label, idx) => {
              const stepNum = idx + 1;
              const active = doraStep === stepNum;
              const done = doraStep > stepNum;
              return (
                <div
                  key={label}
                  className={`p-2.5 rounded-md border text-center text-xs font-medium ${
                    active
                      ? 'bg-sky-600 text-white border-sky-600'
                      : done
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-slate-50 text-slate-500 border-slate-200'
                  }`}
                >
                  {label}
                </div>
              );
            })}
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-md text-xs font-mono text-slate-800">
            {doraMessages[doraStep]}
          </div>

          <div>
            <h4 className="text-xs font-semibold text-slate-700 mb-2">Active DHCP Lease Table (Pool: 10.0.1.50 – .200)</h4>
            <table className="w-full text-xs text-left font-mono tabular-nums">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-sans">
                  <th className="py-1.5">Client</th>
                  <th className="py-1.5">MAC</th>
                  <th className="py-1.5">Leased IP</th>
                  <th className="py-1.5">State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leases.map((l) => (
                  <tr key={l.client}>
                    <td className="py-2 font-sans font-medium">{l.client}</td>
                    <td className="py-2 text-slate-600">{l.mac}</td>
                    <td className="py-2 text-sky-700">{l.ip}</td>
                    <td className="py-2 font-sans text-emerald-700 font-medium">{l.state}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* DNS Hierarchy Resolver */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Globe size={16} className="text-emerald-600" />
              <h3 className="text-base font-semibold text-slate-900">DNS Hierarchy Resolver</h3>
            </div>
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                onClick={() => setDnsMode('recursive')}
                className={`px-2.5 py-1 text-xs font-medium rounded cursor-pointer ${
                  dnsMode === 'recursive' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                Recursive
              </button>
              <button
                onClick={() => setDnsMode('iterative')}
                className={`px-2.5 py-1 text-xs font-medium rounded cursor-pointer ${
                  dnsMode === 'iterative' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                Iterative
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={queryDomain}
              onChange={(e) => setQueryDomain(e.target.value)}
              className="flex-1 px-3 py-1.5 text-sm font-mono border border-slate-300 rounded-md"
              placeholder="portal.campus.edu"
            />
            <button
              onClick={runDnsQuery}
              className="px-4 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-md hover:bg-emerald-700 cursor-pointer whitespace-nowrap"
            >
              Resolve Query
            </button>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <span className="text-slate-500">Quick records:</span>
            {DNS_RECORDS.map((r) => (
              <button
                key={r.domain}
                onClick={() => setQueryDomain(r.domain)}
                className="font-mono text-sky-700 hover:underline cursor-pointer"
              >
                {r.domain}
              </button>
            ))}
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-md p-3 space-y-1.5 text-xs text-slate-700">
            {dnsTrace.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-slate-700">Local DNS Resolver Cache</h4>
              <button
                onClick={() => setDnsCache([])}
                className="text-xs text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                Clear Cache
              </button>
            </div>
            <table className="w-full text-xs text-left font-mono tabular-nums">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-sans">
                  <th className="py-1.5">Domain</th>
                  <th className="py-1.5">Type</th>
                  <th className="py-1.5">Record Value</th>
                  <th className="py-1.5 text-right">TTL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dnsCache.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-3 text-center text-slate-400 font-sans">
                      Cache empty. Resolve a domain to cache the record.
                    </td>
                  </tr>
                ) : (
                  dnsCache.map((c) => (
                    <tr key={c.domain}>
                      <td className="py-1.5 text-slate-900">{c.domain}</td>
                      <td className="py-1.5 text-sky-700">{c.type}</td>
                      <td className="py-1.5 text-slate-700">{c.value}</td>
                      <td className="py-1.5 text-right">{c.ttl}s</td>
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
