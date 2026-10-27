import { addSubGoal, isLiveGoal, useAppState } from '../store';
import { navigate } from '../route';
import type { GalleryData } from '../types';
import { PlusIcon, TrashIcon } from './Icons';
import { GoalCard } from './PageView';

/**
 * A small gallery inside a goal. Each card is a sub-goal with the same properties and page
 * as a goal in the main gallery; tapping a card opens it.
 */
export function GalleryBlock({
  goalId,
  blockId,
  gallery,
  onChange,
  onDelete,
}: {
  goalId: string;
  blockId: string;
  gallery: GalleryData;
  onChange: (g: GalleryData) => void;
  onDelete: () => void;
}) {
  const state = useAppState();
  const goals = gallery.goalIds.map((id) => state.goals[id]).filter((g) => isLiveGoal(state, g));

  return (
    <div className={`gallery-block size-${gallery.size}`}>
      <div className="gallery-block-bar">
        <div className="seg" role="radiogroup" aria-label="Card size">
          {(['small', 'medium'] as const).map((s) => (
            <button
              key={s}
              role="radio"
              aria-checked={gallery.size === s}
              className={gallery.size === s ? 'on' : ''}
              onClick={() => onChange({ ...gallery, size: s })}
            >
              {s === 'small' ? 'Small' : 'Medium'}
            </button>
          ))}
        </div>
        <span className="spacer" />
        <button className="ghost-btn danger-text" onClick={onDelete}>
          <TrashIcon /> Delete gallery
        </button>
      </div>
      <div className="gallery-block-grid">
        {goals.map((g) => (
          <GoalCard
            key={g.id}
            goal={g}
            draggable={false}
            dragging={false}
            dropSide={null}
            onDragStart={() => {}}
            onDragEnd={() => {}}
            onDragOverCard={() => {}}
          />
        ))}
        <button
          className="card new-card gb-add"
          onClick={() => {
            const id = addSubGoal(goalId, blockId);
            if (id) navigate({ view: 'goal', id });
          }}
        >
          <PlusIcon /> Add card
        </button>
      </div>
    </div>
  );
}
