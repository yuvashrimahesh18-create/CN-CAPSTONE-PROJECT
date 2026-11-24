import { NetworkLink, NetworkNode, TopologyPreset } from '../types/network';
import { isValidIpv4, sameSubnet } from './ipMath';

export const TOPOLOGY_PRESETS: TopologyPreset[] = [
  {
    id: 'campus-tree',
    name: 'Campus Multi-Subnet Lab',
    description: '2-router core bridging Student LAN (10.0.1.0/24) and Server DMZ (10.0.2.0/24) with L2 switches.',
    nodes: [
      { id: 'h1', label: 'h1', type: 'host', x: 110, y: 120, ip: '10.0.1.10', cidr: 24, gateway: '10.0.1.1', mac: '00:00:00:00:01:01', iface: 'h1-eth0', mtu: 1500, status: 'down', cpuLoad: 0, role: 'Student Workstation' },
      { id: 'h2', label: 'h2', type: 'host', x: 110, y: 380, ip: '10.0.1.11', cidr: 24, gateway: '10.0.1.1', mac: '00:00:00:00:01:02', iface: 'h2-eth0', mtu: 1500, status: 'down', cpuLoad: 0, role: 'Lab Client' },
      { id: 's1', label: 's1', type: 'switch', x: 290, y: 250, ip: '10.0.1.2', cidr: 24, gateway: '10.0.1.1', mac: '00:00:00:00:00:s1'.replace('s1', '11'), iface: 's1-eth1', mtu: 1500, status: 'down', cpuLoad: 0, role: 'OVS Access Switch' },
      { id: 'r1', label: 'r1', type: 'router', x: 460, y: 250, ip: '10.0.1.1', cidr: 24, gateway: '10.0.0.2', mac: '00:00:00:00:00:21', iface: 'r1-eth0', mtu: 1500, status: 'down', cpuLoad: 0, role: 'Edge Gateway' },
      { id: 'r2', label: 'r2', type: 'router', x: 640, y: 250, ip: '10.0.2.1', cidr: 24, gateway: '10.0.0.1', mac: '00:00:00:00:00:22', iface: 'r2-eth0', mtu: 1500, status: 'down', cpuLoad: 0, role: 'DMZ Core Router' },
      { id: 's2', label: 's2', type: 'switch', x: 780, y: 250, ip: '10.0.2.2', cidr: 24, gateway: '10.0.2.1', mac: '00:00:00:00:00:12', iface: 's2-eth1', mtu: 1500, status: 'down', cpuLoad: 0, role: 'OVS DMZ Switch' },
      { id: 'h3', label: 'h3', type: 'server', x: 910, y: 120, ip: '10.0.2.10', cidr: 24, gateway: '10.0.2.1', mac: '00:00:00:00:02:01', iface: 'h3-eth0', mtu: 1500, status: 'down', cpuLoad: 0, role: 'DNS & DHCP Server' },
      { id: 'h4', label: 'h4', type: 'server', x: 910, y: 380, ip: '10.0.2.20', cidr: 24, gateway: '10.0.2.1', mac: '00:00:00:00:02:02', iface: 'h4-eth0', mtu: 1500, status: 'down', cpuLoad: 0, role: 'Web / Iperf Target' },
    ],
    links: [
      { id: 'l1', source: 'h1', target: 's1', bandwidthMbps: 100, delayMs: 2, jitterMs: 0.4, lossPct: 0, up: true, utilizationPct: 0 },
      { id: 'l2', source: 'h2', target: 's1', bandwidthMbps: 100, delayMs: 2, jitterMs: 0.5, lossPct: 0, up: true, utilizationPct: 0 },
      { id: 'l3', source: 's1', target: 'r1', bandwidthMbps: 1000, delayMs: 3, jitterMs: 0.3, lossPct: 0, up: true, utilizationPct: 0 },
      { id: 'l4', source: 'r1', target: 'r2', bandwidthMbps: 500, delayMs: 12, jitterMs: 1.5, lossPct: 0, up: true, utilizationPct: 0 },
      { id: 'l5', source: 'r2', target: 's2', bandwidthMbps: 1000, delayMs: 3, jitterMs: 0.3, lossPct: 0, up: true, utilizationPct: 0 },
      { id: 'l6', source: 's2', target: 'h3', bandwidthMbps: 1000, delayMs: 1, jitterMs: 0.2, lossPct: 0, up: true, utilizationPct: 0 },
      { id: 'l7', source: 's2', target: 'h4', bandwidthMbps: 1000, delayMs: 1, jitterMs: 0.2, lossPct: 0, up: true, utilizationPct: 0 },
    ],
  },
  {
    id: 'mesh-core',
    name: 'Redundant OSPF Mesh Core',
    description: '4-router mesh core with dual redundant paths for failover, fault injection, and Dijkstra routing tests.',
    nodes: [
      { id: 'h1', label: 'h1', type: 'host', x: 120, y: 260, ip: '192.168.10.10', cidr: 24, gateway: '192.168.10.1', mac: '00:00:00:00:10:01', iface: 'h1-eth0', mtu: 1500, status: 'down', cpuLoad: 0, role: 'Source Host' },
      { id: 'r1', label: 'r1', type: 'router', x: 300, y: 260, ip: '192.168.10.1', cidr: 24, gateway: '192.168.10.1', mac: '00:00:00:00:00:a1', iface: 'r1-eth0', mtu: 1500, status: 'down', cpuLoad: 0, role: 'Ingress Router' },
      { id: 'r2', label: 'r2', type: 'router', x: 500, y: 110, ip: '192.168.10.2', cidr: 24, gateway: '192.168.10.1', mac: '00:00:00:00:00:a2', iface: 'r2-eth0', mtu: 1500, status: 'down', cpuLoad: 0, role: 'North Transit' },
      { id: 'r3', label: 'r3', type: 'router', x: 500, y: 410, ip: '192.168.10.3', cidr: 24, gateway: '192.168.10.1', mac: '00:00:00:00:00:a3', iface: 'r3-eth0', mtu: 1500, status: 'down', cpuLoad: 0, role: 'South Backup' },
      { id: 'r4', label: 'r4', type: 'router', x: 700, y: 260, ip: '192.168.10.4', cidr: 24, gateway: '192.168.10.1', mac: '00:00:00:00:00:a4', iface: 'r4-eth0', mtu: 1500, status: 'down', cpuLoad: 0, role: 'Egress Router' },
      { id: 'h2', label: 'h2', type: 'server', x: 880, y: 150, ip: '192.168.10.20', cidr: 24, gateway: '192.168.10.4', mac: '00:00:00:00:10:02', iface: 'h2-eth0', mtu: 1500, status: 'down', cpuLoad: 0, role: 'App Server' },
      { id: 'h3', label: 'h3', type: 'host', x: 880, y: 370, ip: '192.168.10.21', cidr: 24, gateway: '192.168.10.4', mac: '00:00:00:00:10:03', iface: 'h3-eth0', mtu: 1500, status: 'down', cpuLoad: 0, role: 'Telemetry Sink' },
    ],
    links: [
      { id: 'l1', source: 'h1', target: 'r1', bandwidthMbps: 100, delayMs: 2, jitterMs: 0.2, lossPct: 0, up: true, utilizationPct: 0 },
      { id: 'l2', source: 'r1', target: 'r2', bandwidthMbps: 1000, delayMs: 6, jitterMs: 0.4, lossPct: 0, up: true, utilizationPct: 0 },
      { id: 'l3', source: 'r1', target: 'r3', bandwidthMbps: 500, delayMs: 14, jitterMs: 1.0, lossPct: 0, up: true, utilizationPct: 0 },
      { id: 'l4', source: 'r2', target: 'r3', bandwidthMbps: 500, delayMs: 8, jitterMs: 0.5, lossPct: 0, up: true, utilizationPct: 0 },
      { id: 'l5', source: 'r2', target: 'r4', bandwidthMbps: 1000, delayMs: 5, jitterMs: 0.4, lossPct: 0, up: true, utilizationPct: 0 },
      { id: 'l6', source: 'r3', target: 'r4', bandwidthMbps: 500, delayMs: 12, jitterMs: 1.1, lossPct: 0, up: true, utilizationPct: 0 },
      { id: 'l7', source: 'r4', target: 'h2', bandwidthMbps: 1000, delayMs: 2, jitterMs: 0.2, lossPct: 0, up: true, utilizationPct: 0 },
      { id: 'l8', source: 'r4', target: 'h3', bandwidthMbps: 100, delayMs: 3, jitterMs: 0.3, lossPct: 0, up: true, utilizationPct: 0 },
    ],
  },
  {
    id: 'linear-single',
    name: 'Linear 4-Switch Classroom Lab',
    description: 'Classic single-subnet Mininet linear topology (4 switches, 4 hosts) ideal for ARP & Ping labs.',
    nodes: [
      { id: 's1', label: 's1', type: 'switch', x: 180, y: 180, ip: '10.0.0.101', cidr: 24, gateway: '10.0.0.254', mac: '00:00:00:00:00:01', iface: 's1-eth1', mtu: 1500, status: 'down', cpuLoad: 0, role: 'Switch 1' },
      { id: 's2', label: 's2', type: 'switch', x: 390, y: 180, ip: '10.0.0.102', cidr: 24, gateway: '10.0.0.254', mac: '00:00:00:00:00:02', iface: 's2-eth1', mtu: 1500, status: 'down', cpuLoad: 0, role: 'Switch 2' },
      { id: 's3', label: 's3', type: 'switch', x: 610, y: 180, ip: '10.0.0.103', cidr: 24, gateway: '10.0.0.254', mac: '00:00:00:00:00:03', iface: 's3-eth1', mtu: 1500, status: 'down', cpuLoad: 0, role: 'Switch 3' },
      { id: 's4', label: 's4', type: 'switch', x: 820, y: 180, ip: '10.0.0.104', cidr: 24, gateway: '10.0.0.254', mac: '00:00:00:00:00:04', iface: 's4-eth1', mtu: 1500, status: 'down', cpuLoad: 0, role: 'Switch 4' },
      { id: 'h1', label: 'h1', type: 'host', x: 180, y: 390, ip: '10.0.0.1', cidr: 24, gateway: '10.0.0.254', mac: '00:00:00:00:01:01', iface: 'h1-eth0', mtu: 1500, status: 'down', cpuLoad: 0, role: 'Host 1' },
      { id: 'h2', label: 'h2', type: 'host', x: 390, y: 390, ip: '10.0.0.2', cidr: 24, gateway: '10.0.0.254', mac: '00:00:00:00:01:02', iface: 'h2-eth0', mtu: 1500, status: 'down', cpuLoad: 0, role: 'Host 2' },
      { id: 'h3', label: 'h3', type: 'host', x: 610, y: 390, ip: '10.0.0.3', cidr: 24, gateway: '10.0.0.254', mac: '00:00:00:00:01:03', iface: 'h3-eth0', mtu: 1500, status: 'down', cpuLoad: 0, role: 'Host 3' },
      { id: 'h4', label: 'h4', type: 'server', x: 820, y: 390, ip: '10.0.0.4', cidr: 24, gateway: '10.0.0.254', mac: '00:00:00:00:01:04', iface: 'h4-eth0', mtu: 1500, status: 'down', cpuLoad: 0, role: 'Lab Server' },
    ],
    links: [
      { id: 'l1', source: 's1', target: 's2', bandwidthMbps: 100, delayMs: 4, jitterMs: 0.4, lossPct: 0, up: true, utilizationPct: 0 },
      { id: 'l2', source: 's2', target: 's3', bandwidthMbps: 100, delayMs: 4, jitterMs: 0.4, lossPct: 0, up: true, utilizationPct: 0 },
      { id: 'l3', source: 's3', target: 's4', bandwidthMbps: 100, delayMs: 4, jitterMs: 0.4, lossPct: 0, up: true, utilizationPct: 0 },
      { id: 'l4', source: 'h1', target: 's1', bandwidthMbps: 100, delayMs: 1, jitterMs: 0.1, lossPct: 0, up: true, utilizationPct: 0 },
      { id: 'l5', source: 'h2', target: 's2', bandwidthMbps: 100, delayMs: 1, jitterMs: 0.1, lossPct: 0, up: true, utilizationPct: 0 },
      { id: 'l6', source: 'h3', target: 's3', bandwidthMbps: 100, delayMs: 1, jitterMs: 0.1, lossPct: 0, up: true, utilizationPct: 0 },
      { id: 'l7', source: 'h4', target: 's4', bandwidthMbps: 100, delayMs: 1, jitterMs: 0.1, lossPct: 0, up: true, utilizationPct: 0 },
    ],
  },
];

