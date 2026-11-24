export type ModuleId =
  | 'lab-automation'
  | 'ip-config'
  | 'subnet-calc'
  | 'ping-batch'
  | 'sliding-window'
  | 'arp-sim'
  | 'routing-algos'
  | 'tcp-udp'
  | 'dns-dhcp'
  | 'fault-monitoring'
  | 'reports-history'
  | 'mininet-testing';

export type LabStatus = 'stopped' | 'deploying' | 'running' | 'stopping';

export type NodeType = 'host' | 'switch' | 'router' | 'server';

export interface NetworkNode {
  id: string;
  label: string;
  type: NodeType;
  x: number; // 0..1000 SVG coordinate space
  y: number; // 0..520 SVG coordinate space
  ip: string;
  cidr: number;
  gateway: string;
  mac: string;
  iface: string;
  mtu: number;
  status: 'down' | 'booting' | 'up';
  cpuLoad: number;
  role?: string;
}

export interface NetworkLink {
  id: string;
  source: string;
  target: string;
  bandwidthMbps: number;
  delayMs: number;
  jitterMs: number;
  lossPct: number;
  up: boolean;
  utilizationPct: number;
}

export interface AnimatedPacket {
  id: string;
  linkId: string;
  reverse: boolean;
  protocol: 'ICMP' | 'TCP' | 'UDP' | 'ARP' | 'DNS' | 'DHCP' | 'OSPF';
  color: string;
  progress: number; // 0..1
  label: string;
}

export interface CapturedPacket {
  id: string;
  no: number;
  timestamp: string;
  sourceIp: string;
  destIp: string;
  sourceMac: string;
  destMac: string;
  protocol: 'ICMP' | 'TCP' | 'UDP' | 'ARP' | 'DNS' | 'DHCP' | 'OSPF';
  length: number;
  ttl: number;
  info: string;
  status: 'delivered' | 'dropped' | 'retransmitted';
}

export interface TrafficSample {
  time: string;
  throughputMbps: number;
  packetRate: number;
  lossRate: number;
  avgRttMs: number;
}

export interface ExperimentReport {
  id: string;
  timestamp: string;
  module: ModuleId;
  title: string;
  topologyName: string;
  summary: string;
  status: 'passed' | 'warning' | 'failed';
  metrics: Record<string, string | number>;
  notes: string;
}

export interface TopologyPreset {
  id: string;
  name: string;
  description: string;
  nodes: NetworkNode[];
  links: NetworkLink[];
}
