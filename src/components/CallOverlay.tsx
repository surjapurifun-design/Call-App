import React, { useEffect, useState, useRef } from 'react';
import type { ActiveCall, CallLogStatus } from '../types';
import { audioEngine } from '../utils/audioEngine';
import { formatDuration, getInitials } from '../utils/storage';
import {
  AddCallIcon,
  BackspaceIcon,
  CallEndIcon,
  DialpadIcon,
  HoldIcon,
  MicIcon,
  MicOffIcon,
  PhoneIcon,
  RecordIcon,
  SpeakerIcon,
} from './Icons';

interface CallOverlayProps {
  call: ActiveCall;
  onFinish: (status: CallLogStatus, durationSec: number) => void;
}

const IN_CALL_KEYS = [
  { digit: '1', letters: '' },
  { digit: '2', letters: 'ABC' },
  { digit: '3', letters: 'DEF' },
  { digit: '4', letters: 'GHI' },
  { digit: '5', letters: 'JKL' },
  { digit: '6', letters: 'MNO' },
  { digit: '7', letters: 'PQRS' },
  { digit: '8', letters: 'TUV' },
  { digit: '9', letters: 'WXYZ' },
  { digit: '*', letters: '' },
  { digit: '0', letters: '+' },
  { digit: '#', letters: '' },
];

