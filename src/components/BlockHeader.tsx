import { createContext, useContext, type ReactNode } from 'react';
import type { MenuItem } from './Popover';

/**
 * Supplied by the block row: renders its "+" and "⋮⋮" controls, with the block's own settings
 * added to the ⋮⋮ menu. Content blocks put these in their heading, so the content itself can use
 * the full, centred width instead of sharing it with handles in the margin.
 */
export const BlockHandlesContext = createContext<((extra: (MenuItem | 'sep')[]) => ReactNode) | null>(null);

export function BlockHeader({
  title,
  onTitle,
  placeholder,
  actions,
  menu = [],
}: {
  title: string;
  onTitle: (t: string) => void;
  placeholder: string;
  /** Small controls shown before the handles, e.g. "+ Add" on a report. */
  actions?: ReactNode;
  /** Block-specific settings added to the ⋮⋮ menu. */
  menu?: (MenuItem | 'sep')[];
}) {
  const handles = useContext(BlockHandlesContext);
  return (
    <div className="block-head">
      <input
        className="block-title"
        value={title}
        placeholder={placeholder}
        onChange={(e) => onTitle(e.target.value)}
        aria-label="Heading"
      />
      {actions}
      {handles?.(menu)}
    </div>
  );
}
