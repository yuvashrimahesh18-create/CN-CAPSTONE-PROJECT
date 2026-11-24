import React, { useMemo, useState } from 'react';
import { FastForward, Play, RotateCcw, Zap } from 'lucide-react';
import { useLab } from '../../context/LabContext';

interface CongestionPoint {
  rtt: number;
  cwnd: number;
  ssthresh: number;
  phase: 'Slow Start' | 'Congestion Avoidance' | 'Loss Event';
}

export function TcpUdpView() {
  const { logPacket } = useLab();

  // TCP 3-way handshake & teardown step
  const [tcpStep, setTcpStep] = useState<number>(0);
  const handshakeSteps = [
    { clientState: 'CLOSED', serverState: 'LISTEN', pkt: 'Idle — Click Step to initiate TCP 3-way handshake', dir: 'none' },
    { clientState: 'SYN_SENT', serverState: 'LISTEN', pkt: 'SYN (Seq=100, Win=64240, MSS=1460)', dir: 'c2s' },
    { clientState: 'SYN_SENT', serverState: 'SYN_RCVD', pkt: 'SYN-ACK (Seq=300, Ack=101, Win=65160)', dir: 's2c' },
    { clientState: 'ESTABLISHED', serverState: 'ESTABLISHED', pkt: 'ACK (Seq=101, Ack=301) — Connection Established', dir: 'c2s' },
    { clientState: 'ESTABLISHED', serverState: 'ESTABLISHED', pkt: 'DATA PSH-ACK (1460 bytes) + ACK', dir: 'c2s' },
    { clientState: 'FIN_WAIT_1', serverState: 'CLOSE_WAIT', pkt: 'FIN-ACK (Seq=1561) — Client Teardown', dir: 'c2s' },
    { clientState: 'FIN_WAIT_2', serverState: 'LAST_ACK', pkt: 'ACK + FIN (Server closing socket)', dir: 's2c' },
    { clientState: 'TIME_WAIT', serverState: 'CLOSED', pkt: 'Final ACK — Connection Closed cleanly', dir: 'c2s' },
  ];

  // TCP Congestion Control simulator (Reno vs Tahoe)
  const [tcpVariant, setTcpVariant] = useState<'reno' | 'tahoe'>('reno');
  const [initialSsthresh, setInitialSsthresh] = useState<number>(16);
  const [lossRound, setLossRound] = useState<number>(10);

  const cwndSeries = useMemo<CongestionPoint[]>(() => {
    const pts: CongestionPoint[] = [];
    let cwnd = 1;
    let ssthresh = initialSsthresh;

    for (let rtt = 1; rtt <= 22; rtt++) {
      if (rtt === lossRound) {
        pts.push({ rtt, cwnd, ssthresh, phase: 'Loss Event' });
        ssthresh = Math.max(2, Math.floor(cwnd / 2));
        cwnd = tcpVariant === 'reno' ? ssthresh : 1;
        continue;
      }
      const phase = cwnd < ssthresh ? 'Slow Start' : 'Congestion Avoidance';
      pts.push({ rtt, cwnd, ssthresh, phase });
      if (cwnd < ssthresh) cwnd = Math.min(ssthresh, cwnd * 2);
      else cwnd += 1;
    }
    return pts;
  }, [tcpVariant, initialSsthresh, lossRound]);

  // UDP Stream Burst Demo
  const [udpStats, setUdpStats] = useState({ sent: 0, delivered: 0, dropped: 0 });
  const sendUdpBurst = () => {
    const burst = 10;
    const dropped = Math.floor(Math.random() * 2);
    setUdpStats((prev) => ({
      sent: prev.sent + burst,
      delivered: prev.delivered + (burst - dropped),
      dropped: prev.dropped + dropped,
    }));
    logPacket({
      sourceIp: '10.0.1.10',
      destIp: '10.0.2.20',
      sourceMac: '00:00:00:00:01:01',
      destMac: '00:00:00:00:02:02',
      protocol: 'UDP',
      length: 512,
      ttl: 62,
      info: `UDP Datagram Burst (${burst} pkts, 8-byte header, zero handshake)`,
      status: dropped > 0 ? 'dropped' : 'delivered',
    });
  };

  const currentTcp = handshakeSteps[tcpStep];
  const maxCwnd = Math.max(20, ...cwndSeries.map((p) => p.cwnd));
  const chartW = 540;
  const chartH = 180;
  const cwndPath = cwndSeries
    .map((p, idx) => {
      const x = 20 + (idx / (cwndSeries.length - 1)) * (chartW - 40);
      const y = chartH - 16 - (p.cwnd / maxCwnd) * (chartH - 32);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <h2 className="text-xl font-semibold text-slate-900">08. TCP & UDP Transport Layer Lab</h2>
        <p className="text-sm text-slate-600 mt-1">
          Step through the TCP state machine (3-way handshake & 4-way teardown), compare Tahoe vs Reno AIMD congestion control, and contrast UDP datagram streaming.
        </p>
      </div>

      {/* TCP State Machine + UDP Comparison */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-7 bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900">TCP Handshake & Connection Lifecycle</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const next = (tcpStep + 1) % handshakeSteps.length;
                  setTcpStep(next);
                  const s = handshakeSteps[next];
                  if (s.dir !== 'none') {
                    logPacket({
                      sourceIp: s.dir === 'c2s' ? '10.0.1.10' : '10.0.2.20',
                      destIp: s.dir === 'c2s' ? '10.0.2.20' : '10.0.1.10',
                      sourceMac: '00:00:00:00:01:01',
                      destMac: '00:00:00:00:02:02',
                      protocol: 'TCP',
                      length: 66,
                      ttl: 62,
                      info: s.pkt,
                      status: 'delivered',
                    });
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-sky-600 text-white rounded-md hover:bg-sky-700 cursor-pointer"
              >
                <FastForward size={14} /> Step ({tcpStep + 1}/{handshakeSteps.length})
              </button>
              <button
                onClick={() => setTcpStep(0)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
              >
                <RotateCcw size={13} /> Reset
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 items-center bg-slate-50 border border-slate-200 rounded-lg p-4">
            <div className="text-center p-3 bg-white border border-slate-200 rounded-md">
              <div className="text-xs text-slate-500">Client (h1)</div>
              <div className="mt-1 font-mono text-sm font-semibold text-sky-700">{currentTcp.clientState}</div>
            </div>

            <div className="text-center space-y-1">
              <div className="text-xs font-mono font-semibold text-slate-800">
                {currentTcp.dir === 'c2s' ? '──────►' : currentTcp.dir === 's2c' ? '◄──────' : '• • •'}
              </div>
              <div className="text-[11px] font-mono text-slate-600">{currentTcp.pkt}</div>
            </div>

            <div className="text-center p-3 bg-white border border-slate-200 rounded-md">
              <div className="text-xs text-slate-500">Server (h4:80)</div>
              <div className="mt-1 font-mono text-sm font-semibold text-emerald-700">{currentTcp.serverState}</div>
            </div>
          </div>

          {/* Step timeline pills (interactive buttons) */}
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
            {handshakeSteps.map((s, idx) => (
              <button
                key={idx}
                onClick={() => setTcpStep(idx)}
                className={`py-1.5 px-2 text-[11px] font-mono rounded border cursor-pointer ${
                  tcpStep === idx
                    ? 'bg-sky-600 text-white border-sky-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Step {idx + 1}
              </button>
            ))}
          </div>
        </div>

        {/* UDP Side-by-Side Comparison */}
        <div className="xl:col-span-5 bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">UDP Stateless Datagram Stream</h3>
            <button
              onClick={sendUdpBurst}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-600 text-white rounded-md hover:bg-amber-700 cursor-pointer"
            >
              <Zap size={13} /> Fire 10 UDP Datagrams
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded">
              <div className="text-xs text-slate-500">Sent</div>
              <div className="font-mono text-base font-semibold tabular-nums">{udpStats.sent}</div>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded">
              <div className="text-xs text-slate-500">Delivered</div>
              <div className="font-mono text-base font-semibold tabular-nums text-emerald-700">{udpStats.delivered}</div>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded">
              <div className="text-xs text-slate-500">Unrecovered Drop</div>
              <div className="font-mono text-base font-semibold tabular-nums text-red-700">{udpStats.dropped}</div>
            </div>
          </div>

          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-1.5">Property</th>
                <th className="py-1.5">TCP</th>
                <th className="py-1.5">UDP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              <tr>
                <td className="py-1.5 font-medium">Header Overhead</td>
                <td className="py-1.5 font-mono">20 bytes (min)</td>
                <td className="py-1.5 font-mono">8 bytes</td>
              </tr>
              <tr>
                <td className="py-1.5 font-medium">Reliability</td>
                <td className="py-1.5">ACKs + Retransmit</td>
                <td className="py-1.5">Best-effort</td>
              </tr>
              <tr>
                <td className="py-1.5 font-medium">Congestion Control</td>
                <td className="py-1.5">AIMD / Slow Start</td>
                <td className="py-1.5">None</td>
              </tr>
              <tr>
                <td className="py-1.5 font-medium">Ideal Use Cases</td>
                <td className="py-1.5">HTTP, SSH, FTP</td>
                <td className="py-1.5">DNS, DHCP, VoIP</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* TCP Congestion Control AIMD Chart */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">TCP Congestion Control (Slow Start & AIMD)</h3>
            <p className="text-xs text-slate-500">
              Adjust ssthresh and packet loss round to contrast TCP Reno (Fast Recovery) vs TCP Tahoe (reset cwnd=1).
            </p>
          </div>
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
            <button
              onClick={() => setTcpVariant('reno')}
              className={`px-3 py-1 text-xs font-medium rounded-md cursor-pointer ${
                tcpVariant === 'reno' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              TCP Reno
            </button>
            <button
              onClick={() => setTcpVariant('tahoe')}
              className={`px-3 py-1 text-xs font-medium rounded-md cursor-pointer ${
                tcpVariant === 'tahoe' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              TCP Tahoe
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="flex justify-between text-xs text-slate-600 mb-1">
              <span>Initial ssthresh (MSS)</span>
              <span className="font-mono tabular-nums">{initialSsthresh} MSS</span>
            </div>
            <input
              type="range"
              min={4}
              max={24}
              value={initialSsthresh}
              onChange={(e) => setInitialSsthresh(Number(e.target.value))}
              className="w-full accent-sky-600"
            />
          </div>
          <div>
            <div className="flex justify-between text-xs text-slate-600 mb-1">
              <span>Simulated Loss Event Round</span>
              <span className="font-mono tabular-nums text-red-700">RTT #{lossRound}</span>
            </div>
            <input
              type="range"
              min={4}
              max={18}
              value={lossRound}
              onChange={(e) => setLossRound(Number(e.target.value))}
              className="w-full accent-red-600"
            />
          </div>
        </div>

        <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-48 bg-slate-50 border border-slate-200 rounded-md">
          <polyline points={cwndPath} fill="none" stroke="#0284c7" strokeWidth="2.5" strokeLinejoin="round" />
          {cwndSeries.map((p, idx) => {
            const x = 20 + (idx / (cwndSeries.length - 1)) * (chartW - 40);
            const y = chartH - 16 - (p.cwnd / maxCwnd) * (chartH - 32);
            return (
              <g key={p.rtt}>
                <circle
                  cx={x}
                  cy={y}
                  r={p.phase === 'Loss Event' ? 5 : 3.2}
                  fill={p.phase === 'Loss Event' ? '#dc2626' : '#0284c7'}
                />
                {p.phase === 'Loss Event' && (
                  <text x={x} y={y - 10} textAnchor="middle" className="text-[10px] font-mono fill-red-700 font-semibold">
                    LOSS
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
