import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  AnimatedPacket,
  CapturedPacket,
  ExperimentReport,
  LabStatus,
  ModuleId,
  NetworkLink,
  NetworkNode,
  TrafficSample,
} from '../types/network';
import { TOPOLOGY_PRESETS } from '../utils/networkEngine';

interface LabContextValue {
  activeModule: ModuleId;
  setActiveModule: (m: ModuleId) => void;
  presetId: string;
  presetName: string;
  labStatus: LabStatus;
  nodes: NetworkNode[];
  links: NetworkLink[];
  animatedPackets: AnimatedPacket[];
  capturedPackets: CapturedPacket[];
  trafficHistory: TrafficSample[];
  reports: ExperimentReport[];
  deployPreset: (id: string) => void;
  startLab: () => void;
  stopLab: () => void;
  restartLab: () => void;
  updateNode: (id: string, patch: Partial<NetworkNode>) => void;
  addNode: (node: NetworkNode, connectToId?: string) => void;
  removeNode: (id: string) => void;
  updateLink: (id: string, patch: Partial<NetworkLink>) => void;
  addLink: (source: string, target: string) => void;
  removeLink: (id: string) => void;
  injectPacketOnPath: (
    linkIds: string[],
    protocol: AnimatedPacket['protocol'],
    label: string,
    srcNode?: NetworkNode,
    dstNode?: NetworkNode,
    status?: CapturedPacket['status']
  ) => void;
  logPacket: (pkt: Omit<CapturedPacket, 'id' | 'no' | 'timestamp'>) => void;
  clearCaptures: () => void;
  addReport: (report: Omit<ExperimentReport, 'id' | 'timestamp'>) => void;
  updateReportNotes: (id: string, notes: string) => void;
  deleteReport: (id: string) => void;
  clearReports: () => void;
}

const LabContext = createContext<LabContextValue | null>(null);

const PROTOCOL_COLORS: Record<AnimatedPacket['protocol'], string> = {
  ICMP: '#0284c7',
  TCP: '#059669',
  UDP: '#d97706',
  ARP: '#7c3aed',
  DNS: '#0891b2',
  DHCP: '#4f46e5',
  OSPF: '#be123c',
};

const STORAGE_KEY_REPORTS = 'netlab_studio_experiment_reports_v1';

const INITIAL_REPORTS: ExperimentReport[] = [
  {
    id: 'rep-init-1',
    timestamp: new Date(Date.now() - 3600_000 * 4).toISOString(),
    module: 'ping-batch',
    title: 'Baseline Campus Multi-Subnet PingAll Matrix',
    topologyName: 'Campus Multi-Subnet Lab',
    summary: 'Verified 100% reachability across Student LAN (10.0.1.0/24) and DMZ (10.0.2.0/24) through r1-r2 core.',
    status: 'passed',
    metrics: { 'Total Pairs': 12, 'Delivered': '12/12', 'Avg RTT': '18.4 ms', 'Loss': '0.0%' },
    notes: 'Default gateway routes converged properly across r1 and r2.',
  },
  {
    id: 'rep-init-2',
    timestamp: new Date(Date.now() - 3600_000 * 2).toISOString(),
    module: 'sliding-window',
    title: 'Go-Back-N vs Selective Repeat (N=4, 10% Loss)',
    topologyName: 'Campus Multi-Subnet Lab',
    summary: 'Demonstrated cumulative retransmission penalty in Go-Back-N compared to Selective Repeat single-frame recovery.',
    status: 'passed',
    metrics: { 'Window Size': 4, 'Efficiency': '78.6%', 'Retransmissions': 3, 'Frames Acked': 12 },
    notes: 'Prepared for capstone professor review.',
  },
];

function cloneInitialNodes(presetId: string, up: boolean): NetworkNode[] {
  const preset = TOPOLOGY_PRESETS.find((p) => p.id === presetId) || TOPOLOGY_PRESETS[0];
  return preset.nodes.map((n) => ({
    ...n,
    status: up ? 'up' : 'down',
    cpuLoad: up ? Math.round(6 + Math.random() * 14) : 0,
  }));
}

function cloneInitialLinks(presetId: string): NetworkLink[] {
  const preset = TOPOLOGY_PRESETS.find((p) => p.id === presetId) || TOPOLOGY_PRESETS[0];
  return preset.links.map((l) => ({ ...l, utilizationPct: Math.round(8 + Math.random() * 18) }));
}

