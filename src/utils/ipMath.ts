export function isValidIpv4(ip: string): boolean {
  const parts = ip.trim().split('.');
  if (parts.length !== 4) return false;
  return parts.every((p) => {
    if (!/^\d{1,3}$/.test(p)) return false;
    const num = Number(p);
    return num >= 0 && num <= 255;
  });
}

export function ipToInt(ip: string): number {
  const parts = ip.trim().split('.').map(Number);
  return (((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0);
}

export function intToIp(int: number): string {
  return [
    (int >>> 24) & 255,
    (int >>> 16) & 255,
    (int >>> 8) & 255,
    int & 255,
  ].join('.');
}

export function cidrToMaskInt(cidr: number): number {
  if (cidr <= 0) return 0;
  if (cidr >= 32) return 0xffffffff >>> 0;
  return (0xffffffff << (32 - cidr)) >>> 0;
}

export function cidrToMask(cidr: number): string {
  return intToIp(cidrToMaskInt(cidr));
}

export function ipToBinaryOctets(ip: string): string[] {
  if (!isValidIpv4(ip)) return ['00000000', '00000000', '00000000', '00000000'];
  return ip
    .trim()
    .split('.')
    .map((octet) => Number(octet).toString(2).padStart(8, '0'));
}

export interface SubnetDetails {
  ip: string;
  cidr: number;
  mask: string;
  wildcard: string;
  networkAddress: string;
  broadcastAddress: string;
  firstUsable: string;
  lastUsable: string;
  totalAddresses: number;
  usableHosts: number;
  ipClass: string;
  isPrivate: boolean;
}

export function calculateSubnet(ip: string, cidr: number): SubnetDetails | null {
  if (!isValidIpv4(ip) || cidr < 0 || cidr > 32) return null;
  const ipInt = ipToInt(ip);
  const maskInt = cidrToMaskInt(cidr);
  const wildcardInt = (~maskInt) >>> 0;
  const networkInt = (ipInt & maskInt) >>> 0;
  const broadcastInt = (networkInt | wildcardInt) >>> 0;
  const totalAddresses = Math.pow(2, 32 - cidr);
  const usableHosts = cidr >= 31 ? (cidr === 32 ? 1 : 2) : Math.max(0, totalAddresses - 2);
  const firstUsable = cidr >= 31 ? intToIp(networkInt) : intToIp(networkInt + 1);
  const lastUsable = cidr >= 31 ? intToIp(broadcastInt) : intToIp(broadcastInt - 1);

  const firstOctet = (ipInt >>> 24) & 255;
  const secondOctet = (ipInt >>> 16) & 255;
  let ipClass = 'E (Experimental)';
  if (firstOctet < 128) ipClass = 'A';
  else if (firstOctet < 192) ipClass = 'B';
  else if (firstOctet < 224) ipClass = 'C';
  else if (firstOctet < 240) ipClass = 'D (Multicast)';

  const isPrivate =
    firstOctet === 10 ||
    (firstOctet === 172 && secondOctet >= 16 && secondOctet <= 31) ||
    (firstOctet === 192 && secondOctet === 168);

  return {
    ip,
    cidr,
    mask: intToIp(maskInt),
    wildcard: intToIp(wildcardInt),
    networkAddress: intToIp(networkInt),
    broadcastAddress: intToIp(broadcastInt),
    firstUsable,
    lastUsable,
    totalAddresses,
    usableHosts,
    ipClass,
    isPrivate,
  };
}

export function sameSubnet(ipA: string, cidrA: number, ipB: string, cidrB: number): boolean {
  if (!isValidIpv4(ipA) || !isValidIpv4(ipB)) return false;
  const maskA = cidrToMaskInt(cidrA);
  const maskB = cidrToMaskInt(cidrB);
  return ((ipToInt(ipA) & maskA) >>> 0) === ((ipToInt(ipB) & maskB) >>> 0) && cidrA === cidrB;
}

export interface VlsmRequirement {
  id: string;
  name: string;
  hosts: number;
}

export interface VlsmAllocation {
  id: string;
  name: string;
  requestedHosts: number;
  allocatedHosts: number;
  cidr: number;
  mask: string;
  network: string;
  range: string;
  broadcast: string;
  utilizationPct: number;
  overflow: boolean;
}

export function allocateVlsm(baseIp: string, baseCidr: number, requirements: VlsmRequirement[]): VlsmAllocation[] {
  const baseDetails = calculateSubnet(baseIp, baseCidr);
  if (!baseDetails) return [];
  const baseStart = ipToInt(baseDetails.networkAddress);
  const baseEnd = ipToInt(baseDetails.broadcastAddress);

  const sorted = [...requirements].sort((a, b) => b.hosts - a.hosts);
  let cursor = baseStart;

  return sorted.map((req) => {
    const needed = Math.max(1, req.hosts) + 2;
    let hostBits = 1;
    while (Math.pow(2, hostBits) < needed && hostBits < 30) {
      hostBits++;
    }
    const cidr = 32 - hostBits;
    const blockSize = Math.pow(2, hostBits);
    // Align cursor to blockSize boundary
    const aligned = Math.ceil(cursor / blockSize) * blockSize;
    const networkInt = aligned >>> 0;
    const broadcastInt = (networkInt + blockSize - 1) >>> 0;
    const overflow = broadcastInt > baseEnd;
    cursor = broadcastInt + 1;

    const usable = Math.max(0, blockSize - 2);
    return {
      id: req.id,
      name: req.name,
      requestedHosts: req.hosts,
      allocatedHosts: usable,
      cidr,
      mask: cidrToMask(cidr),
      network: intToIp(networkInt),
      range: `${intToIp(networkInt + 1)} – ${intToIp(broadcastInt - 1)}`,
      broadcast: intToIp(broadcastInt),
      utilizationPct: usable > 0 ? Math.min(100, Math.round((req.hosts / usable) * 100)) : 0,
      overflow,
    };
  });
}
