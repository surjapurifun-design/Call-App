import React, { useEffect, useState } from 'react';
import type { SmsNotification } from '../types';
import { getAvatarColor, getInitials } from '../utils/storage';
import { CloseIcon, SmsIcon } from './Icons';

interface SmsBannerProps {
  notification: SmsNotification | null;
  onDismiss: () => void;
}

export const SmsBanner: React.FC<SmsBannerProps> = ({ notification, onDismiss }) => {
  const [replyMode, setReplyMode] = useState(false);
  const [replyText, setReplyText] = useState('');

  useEffect(() => {
    setReplyMode(false);
    setReplyText('');
    if (!notification) return;
    const timer = window.setTimeout(() => {
      onDismiss();
    }, 7500);
    return () => window.clearTimeout(timer);
  }, [notification, onDismiss]);

  if (!notification) return null;

  const avatarBg = getAvatarColor(notification.sender);

  const handleReplySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    onDismiss();
  };

  return (
    <div
      role="status"
      aria-live="assertive"
      className="fixed top-3 left-3 right-3 z-[60] max-w-md mx-auto animate-slide-down"
    >
      <div className="bg-[#FDFDFD] dark:bg-[#23262E] text-[#1F1F1F] dark:text-[#E3E2E6] rounded-[24px] shadow-[0_12px_36px_rgba(0,0,0,0.22)] border border-black/8 dark:border-white/10 p-4">
        {/* Android Header Row */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 text-xs text-[#5E5E5E] dark:text-[#A0A3AA]">
            <span className="w-5 h-5 rounded-full bg-[#1A73E8] text-white flex items-center justify-center shrink-0">
              <SmsIcon className="w-3 h-3" />
            </span>
            <span className="font-medium text-[#1F1F1F] dark:text-[#E3E2E6]">Messages</span>
            <span aria-hidden="true">·</span>
            <span>now</span>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss message notification"
            className="w-7 h-7 rounded-full flex items-center justify-center text-[#5E5E5E] dark:text-[#A0A3AA] hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Sender & Body */}
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium text-sm shrink-0 mt-0.5"
            style={{ backgroundColor: avatarBg }}
          >
            {getInitials(notification.sender)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-[#1F1F1F] dark:text-[#E3E2E6] truncate">
              {notification.sender}
            </div>
            <p className="text-sm text-[#444746] dark:text-[#C4C7C5] leading-snug break-words mt-0.5">
              {notification.message}
            </p>
          </div>
        </div>

        {/* Inline Reply or Quick Action Row */}
        {replyMode ? (
          <form onSubmit={handleReplySubmit} className="mt-3 flex items-center gap-2">
            <input
              type="text"
              autoFocus
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={`Reply to ${notification.sender}...`}
              className="flex-1 h-9 px-3.5 rounded-full bg-[#EDF2FA] dark:bg-[#17191F] text-sm text-[#1F1F1F] dark:text-[#E3E2E6] placeholder:text-[#747775] focus:outline-none focus:ring-2 focus:ring-[#0B57D0]"
            />
            <button
              type="submit"
              className="h-9 px-4 rounded-full bg-[#0B57D0] text-white text-xs font-medium hover:bg-[#0842A0] cursor-pointer whitespace-nowrap"
            >
              Send
            </button>
          </form>
        ) : (
          <div className="mt-3 pl-[52px] flex items-center gap-4">
            <button
              type="button"
              onClick={() => setReplyMode(true)}
              className="text-xs font-semibold text-[#0B57D0] dark:text-[#A8C7FA] hover:underline cursor-pointer py-1"
            >
              Reply
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="text-xs font-semibold text-[#0B57D0] dark:text-[#A8C7FA] hover:underline cursor-pointer py-1"
            >
              Mark as read
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
