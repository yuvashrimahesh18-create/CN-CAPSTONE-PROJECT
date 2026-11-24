import React, { useMemo, useState } from 'react';
import { CheckCircle2, Copy, Download, Play, Terminal, XCircle } from 'lucide-react';
import { useLab } from '../../context/LabContext';
import { isValidIpv4 } from '../../utils/ipMath';
import { findShortestPath, generateMininetPython } from '../../utils/networkEngine';

interface CliLine {
  id: string;
  text: string;
  kind: 'cmd' | 'out' | 'err';
}

interface VerificationCheck {
  name: string;
  passed: boolean;
  detail: string;
}

export function MininetTestingView() {
  const { presetName, nodes, links, labStatus, updateLink, addReport, injectPacketOnPath } = useLab();

  const [cmdInput, setCmdInput] = useState('');
  const [cliLines, setCliLines] = useState<CliLine[]>([
    {
      id: 'welcome-1',
      kind: 'out',
      text: 'NetLab Browser Mininet Kernel Ready (Ubuntu/VirtualBox not required). Type "help" for supported Mininet CLI commands.',
    },
  ]);
  const [copied, setCopied] = useState(false);
  const [verificationResults, setVerificationResults] = useState<VerificationCheck[] | null>(null);

  const pythonScript = useMemo(
    () => generateMininetPython(presetName, nodes, links),
    [presetName, nodes, links]
  );

  const pushCli = (text: string, kind: CliLine['kind'] = 'out') => {
    setCliLines((prev) => [...prev.slice(-80), { id: `cli-${Date.now()}-${Math.random()}`, text, kind }]);
  };

  const executeMininetCmd = (raw: string) => {
    const cmd = raw.trim();
    if (!cmd) return;
    pushCli(`mininet> ${cmd}`, 'cmd');

    const parts = cmd.split(/\s+/);
    const base = parts[0].toLowerCase();

    if (base === 'clear') {
      setCliLines([]);
      return;
    }

    if (base === 'help') {
      pushCli(
        'Commands: nodes | net | dump | pingall | <h1 ping h2> | iperf <h1 h2> | link <n1 n2 up|down> | route | arp | clear'
      );
      return;
    }

    if (base === 'nodes') {
      pushCli(`available nodes are:\n${nodes.map((n) => n.label).join(' ')}`);
      return;
    }

    if (base === 'net') {
      const lines = nodes.map((n) => {
        const adj = links
          .filter((l) => l.source === n.id || l.target === n.id)
          .map((l) => `${n.iface}:${l.source === n.id ? l.target : l.source}`)
          .join(' ');
        return `${n.label} ${adj}`;
      });
      pushCli(lines.join('\n'));
      return;
    }

    if (base === 'dump') {
      const lines = nodes.map(
        (n) => `<${n.type.toUpperCase()} ${n.label}: ${n.iface}=${n.ip}/${n.cidr} mac=${n.mac} state=${n.status}>`
      );
      pushCli(lines.join('\n'));
      return;
    }

    if (base === 'pingall') {
      const hosts = nodes.filter((n) => n.type === 'host' || n.type === 'server');
      let drops = 0;
      let total = 0;
      const output: string[] = [];
      hosts.forEach((src) => {
        const targets: string[] = [];
        hosts.forEach((dst) => {
          if (src.id === dst.id) return;
          total++;
          const res = findShortestPath(src.id, dst.id, nodes, links, labStatus === 'running');
          if (res.reachable) {
            targets.push(dst.label);
            injectPacketOnPath(res.linkIds, 'ICMP', `mininet pingall ${src.label}->${dst.label}`, src, dst);
          } else {
            drops++;
            targets.push('X');
          }
        });
        output.push(`${src.label} -> ${targets.join(' ')}`);
      });
      const pct = total > 0 ? Math.round((drops / total) * 100) : 0;
      output.push(`*** Results: ${pct}% dropped (${total - drops}/${total} received)`);
      pushCli(output.join('\n'), drops > 0 ? 'err' : 'out');
      return;
    }

    if (base === 'iperf' && parts.length >= 3) {
      const src = nodes.find((n) => n.label === parts[1]);
      const dst = nodes.find((n) => n.label === parts[2]);
      if (!src || !dst) {
        pushCli(`Unknown host(s): ${parts[1]} ${parts[2]}`, 'err');
        return;
      }
      const res = findShortestPath(src.id, dst.id, nodes, links, labStatus === 'running');
      if (!res.reachable) {
        pushCli(`iperf failed: ${res.reason}`, 'err');
        return;
      }
      const effBw = Math.max(1, Math.round(res.bottleneckMbps * (1 - res.combinedLossPct / 100) * 0.91));
      injectPacketOnPath(res.linkIds, 'TCP', `iperf ${src.label}->${dst.label} ${effBw} Mbps`, src, dst);
      pushCli(
        `*** Iperf: testing TCP bandwidth between ${src.label} and ${dst.label}\n*** Results: ['${effBw} Mbits/sec', '${Math.round(
          effBw * 0.97
        )} Mbits/sec'] (bottleneck ${res.bottleneckMbps} Mbps, RTT ${(res.oneWayDelayMs * 2).toFixed(1)} ms)`
      );
      return;
    }

    if (base === 'link' && parts.length >= 4) {
      const n1 = parts[1];
      const n2 = parts[2];
      const action = parts[3].toLowerCase();
      const targetLink = links.find(
        (l) => (l.source === n1 && l.target === n2) || (l.source === n2 && l.target === n1)
      );
      if (!targetLink) {
        pushCli(`Link ${n1}-${n2} not found.`, 'err');
        return;
      }
      if (action === 'down' || action === 'up') {
        updateLink(targetLink.id, { up: action === 'up' });
        pushCli(`Set link (${n1}, ${n2}) ${action.toUpperCase()}.`);
      } else {
        pushCli('Usage: link <node1> <node2> up|down', 'err');
      }
      return;
    }

    if (parts.length >= 3 && parts[1].toLowerCase() === 'ping') {
      const src = nodes.find((n) => n.label === parts[0]);
      const dst = nodes.find((n) => n.label === parts[2] || n.ip === parts[2]);
      if (!src || !dst) {
        pushCli(`Host not found: ${parts[0]} or ${parts[2]}`, 'err');
        return;
      }
      const res = findShortestPath(src.id, dst.id, nodes, links, labStatus === 'running');
      if (!res.reachable) {
        pushCli(`PING ${dst.ip}: ${res.reason}`, 'err');
        return;
      }
      injectPacketOnPath(res.linkIds, 'ICMP', `mininet ping ${src.label}->${dst.label}`, src, dst);
      const rtt = (res.oneWayDelayMs * 2).toFixed(1);
      pushCli(
        `PING ${dst.ip} (${dst.ip}) 56(84) bytes of data.\n64 bytes from ${dst.ip}: icmp_seq=1 ttl=63 time=${rtt} ms\n64 bytes from ${dst.ip}: icmp_seq=2 ttl=63 time=${rtt} ms\n--- ${dst.ip} ping statistics ---\n2 packets transmitted, 2 received, 0% packet loss`
      );
      return;
    }

    if (base === 'route') {
      pushCli(
        nodes
          .filter((n) => n.type === 'host' || n.type === 'router')
          .map((n) => `${n.label}: default via ${n.gateway} dev ${n.iface} (${n.ip}/${n.cidr})`)
          .join('\n')
      );
      return;
    }

    if (base === 'arp') {
      pushCli(nodes.map((n) => `${n.ip.padEnd(16)} ether ${n.mac}   C   ${n.iface}`).join('\n'));
      return;
    }

    pushCli(`Unknown command "${cmd}". Type "help" for available Mininet commands.`, 'err');
  };

  const runFinalVerification = () => {
    const endpoints = nodes.filter((n) => n.type === 'host' || n.type === 'server');
    const uniqueIps = new Set(nodes.map((n) => n.ip));
    const allIpsValid = nodes.every((n) => isValidIpv4(n.ip));

    let reachablePairs = 0;
    let totalPairs = 0;
    endpoints.forEach((a) => {
      endpoints.forEach((b) => {
        if (a.id === b.id) return;
        totalPairs++;
        if (findShortestPath(a.id, b.id, nodes, links, labStatus === 'running').reachable) {
          reachablePairs++;
        }
      });
    });

    const checks: VerificationCheck[] = [
      {
        name: 'Lab Automation Lifecycle Active',
        passed: labStatus === 'running' && nodes.every((n) => n.status === 'up'),
        detail: labStatus === 'running' ? `All ${nodes.length} virtual nodes online.` : 'Lab is stopped or degraded.',
      },
      {
        name: 'IPv4 Address & Conflict Integrity',
        passed: allIpsValid && uniqueIps.size === nodes.length,
        detail:
          uniqueIps.size === nodes.length
            ? `Verified ${nodes.length} unique valid IPv4 interfaces.`
            : 'Duplicate or malformed IPv4 detected.',
      },
      {
        name: 'Full-Mesh PingAll Reachability',
        passed: totalPairs > 0 && reachablePairs === totalPairs,
        detail: `${reachablePairs}/${totalPairs} host-to-host paths converged cleanly.`,
      },
      {
        name: 'Mininet Topology Script Export Readiness',
        passed: pythonScript.includes('class ') && pythonScript.includes('Mininet('),
        detail: `Generated ${pythonScript.split('\n').length}-line Python Topo script ready for standalone Mininet.`,
      },
    ];

    setVerificationResults(checks);
    const allPass = checks.every((c) => c.passed);

    addReport({
      module: 'mininet-testing',
      title: `Final Capstone Verification Suite (${presetName})`,
      topologyName: presetName,
      summary: allPass
        ? 'All 4 end-to-end verification checks passed cleanly.'
        : 'Verification completed with warnings; inspect failing checks.',
      status: allPass ? 'passed' : 'warning',
      metrics: {
        'Checks Passed': `${checks.filter((c) => c.passed).length}/${checks.length}`,
        'PingAll': `${reachablePairs}/${totalPairs}`,
        'Nodes': nodes.length,
      },
      notes: 'Executed via integrated Mininet Verification Suite.',
    });
  };

  const copyPython = () => {
    navigator.clipboard.writeText(pythonScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadPython = () => {
    const blob = new Blob([pythonScript], { type: 'text/x-python' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'netlab_mininet_topo.py';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">12. Mininet CLI Emulator, Python Export & Final Verification</h2>
          <p className="text-sm text-slate-600 mt-1">
            Run interactive Mininet commands directly in your browser without VirtualBox/Ubuntu, export real Python topology code, and run final capstone verification.
          </p>
        </div>
        <button
          onClick={runFinalVerification}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium bg-emerald-600 text-white rounded-md hover:bg-emerald-700 cursor-pointer whitespace-nowrap self-start"
        >
          <Play size={14} /> Run Final Capstone Verification
        </button>
      </div>

      {/* Capstone Final Verification Results */}
      {verificationResults && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Automated Verification Report</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {verificationResults.map((chk) => (
              <div
                key={chk.name}
                className={`p-3.5 rounded-lg border flex items-start gap-3 ${
                  chk.passed ? 'bg-emerald-50/70 border-emerald-200' : 'bg-red-50/70 border-red-200'
                }`}
              >
                {chk.passed ? (
                  <CheckCircle2 size={18} className="text-emerald-700 shrink-0 mt-0.5" />
                ) : (
                  <XCircle size={18} className="text-red-700 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="text-sm font-semibold text-slate-900">{chk.name}</div>
                  <div className="text-xs text-slate-600 mt-0.5">{chk.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Browser Mininet CLI */}
        <div className="xl:col-span-6 bg-slate-900 text-slate-100 rounded-lg border border-slate-800 flex flex-col h-[480px]">
          <div className="px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-200">
              <Terminal size={15} className="text-sky-400" />
              <span>Interactive Mininet CLI Emulator</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {['nodes', 'net', 'pingall', 'iperf h1 h4'].map((preset) => (
                <button
                  key={preset}
                  onClick={() => executeMininetCmd(preset)}
                  className="px-2 py-1 text-[11px] font-mono bg-slate-800 hover:bg-slate-700 text-slate-200 rounded cursor-pointer"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-2">
            {cliLines.map((line) => (
              <pre
                key={line.id}
                className={`whitespace-pre-wrap leading-relaxed ${
                  line.kind === 'cmd'
                    ? 'text-sky-400 font-semibold'
                    : line.kind === 'err'
                    ? 'text-red-400'
                    : 'text-slate-200'
                }`}
              >
                {line.text}
              </pre>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              executeMininetCmd(cmdInput);
              setCmdInput('');
            }}
            className="p-3 border-t border-slate-800 flex items-center gap-2"
          >
            <span className="font-mono text-xs text-emerald-400 shrink-0">mininet&gt;</span>
            <input
              type="text"
              value={cmdInput}
              onChange={(e) => setCmdInput(e.target.value)}
              placeholder="Type command (e.g. pingall, h1 ping h3, link r1 r2 down)..."
              className="flex-1 bg-transparent text-xs font-mono text-white focus:outline-none"
            />
            <button
              type="submit"
              className="px-3 py-1 text-xs font-medium bg-sky-600 text-white rounded hover:bg-sky-700 cursor-pointer"
            >
              Run
            </button>
          </form>
        </div>

        {/* Real Mininet Python Script Generator */}
        <div className="xl:col-span-6 bg-white border border-slate-200 rounded-lg flex flex-col h-[480px]">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Generated Mininet Python Script</h3>
              <p className="text-xs text-slate-500">Synchronized live with your current topology, IPs & QoS links</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={copyPython}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
              >
                <Copy size={13} /> {copied ? 'Copied' : 'Copy'}
              </button>
              <button
                onClick={downloadPython}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-sky-600 text-white rounded-md hover:bg-sky-700 cursor-pointer"
              >
                <Download size={13} /> Download .py
              </button>
            </div>
          </div>

          <pre className="flex-1 overflow-auto p-4 font-mono text-xs bg-slate-50 text-slate-800 leading-relaxed">
            {pythonScript}
          </pre>
        </div>
      </div>
    </div>
  );
}