export const CallOverlay: React.FC<CallOverlayProps> = ({ call, onFinish }) => {
  const [phase, setPhase] = useState<'incoming' | 'ongoing' | 'ending'>('incoming');
  const [durationSec, setDurationSec] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [isHold, setIsHold] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSec, setRecordSec] = useState(0);
  const [isAddCall, setIsAddCall] = useState(false);
  const [showKeypad, setShowKeypad] = useState(false);
  const [dtmfEntered, setDtmfEntered] = useState('');
  const [endLabel, setEndLabel] = useState('Call ended');

  const durationRef = useRef(0);
  durationRef.current = durationSec;

  // Start ringtone + vibration on incoming
  useEffect(() => {
    audioEngine.startRingtone(true);
    return () => {
      audioEngine.stopRingtone();
    };
  }, []);

  // Ongoing call duration timer
  useEffect(() => {
    if (phase !== 'ongoing') return;
    const interval = window.setInterval(() => {
      setDurationSec((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [phase]);

  // Recording elapsed timer
  useEffect(() => {
    if (!isRecording || phase !== 'ongoing') return;
    const interval = window.setInterval(() => {
      setRecordSec((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isRecording, phase]);

  const handleAnswer = () => {
    audioEngine.stopRingtone();
    audioEngine.vibrateOnce(35);
    setPhase('ongoing');
  };

  const handleDecline = () => {
    audioEngine.stopRingtone();
    audioEngine.playCallEndTone();
    audioEngine.vibrateOnce(50);
    setEndLabel('Call declined');
    setPhase('ending');
    window.setTimeout(() => {
      onFinish('declined', 0);
    }, 750);
  };

  const handleEndOngoing = () => {
    audioEngine.stopRingtone();
    audioEngine.playCallEndTone();
    audioEngine.vibrateOnce(50);
    const finalDur = durationRef.current;
    setEndLabel(`Call ended • ${formatDuration(finalDur)}`);
    setPhase('ending');
    window.setTimeout(() => {
      onFinish('answered', finalDur);
    }, 850);
  };

  const handleDtmfPress = (digit: string) => {
    audioEngine.playDtmf(digit);
    audioEngine.vibrateOnce(18);
    setDtmfEntered((prev) => (prev + digit).slice(-24));
  };

  const toggleRecord = () => {
    audioEngine.vibrateOnce(25);
    setIsRecording((prev) => {
      if (prev) setRecordSec(0);
      return !prev;
    });
  };

  const initial = getInitials(call.name || call.number);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={phase === 'incoming' ? `Incoming call from ${call.name}` : `Ongoing call with ${call.name}`}
      className="fixed inset-0 z-50 flex flex-col justify-between text-white select-none overflow-hidden animate-fade-in"
      style={{
        background:
          'radial-gradient(circle at 50% 18%, #1E3246 0%, #101E2B 48%, #091118 100%)',
      }}
    >
      {/* Top Caller Identity Section */}
      <div className="w-full max-w-md mx-auto flex flex-col items-center pt-12 sm:pt-16 px-6 text-center">
        <div className="flex items-center gap-2 text-sm font-medium tracking-wide text-white/80 mb-6">
          {phase === 'incoming' && <span>Incoming call • {call.sim}</span>}
          {phase === 'ongoing' && (
            <span className="tabular-nums">
              {isHold ? `On hold • ${formatDuration(durationSec)}` : `${call.sim} • ${formatDuration(durationSec)}`}
            </span>
          )}
          {phase === 'ending' && <span className="text-red-300">{endLabel}</span>}
        </div>

        {/* Caller Avatar */}
        {!showKeypad && (
          <div className="relative flex items-center justify-center mb-6">
            {phase === 'incoming' && (
              <>
                <span
                  className="absolute w-24 h-24 rounded-full animate-incoming-ripple"
                  style={{ backgroundColor: `${call.avatarColor}66` }}
                />
                <span
                  className="absolute w-24 h-24 rounded-full animate-incoming-ripple-delayed"
                  style={{ backgroundColor: `${call.avatarColor}44` }}
                />
              </>
            )}
            <div
              className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full flex items-center justify-center text-4xl sm:text-5xl font-medium text-white shadow-xl"
              style={{ backgroundColor: call.avatarColor }}
            >
              {initial}
            </div>
          </div>
        )}

        {/* Caller Name & Number */}
        <h1 className="text-3xl sm:text-4xl font-normal tracking-tight text-white truncate max-w-full">
          {call.name || call.number}
        </h1>
        <p className="mt-2 text-base sm:text-lg text-white/75 tabular-nums tracking-wide">
          {call.number}
        </p>

        {/* Live Recording or Add-Call subtle indicator */}
        {phase === 'ongoing' && (isRecording || isAddCall) && (
          <div className="mt-3 flex items-center gap-3 text-xs font-medium text-white/80 tabular-nums">
            {isRecording && (
              <span className="text-red-300">Recording • {formatDuration(recordSec)}</span>
            )}
            {isAddCall && <span className="text-sky-300">Ready to add call</span>}
          </div>
        )}
      </div>

      {/* Middle / Bottom Action Zone */}
      <div className="w-full max-w-md mx-auto px-6 pb-10 sm:pb-12">
        {phase === 'incoming' && (
          <div className="flex items-end justify-between px-4 sm:px-8 pt-6">
            {/* Decline Button */}
            <div className="flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={handleDecline}
                aria-label="Decline call"
                className="w-[72px] h-[72px] rounded-full bg-[#EA4335] hover:bg-[#D93025] active:scale-95 transition-transform flex items-center justify-center shadow-lg shadow-black/40 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
              >
                <CallEndIcon className="w-8 h-8 text-white" />
              </button>
              <span className="text-sm font-medium text-white/85">Decline</span>
            </div>

            {/* Answer Button */}
            <div className="flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={handleAnswer}
                aria-label="Answer call"
                className="w-[72px] h-[72px] rounded-full bg-[#1E8E3E] hover:bg-[#188038] active:scale-95 transition-transform flex items-center justify-center shadow-lg shadow-black/40 animate-answer-bounce cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
              >
                <PhoneIcon className="w-8 h-8 text-white" />
              </button>
              <span className="text-sm font-medium text-white/85">Answer</span>
            </div>
          </div>
        )}

        {phase === 'ongoing' && (
          <div className="flex flex-col items-center">
            {showKeypad ? (
              /* In-Call Interactive DTMF Keypad */
              <div className="w-full bg-white/8 backdrop-blur-md rounded-3xl p-4 mb-6">
                <div className="flex items-center justify-between px-3 pb-3 mb-2 border-b border-white/10 min-h-[40px]">
                  <span className="text-xl font-medium tracking-widest tabular-nums text-white truncate">
                    {dtmfEntered || 'Keypad'}
                  </span>
                  <div className="flex items-center gap-1">
                    {dtmfEntered && (
                      <button
                        type="button"
                        onClick={() => setDtmfEntered((prev) => prev.slice(0, -1))}
                        aria-label="Backspace digit"
                        className="min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center text-white/80 hover:bg-white/10 cursor-pointer"
                      >
                        <BackspaceIcon className="w-5 h-5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowKeypad(false)}
                      className="px-3 py-1.5 text-xs font-medium text-sky-300 hover:bg-white/10 rounded-full cursor-pointer"
                    >
                      Hide
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-y-2 gap-x-3">
                  {IN_CALL_KEYS.map((k) => (
                    <button
                      key={k.digit}
                      type="button"
                      onClick={() => handleDtmfPress(k.digit)}
                      className="h-14 rounded-2xl bg-white/6 hover:bg-white/15 active:scale-95 transition-all flex flex-col items-center justify-center cursor-pointer"
                    >
                      <span className="text-2xl font-normal leading-none tabular-nums">{k.digit}</span>
                      {k.letters && (
                        <span className="text-[10px] tracking-widest text-white/55 mt-0.5">{k.letters}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Authentic 6-Button Google In-Call Grid */
              <div className="w-full grid grid-cols-3 gap-y-6 gap-x-4 mb-10">
                <InCallTile
                  label="Mute"
                  active={isMuted}
                  onClick={() => {
                    audioEngine.vibrateOnce(20);
                    setIsMuted((v) => !v);
                  }}
                  icon={isMuted ? <MicOffIcon className="w-6 h-6" /> : <MicIcon className="w-6 h-6" />}
                />
                <InCallTile
                  label="Keypad"
                  active={showKeypad}
                  onClick={() => {
                    audioEngine.vibrateOnce(20);
                    setShowKeypad(true);
                  }}
                  icon={<DialpadIcon className="w-6 h-6" />}
                />
                <InCallTile
                  label="Speaker"
                  active={isSpeaker}
                  onClick={() => {
                    audioEngine.vibrateOnce(20);
                    setIsSpeaker((v) => !v);
                  }}
                  icon={<SpeakerIcon className="w-6 h-6" />}
                />
                <InCallTile
                  label="Add call"
                  active={isAddCall}
                  onClick={() => {
                    audioEngine.vibrateOnce(20);
                    setIsAddCall((v) => !v);
                  }}
                  icon={<AddCallIcon className="w-6 h-6" />}
                />
                <InCallTile
                  label="Hold"
                  active={isHold}
                  onClick={() => {
                    audioEngine.vibrateOnce(20);
                    setIsHold((v) => !v);
                  }}
                  icon={<HoldIcon className="w-6 h-6" />}
                />
                <InCallTile
                  label={isRecording ? 'Stop rec' : 'Record'}
                  active={isRecording}
                  dangerActive
                  onClick={toggleRecord}
                  icon={<RecordIcon className="w-6 h-6" />}
                />
              </div>
            )}

            {/* Red End Call Button */}
            <button
              type="button"
              onClick={handleEndOngoing}
              aria-label="End call"
              className="w-[74px] h-[74px] rounded-full bg-[#EA4335] hover:bg-[#D93025] active:scale-95 transition-transform flex items-center justify-center shadow-xl shadow-black/40 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              <CallEndIcon className="w-8 h-8 text-white" />
            </button>
          </div>
        )}

        {phase === 'ending' && (
          <div className="flex justify-center py-10">
            <div className="w-[72px] h-[72px] rounded-full bg-[#EA4335]/50 flex items-center justify-center">
              <CallEndIcon className="w-8 h-8 text-white/70" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface InCallTileProps {
  label: string;
  active: boolean;
  dangerActive?: boolean;
  onClick: () => void;
  icon: React.ReactNode;
}

const InCallTile: React.FC<InCallTileProps> = ({ label, active, dangerActive, onClick, icon }) => {
  const activeStyle = dangerActive
    ? 'bg-red-500 text-white'
    : 'bg-white text-[#101E2B]';
  const inactiveStyle = 'bg-white/12 text-white hover:bg-white/20';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="flex flex-col items-center gap-2 group cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white rounded-2xl py-1"
    >
      <span
        className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors active:scale-95 ${
          active ? activeStyle : inactiveStyle
        }`}
      >
        {icon}
      </span>
      <span className="text-xs font-medium text-white/85 whitespace-nowrap">{label}</span>
    </button>
  );
};