export interface PathResult {
  reachable: boolean;
  reason?: string;
  nodePath: string[];
  linkIds: string[];
  oneWayDelayMs: number;
  combinedLossPct: number;
  bottleneckMbps: number;
}

export function findShortestPath(
  sourceId: string,
  targetId: string,
  nodes: NetworkNode[],
  links: NetworkLink[],
  labRunning: boolean
): PathResult {
  if (!labRunning) {
    return {
      reachable: false,
      reason: 'Lab environment is currently stopped. Start the Lab Automation Engine first.',
      nodePath: [],
      linkIds: [],
      oneWayDelayMs: 0,
      combinedLossPct: 100,
      bottleneckMbps: 0,
    };
  }

  const srcNode = nodes.find((n) => n.id === sourceId);
  const dstNode = nodes.find((n) => n.id === targetId);
  if (!srcNode || !dstNode) {
    return { reachable: false, reason: 'Invalid source or destination node.', nodePath: [], linkIds: [], oneWayDelayMs: 0, combinedLossPct: 100, bottleneckMbps: 0 };
  }

  if (srcNode.status !== 'up' || dstNode.status !== 'up') {
    return { reachable: false, reason: 'Source or destination interface is down.', nodePath: [], linkIds: [], oneWayDelayMs: 0, combinedLossPct: 100, bottleneckMbps: 0 };
  }

  if (!isValidIpv4(srcNode.ip) || !isValidIpv4(dstNode.ip)) {
    return { reachable: false, reason: 'Invalid IPv4 configuration on endpoint.', nodePath: [], linkIds: [], oneWayDelayMs: 0, combinedLossPct: 100, bottleneckMbps: 0 };
  }

  // Duplicate IP check
  const duplicateIps = nodes.filter((n) => n.ip === srcNode.ip || n.ip === dstNode.ip);
  if (srcNode.ip === dstNode.ip && srcNode.id !== dstNode.id) {
    return { reachable: false, reason: `IP conflict detected on ${srcNode.ip}.`, nodePath: [], linkIds: [], oneWayDelayMs: 0, combinedLossPct: 100, bottleneckMbps: 0 };
  }
  if (duplicateIps.length > 2) {
    return { reachable: false, reason: 'Duplicate IP address conflict in topology.', nodePath: [], linkIds: [], oneWayDelayMs: 0, combinedLossPct: 100, bottleneckMbps: 0 };
  }

  // Dijkstra by link delay
  const dist: Record<string, number> = {};
  const prev: Record<string, { nodeId: string; linkId: string } | null> = {};
  const unvisited = new Set<string>();

  nodes.forEach((n) => {
    if (n.status === 'up') {
      dist[n.id] = Infinity;
      prev[n.id] = null;
      unvisited.add(n.id);
    }
  });
  dist[sourceId] = 0;

  while (unvisited.size > 0) {
    let u: string | null = null;
    let best = Infinity;
    for (const id of unvisited) {
      if (dist[id] < best) {
        best = dist[id];
        u = id;
      }
    }
    if (!u || best === Infinity) break;
    if (u === targetId) break;
    unvisited.delete(u);

    for (const link of links) {
      if (!link.up) continue;
      const neighbor = link.source === u ? link.target : link.target === u ? link.source : null;
      if (!neighbor || !unvisited.has(neighbor)) continue;
      const alt = dist[u] + Math.max(0.5, link.delayMs);
      if (alt < dist[neighbor]) {
        dist[neighbor] = alt;
        prev[neighbor] = { nodeId: u, linkId: link.id };
      }
    }
  }

  if (!prev[targetId] && sourceId !== targetId) {
    return {
      reachable: false,
      reason: 'Network unreachable (link down or isolated partition).',
      nodePath: [],
      linkIds: [],
      oneWayDelayMs: 0,
      combinedLossPct: 100,
      bottleneckMbps: 0,
    };
  }

  const nodePath: string[] = [];
  const linkIds: string[] = [];
  let curr: string | null = targetId;
  while (curr) {
    nodePath.unshift(curr);
    const step: { nodeId: string; linkId: string } | null = prev[curr] ?? null;
    if (step) {
      linkIds.unshift(step.linkId);
      curr = step.nodeId;
    } else {
      curr = null;
    }
  }

  // Verify L3 routing rules if crossing subnets: needs a router in path or valid gateway
  const isSameSub = sameSubnet(srcNode.ip, srcNode.cidr, dstNode.ip, dstNode.cidr);
  if (!isSameSub) {
    const hasRouter = nodePath.some((nid) => nodes.find((n) => n.id === nid)?.type === 'router');
    if (!hasRouter) {
      return {
        reachable: false,
        reason: `Different subnets (${srcNode.ip}/${srcNode.cidr} vs ${dstNode.ip}/${dstNode.cidr}) with no active L3 router in path.`,
        nodePath,
        linkIds,
        oneWayDelayMs: 0,
        combinedLossPct: 100,
        bottleneckMbps: 0,
      };
    }
    if (!isValidIpv4(srcNode.gateway) || !isValidIpv4(dstNode.gateway)) {
      return {
        reachable: false,
        reason: 'Missing default gateway for inter-subnet routing.',
        nodePath,
        linkIds,
        oneWayDelayMs: 0,
        combinedLossPct: 100,
        bottleneckMbps: 0,
      };
    }
  }

  let oneWayDelayMs = 0;
  let survivalProb = 1;
  let bottleneckMbps = Infinity;
  for (const lid of linkIds) {
    const l = links.find((lk) => lk.id === lid);
    if (l) {
      oneWayDelayMs += l.delayMs;
      survivalProb *= Math.max(0, 1 - l.lossPct / 100);
      bottleneckMbps = Math.min(bottleneckMbps, l.bandwidthMbps);
    }
  }

  return {
    reachable: true,
    nodePath,
    linkIds,
    oneWayDelayMs,
    combinedLossPct: Math.round((1 - survivalProb) * 1000) / 10,
    bottleneckMbps: bottleneckMbps === Infinity ? 1000 : bottleneckMbps,
  };
}

