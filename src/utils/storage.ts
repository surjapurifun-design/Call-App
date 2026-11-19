import type { Contact, RecentCall } from '../types';

const CONTACTS_KEY = 'sn_call_contacts_v1';
const RECENTS_KEY = 'sn_call_recents_v1';
const THEME_KEY = 'sn_call_theme_v1';

// Authentic Google Contacts Material You avatar palette
export const AVATAR_COLORS = [
  '#1A73E8', // Google Blue
  '#188038', // Google Green
  '#D93025', // Google Red
  '#E37400', // Google Amber
  '#8430CE', // Material Purple
  '#007B83', // Material Teal
  '#C5221F', // Deep Crimson
  '#3F51B5', // Indigo
];

export function getAvatarColor(seed: string): string {
  const clean = (seed || 'U').trim();
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = clean.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function getInitials(name: string): string {
  const clean = name.trim();
  if (!clean) return '?';
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export const DEFAULT_CONTACTS: Contact[] = [
  { id: 'c-1', name: 'Mom', number: '+91 98765 43210', label: 'Mobile', avatarColor: '#D93025' },
  { id: 'c-2', name: 'Dad', number: '+91 98201 11223', label: 'Mobile', avatarColor: '#1A73E8' },
  { id: 'c-3', name: 'Aarav Sharma', number: '+91 98112 77890', label: 'Work', avatarColor: '#188038' },
  { id: 'c-4', name: 'Boss (Office)', number: '+91 99104 55612', label: 'Work', avatarColor: '#007B83' },
  { id: 'c-5', name: 'Dr. Mehta Clinic', number: '+91 98220 34511', label: 'Main', avatarColor: '#8430CE' },
  { id: 'c-6', name: 'Priya Verma', number: '+91 97654 22109', label: 'Mobile', avatarColor: '#E37400' },
  { id: 'c-7', name: 'Courier Delivery', number: '+91 80456 78901', label: 'Mobile', avatarColor: '#3F51B5' },
  { id: 'c-8', name: 'Rahul Kumar', number: '+91 96502 88341', label: 'Mobile', avatarColor: '#188038' },
];

export function loadContacts(): Contact[] {
  try {
    const raw = localStorage.getItem(CONTACTS_KEY);
    if (!raw) {
      localStorage.setItem(CONTACTS_KEY, JSON.stringify(DEFAULT_CONTACTS));
      return DEFAULT_CONTACTS;
    }
    const parsed = JSON.parse(raw) as Contact[];
    if (!Array.isArray(parsed)) return DEFAULT_CONTACTS;
    return parsed;
  } catch {
    return DEFAULT_CONTACTS;
  }
}

export function saveContacts(contacts: Contact[]): void {
  try {
    localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadRecents(): RecentCall[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentCall[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function saveRecents(recents: RecentCall[]): void {
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(recents));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadTheme(): 'light' | 'dark' {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    // Ignore
  }
  return 'light';
}

export function saveTheme(theme: 'light' | 'dark'): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Ignore
  }
}

export function formatDuration(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (isToday) return timeStr;
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;
}

// T9 digit-to-letters mapping for authentic dialpad contact lookup
const T9_MAP: Record<string, string> = {
  '2': 'abc',
  '3': 'def',
  '4': 'ghi',
  '5': 'jkl',
  '6': 'mno',
  '7': 'pqrs',
  '8': 'tuv',
  '9': 'wxyz',
};

export function matchesT9(contact: Contact, digits: string): boolean {
  const cleanDigits = digits.replace(/[^0-9]/g, '');
  if (!cleanDigits) return false;

  const phoneDigits = contact.number.replace(/[^0-9]/g, '');
  if (phoneDigits.includes(cleanDigits)) return true;

  const lowerName = contact.name.toLowerCase();
  let t9Name = '';
  for (const ch of lowerName) {
    let matchedDigit = '';
    for (const [d, letters] of Object.entries(T9_MAP)) {
      if (letters.includes(ch)) {
        matchedDigit = d;
        break;
      }
    }
    if (matchedDigit) t9Name += matchedDigit;
  }
  return t9Name.includes(cleanDigits);
}
