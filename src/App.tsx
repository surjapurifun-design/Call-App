import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActiveCall,
  CallLogStatus,
  Contact,
  DELAY_OPTIONS,
  RecentCall,
  SmsNotification,
  TabId,
} from './types';
import { audioEngine } from './utils/audioEngine';
import {
  formatDuration,
  formatTimestamp,
  getAvatarColor,
  getInitials,
  loadContacts,
  loadRecents,
  loadTheme,
  saveContacts,
  saveRecents,
  saveTheme,
} from './utils/storage';
import { CallOverlay } from './components/CallOverlay';
import { DialpadSheet } from './components/DialpadSheet';
import { SmsBanner } from './components/SmsBanner';
import {
  CloseIcon,
  ContactsFilledIcon,
  ContactsIcon,
  DialpadIcon,
  DownloadIcon,
  HistoryIcon,
  IncomingArrowIcon,
  MicIcon,
  MissedArrowIcon,
  MoonIcon,
  MoreVertIcon,
  MusicNoteIcon,
  PersonAddIcon,
  PhoneIcon,
  PhoneOutlineIcon,
  PlayIcon,
  SearchIcon,
  SmsIcon,
  StopIcon,
  SunIcon,
  TrashIcon,
} from './components/Icons';

const QUICK_CALLERS = [
  { name: 'Mom', number: '+91 98765 43210' },
  { name: 'Boss', number: '+91 99104 55612' },
  { name: 'Home', number: '+91 98201 11223' },
  { name: 'Delivery', number: '+91 80456 78901' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('fake-call');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => loadTheme());
  const [searchQuery, setSearchQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialpadOpen, setDialpadOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Offline persistent data
  const [contacts, setContacts] = useState<Contact[]>(() => loadContacts());
  const [recents, setRecents] = useState<RecentCall[]>(() => loadRecents());

  // Fake Call Scheduler state
  const [callerName, setCallerName] = useState('Mom');
  const [callerNumber, setCallerNumber] = useState('+91 98765 43210');
  const [selectedSim, setSelectedSim] = useState<'SIM 1' | 'SIM 2'>('SIM 1');
  const [delaySeconds, setDelaySeconds] = useState<number>(0);
  const [countdownLeft, setCountdownLeft] = useState<number | null>(null);
  const [ringtoneName, setRingtoneName] = useState<string | null>(null);
  const [isTestingSound, setIsTestingSound] = useState(false);

  // Active fullscreen call overlay
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);

  // Fake SMS Notification state
  const [smsSender, setSmsSender] = useState('Mom');
  const [smsText, setSmsText] = useState('Call me back urgently, waiting for you at home.');
  const [smsDelay, setSmsDelay] = useState<number>(0);
  const [smsCountdown, setSmsCountdown] = useState<number | null>(null);
  const [activeSms, setActiveSms] = useState<SmsNotification | null>(null);

  // Add Contact modal state
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactNumber, setNewContactNumber] = useState('');
  const [newContactLabel, setNewContactLabel] = useState('Mobile');

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const menuContainerRef = useRef<HTMLDivElement | null>(null);
  const callTimerRef = useRef<number | null>(null);
  const smsTimerRef = useRef<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  // Sync dark mode class on <html> and theme-color meta
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', theme === 'dark' ? '#111318' : '#F8F9FA');
    }
    saveTheme(theme);
  }, [theme]);

  // Persist contacts & recents
  useEffect(() => {
    saveContacts(contacts);
  }, [contacts]);

  useEffect(() => {
    saveRecents(recents);
  }, [recents]);

  // Close overflow menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (menuContainerRef.current && !menuContainerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [menuOpen]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (callTimerRef.current !== null) window.clearInterval(callTimerRef.current);
      if (smsTimerRef.current !== null) window.clearInterval(smsTimerRef.current);
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
      audioEngine.stopRingtone();
    };
  }, []);

  const showToast = useCallback((message: string) => {
    setToastMsg(message);
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToastMsg(null);
    }, 2800);
  }, []);

  const stopRingtonePreview = useCallback(() => {
    if (isTestingSound) {
      audioEngine.stopRingtone();
      setIsTestingSound(false);
    }
  }, [isTestingSound]);

  // Trigger an incoming fake call immediately
  const triggerFakeCallNow = useCallback(
    (name: string, number: string, avatarColor?: string, sim: 'SIM 1' | 'SIM 2' = selectedSim) => {
      stopRingtonePreview();
      audioEngine.unlock();
      const cleanName = name.trim() || 'Unknown Caller';
      const cleanNum = number.trim() || '+91 98765 43210';
      setActiveCall({
        name: cleanName,
        number: cleanNum,
        sim,
        avatarColor: avatarColor || getAvatarColor(cleanName),
      });
    },
    [selectedSim, stopRingtonePreview]
  );

  // Schedule or cancel fake call from the main scheduler button
  const handleScheduleCall = () => {
    audioEngine.unlock();
    stopRingtonePreview();

    // If countdown is already running, cancel it
    if (countdownLeft !== null) {
      if (callTimerRef.current !== null) {
        window.clearInterval(callTimerRef.current);
        callTimerRef.current = null;
      }
      setCountdownLeft(null);
      showToast('Scheduled call cancelled');
      return;
    }

    const finalName = callerName.trim() || 'Unknown Caller';
    const finalNum = callerNumber.trim() || '+91 98765 43210';
    const matched = contacts.find(
      (c) =>
        c.name.toLowerCase() === finalName.toLowerCase() ||
        c.number.replace(/\s+/g, '') === finalNum.replace(/\s+/g, '')
    );
    const color = matched?.avatarColor || getAvatarColor(finalName);

    if (delaySeconds <= 0) {
      triggerFakeCallNow(finalName, finalNum, color, selectedSim);
      return;
    }

    let remaining = delaySeconds;
    setCountdownLeft(remaining);

    callTimerRef.current = window.setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        if (callTimerRef.current !== null) {
          window.clearInterval(callTimerRef.current);
          callTimerRef.current = null;
        }
        setCountdownLeft(null);
        triggerFakeCallNow(finalName, finalNum, color, selectedSim);
      } else {
        setCountdownLeft(remaining);
      }
    }, 1000);
  };

  // Log completed call to Recents in localStorage
  const handleCallFinished = useCallback(
    (status: CallLogStatus, durationSec: number) => {
      setActiveCall((current) => {
        if (current) {
          const entry: RecentCall = {
            id: `rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: current.name,
            number: current.number,
            sim: current.sim,
            timestamp: Date.now(),
            status,
            durationSec,
            avatarColor: current.avatarColor,
          };
          setRecents((prev) => [entry, ...prev].slice(0, 100));
        }
        return null;
      });
    },
    []
  );

  // Custom ringtone file picker
  const handleRingtoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) return;
    stopRingtonePreview();
    const loadedName = audioEngine.setCustomRingtone(file);
    setRingtoneName(loadedName);
    showToast(`Ringtone set: ${loadedName}`);
  };

  const handleResetRingtone = () => {
    stopRingtonePreview();
    audioEngine.setCustomRingtone(null);
    setRingtoneName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    showToast('Switched to built-in offline ringtone');
  };

  const handleToggleTestRingtone = () => {
    audioEngine.unlock();
    if (isTestingSound) {
      audioEngine.stopRingtone();
      setIsTestingSound(false);
    } else {
      audioEngine.startRingtone(false);
      setIsTestingSound(true);
    }
  };

  // Trigger or schedule fake SMS heads-up notification
  const fireSmsNow = useCallback((sender: string, message: string) => {
    audioEngine.playSmsChime();
    setActiveSms({
      id: `sms-${Date.now()}`,
      sender: sender.trim() || 'Messages',
      message: message.trim() || 'New message received.',
      timestamp: Date.now(),
    });
  }, []);

  const handleTriggerSms = (e: React.FormEvent) => {
    e.preventDefault();
    audioEngine.unlock();

    if (smsCountdown !== null) {
      if (smsTimerRef.current !== null) {
        window.clearInterval(smsTimerRef.current);
        smsTimerRef.current = null;
      }
      setSmsCountdown(null);
      showToast('Scheduled SMS cancelled');
      return;
    }

    if (smsDelay <= 0) {
      fireSmsNow(smsSender, smsText);
      return;
    }

    let remaining = smsDelay;
    setSmsCountdown(remaining);
    smsTimerRef.current = window.setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        if (smsTimerRef.current !== null) {
          window.clearInterval(smsTimerRef.current);
          smsTimerRef.current = null;
        }
        setSmsCountdown(null);
        fireSmsNow(smsSender, smsText);
      } else {
        setSmsCountdown(remaining);
      }
    }, 1000);
  };

  // Voice search handler (uses SpeechRecognition if available, clean offline fallback otherwise)
  const handleMicSearch = () => {
    const SpeechRec =
      (window as unknown as { SpeechRecognition?: new () => { lang: string; onresult: (ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onerror: () => void; start: () => void } }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => { lang: string; onresult: (ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onerror: () => void; start: () => void } }).webkitSpeechRecognition;

    if (!SpeechRec) {
      searchInputRef.current?.focus();
      showToast('Offline mode: type name or number to search');
      return;
    }

    try {
      const rec = new SpeechRec();
      rec.lang = 'en-IN';
      rec.onresult = (event) => {
        const transcript = event.results?.[0]?.[0]?.transcript || '';
        if (transcript) {
          setSearchQuery(transcript);
          setActiveTab('contacts');
        }
      };
      rec.onerror = () => {
        showToast('Voice input unavailable offline — type to search');
      };
      rec.start();
      showToast('Listening...');
    } catch {
      searchInputRef.current?.focus();
      showToast('Offline mode: type name or number to search');
    }
  };

  // Add new offline contact
  const handleCreateContact = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newContactName.trim();
    const cleanNumber = newContactNumber.trim();
    if (!cleanName || !cleanNumber) return;

    const newItem: Contact = {
      id: `c-${Date.now()}`,
      name: cleanName,
      number: cleanNumber,
      label: newContactLabel.trim() || 'Mobile',
      avatarColor: getAvatarColor(cleanName),
    };
    setContacts((prev) =>
      [...prev, newItem].sort((a, b) => a.name.localeCompare(b.name))
    );
    setNewContactName('');
    setNewContactNumber('');
    setNewContactLabel('Mobile');
    setAddContactOpen(false);
    showToast(`Saved ${cleanName}`);
  };

  const handleDeleteContact = (id: string, name: string) => {
    setContacts((prev) => prev.filter((c) => c.id !== id));
    showToast(`Removed ${name}`);
  };

  const handleDeleteRecent = (id: string) => {
    setRecents((prev) => prev.filter((r) => r.id !== id));
  };

  const handleClearRecents = () => {
    setRecents([]);
    setMenuOpen(false);
    showToast('Call history cleared');
  };

  const handleDownloadOfflineHtml = async () => {
    setMenuOpen(false);
    try {
      const response = await fetch('/SnCall.html');
      if (!response.ok) throw new Error('File unavailable');
      const htmlContent = await response.text();
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = 'SnCall.html';
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
      showToast('Downloading SnCall.html...');
    } catch {
      showToast('Download blocked in preview — open app in Chrome browser');
    }
  };

  // Filtered lists for real-time search
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredContacts = useMemo(() => {
    const sorted = [...contacts].sort((a, b) => a.name.localeCompare(b.name));
    if (!normalizedQuery) return sorted;
    return sorted.filter(
      (c) =>
        c.name.toLowerCase().includes(normalizedQuery) ||
        c.number.toLowerCase().includes(normalizedQuery)
    );
  }, [contacts, normalizedQuery]);

  const filteredRecents = useMemo(() => {
    if (!normalizedQuery) return recents;
    return recents.filter(
      (r) =>
        r.name.toLowerCase().includes(normalizedQuery) ||
        r.number.toLowerCase().includes(normalizedQuery)
    );
  }, [recents, normalizedQuery]);

  // Group contacts by first letter
  const groupedContacts = useMemo(() => {
    const map = new Map<string, Contact[]>();
    for (const contact of filteredContacts) {
      const first = contact.name.trim().charAt(0).toUpperCase();
      const letter = /[A-Z]/.test(first) ? first : '#';
      const list = map.get(letter) || [];
      list.push(contact);
      map.set(letter, list);
    }
    return Array.from(map.entries());
  }, [filteredContacts]);

  return (
    <div className="min-h-dvh flex flex-col bg-[#F8F9FA] dark:bg-[#111318] text-[#1F1F1F] dark:text-[#E3E2E6] transition-colors">
      {/* Top Google Phone Pill-Shaped Search Bar */}
      <header className="sticky top-0 z-30 bg-[#F8F9FA]/95 dark:bg-[#111318]/95 backdrop-blur-md px-3 sm:px-6 pt-3 pb-2">
        <div className="max-w-5xl mx-auto">
          <div className="relative flex items-center h-[52px] rounded-full bg-[#EDF2FA] dark:bg-[#22262E] px-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus-within:ring-2 focus-within:ring-[#0B57D0]/35 dark:focus-within:ring-[#A8C7FA]/35 transition-shadow">
            <button
              type="button"
              onClick={() => searchInputRef.current?.focus()}
              aria-label="Search contacts"
              className="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-[#444746] dark:text-[#C4C7C5] hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
            >
              <SearchIcon className="w-5 h-5" />
            </button>

            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (e.target.value.trim() && activeTab === 'fake-call') {
                  setActiveTab('contacts');
                }
              }}
              placeholder="Sn Call • Search contacts"
              aria-label="Sn Call search contacts"
              className="flex-1 min-w-0 bg-transparent text-[15px] text-[#1F1F1F] dark:text-[#E3E2E6] placeholder:text-[#5E5E5E] dark:placeholder:text-[#A0A3AA] focus:outline-none px-1"
            />

            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-[#444746] dark:text-[#C4C7C5] hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleMicSearch}
                aria-label="Voice search"
                className="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-[#444746] dark:text-[#C4C7C5] hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
              >
                <MicIcon className="w-5 h-5" />
              </button>
            )}

            <div className="relative" ref={menuContainerRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="More options"
                aria-expanded={menuOpen}
                className="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-[#444746] dark:text-[#C4C7C5] hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
              >
                <MoreVertIcon className="w-5 h-5" />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-64 rounded-2xl bg-white dark:bg-[#23262E] shadow-xl border border-black/8 dark:border-white/10 py-1.5 z-50 animate-fade-in"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
                      setMenuOpen(false);
                    }}
                    className="w-full px-4 py-3 text-left text-sm flex items-center gap-3 hover:bg-[#EDF2FA] dark:hover:bg-white/8 cursor-pointer"
                  >
                    {theme === 'dark' ? (
                      <SunIcon className="w-4 h-4 text-[#A8C7FA]" />
                    ) : (
                      <MoonIcon className="w-4 h-4 text-[#0B57D0]" />
                    )}
                    <span>{theme === 'dark' ? 'Light theme' : 'Dark theme'}</span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleDownloadOfflineHtml}
                    className="w-full px-4 py-3 text-left text-sm flex items-center gap-3 hover:bg-[#EDF2FA] dark:hover:bg-white/8 cursor-pointer"
                  >
                    <DownloadIcon className="w-4 h-4 text-[#188038] dark:text-[#6DD58C]" />
                    <span>Download SnCall.html</span>
                  </button>

                  <div className="my-1 border-t border-black/6 dark:border-white/8" />

                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleClearRecents}
                    className="w-full px-4 py-3 text-left text-sm flex items-center gap-3 text-[#B3261E] dark:text-[#F2B8B5] hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                  >
                    <TrashIcon className="w-4 h-4" />
                    <span>Clear call history</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 pt-3 pb-28">
        {/* TAB 1: FAKE CALL & FAKE SMS */}
        {activeTab === 'fake-call' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Primary Card: Fake Call Scheduler */}
            <section className="lg:col-span-7 bg-white dark:bg-[#1A1C22] rounded-[28px] p-5 sm:p-6 border border-black/6 dark:border-white/8">
              <div className="flex items-center justify-between gap-3 mb-5">
                <div>
                  <h2 className="text-xl font-medium tracking-tight text-[#1F1F1F] dark:text-[#E3E2E6]">
                    Fake Call Scheduler
                  </h2>
                  <p className="text-xs text-[#5E5E5E] dark:text-[#A0A3AA] mt-0.5">
                    Configure caller identity, delay timer, and ringtone
                  </p>
                </div>

                {/* SIM Selector Toggle */}
                <div className="flex items-center p-1 rounded-full bg-[#EDF2FA] dark:bg-[#242832] shrink-0">
                  {(['SIM 1', 'SIM 2'] as const).map((sim) => (
                    <button
                      key={sim}
                      type="button"
                      onClick={() => setSelectedSim(sim)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                        selectedSim === sim
                          ? 'bg-[#0B57D0] dark:bg-[#A8C7FA] text-white dark:text-[#062E6F]'
                          : 'text-[#444746] dark:text-[#C4C7C5]'
                      }`}
                    >
                      {sim}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Fill Contacts Row */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-4 no-scrollbar">
                {QUICK_CALLERS.map((preset) => {
                  const selected =
                    callerName === preset.name && callerNumber === preset.number;
                  return (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => {
                        setCallerName(preset.name);
                        setCallerNumber(preset.number);
                      }}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        selected
                          ? 'bg-[#C2E7FF] dark:bg-[#004A77] border-transparent text-[#001D35] dark:text-[#C2E7FF]'
                          : 'bg-transparent border-black/12 dark:border-white/15 text-[#444746] dark:text-[#C4C7C5] hover:bg-black/4 dark:hover:bg-white/6'
                      }`}
                    >
                      {preset.name}
                    </button>
                  );
                })}
              </div>

              {/* Caller Name & Number Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-5">
                <div>
                  <label
                    htmlFor="caller-name-input"
                    className="block text-xs font-medium text-[#444746] dark:text-[#C4C7C5] mb-1.5"
                  >
                    Caller Name
                  </label>
                  <input
                    id="caller-name-input"
                    type="text"
                    value={callerName}
                    onChange={(e) => setCallerName(e.target.value)}
                    placeholder="e.g. Mom, Boss, Rahul"
                    className="w-full h-12 px-4 rounded-2xl bg-[#F3F6FC] dark:bg-[#23262E] border border-transparent focus:border-[#0B57D0] dark:focus:border-[#A8C7FA] text-[15px] text-[#1F1F1F] dark:text-[#E3E2E6] placeholder:text-[#747775] focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label
                    htmlFor="caller-number-input"
                    className="block text-xs font-medium text-[#444746] dark:text-[#C4C7C5] mb-1.5"
                  >
                    Mobile Number
                  </label>
                  <input
                    id="caller-number-input"
                    type="tel"
                    value={callerNumber}
                    onChange={(e) => setCallerNumber(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full h-12 px-4 rounded-2xl bg-[#F3F6FC] dark:bg-[#23262E] border border-transparent focus:border-[#0B57D0] dark:focus:border-[#A8C7FA] text-[15px] tabular-nums text-[#1F1F1F] dark:text-[#E3E2E6] placeholder:text-[#747775] focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Call Delay Timer Options */}
              <div className="mb-5">
                <span className="block text-xs font-medium text-[#444746] dark:text-[#C4C7C5] mb-2">
                  Call Delay Timer
                </span>
                <div className="grid grid-cols-5 gap-1.5 p-1 rounded-2xl bg-[#F3F6FC] dark:bg-[#23262E]">
                  {DELAY_OPTIONS.map((opt) => {
                    const active = delaySeconds === opt.seconds;
                    return (
                      <button
                        key={opt.label}
                        type="button"
                        disabled={countdownLeft !== null}
                        onClick={() => setDelaySeconds(opt.seconds)}
                        className={`h-10 rounded-xl text-xs sm:text-sm font-medium transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 ${
                          active
                            ? 'bg-[#0B57D0] dark:bg-[#A8C7FA] text-white dark:text-[#062E6F] shadow-sm'
                            : 'text-[#444746] dark:text-[#C4C7C5] hover:bg-black/5 dark:hover:bg-white/6'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Ringtone Picker */}
              <div className="mb-6 pt-4 border-t border-black/6 dark:border-white/8">
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <MusicNoteIcon className="w-4 h-4 text-[#0B57D0] dark:text-[#A8C7FA] shrink-0" />
                    <span className="text-xs font-medium text-[#444746] dark:text-[#C4C7C5]">
                      Incoming Ringtone
                    </span>
                  </div>
                  <span className="text-xs text-[#5E5E5E] dark:text-[#A0A3AA] truncate max-w-[180px]">
                    {ringtoneName || 'Built-in Pixel Chime'}
                  </span>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={handleRingtoneChange}
                  className="hidden"
                />

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-10 px-4 rounded-full bg-[#EDF2FA] dark:bg-[#242832] hover:bg-[#DFE8F6] dark:hover:bg-[#2E3340] text-xs font-medium text-[#0B57D0] dark:text-[#A8C7FA] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Choose Audio / MP3
                  </button>

                  <button
                    type="button"
                    onClick={handleToggleTestRingtone}
                    className="h-10 px-4 rounded-full border border-black/12 dark:border-white/15 hover:bg-black/4 dark:hover:bg-white/6 text-xs font-medium text-[#1F1F1F] dark:text-[#E3E2E6] flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {isTestingSound ? (
                      <>
                        <StopIcon className="w-3.5 h-3.5 text-[#D93025]" />
                        <span>Stop preview</span>
                      </>
                    ) : (
                      <>
                        <PlayIcon className="w-3.5 h-3.5 text-[#188038] dark:text-[#6DD58C]" />
                        <span>Test sound</span>
                      </>
                    )}
                  </button>

                  {ringtoneName && (
                    <button
                      type="button"
                      onClick={handleResetRingtone}
                      className="h-10 px-3 rounded-full text-xs font-medium text-[#5E5E5E] dark:text-[#A0A3AA] hover:text-[#B3261E] dark:hover:text-[#F2B8B5] transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Reset default
                    </button>
                  )}
                </div>
              </div>

              {/* Primary Start / Live Countdown Button */}
              <button
                type="button"
                onClick={handleScheduleCall}
                className={`w-full h-14 rounded-full font-medium text-base flex items-center justify-center gap-2.5 active:scale-[0.99] transition-all shadow-sm cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 ${
                  countdownLeft !== null
                    ? 'bg-[#B3261E] hover:bg-[#931E18] text-white focus-visible:outline-[#B3261E]'
                    : 'bg-[#188038] hover:bg-[#146C2E] text-white focus-visible:outline-[#188038]'
                }`}
              >
                <PhoneIcon className="w-5 h-5" />
                {countdownLeft !== null ? (
                  <span className="tabular-nums">
                    Incoming in {formatDuration(countdownLeft)} · Tap to cancel
                  </span>
                ) : (
                  <span>
                    {delaySeconds === 0
                      ? 'Start Fake Call Now'
                      : `Schedule Call (${DELAY_OPTIONS.find((d) => d.seconds === delaySeconds)?.label})`}
                  </span>
                )}
              </button>
            </section>

            {/* Secondary Card: Fake Message (SMS) Notification */}
            <section className="lg:col-span-5 bg-white dark:bg-[#1A1C22] rounded-[28px] p-5 sm:p-6 border border-black/6 dark:border-white/8">
              <div className="flex items-center gap-3 mb-5">
                <span className="w-10 h-10 rounded-full bg-[#D3E3FD] dark:bg-[#0842A0]/60 text-[#0B57D0] dark:text-[#A8C7FA] flex items-center justify-center shrink-0">
                  <SmsIcon className="w-5 h-5" />
                </span>
                <div>
                  <h2 className="text-lg font-medium tracking-tight text-[#1F1F1F] dark:text-[#E3E2E6]">
                    Fake SMS Notification
                  </h2>
                  <p className="text-xs text-[#5E5E5E] dark:text-[#A0A3AA]">
                    Android heads-up message banner with vibration
                  </p>
                </div>
              </div>

              <form onSubmit={handleTriggerSms} className="space-y-4">
                <div>
                  <label
                    htmlFor="sms-sender-input"
                    className="block text-xs font-medium text-[#444746] dark:text-[#C4C7C5] mb-1.5"
                  >
                    Sender ID / Name
                  </label>
                  <input
                    id="sms-sender-input"
                    type="text"
                    value={smsSender}
                    onChange={(e) => setSmsSender(e.target.value)}
                    placeholder="e.g. Mom, HDFC Bank, Office"
                    className="w-full h-11 px-4 rounded-2xl bg-[#F3F6FC] dark:bg-[#23262E] border border-transparent focus:border-[#0B57D0] dark:focus:border-[#A8C7FA] text-sm text-[#1F1F1F] dark:text-[#E3E2E6] placeholder:text-[#747775] focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="sms-body-input"
                    className="block text-xs font-medium text-[#444746] dark:text-[#C4C7C5] mb-1.5"
                  >
                    Message Text
                  </label>
                  <textarea
                    id="sms-body-input"
                    rows={3}
                    value={smsText}
                    onChange={(e) => setSmsText(e.target.value)}
                    placeholder="Write the incoming SMS message..."
                    className="w-full px-4 py-3 rounded-2xl bg-[#F3F6FC] dark:bg-[#23262E] border border-transparent focus:border-[#0B57D0] dark:focus:border-[#A8C7FA] text-sm text-[#1F1F1F] dark:text-[#E3E2E6] placeholder:text-[#747775] focus:outline-none resize-none"
                  />
                </div>

                <div>
                  <span className="block text-xs font-medium text-[#444746] dark:text-[#C4C7C5] mb-1.5">
                    Delivery Delay
                  </span>
                  <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#F3F6FC] dark:bg-[#23262E]">
                    {[
                      { label: 'Now', sec: 0 },
                      { label: '5s', sec: 5 },
                      { label: '10s', sec: 10 },
                    ].map((opt) => (
                      <button
                        key={opt.label}
                        type="button"
                        disabled={smsCountdown !== null}
                        onClick={() => setSmsDelay(opt.sec)}
                        className={`h-9 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                          smsDelay === opt.sec
                            ? 'bg-[#0B57D0] dark:bg-[#A8C7FA] text-white dark:text-[#062E6F]'
                            : 'text-[#444746] dark:text-[#C4C7C5] hover:bg-black/5 dark:hover:bg-white/6'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  className={`w-full h-12 rounded-full font-medium text-sm flex items-center justify-center gap-2 active:scale-[0.99] transition-all cursor-pointer ${
                    smsCountdown !== null
                      ? 'bg-[#B3261E] text-white hover:bg-[#931E18]'
                      : 'bg-[#0B57D0] dark:bg-[#A8C7FA] text-white dark:text-[#062E6F] hover:bg-[#0842A0] dark:hover:bg-[#8AB4F8]'
                  }`}
                >
                  <SmsIcon className="w-4 h-4" />
                  {smsCountdown !== null ? (
                    <span className="tabular-nums">
                      Arriving in {smsCountdown}s · Tap to cancel
                    </span>
                  ) : (
                    <span>Send Fake SMS Notification</span>
                  )}
                </button>
              </form>
            </section>
          </div>
        )}

        {/* TAB 2: RECENTS */}
        {activeTab === 'recents' && (
          <section className="bg-white dark:bg-[#1A1C22] rounded-[28px] border border-black/6 dark:border-white/8 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-black/6 dark:border-white/8">
              <div>
                <h2 className="text-base font-medium text-[#1F1F1F] dark:text-[#E3E2E6]">
                  Recent Calls
                </h2>
                <p className="text-xs text-[#5E5E5E] dark:text-[#A0A3AA]">
                  Tap any log to trigger an instant fake call
                </p>
              </div>
              {recents.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearRecents}
                  className="px-3 py-1.5 rounded-full text-xs font-medium text-[#0B57D0] dark:text-[#A8C7FA] hover:bg-[#EDF2FA] dark:hover:bg-white/8 cursor-pointer"
                >
                  Clear all
                </button>
              )}
            </div>

            {filteredRecents.length === 0 ? (
              <div className="py-16 px-6 text-center">
                <div className="w-14 h-14 mx-auto rounded-full bg-[#EDF2FA] dark:bg-[#242832] flex items-center justify-center text-[#5E5E5E] dark:text-[#A0A3AA] mb-3">
                  <HistoryIcon className="w-7 h-7" />
                </div>
                <p className="text-base font-medium text-[#1F1F1F] dark:text-[#E3E2E6]">
                  {normalizedQuery ? 'No matching recent calls' : 'No recent fake calls yet'}
                </p>
                <p className="text-sm text-[#5E5E5E] dark:text-[#A0A3AA] mt-1 max-w-xs mx-auto">
                  Every triggered fake call is automatically logged offline here.
                </p>
                {!normalizedQuery && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('fake-call')}
                    className="mt-5 h-10 px-5 rounded-full bg-[#C2E7FF] dark:bg-[#004A77] text-[#001D35] dark:text-[#C2E7FF] text-sm font-medium cursor-pointer"
                  >
                    Schedule a Fake Call
                  </button>
                )}
              </div>
            ) : (
              <ul className="divide-y divide-black/5 dark:divide-white/6">
                {filteredRecents.map((item) => {
                  const declined = item.status !== 'answered';
                  return (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-2 px-4 sm:px-5 py-3 hover:bg-[#F3F6FC] dark:hover:bg-white/4 transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          triggerFakeCallNow(item.name, item.number, item.avatarColor, item.sim)
                        }
                        className="flex items-center gap-3.5 min-w-0 flex-1 text-left cursor-pointer"
                      >
                        <span
                          className="w-11 h-11 rounded-full flex items-center justify-center text-white font-medium text-base shrink-0"
                          style={{ backgroundColor: item.avatarColor }}
                        >
                          {getInitials(item.name)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div
                            className={`text-[15px] font-medium truncate ${
                              declined
                                ? 'text-[#B3261E] dark:text-[#F2B8B5]'
                                : 'text-[#1F1F1F] dark:text-[#E3E2E6]'
                            }`}
                          >
                            {item.name}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-[#5E5E5E] dark:text-[#A0A3AA] mt-0.5 tabular-nums flex-wrap">
                            {declined ? (
                              <MissedArrowIcon className="w-3.5 h-3.5 text-[#D93025] shrink-0" />
                            ) : (
                              <IncomingArrowIcon className="w-3.5 h-3.5 text-[#188038] dark:text-[#6DD58C] shrink-0" />
                            )}
                            <span>{declined ? 'Declined' : formatDuration(item.durationSec)}</span>
                            <span aria-hidden="true">·</span>
                            <span>{item.sim}</span>
                            <span aria-hidden="true">·</span>
                            <span>{formatTimestamp(item.timestamp)}</span>
                          </div>
                        </div>
                      </button>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            triggerFakeCallNow(item.name, item.number, item.avatarColor, item.sim)
                          }
                          aria-label={`Trigger fake call from ${item.name}`}
                          className="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-[#444746] dark:text-[#C4C7C5] hover:bg-[#C2E7FF]/60 dark:hover:bg-[#004A77]/60 hover:text-[#0B57D0] dark:hover:text-[#A8C7FA] transition-colors cursor-pointer"
                        >
                          <PhoneOutlineIcon className="w-5 h-5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRecent(item.id)}
                          aria-label={`Delete log for ${item.name}`}
                          className="min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center text-[#747775] hover:text-[#B3261E] hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        {/* TAB 3: CONTACTS */}
        {activeTab === 'contacts' && (
          <section className="bg-white dark:bg-[#1A1C22] rounded-[28px] border border-black/6 dark:border-white/8 overflow-hidden">
            {/* Authentic Google Phone Create New Contact Row */}
            <button
              type="button"
              onClick={() => setAddContactOpen(true)}
              className="w-full flex items-center gap-4 px-5 py-4 border-b border-black/6 dark:border-white/8 text-[#0B57D0] dark:text-[#A8C7FA] hover:bg-[#EDF2FA]/70 dark:hover:bg-white/5 transition-colors cursor-pointer text-left"
            >
              <span className="w-10 h-10 rounded-full bg-[#D3E3FD] dark:bg-[#0842A0]/60 flex items-center justify-center shrink-0">
                <PersonAddIcon className="w-5 h-5" />
              </span>
              <span className="text-[15px] font-medium">Create new contact</span>
            </button>

            {groupedContacts.length === 0 ? (
              <div className="py-14 px-6 text-center">
                <p className="text-base font-medium text-[#1F1F1F] dark:text-[#E3E2E6]">
                  No contacts found
                </p>
                <p className="text-sm text-[#5E5E5E] dark:text-[#A0A3AA] mt-1">
                  Try another search term or add a new offline contact.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-black/5 dark:divide-white/6">
                {groupedContacts.map(([letter, list]) => (
                  <div key={letter} className="py-1">
                    <div className="px-5 pt-2.5 pb-1 text-xs font-semibold text-[#0B57D0] dark:text-[#A8C7FA]">
                      {letter}
                    </div>
                    <ul>
                      {list.map((contact) => (
                        <li
                          key={contact.id}
                          className="flex items-center justify-between gap-2 px-4 sm:px-5 py-2.5 hover:bg-[#F3F6FC] dark:hover:bg-white/4 transition-colors"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              triggerFakeCallNow(contact.name, contact.number, contact.avatarColor)
                            }
                            className="flex items-center gap-3.5 min-w-0 flex-1 text-left cursor-pointer"
                          >
                            <span
                              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium text-sm shrink-0"
                              style={{ backgroundColor: contact.avatarColor }}
                            >
                              {getInitials(contact.name)}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="text-[15px] font-medium text-[#1F1F1F] dark:text-[#E3E2E6] truncate">
                                {contact.name}
                              </div>
                              <div className="text-xs text-[#5E5E5E] dark:text-[#A0A3AA] tabular-nums truncate">
                                {contact.number}
                                {contact.label ? ` · ${contact.label}` : ''}
                              </div>
                            </div>
                          </button>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                triggerFakeCallNow(contact.name, contact.number, contact.avatarColor)
                              }
                              aria-label={`Fake call from ${contact.name}`}
                              className="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-[#188038] dark:text-[#6DD58C] hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors cursor-pointer"
                            >
                              <PhoneIcon className="w-5 h-5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteContact(contact.id, contact.name)}
                              aria-label={`Delete ${contact.name}`}
                              className="min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center text-[#747775] hover:text-[#B3261E] hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {/* Google Dialer Material You Squircle Dialpad FAB */}
      <button
        type="button"
        onClick={() => {
          audioEngine.unlock();
          setDialpadOpen(true);
        }}
        aria-label="Open T9 Dialpad"
        className="fixed right-4 sm:right-6 bottom-[88px] z-30 w-14 h-14 rounded-[16px] bg-[#C2E7FF] dark:bg-[#004A77] text-[#001D35] dark:text-[#C2E7FF] shadow-[0_4px_14px_rgba(0,0,0,0.18)] hover:brightness-95 active:scale-95 transition-all flex items-center justify-center cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B57D0]"
      >
        <DialpadIcon className="w-6 h-6" />
      </button>

      {/* Authentic Google Phone Material You Bottom Navigation Bar (3 Tabs) */}
      <nav
        aria-label="Primary navigation"
        className="fixed bottom-0 left-0 right-0 z-30 bg-[#F3F6FC]/95 dark:bg-[#1B1E24]/95 backdrop-blur-md border-t border-black/6 dark:border-white/8"
      >
        <div className="max-w-lg mx-auto grid grid-cols-3 h-[72px] items-center px-2">
          <BottomNavTab
            label="Fake Call"
            active={activeTab === 'fake-call'}
            onClick={() => setActiveTab('fake-call')}
            icon={
              activeTab === 'fake-call' ? (
                <PhoneIcon className="w-5 h-5" />
              ) : (
                <PhoneOutlineIcon className="w-5 h-5" />
              )
            }
          />
          <BottomNavTab
            label="Recents"
            active={activeTab === 'recents'}
            onClick={() => setActiveTab('recents')}
            icon={<HistoryIcon className="w-5 h-5" />}
          />
          <BottomNavTab
            label="Contacts"
            active={activeTab === 'contacts'}
            onClick={() => setActiveTab('contacts')}
            icon={
              activeTab === 'contacts' ? (
                <ContactsFilledIcon className="w-5 h-5" />
              ) : (
                <ContactsIcon className="w-5 h-5" />
              )
            }
          />
        </div>
      </nav>

      {/* Add Contact Modal */}
      {addContactOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[2px] flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setAddContactOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Create new contact"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-[28px] bg-white dark:bg-[#23262E] p-6 shadow-2xl border border-black/6 dark:border-white/10"
          >
            <h3 className="text-lg font-medium text-[#1F1F1F] dark:text-[#E3E2E6] mb-4">
              Create new contact
            </h3>
            <form onSubmit={handleCreateContact} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-[#5E5E5E] dark:text-[#A0A3AA] mb-1">
                  Name
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                  placeholder="Contact name"
                  className="w-full h-11 px-3.5 rounded-xl bg-[#F3F6FC] dark:bg-[#17191F] text-sm text-[#1F1F1F] dark:text-[#E3E2E6] focus:outline-none focus:ring-2 focus:ring-[#0B57D0]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#5E5E5E] dark:text-[#A0A3AA] mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  required
                  value={newContactNumber}
                  onChange={(e) => setNewContactNumber(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full h-11 px-3.5 rounded-xl bg-[#F3F6FC] dark:bg-[#17191F] text-sm tabular-nums text-[#1F1F1F] dark:text-[#E3E2E6] focus:outline-none focus:ring-2 focus:ring-[#0B57D0]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#5E5E5E] dark:text-[#A0A3AA] mb-1">
                  Label
                </label>
                <input
                  type="text"
                  value={newContactLabel}
                  onChange={(e) => setNewContactLabel(e.target.value)}
                  placeholder="Mobile, Work, Home"
                  className="w-full h-11 px-3.5 rounded-xl bg-[#F3F6FC] dark:bg-[#17191F] text-sm text-[#1F1F1F] dark:text-[#E3E2E6] focus:outline-none focus:ring-2 focus:ring-[#0B57D0]"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setAddContactOpen(false)}
                  className="h-10 px-4 rounded-full text-sm font-medium text-[#444746] dark:text-[#C4C7C5] hover:bg-black/5 dark:hover:bg-white/8 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-10 px-5 rounded-full bg-[#0B57D0] dark:bg-[#A8C7FA] text-white dark:text-[#062E6F] text-sm font-medium hover:brightness-95 cursor-pointer"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Slide-Up T9 Dialpad */}
      <DialpadSheet
        open={dialpadOpen}
        contacts={contacts}
        onClose={() => setDialpadOpen(false)}
        onTriggerCall={(name, number, color) => triggerFakeCallNow(name, number, color)}
      />

      {/* Fullscreen Google Phone Incoming & Ongoing Call Overlay */}
      {activeCall && <CallOverlay call={activeCall} onFinish={handleCallFinished} />}

      {/* Android Heads-Up Fake SMS Notification Banner */}
      <SmsBanner notification={activeSms} onDismiss={() => setActiveSms(null)} />

      {/* Subtle Material Snackbar Toast */}
      {toastMsg && (
        <div
          role="status"
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 max-w-[90vw] px-4 py-2.5 rounded-xl bg-[#2D3139] text-white text-xs font-medium shadow-lg whitespace-nowrap animate-fade-in"
        >
          {toastMsg}
        </div>
      )}
    </div>
  );
}

interface BottomNavTabProps {
  label: string;
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
}

const BottomNavTab: React.FC<BottomNavTabProps> = ({ label, active, onClick, icon }) => (
  <button
    type="button"
    onClick={onClick}
    aria-current={active ? 'page' : undefined}
    className="flex flex-col items-center justify-center gap-1 min-h-[56px] cursor-pointer group focus-visible:outline-2 focus-visible:outline-[#0B57D0] rounded-xl"
  >
    <span
      className={`w-16 h-8 rounded-full flex items-center justify-center transition-colors ${
        active
          ? 'bg-[#C2E7FF] dark:bg-[#004A77] text-[#001D35] dark:text-[#C2E7FF]'
          : 'text-[#444746] dark:text-[#C4C7C5] group-hover:bg-black/5 dark:group-hover:bg-white/6'
      }`}
    >
      {icon}
    </span>
    <span
      className={`text-xs leading-none whitespace-nowrap ${
        active
          ? 'font-semibold text-[#1F1F1F] dark:text-[#E3E2E6]'
          : 'font-medium text-[#444746] dark:text-[#C4C7C5]'
      }`}
    >
      {label}
    </span>
  </button>
);