function createInitialTraffic(): TrafficSample[] {
  const samples: TrafficSample[] = [];
  const now = Date.now();
  for (let i = 19; i >= 0; i--) {
    const d = new Date(now - i * 1500);
    samples.push({
      time: d.toLocaleTimeString([], { minute: '2-digit', second: '2-digit' }),
      throughputMbps: Math.round((32 + Math.sin(i * 0.5) * 12 + Math.random() * 9) * 10) / 10,
      packetRate: Math.round(240 + Math.cos(i * 0.4) * 60 + Math.random() * 45),
      lossRate: 0,
      avgRttMs: Math.round((14 + Math.random() * 5) * 10) / 10,
    });
  }
  return samples;
}

export function LabProvider({ children }: { children: React.ReactNode }) {
  const [activeModule, setActiveModule] = useState<ModuleId>('lab-automation');
  const [presetId, setPresetId] = useState<string>('campus-tree');
  const [labStatus, setLabStatus] = useState<LabStatus>('running');
  const [nodes, setNodes] = useState<NetworkNode[]>(() => cloneInitialNodes('campus-tree', true));
  const [links, setLinks] = useState<NetworkLink[]>(() => cloneInitialLinks('campus-tree'));
  const [animatedPackets, setAnimatedPackets] = useState<AnimatedPacket[]>([]);
  const [capturedPackets, setCapturedPackets] = useState<CapturedPacket[]>(() => [
    {
      id: 'pkt-1',
      no: 1,
      timestamp: new Date(Date.now() - 4000).toLocaleTimeString(),
      sourceIp: '10.0.1.10',
      destIp: '10.0.2.10',
      sourceMac: '00:00:00:00:01:01',
      destMac: '00:00:00:00:02:01',
      protocol: 'DNS',
      length: 74,
      ttl: 62,
      info: 'Standard query 0x4b12 A portal.campus.edu',
      status: 'delivered',
    },
    {
      id: 'pkt-2',
      no: 2,
      timestamp: new Date(Date.now() - 3200).toLocaleTimeString(),
      sourceIp: '10.0.2.10',
      destIp: '10.0.1.10',
      sourceMac: '00:00:00:00:02:01',
      destMac: '00:00:00:00:01:01',
      protocol: 'DNS',
      length: 90,
      ttl: 62,
      info: 'Standard query response A 10.0.2.20',
      status: 'delivered',
    },
    {
      id: 'pkt-3',
      no: 3,
      timestamp: new Date(Date.now() - 2100).toLocaleTimeString(),
      sourceIp: '10.0.1.10',
      destIp: '10.0.2.20',
      sourceMac: '00:00:00:00:01:01',
      destMac: '00:00:00:00:02:02',
      protocol: 'TCP',
      length: 66,
      ttl: 62,
      info: '51824 → 80 [SYN] Seq=0 Win=64240 Len=0 MSS=1460',
      status: 'delivered',
    },
  ]);
  const [trafficHistory, setTrafficHistory] = useState<TrafficSample[]>(createInitialTraffic);
  const [reports, setReports] = useState<ExperimentReport[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_REPORTS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return INITIAL_REPORTS;
  });

  const packetCounterRef = useRef(4);
  const presetName = TOPOLOGY_PRESETS.find((p) => p.id === presetId)?.name || 'Custom Lab Topology';

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_REPORTS, JSON.stringify(reports));
    } catch {
      // ignore
    }
  }, [reports]);

  const logPacket = useCallback((pkt: Omit<CapturedPacket, 'id' | 'no' | 'timestamp'>) => {
    const no = packetCounterRef.current++;
    const entry: CapturedPacket = {
      ...pkt,
      id: `pkt-${no}-${Math.random().toString(36).slice(2, 6)}`,
      no,
      timestamp: new Date().toLocaleTimeString(),
    };
    setCapturedPackets((prev) => [entry, ...prev].slice(0, 120));
  }, []);

  const injectPacketOnPath = useCallback(
    (
      linkIds: string[],
      protocol: AnimatedPacket['protocol'],
      label: string,
      srcNode?: NetworkNode,
      dstNode?: NetworkNode,
      status: CapturedPacket['status'] = 'delivered'
    ) => {
      const newPkts: AnimatedPacket[] = linkIds.map((lid, idx) => ({
        id: `anim-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
        linkId: lid,
        reverse: false,
        protocol,
        color: PROTOCOL_COLORS[protocol],
        progress: -idx * 0.15,
        label,
      }));
      setAnimatedPackets((prev) => [...prev, ...newPkts].slice(-36));

      if (srcNode && dstNode) {
        logPacket({
          sourceIp: srcNode.ip,
          destIp: dstNode.ip,
          sourceMac: srcNode.mac,
          destMac: dstNode.mac,
          protocol,
          length: protocol === 'ICMP' ? 98 : protocol === 'ARP' ? 42 : 128,
          ttl: 64 - Math.max(0, linkIds.length - 1),
          info: label,
          status,
        });
      }
    },
    [logPacket]
  );

  // Animation tick for flying packets across topology links
  useEffect(() => {
    if (labStatus !== 'running') {
      setAnimatedPackets([]);
      return;
    }
    const timer = setInterval(() => {
      setAnimatedPackets((prev) =>
        prev
          .map((p) => ({ ...p, progress: p.progress + 0.075 }))
          .filter((p) => p.progress <= 1.05)
      );
    }, 50);
    return () => clearInterval(timer);
  }, [labStatus]);

  // Background telemetry & ambient packet generator when lab is running
  useEffect(() => {
    if (labStatus !== 'running') return;
    const timer = setInterval(() => {
      setLinks((prevLinks) => {
        const activeLinks = prevLinks.filter((l) => l.up);
        const totalLoss =
          activeLinks.length > 0
            ? activeLinks.reduce((acc, l) => acc + l.lossPct, 0) / activeLinks.length
            : 100;
        const avgDelay =
          activeLinks.length > 0
            ? activeLinks.reduce((acc, l) => acc + l.delayMs, 0) / activeLinks.length
            : 0;

        // Emit 1 ambient packet along a random active link
        if (activeLinks.length > 0) {
          const pick = activeLinks[Math.floor(Math.random() * activeLinks.length)];
          const protocols: AnimatedPacket['protocol'][] = ['TCP', 'UDP', 'ICMP', 'OSPF'];
          const proto = protocols[Math.floor(Math.random() * protocols.length)];
          setAnimatedPackets((prev) => [
            ...prev.slice(-24),
            {
              id: `bg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              linkId: pick.id,
              reverse: Math.random() > 0.5,
              protocol: proto,
              color: PROTOCOL_COLORS[proto],
              progress: 0,
              label: proto,
            },
          ]);
        }

        const timeLabel = new Date().toLocaleTimeString([], { minute: '2-digit', second: '2-digit' });
        const baseThroughput = activeLinks.length * 6.8 + Math.random() * 14;
        const throughputMbps = Math.round(Math.max(0, baseThroughput * (1 - totalLoss / 100)) * 10) / 10;
        const packetRate = activeLinks.length === 0 ? 0 : Math.round(140 + activeLinks.length * 24 + Math.random() * 45);

        setTrafficHistory((prev) => [
          ...prev.slice(-23),
          {
            time: timeLabel,
            throughputMbps,
            packetRate,
            lossRate: Math.round(totalLoss * 10) / 10,
            avgRttMs: Math.round(avgDelay * 2 * 10) / 10,
          },
        ]);

        return prevLinks.map((l) => ({
          ...l,
          utilizationPct: l.up ? Math.min(96, Math.max(4, Math.round(12 + Math.random() * 26 + l.lossPct * 0.6))) : 0,
        }));
      });

      setNodes((prev) =>
        prev.map((n) => ({
          ...n,
          cpuLoad: n.status === 'up' ? Math.min(95, Math.max(4, Math.round(n.cpuLoad + (Math.random() * 6 - 3)))) : 0,
        }))
      );
    }, 1500);

    return () => clearInterval(timer);
  }, [labStatus]);

  const startLab = useCallback(() => {
    setLabStatus('deploying');
    setNodes((prev) => prev.map((n) => ({ ...n, status: 'booting', cpuLoad: 25 })));
    setTimeout(() => {
      setNodes((prev) => prev.map((n) => ({ ...n, status: 'up', cpuLoad: Math.round(8 + Math.random() * 12) })));
      setLabStatus('running');
    }, 800);
  }, []);

  const stopLab = useCallback(() => {
    setLabStatus('stopping');
    setTimeout(() => {
      setNodes((prev) => prev.map((n) => ({ ...n, status: 'down', cpuLoad: 0 })));
      setLinks((prev) => prev.map((l) => ({ ...l, utilizationPct: 0 })));
      setLabStatus('stopped');
    }, 500);
  }, []);

  const restartLab = useCallback(() => {
    setLabStatus('stopping');
    setNodes((prev) => prev.map((n) => ({ ...n, status: 'down', cpuLoad: 0 })));
    setTimeout(() => {
      setLabStatus('deploying');
      setNodes((prev) => prev.map((n) => ({ ...n, status: 'booting', cpuLoad: 30 })));
      setTimeout(() => {
        setNodes((prev) => prev.map((n) => ({ ...n, status: 'up', cpuLoad: 10 })));
        setLabStatus('running');
      }, 700);
    }, 400);
  }, []);

  const deployPreset = useCallback((id: string) => {
    setPresetId(id);
    setLabStatus('deploying');
    setNodes(cloneInitialNodes(id, false).map((n) => ({ ...n, status: 'booting', cpuLoad: 22 })));
    setLinks(cloneInitialLinks(id));
    setTimeout(() => {
      setNodes(cloneInitialNodes(id, true));
      setLabStatus('running');
    }, 700);
  }, []);

  const updateNode = useCallback((id: string, patch: Partial<NetworkNode>) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  }, []);

  const addNode = useCallback(
    (node: NetworkNode, connectToId?: string) => {
      setNodes((prev) => [...prev, { ...node, status: labStatus === 'running' ? 'up' : 'down' }]);
      if (connectToId) {
        setLinks((prev) => [
          ...prev,
          {
            id: `l-${Date.now()}`,
            source: node.id,
            target: connectToId,
            bandwidthMbps: 100,
            delayMs: 2,
            jitterMs: 0.3,
            lossPct: 0,
            up: true,
            utilizationPct: 8,
          },
        ]);
      }
    },
    [labStatus]
  );

  const removeNode = useCallback((id: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setLinks((prev) => prev.filter((l) => l.source !== id && l.target !== id));
  }, []);

  const updateLink = useCallback((id: string, patch: Partial<NetworkLink>) => {
    setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }, []);

  const addLink = useCallback((source: string, target: string) => {
    if (source === target) return;
    setLinks((prev) => {
      const exists = prev.some(
        (l) => (l.source === source && l.target === target) || (l.source === target && l.target === source)
      );
      if (exists) return prev;
      return [
        ...prev,
        {
          id: `l-${Date.now()}`,
          source,
          target,
          bandwidthMbps: 100,
          delayMs: 4,
          jitterMs: 0.5,
          lossPct: 0,
          up: true,
          utilizationPct: 10,
        },
      ];
    });
  }, []);

  const removeLink = useCallback((id: string) => {
    setLinks((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const clearCaptures = useCallback(() => {
    setCapturedPackets([]);
  }, []);

  const addReport = useCallback((report: Omit<ExperimentReport, 'id' | 'timestamp'>) => {
    const newReport: ExperimentReport = {
      ...report,
      id: `rep-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    setReports((prev) => [newReport, ...prev]);
  }, []);

  const updateReportNotes = useCallback((id: string, notes: string) => {
    setReports((prev) => prev.map((r) => (r.id === id ? { ...r, notes } : r)));
  }, []);

  const deleteReport = useCallback((id: string) => {
    setReports((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const clearReports = useCallback(() => {
    setReports([]);
  }, []);

  return (
    <LabContext.Provider
      value={{
        activeModule,
        setActiveModule,
        presetId,
        presetName,
        labStatus,
        nodes,
        links,
        animatedPackets,
        capturedPackets,
        trafficHistory,
        reports,
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
        injectPacketOnPath,
        logPacket,
        clearCaptures,
        addReport,
        updateReportNotes,
        deleteReport,
        clearReports,
      }}
    >
      {children}
    </LabContext.Provider>
  );
}

export function useLab() {
  const ctx = useContext(LabContext);
  if (!ctx) throw new Error('useLab must be used inside LabProvider');
  return ctx;
}
