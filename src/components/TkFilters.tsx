// src/components/TkFilters.tsx
// Filtres pliables : emballe la zone de filtres existante sans toucher à sa logique.
import { useState } from 'react';
import type React from 'react';
import { UnstyledButton } from '@mantine/core';
import { SlidersHorizontal, ChevronDown } from 'lucide-react';

export interface TkActiveFilter {
  label: string;
  value: string;
}

interface TkFiltersProps {
  children: React.ReactNode;
  /** Filtres actifs affichés en chips « Libellé : valeur » (facultatif). */
  active?: TkActiveFilter[];
  defaultOpen?: boolean;
  title?: string;
}

export default function TkFilters({ children, active = [], defaultOpen = true, title = 'Filtres' }: TkFiltersProps) {
  const [open, setOpen] = useState(defaultOpen);
  const chips = active.filter(f => f.value !== '' && f.value != null);
  return (
    <section className="tk-filters" data-open={open || undefined}>
      <UnstyledButton className="tk-filters-head" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span className="tk-filters-icon"><SlidersHorizontal size={16} /></span>
        <span className="tk-filters-title">{title}</span>
        <span className="tk-filters-chips">
          {chips.map(f => (
            <span key={f.label} className="tk-filters-chip">{f.label} : {f.value}</span>
          ))}
        </span>
        <ChevronDown size={16} className="tk-filters-chevron" />
      </UnstyledButton>
      <div className="tk-filters-body" hidden={!open}>
        {children}
      </div>
    </section>
  );
}
