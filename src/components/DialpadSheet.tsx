import React, { useMemo, useState } from 'react';
import type { Contact } from '../types';
import { audioEngine } from '../utils/audioEngine';
import { getAvatarColor, getInitials, matchesT9 } from '../utils/storage';
import { BackspaceIcon, CloseIcon, PhoneIcon } from './Icons';

interface DialpadSheetProps {
  open: boolean;
  contacts: Contact[];
  onClose: () => void;
  onTriggerCall: (name: string, number: string, avatarColor?: string) => void;
}

const DIAL_KEYS = [
  { digit: '1', letters: '∞' },
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

export const DialpadSheet: React.FC<DialpadSheetProps> = ({
  open,
  contacts,
  onClose,
  onTriggerCall,
}) => {
  const [dialed, setDialed] = useState('');

  const matchedContacts = useMemo(() => {
    if (!dialed.trim()) return [];
    return contacts.filter((c) => matchesT9(c, dialed)).slice(0, 3);
  }, [contacts, dialed]);

  if (!open) return null;

  const handleKeyPress = (digit: string) => {
    audioEngine.playDtmf(digit);
    audioEngine.vibrateOnce(18);
    setDialed((prev) => (prev + digit).slice(0, 20));
  };

  const handleBackspace = () => {
    audioEngine.vibrateOnce(12);
    setDialed((prev) => prev.slice(0, -1));
  };

  const handleCall = () => {
    const clean = dialed.trim();
    if (!clean) return;
    const exactMatch = matchedContacts.find(
      (c) => c.number.replace(/[^0-9]/g, '') === clean.replace(/[^0-9]/g, '')
    ) || matchedContacts[0];

    const callerName = exactMatch ? exactMatch.name : clean;
    const callerNum = exactMatch ? exactMatch.number : clean;
    const color = exactMatch ? exactMatch.avatarColor : getAvatarColor(callerName);

    setDialed('');
    onClose();
    onTriggerCall(callerName, callerNum, color);
  };

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col justify-end bg-black/40 backdrop-blur-[2px] animate-fade-in"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="T9 Dialpad"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md mx-auto bg-[#F3F6FC] dark:bg-[#1E2025] rounded-t-[28px] shadow-2xl border-t border-black/5 dark:border-white/10 pt-3 pb-7 px-5 animate-slide-up"
      >
        {/* Drag Handle & Close */}
        <div className="flex items-center justify-between mb-2">
          <div className="w-10" />
          <div className="w-10 h-1 rounded-full bg-[#C4C7C5] dark:bg-[#444746]" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialpad"
            className="min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center text-[#444746] dark:text-[#C4C7C5] hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Live T9 Contact Matches */}
        {matchedContacts.length > 0 && (
          <div className="mb-3 divide-y divide-black/5 dark:divide-white/5 bg-white dark:bg-[#282A30] rounded-2xl overflow-hidden">
            {matchedContacts.map((contact) => (
              <button
                key={contact.id}
                type="button"
                onClick={() => {
                  setDialed('');
                  onClose();
                  onTriggerCall(contact.name, contact.number, contact.avatarColor);
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-[#EDF2FA] dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                <span
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium text-white shrink-0"
                  style={{ backgroundColor: contact.avatarColor }}
                >
                  {getInitials(contact.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-[#1F1F1F] dark:text-[#E3E2E6] truncate">
                    {contact.name}
                  </div>
                  <div className="text-xs text-[#5E5E5E] dark:text-[#A0A3AA] tabular-nums">
                    {contact.number}
                  </div>
                </div>
                <PhoneIcon className="w-4 h-4 text-[#188038] dark:text-[#6DD58C] shrink-0" />
              </button>
            ))}
          </div>
        )}

        {/* Number Display Row */}
        <div className="flex items-center justify-between gap-2 px-2 py-2 mb-3 border-b border-black/8 dark:border-white/10 min-h-[56px]">
          <div className="w-11 shrink-0" />
          <input
            type="tel"
            readOnly
            value={dialed}
            placeholder="Enter number"
            aria-label="Dialed number"
            className="w-full bg-transparent text-center text-3xl font-normal tracking-wider tabular-nums text-[#1F1F1F] dark:text-[#E3E2E6] placeholder:text-[#8E918F] placeholder:text-xl focus:outline-none"
          />
          <button
            type="button"
            onClick={handleBackspace}
            onDoubleClick={() => setDialed('')}
            disabled={!dialed}
            aria-label="Delete digit"
            className="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-[#444746] dark:text-[#C4C7C5] disabled:opacity-25 hover:bg-black/5 dark:hover:bg-white/10 transition-opacity cursor-pointer"
          >
            <BackspaceIcon className="w-6 h-6" />
          </button>
        </div>

        {/* T9 Numeric Keypad Grid */}
        <div className="grid grid-cols-3 gap-2.5 mb-5">
          {DIAL_KEYS.map((item) => (
            <button
              key={item.digit}
              type="button"
              onClick={() => handleKeyPress(item.digit)}
              className="h-[58px] rounded-full bg-white dark:bg-[#2A2D34] hover:bg-[#E1E9F6] dark:hover:bg-[#343842] active:scale-95 transition-all flex flex-col items-center justify-center shadow-[0_1px_2px_rgba(0,0,0,0.04)] cursor-pointer focus-visible:outline-2 focus-visible:outline-[#0B57D0]"
            >
              <span className="text-[26px] font-normal leading-none tabular-nums text-[#1F1F1F] dark:text-[#E3E2E6]">
                {item.digit}
              </span>
              {item.letters && (
                <span className="text-[10px] font-medium tracking-[0.14em] text-[#5E5E5E] dark:text-[#A0A3AA] mt-0.5">
                  {item.letters}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Google Green Call Action Button */}
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={handleCall}
            disabled={!dialed.trim()}
            className="h-14 px-10 rounded-full bg-[#188038] hover:bg-[#146C2E] disabled:opacity-45 active:scale-95 transition-all text-white font-medium text-base flex items-center gap-2.5 shadow-md cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#188038]"
          >
            <PhoneIcon className="w-5 h-5" />
            <span>Call</span>
          </button>
        </div>
      </div>
    </div>
  );
};
