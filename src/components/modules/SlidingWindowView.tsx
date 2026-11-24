import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, FastForward, Pause, Play, RotateCcw, Save, Send, ShieldAlert } from 'lucide-react';
import { useLab } from '../../context/LabContext';

type SwProtocol = 'stop-wait' | 'go-back-n' | 'selective-repeat';

interface InFlightPacket {
  id: string;
  kind: 'DATA' | 'ACK';
  seq: number;
  progress: number; // 0..100
  willDrop: boolean;
  dropped: boolean;
  retransmitted: boolean;
}

interface LadderEvent {
  id: string;
  tick: number;
  actor: 'Sender' | 'Receiver' | 'Channel';
  message: string;
  tone: 'normal' | 'warn' | 'error' | 'ok';
}

export function SlidingWindowView() {
  const { addReport, presetName, logPacket } = useLab();

  const [protocol, setProtocol] = useState<SwProtocol>('go-back-n');
  const [windowSize, setWindowSize] = useState<number>(4);
  const [totalFrames, setTotalFrames] = useState<number>(12);
  const [lossPct, setLossPct] = useState<number>(0);
  const [timeoutTicks, setTimeoutTicks] = useState<number>(16);
  const [speedMs, setSpeedMs] = useState<number>(180);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [tick, setTick] = useState<number>(0);

  // Protocol state
  const [sendBase, setSendBase] = useState<number>(0);
  const [nextSeq, setNextSeq] = useState<number>(0);
  const [ackedBySender, setAckedBySender] = useState<number[]>([]);
  const [timers, setTimers] = useState<Record<number, number>>({}); // seq -> remaining ticks

  const [rcvBase, setRcvBase] = useState<number>(0);
  const [rcvBuffer, setRcvBuffer] = useState<number[]>([]);
  const [delivered, setDelivered] = useState<number[]>([]);

  const [inFlight, setInFlight] = useState<InFlightPacket[]>([]);
  const [events, setEvents] = useState<LadderEvent[]>([
    {
      id: 'init',
      tick: 0,
      actor: 'Sender',
      message: 'Ready. Press Play or Step to transmit frames across the virtual channel.',
      tone: 'normal',
    },
  ]);

  const [stats, setStats] = useState({
    sentFrames: 0,
    retransmissions: 0,
    acksReceived: 0,
    droppedData: 0,
    droppedAck: 0,
  });

  // Manual fault triggers for live classroom demos
  const [armDropData, setArmDropData] = useState<boolean>(false);
  const [armDropAck, setArmDropAck] = useState<boolean>(false);

  const effectiveWindow = protocol === 'stop-wait' ? 1 : windowSize;

  const resetSimulation = useCallback(
    (newProto?: SwProtocol) => {
      setIsPlaying(false);
      setTick(0);
      setSendBase(0);
      setNextSeq(0);
      setAckedBySender([]);
      setTimers({});
      setRcvBase(0);
      setRcvBuffer([]);
      setDelivered([]);
      setInFlight([]);
      setArmDropData(false);
      setArmDropAck(false);
      setStats({ sentFrames: 0, retransmissions: 0, acksReceived: 0, droppedData: 0, droppedAck: 0 });
      const activeProto = newProto ?? protocol;
      setEvents([
        {
          id: `reset-${Date.now()}`,
          tick: 0,
          actor: 'Sender',
          message: `Initialized ${
            activeProto === 'stop-wait'
              ? 'Stop-and-Wait (N=1)'
              : activeProto === 'go-back-n'
              ? `Go-Back-N (N=${windowSize})`
              : `Selective Repeat (N=${windowSize})`
          } simulation.`,
          tone: 'normal',
        },
      ]);
    },
    [protocol, windowSize]
  );

  // Refs for clean deterministic tick execution inside interval
  const stateRef = useRef({
    protocol,
    effectiveWindow,
    totalFrames,
    lossPct,
    timeoutTicks,
    tick,
    sendBase,
    nextSeq,
    ackedBySender,
    timers,
    rcvBase,
    rcvBuffer,
    delivered,
    inFlight,
    armDropData,
    armDropAck,
    stats,
  });
  stateRef.current = {
    protocol,
    effectiveWindow,
    totalFrames,
    lossPct,
    timeoutTicks,
    tick,
    sendBase,
    nextSeq,
    ackedBySender,
    timers,
    rcvBase,
    rcvBuffer,
    delivered,
    inFlight,
    armDropData,
    armDropAck,
    stats,
  };

  const stepTick = useCallback(() => {
    const s = stateRef.current;
    if (s.sendBase >= s.totalFrames && s.inFlight.length === 0) {
      setIsPlaying(false);
      return;
    }

    const nextTick = s.tick + 1;
    let sendBase = s.sendBase;
    let nextSeq = s.nextSeq;
    const acked = new Set(s.ackedBySender);
    const timers: Record<number, number> = { ...s.timers };
    let rcvBase = s.rcvBase;
    const rcvBuf = new Set(s.rcvBuffer);
    const deliveredSet = new Set(s.delivered);
    const newEvents: LadderEvent[] = [];
    let armDropData = s.armDropData;
    let armDropAck = s.armDropAck;
    const stats = { ...s.stats };

    const pushEvent = (actor: LadderEvent['actor'], message: string, tone: LadderEvent['tone'] = 'normal') => {
      newEvents.push({ id: `ev-${nextTick}-${Math.random().toString(36).slice(2, 6)}`, tick: nextTick, actor, message, tone });
    };

    // 1. Advance in-flight packets
    const updatedFlight: InFlightPacket[] = [];
    for (const pkt of s.inFlight) {
      if (pkt.dropped) continue; // clear previously exploded packet after 1 tick
      const nextProg = pkt.progress + 20;

      // Mid-channel drop check at 40%
      if (pkt.willDrop && pkt.progress < 40 && nextProg >= 40) {
        if (pkt.kind === 'DATA') stats.droppedData++;
        else stats.droppedAck++;
        pushEvent(
          'Channel',
          `${pkt.kind} Seq=${pkt.seq} lost in transit (timeout recovery pending).`,
          'error'
        );
        logPacket({
          sourceIp: pkt.kind === 'DATA' ? '10.0.1.10' : '10.0.2.20',
          destIp: pkt.kind === 'DATA' ? '10.0.2.20' : '10.0.1.10',
          sourceMac: '00:00:00:00:01:01',
          destMac: '00:00:00:00:02:02',
          protocol: 'TCP',
          length: pkt.kind === 'DATA' ? 1460 : 54,
          ttl: 62,
          info: `[${s.protocol.toUpperCase()}] ${pkt.kind} Seq=${pkt.seq} DROPPED`,
          status: 'dropped',
        });
        updatedFlight.push({ ...pkt, progress: 45, dropped: true });
        continue;
      }

      if (nextProg >= 100) {
        // Arrived at destination
        if (pkt.kind === 'DATA') {
          if (s.protocol === 'stop-wait' || s.protocol === 'go-back-n') {
            if (pkt.seq === rcvBase) {
              deliveredSet.add(pkt.seq);
              rcvBase++;
              pushEvent('Receiver', `Accepted DATA Seq=${pkt.seq} in order. Sending cumulative ACK=${rcvBase - 1}.`, 'ok');
            } else {
              pushEvent(
                'Receiver',
                `Discarded out-of-order DATA Seq=${pkt.seq} (expected ${rcvBase}). Re-sending ACK=${Math.max(-1, rcvBase - 1)}.`,
                'warn'
              );
            }
            const ackSeq = rcvBase - 1;
            if (ackSeq >= 0) {
              const dropThisAck = armDropAck || Math.random() * 100 < s.lossPct * 0.45;
              if (armDropAck) armDropAck = false;
              updatedFlight.push({
                id: `ack-${nextTick}-${ackSeq}-${Math.random().toString(36).slice(2, 5)}`,
                kind: 'ACK',
                seq: ackSeq,
                progress: 0,
                willDrop: dropThisAck,
                dropped: false,
                retransmitted: false,
              });
            }
          } else {
            // Selective Repeat
            if (pkt.seq >= rcvBase && pkt.seq < rcvBase + s.effectiveWindow) {
              rcvBuf.add(pkt.seq);
              while (rcvBuf.has(rcvBase)) {
                rcvBuf.delete(rcvBase);
                deliveredSet.add(rcvBase);
                rcvBase++;
              }
              pushEvent('Receiver', `Buffered DATA Seq=${pkt.seq}. Sending selective ACK=${pkt.seq}.`, 'ok');
              const dropThisAck = armDropAck || Math.random() * 100 < s.lossPct * 0.45;
              if (armDropAck) armDropAck = false;
              updatedFlight.push({
                id: `ack-${nextTick}-${pkt.seq}-${Math.random().toString(36).slice(2, 5)}`,
                kind: 'ACK',
                seq: pkt.seq,
                progress: 0,
                willDrop: dropThisAck,
                dropped: false,
                retransmitted: false,
              });
            } else if (pkt.seq < rcvBase) {
              // Re-ack old duplicate
              pushEvent('Receiver', `Duplicate DATA Seq=${pkt.seq} received. Re-sending ACK=${pkt.seq}.`, 'warn');
              updatedFlight.push({
                id: `ack-${nextTick}-${pkt.seq}-${Math.random().toString(36).slice(2, 5)}`,
                kind: 'ACK',
                seq: pkt.seq,
                progress: 0,
                willDrop: false,
                dropped: false,
                retransmitted: false,
              });
            }
          }
        } else {
          // ACK arrived at Sender
          stats.acksReceived++;
          if (s.protocol === 'stop-wait' || s.protocol === 'go-back-n') {
            if (pkt.seq >= sendBase) {
              for (let k = sendBase; k <= pkt.seq; k++) {
                acked.add(k);
                delete timers[k];
              }
              sendBase = pkt.seq + 1;
              pushEvent('Sender', `Received cumulative ACK=${pkt.seq}. Window base advanced to ${sendBase}.`, 'ok');
            }
          } else {
            // Selective Repeat individual ACK
            acked.add(pkt.seq);
            delete timers[pkt.seq];
            while (acked.has(sendBase)) {
              sendBase++;
            }
            pushEvent('Sender', `Received selective ACK=${pkt.seq}. SendBase=${sendBase}.`, 'ok');
          }
        }
      } else {
        updatedFlight.push({ ...pkt, progress: nextProg });
      }
    }

    // 2. Decrement active timers and handle timeouts
    const timedOutSeqs: number[] = [];
    for (const seqStr of Object.keys(timers)) {
      const seqNum = Number(seqStr);
      if (acked.has(seqNum)) {
        delete timers[seqNum];
        continue;
      }
      timers[seqNum] -= 1;
      if (timers[seqNum] <= 0) {
        timedOutSeqs.push(seqNum);
      }
    }

    if (timedOutSeqs.length > 0) {
      if (s.protocol === 'go-back-n' || s.protocol === 'stop-wait') {
        // Retransmit entire window [sendBase .. nextSeq - 1]
        const oldest = Math.min(...timedOutSeqs);
        if (oldest >= sendBase) {
          pushEvent(
            'Sender',
            `Timeout on Frame ${oldest}! Go-Back-N retransmitting window [${sendBase}..${nextSeq - 1}].`,
            'error'
          );
          for (let seqNum = sendBase; seqNum < nextSeq; seqNum++) {
            const drop = armDropData || Math.random() * 100 < s.lossPct;
            if (armDropData) armDropData = false;
            timers[seqNum] = s.timeoutTicks + (seqNum - sendBase) * 2;
            stats.sentFrames++;
            stats.retransmissions++;
            updatedFlight.push({
              id: `retx-${nextTick}-${seqNum}-${Math.random().toString(36).slice(2, 5)}`,
              kind: 'DATA',
              seq: seqNum,
              progress: 0,
              willDrop: drop,
              dropped: false,
              retransmitted: true,
            });
          }
        }
      } else {
        // Selective Repeat: retransmit ONLY timed-out frames
        for (const seqNum of timedOutSeqs) {
          const drop = armDropData || Math.random() * 100 < s.lossPct;
          if (armDropData) armDropData = false;
          timers[seqNum] = s.timeoutTicks;
          stats.sentFrames++;
          stats.retransmissions++;
          pushEvent('Sender', `Timeout on Frame ${seqNum}. Selective Repeat retransmitting ONLY Frame ${seqNum}.`, 'error');
          updatedFlight.push({
            id: `retx-${nextTick}-${seqNum}-${Math.random().toString(36).slice(2, 5)}`,
            kind: 'DATA',
            seq: seqNum,
            progress: 0,
            willDrop: drop,
            dropped: false,
            retransmitted: true,
          });
        }
      }
    }

    // 3. Transmit at most 1 new frame per tick if window allows (clean visual pacing)
    if (nextSeq < s.totalFrames && nextSeq < sendBase + s.effectiveWindow) {
      const seqNum = nextSeq;
      const drop = armDropData || Math.random() * 100 < s.lossPct;
      if (armDropData) armDropData = false;
      nextSeq++;
      timers[seqNum] = s.timeoutTicks;
      stats.sentFrames++;
      pushEvent('Sender', `Transmitted DATA Frame Seq=${seqNum} (Window [${sendBase}..${Math.min(s.totalFrames - 1, sendBase + s.effectiveWindow - 1)}]).`);
      logPacket({
        sourceIp: '10.0.1.10',
        destIp: '10.0.2.20',
        sourceMac: '00:00:00:00:01:01',
        destMac: '00:00:00:00:02:02',
        protocol: 'TCP',
        length: 1460,
        ttl: 62,
        info: `[${s.protocol.toUpperCase()}] DATA Seq=${seqNum} Win=${s.effectiveWindow}`,
        status: 'delivered',
      });
      updatedFlight.push({
        id: `data-${nextTick}-${seqNum}`,
        kind: 'DATA',
        seq: seqNum,
        progress: 0,
        willDrop: drop,
        dropped: false,
        retransmitted: false,
      });
    }

    setTick(nextTick);
    setSendBase(sendBase);
    setNextSeq(nextSeq);
    setAckedBySender(Array.from(acked));
    setTimers(timers);
    setRcvBase(rcvBase);
    setRcvBuffer(Array.from(rcvBuf));
    setDelivered(Array.from(deliveredSet));
    setInFlight(updatedFlight);
    setArmDropData(armDropData);
    setArmDropAck(armDropAck);
    setStats(stats);
    if (newEvents.length > 0) {
      setEvents((prev) => [...newEvents.reverse(), ...prev].slice(0, 40));
    }
  }, [logPacket]);

  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(stepTick, speedMs);
    return () => clearInterval(id);
  }, [isPlaying, speedMs, stepTick]);

  const goodputPct =
    stats.sentFrames > 0 ? Math.min(100, Math.round((ackedBySender.length / stats.sentFrames) * 100)) : 100;
  const isComplete = sendBase >= totalFrames && inFlight.length === 0;

  const saveSwReport = () => {
    addReport({
      module: 'sliding-window',
      title: `Sliding Window Protocol (${protocol.toUpperCase()}, N=${effectiveWindow})`,
      topologyName: presetName,
      summary: `Delivered ${delivered.length}/${totalFrames} frames using ${protocol} with ${stats.retransmissions} retransmissions (${goodputPct}% link efficiency).`,
      status: isComplete ? 'passed' : 'warning',
      metrics: {
        'Protocol': protocol,
        'Window Size': effectiveWindow,
        'Total Transmissions': stats.sentFrames,
        'Retransmissions': stats.retransmissions,
        'Goodput Efficiency': `${goodputPct}%`,
      },
      notes: 'Demonstrated sliding window recovery and cumulative vs selective acknowledgements.',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header & Protocol Selector */}
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">05. Sliding Window Protocol Simulator</h2>
            <p className="text-sm text-slate-600 mt-1">
              Interactive Stop-and-Wait, Go-Back-N, and Selective Repeat ARQ engine with real-time packet flight, timeouts, and fault injection.
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
            {(
              [
                { id: 'stop-wait', label: 'Stop & Wait' },
                { id: 'go-back-n', label: 'Go-Back-N' },
                { id: 'selective-repeat', label: 'Selective Repeat' },
              ] as const
            ).map((mode) => (
              <button
                key={mode.id}
                onClick={() => {
                  setProtocol(mode.id);
                  resetSimulation(mode.id);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  protocol === mode.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        {/* Parameter Controls + Playback */}
        <div className="mt-5 pt-4 border-t border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <div className="flex justify-between text-xs text-slate-600 mb-1">
              <span>Window Size (N)</span>
              <span className="font-mono tabular-nums font-semibold text-sky-700">
                {effectiveWindow} {protocol === 'stop-wait' ? '(fixed)' : 'frames'}
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={6}
              disabled={protocol === 'stop-wait' || isPlaying}
              value={effectiveWindow}
              onChange={(e) => {
                setWindowSize(Number(e.target.value));
                resetSimulation();
              }}
              className="w-full accent-sky-600 disabled:opacity-40"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs text-slate-600 mb-1">
              <span>Total Frames</span>
              <span className="font-mono tabular-nums font-semibold">{totalFrames}</span>
            </div>
            <input
              type="range"
              min={6}
              max={16}
              disabled={isPlaying}
              value={totalFrames}
              onChange={(e) => {
                setTotalFrames(Number(e.target.value));
                resetSimulation();
              }}
              className="w-full accent-sky-600 disabled:opacity-40"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs text-slate-600 mb-1">
              <span>Channel Loss Probability</span>
              <span className="font-mono tabular-nums font-semibold text-amber-700">{lossPct}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={40}
              step={5}
              value={lossPct}
              onChange={(e) => setLossPct(Number(e.target.value))}
              className="w-full accent-amber-600"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs text-slate-600 mb-1">
              <span>Simulation Speed</span>
              <span className="font-mono tabular-nums">{speedMs} ms/tick</span>
            </div>
            <input
              type="range"
              min={80}
              max={450}
              step={30}
              value={speedMs}
              onChange={(e) => setSpeedMs(Number(e.target.value))}
              className="w-full accent-sky-600"
            />
          </div>
        </div>

        {/* Playback & Demo Fault Injection Toolbar */}
        <div className="mt-4 pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsPlaying((p) => !p)}
              disabled={isComplete}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-md bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-45 cursor-pointer whitespace-nowrap"
            >
              {isPlaying ? <Pause size={14} /> : <Play size={14} />}
              {isPlaying ? 'Pause' : isComplete ? 'Completed' : 'Start / Resume'}
            </button>
            <button
              onClick={stepTick}
              disabled={isPlaying || isComplete}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-45 cursor-pointer whitespace-nowrap"
            >
              <FastForward size={14} />
              Step +1 Tick
            </button>
            <button
              onClick={() => resetSimulation()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
            >
              <RotateCcw size={14} />
              Reset
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setArmDropData(true)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border cursor-pointer whitespace-nowrap ${
                armDropData
                  ? 'bg-red-600 text-white border-red-600'
                  : 'border-red-300 text-red-700 bg-red-50 hover:bg-red-100'
              }`}
            >
              <ShieldAlert size={14} />
              {armDropData ? 'Armed: Next DATA Will Drop' : 'Drop Next DATA Frame'}
            </button>
            <button
              onClick={() => setArmDropAck(true)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border cursor-pointer whitespace-nowrap ${
                armDropAck
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100'
              }`}
            >
              <AlertCircle size={14} />
              {armDropAck ? 'Armed: Next ACK Will Drop' : 'Drop Next ACK'}
            </button>
            <button
              onClick={saveSwReport}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
            >
              <Save size={14} />
              Save Run
            </button>
          </div>
        </div>
      </div>

      {/* Live Metrics Strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-3.5">
          <div className="text-xs text-slate-500">Current Tick</div>
          <div className="text-lg font-mono font-semibold tabular-nums text-slate-900 mt-0.5">{tick}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-3.5">
          <div className="text-xs text-slate-500">Delivered In-Order</div>
          <div className="text-lg font-mono font-semibold tabular-nums text-emerald-700 mt-0.5">
            {delivered.length} / {totalFrames}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-3.5">
          <div className="text-xs text-slate-500">Frames Sent (Total)</div>
          <div className="text-lg font-mono font-semibold tabular-nums text-slate-900 mt-0.5">{stats.sentFrames}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-3.5">
          <div className="text-xs text-slate-500">Retransmissions</div>
          <div className="text-lg font-mono font-semibold tabular-nums text-red-700 mt-0.5">{stats.retransmissions}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-3.5">
          <div className="text-xs text-slate-500">Goodput Efficiency</div>
          <div className="text-lg font-mono font-semibold tabular-nums text-sky-700 mt-0.5">{goodputPct}%</div>
        </div>
      </div>

      {/* Interactive Sliding Window Visual Stage */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-6">
        {/* 1. Sender Sliding Window Buffer */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="text-sm font-semibold text-slate-900">
              Sender Buffer & Window <span className="font-mono text-xs text-sky-700 ml-2">SendBase={sendBase} · NextSeq={nextSeq}</span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
              <span>Green: ACKed</span>
              <span>Blue: In-Window UnACKed</span>
              <span>Sky Outline: Ready in Window</span>
              <span>Gray: Outside Window</span>
            </div>
          </div>

          <div className="grid grid-cols-8 sm:grid-cols-12 md:grid-cols-16 gap-1.5">
            {Array.from({ length: totalFrames }, (_, i) => {
              const isAcked = ackedBySender.includes(i);
              const inWindow = i >= sendBase && i < sendBase + effectiveWindow;
              const isSentUnacked = i < nextSeq && !isAcked;
              const timerRem = timers[i];

              let style = 'bg-slate-100 border-slate-200 text-slate-500';
              if (isAcked) style = 'bg-emerald-100 border-emerald-400 text-emerald-900 font-semibold';
              else if (isSentUnacked) style = 'bg-sky-600 border-sky-700 text-white font-semibold';
              else if (inWindow) style = 'bg-sky-50 border-sky-400 text-sky-900';

              return (
                <div key={i} className={`relative border rounded-md p-2 text-center transition-colors ${style}`}>
                  <div className="text-xs font-mono tabular-nums">F{i}</div>
                  <div className="text-[10px] mt-0.5 font-mono tabular-nums">
                    {isAcked ? 'ACK' : timerRem !== undefined ? `T:${timerRem}` : inWindow ? 'RDY' : 'WAIT'}
                  </div>
                  {inWindow && (
                    <div className="mt-1 h-1 w-full bg-sky-400/50 rounded-full overflow-hidden">
                      {timerRem !== undefined && (
                        <div
                          className="h-full bg-amber-300"
                          style={{ width: `${Math.max(5, (timerRem / timeoutTicks) * 100)}%` }}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. Animated Channel Medium */}
        <div className="relative bg-slate-900 rounded-lg p-5 border border-slate-800 overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-4">
            <span className="font-medium text-slate-200">Sender (h1 · 10.0.1.10)</span>
            <span className="font-mono">Full-Duplex Virtual Link ({lossPct}% loss)</span>
            <span className="font-medium text-slate-200">Receiver (h4 · 10.0.2.20)</span>
          </div>

          <div className="relative h-28 bg-slate-950/70 rounded border border-slate-800">
            {/* DATA lane */}
            <div className="absolute top-6 left-4 right-4 h-px bg-slate-700" />
            <div className="absolute top-2 left-3 text-[10px] font-mono text-slate-500">DATA →</div>

            {/* ACK lane */}
            <div className="absolute bottom-6 left-4 right-4 h-px bg-slate-700" />
            <div className="absolute bottom-2 left-3 text-[10px] font-mono text-slate-500">← ACK</div>

            {inFlight.map((pkt) => {
              const leftPct = pkt.kind === 'DATA' ? 5 + pkt.progress * 0.86 : 91 - pkt.progress * 0.86;
              return (
                <div
                  key={pkt.id}
                  style={{ left: `${leftPct}%` }}
                  className={`absolute -translate-x-1/2 px-2.5 py-1 rounded text-[11px] font-mono font-semibold shadow-sm transition-all duration-100 whitespace-nowrap ${
                    pkt.kind === 'DATA' ? 'top-2.5' : 'bottom-2.5'
                  } ${
                    pkt.dropped
                      ? 'bg-red-600 text-white'
                      : pkt.kind === 'DATA'
                      ? pkt.retransmitted
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-sky-500 text-white'
                      : 'bg-emerald-500 text-slate-950'
                  }`}
                >
                  {pkt.dropped ? `LOST ${pkt.kind} ${pkt.seq}` : `${pkt.kind} ${pkt.seq}${pkt.retransmitted ? ' (RTX)' : ''}`}
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. Receiver Sliding Window Buffer */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="text-sm font-semibold text-slate-900">
              Receiver Buffer & Delivery{' '}
              <span className="font-mono text-xs text-emerald-700 ml-2">
                RcvBase (Expected)={rcvBase} · Window={protocol === 'selective-repeat' ? effectiveWindow : 1}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
              <span>Green: Delivered to App</span>
              <span>Amber: Buffered Out-of-Order (SR)</span>
              <span>Sky Outline: Expected Slot</span>
            </div>
          </div>

          <div className="grid grid-cols-8 sm:grid-cols-12 md:grid-cols-16 gap-1.5">
            {Array.from({ length: totalFrames }, (_, i) => {
              const isDelivered = delivered.includes(i);
              const isBuffered = rcvBuffer.includes(i);
              const rcvWin = protocol === 'selective-repeat' ? effectiveWindow : 1;
              const inRcvWin = i >= rcvBase && i < rcvBase + rcvWin;

              let style = 'bg-slate-100 border-slate-200 text-slate-500';
              if (isDelivered) style = 'bg-emerald-100 border-emerald-400 text-emerald-900 font-semibold';
              else if (isBuffered) style = 'bg-amber-100 border-amber-400 text-amber-900 font-semibold';
              else if (inRcvWin) style = 'bg-sky-50 border-sky-400 text-sky-900';

              return (
                <div key={i} className={`border rounded-md p-2 text-center ${style}`}>
                  <div className="text-xs font-mono tabular-nums">F{i}</div>
                  <div className="text-[10px] mt-0.5 font-mono">
                    {isDelivered ? 'DELIV' : isBuffered ? 'BUF' : i === rcvBase ? 'EXP' : inRcvWin ? 'WIN' : '—'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Live Protocol Event Trace & Educational Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Protocol State Transition Log</h3>
          <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 font-mono text-xs">
            {events.map((ev) => (
              <div key={ev.id} className="py-2 flex items-start gap-3">
                <span className="text-slate-400 tabular-nums shrink-0">t={String(ev.tick).padStart(3, '0')}</span>
                <span
                  className={`font-semibold shrink-0 w-16 ${
                    ev.actor === 'Sender'
                      ? 'text-sky-700'
                      : ev.actor === 'Receiver'
                      ? 'text-emerald-700'
                      : 'text-red-700'
                  }`}
                >
                  {ev.actor}
                </span>
                <span
                  className={
                    ev.tone === 'error'
                      ? 'text-red-700'
                      : ev.tone === 'warn'
                      ? 'text-amber-700'
                      : ev.tone === 'ok'
                      ? 'text-emerald-800'
                      : 'text-slate-700'
                  }
                >
                  {ev.message}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-lg p-5 space-y-3 text-xs text-slate-700">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Send size={15} className="text-sky-600" />
            <span>Key Protocol Differences</span>
          </div>
          <div className="p-3 bg-slate-50 rounded border border-slate-200">
            <div className="font-semibold text-slate-900">Stop-and-Wait (N=1)</div>
            <p className="mt-1 text-slate-600">Only 1 unACKed frame in flight. Simple, zero buffering, low channel utilization on high-BDP links.</p>
          </div>
          <div className="p-3 bg-slate-50 rounded border border-slate-200">
            <div className="font-semibold text-slate-900">Go-Back-N (Cumulative ACK)</div>
            <p className="mt-1 text-slate-600">Pipelines N frames. Receiver discards out-of-order frames; a single loss forces retransmission of the entire window.</p>
          </div>
          <div className="p-3 bg-slate-50 rounded border border-slate-200">
            <div className="font-semibold text-slate-900">Selective Repeat (Individual ACK)</div>
            <p className="mt-1 text-slate-600">Receiver buffers out-of-order frames within its window; sender retransmits only the lost frame.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
