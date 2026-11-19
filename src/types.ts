export type TabId = 'fake-call' | 'recents' | 'contacts';

export interface Contact {
  id: string;
  name: string;
  number: string;
  label?: string;
  avatarColor: string;
}

export type CallLogStatus = 'answered' | 'declined' | 'missed';

export interface RecentCall {
  id: string;
  name: string;
  number: string;
  sim: 'SIM 1' | 'SIM 2';
  timestamp: number;
  status: CallLogStatus;
  durationSec: number;
  avatarColor: string;
}

export interface ActiveCall {
  name: string;
  number: string;
  sim: 'SIM 1' | 'SIM 2';
  avatarColor: string;
}

export interface SmsNotification {
  id: string;
  sender: string;
  message: string;
  timestamp: number;
}

export interface DelayOption {
  label: string;
  seconds: number;
}

export const DELAY_OPTIONS: DelayOption[] = [
  { label: 'Now', seconds: 0 },
  { label: '5s', seconds: 5 },
  { label: '10s', seconds: 10 },
  { label: '30s', seconds: 30 },
  { label: '1 min', seconds: 60 },
];