export function generateMininetPython(presetName: string, nodes: NetworkNode[], links: NetworkLink[]): string {
  const safeName = presetName.replace(/[^a-zA-Z0-9]/g, '') || 'CustomLab';
  const hostsAndServers = nodes.filter((n) => n.type === 'host' || n.type === 'server');
  const switchesAndRouters = nodes.filter((n) => n.type === 'switch' || n.type === 'router');

  const nodeLines = [
    ...switchesAndRouters.map(
      (n) => `        ${n.id} = self.addSwitch('${n.id}')  # ${n.role || n.type} (${n.ip}/${n.cidr})`
    ),
    ...hostsAndServers.map(
      (n) =>
        `        ${n.id} = self.addHost('${n.id}', ip='${n.ip}/${n.cidr}', defaultRoute='via ${n.gateway}', mac='${n.mac}')`
    ),
  ].join('\n');

  const linkLines = links
    .map(
      (l) =>
        `        self.addLink(${l.source}, ${l.target}, cls=TCLink, bw=${l.bandwidthMbps}, delay='${l.delayMs}ms', jitter='${l.jitterMs}ms', loss=${l.lossPct})`
    )
    .join('\n');

  return `#!/usr/bin/env python3
"""
NetLab Studio — Exported Mininet Topology (${presetName})
Generated for standalone Mininet execution with TCLink QoS parameters.
"""

from mininet.topo import Topo
from mininet.net import Mininet
from mininet.node import OVSController
from mininet.link import TCLink
from mininet.cli import CLI
from mininet.log import setLogLevel, info


class ${safeName}Topo(Topo):
    def build(self):
        # Network Nodes
${nodeLines}

        # Network Links with Bandwidth, Delay, Jitter & Loss
${linkLines}


def run_lab():
    setLogLevel('info')
    topo = ${safeName}Topo()
    net = Mininet(topo=topo, controller=OVSController, link=TCLink, autoSetMacs=False)
    net.start()

    info("*** Running automated connectivity verification (pingall)\\n")
    loss_pct = net.pingAll()
    info(f"*** PingAll Packet Loss: {loss_pct}%\\n")

    CLI(net)
    net.stop()


if __name__ == '__main__':
    run_lab()
`;
}
