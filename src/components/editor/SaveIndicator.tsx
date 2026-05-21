import React, { useEffect, useState } from 'react';
import { Check, Loader2, AlertCircle, Pencil } from 'lucide-react';
import { SaveStatus } from '../../hooks/useAutosave';

interface SaveIndicatorProps {
  status: SaveStatus;
  lastSavedAt: Date | null;
}

function formatRelative(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export default function SaveIndicator({ status, lastSavedAt }: SaveIndicatorProps) {
  // Re-render every 15s so the relative timestamp stays accurate
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  let icon: React.ReactNode;
  let text: string;
  let colorClass = 'text-slate-500';

  switch (status) {
    case 'pending':
      icon = <Pencil size={14} className="animate-pulse" />;
      text = 'Editing…';
      break;
    case 'saving':
      icon = <Loader2 size={14} className="animate-spin" />;
      text = 'Saving…';
      break;
    case 'saved':
      icon = <Check size={14} className="text-green-600" />;
      text = lastSavedAt ? `Saved ${formatRelative(lastSavedAt)}` : 'Saved';
      colorClass = 'text-green-700';
      break;
    case 'error':
      icon = <AlertCircle size={14} className="text-red-600" />;
      text = 'Could not save — check connection';
      colorClass = 'text-red-700';
      break;
    case 'idle':
    default:
      if (lastSavedAt) {
        icon = <Check size={14} className="text-slate-400" />;
        text = `Saved ${formatRelative(lastSavedAt)}`;
      } else {
        return null;
      }
  }

  return (
    <div className={`flex items-center gap-1.5 text-xs font-avenir ${colorClass}`}>
      {icon}
      <span>{text}</span>
    </div>
  );
}
