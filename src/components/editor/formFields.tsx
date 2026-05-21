import React from 'react';

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-avenir uppercase tracking-wider text-slate-500 mb-2">
      {children}
    </label>
  );
}

export function TextField({
  label, value, onChange, placeholder, multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  const common = "w-full px-3 py-2 border border-slate-300 rounded-lg font-avenir text-slate-800 focus:ring-2 focus:ring-slate-300 focus:border-slate-300 outline-none";
  return (
    <div className="mb-5">
      <FieldLabel>{label}</FieldLabel>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={2}
          className={common}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={common}
        />
      )}
    </div>
  );
}

export function SectionHeading({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-2xl font-avenir text-slate-800 heading-tracking">{children}</h2>
      {hint && <p className="text-sm text-slate-500 font-lora italic mt-1">{hint}</p>}
    </div>
  );
}
