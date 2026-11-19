// src/components/TkStatusSelect.tsx
// <select> en pastille aux couleurs des badges. Créé mais NON branché :
// le statut des factures est recalculé par les règlements, et celui des
// décomptes n'a aucun traitement associé.
import type React from 'react';

export type TkTone = 'success' | 'info' | 'warning' | 'danger' | 'neutral';

export interface TkStatusOption {
  value: string;
  label: string;
  tone: TkTone;
}

interface TkStatusSelectProps {
  value: string;
  options: TkStatusOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  'aria-label'?: string;
}

export default function TkStatusSelect({ value, options, onChange, disabled, ...rest }: TkStatusSelectProps) {
  const tone = options.find(o => o.value === value)?.tone ?? 'neutral';
  return (
    <select
      className="tk-status-select tk-inline-input"
      data-tone={tone}
      value={value}
      disabled={disabled}
      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      aria-label={rest['aria-label']}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
