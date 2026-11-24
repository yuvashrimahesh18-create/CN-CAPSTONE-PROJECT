import React, { useState } from 'react';
import {
  Activity,
  Calculator,
  FileBarChart2,
  GitBranch,
  Globe,
  Layers,
  Menu,
  Network,
  Radio,
  Send,
  Settings2,
  ShieldAlert,
  Terminal,
  X,
} from 'lucide-react';
import { LabProvider, useLab } from './context/LabContext';
import { ModuleId } from './types/network';
import { LabAutomationView } from './components/modules/LabAutomationView';
import { IpConfigView } from './components/modules/IpConfigView';
import { SubnetCalculatorView } from './components/modules/SubnetCalculatorView';
import { PingBatchView } from './components/modules/PingBatchView';
import { SlidingWindowView } from './components/modules/SlidingWindowView';
import { ArpSimulatorView } from './components/modules/ArpSimulatorView';
import { RoutingAlgorithmsView } from './components/modules/RoutingAlgorithmsView';
import { TcpUdpView } from './components/modules/TcpUdpView';
import { DnsDhcpView } from './components/modules/DnsDhcpView';
import { FaultMonitoringView } from './components/modules/FaultMonitoringView';
import { ReportsHistoryView } from './components/modules/ReportsHistoryView';
import { MininetTestingView } from './components/modules/MininetTestingView';

interface NavItem {
  id: ModuleId;
  num: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  group: 'Lab & Addressing' | 'Protocols & Routing' | 'Monitoring & Mininet';
}

const NAV_ITEMS: NavItem[] = [
  { id: 'lab-automation', num: '01', label: 'Lab Automation Engine', icon: Network, group: 'Lab & Addressing' },
  { id: 'ip-config', num: '02', label: 'IP Address Config', icon: Settings2, group: 'Lab & Addressing' },
  { id: 'subnet-calc', num: '03', label: 'Subnet Calculator', icon: Calculator, group: 'Lab & Addressing' },
  { id: 'ping-batch', num: '04', label: 'Ping & Batch Labs', icon: Radio, group: 'Lab & Addressing' },
  { id: 'sliding-window', num: '05', label: 'Sliding Window Protocol', icon: Layers, group: 'Protocols & Routing' },
  { id: 'arp-sim', num: '06', label: 'ARP Simulator', icon: Send, group: 'Protocols & Routing' },
  { id: 'routing-algos', num: '07', label: 'Routing Algorithms', icon: GitBranch, group: 'Protocols & Routing' },
  { id: 'tcp-udp', num: '08', label: 'TCP & UDP', icon: Activity, group: 'Protocols & Routing' },
  { id: 'dns-dhcp', num: '09', label: 'DNS & DHCP', icon: Globe, group: 'Protocols & Routing' },
  { id: 'fault-monitoring', num: '10', label: 'Faults & Monitoring', icon: ShieldAlert, group: 'Monitoring & Mininet' },
  { id: 'reports-history', num: '11', label: 'Reports & History', icon: FileBarChart2, group: 'Monitoring & Mininet' },
  { id: 'mininet-testing', num: '12', label: 'Mininet & Final Test', icon: Terminal, group: 'Monitoring & Mininet' },
];

const GROUPS: NavItem['group'][] = ['Lab & Addressing', 'Protocols & Routing', 'Monitoring & Mininet'];

function DashboardShell() {
  const { activeModule, setActiveModule, labStatus, presetName, startLab, stopLab } = useLab();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const currentNav = NAV_ITEMS.find((n) => n.id === activeModule) || NAV_ITEMS[0];

  const renderModule = () => {
    switch (activeModule) {
      case 'lab-automation':
        return <LabAutomationView />;
      case 'ip-config':
        return <IpConfigView />;
      case 'subnet-calc':
        return <SubnetCalculatorView />;
      case 'ping-batch':
        return <PingBatchView />;
      case 'sliding-window':
        return <SlidingWindowView />;
      case 'arp-sim':
        return <ArpSimulatorView />;
      case 'routing-algos':
        return <RoutingAlgorithmsView />;
      case 'tcp-udp':
        return <TcpUdpView />;
      case 'dns-dhcp':
        return <DnsDhcpView />;
      case 'fault-monitoring':
        return <FaultMonitoringView />;
      case 'reports-history':
        return <ReportsHistoryView />;
      case 'mininet-testing':
        return <MininetTestingView />;
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Mobile Sidebar Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 z-30 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Left Sidebar Navigation (264px) */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-14 px-5 border-b border-slate-200 flex items-center justify-between shrink-0">
          <span className="font-display text-base font-bold tracking-tight text-slate-900 whitespace-nowrap">
            NetLab Studio
          </span>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden p-1.5 text-slate-500 hover:text-slate-900 cursor-pointer"
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {GROUPS.map((group) => (
            <div key={group}>
              <div className="px-2.5 mb-1.5 text-xs font-semibold text-slate-400">{group}</div>
              <div className="space-y-0.5">
                {NAV_ITEMS.filter((item) => item.group === group).map((item) => {
                  const Icon = item.icon;
                  const active = item.id === activeModule;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveModule(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs font-medium transition-colors text-left cursor-pointer whitespace-nowrap ${
                        active
                          ? 'bg-sky-50 text-sky-800 font-semibold'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <Icon size={15} className={active ? 'text-sky-600 shrink-0' : 'text-slate-400 shrink-0'} />
                      <span className="font-mono text-[11px] text-slate-400 tabular-nums">{item.num}</span>
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-200 text-xs text-slate-500">
          <div className="font-medium text-slate-700">Browser Virtual Kernel</div>
          <div className="mt-0.5">Standalone mode · No VM required</div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Contextual Top Bar */}
        <header className="h-14 bg-white border-b border-slate-200 px-4 lg:px-6 flex items-center justify-between gap-4 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 text-slate-600 hover:text-slate-900 cursor-pointer"
              aria-label="Open navigation"
            >
              <Menu size={18} />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-400 hidden sm:inline whitespace-nowrap">Capstone Workbench</span>
              <span className="text-slate-300 hidden sm:inline">/</span>
              <span className="font-semibold text-slate-900 truncate">{currentNav.label}</span>
            </div>
          </div>

          <div className="flex items-center gap-6 shrink-0">
            <div className="hidden md:flex items-center gap-2 text-xs text-slate-600 whitespace-nowrap">
              <span>{presetName}</span>
              <span aria-hidden="true">·</span>
              <span
                className={`font-semibold capitalize ${
                  labStatus === 'running'
                    ? 'text-emerald-700'
                    : labStatus === 'stopped'
                    ? 'text-red-700'
                    : 'text-amber-700'
                }`}
              >
                Lab {labStatus}
              </span>
            </div>

            <button
              onClick={labStatus === 'running' ? stopLab : startLab}
              disabled={labStatus === 'deploying' || labStatus === 'stopping'}
              className={`px-4 py-1.5 text-xs font-medium rounded-md text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 ${
                labStatus === 'running' ? 'bg-slate-900 hover:bg-slate-800' : 'bg-sky-600 hover:bg-sky-700'
              }`}
            >
              {labStatus === 'running' ? 'Stop Lab' : 'Start Lab'}
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 max-w-[1440px] w-full mx-auto">{renderModule()}</main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <LabProvider>
      <DashboardShell />
    </LabProvider>
  );
}
