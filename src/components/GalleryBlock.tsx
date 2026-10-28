import { addSubGoal, isLiveGoal, useAppState } from '../store';
import { navigate } from '../route';
import type { GalleryData } from '../types';
import { CheckIcon, PlusIcon } from './Icons';
import { BlockHeader } from './BlockHeader';
import { GoalCard } from './PageView';

/**
 * A small gallery inside a goal. Each card is a sub-goal with the same properties and page
 * as a goal in the main gallery; tapping a card opens it.
 */
export function GalleryBlock({
  goalId,
  blockId,
  title,
  onTitle,
  gallery,
  onChange,
}: {
  goalId: string;
  blockId: string;
  title: string;
  onTitle: (t: string) => void;
  gallery: GalleryData;
  onChange: (g: GalleryData) => void;
}) {
  const state = useAppState();
  const goals = gallery.goalIds.map((id) => state.goals[id]).filter((g) => isLiveGoal(state, g));

  return (
    <div className={`gallery-block size-${gallery.size}`}>
      <BlockHeader
        title={title}
        onTitle={onTitle}
        placeholder="Gallery"
        menu={[
          { label: 'Small cards', icon: gallery.size === 'small' ? <CheckIcon /> : undefined, onClick: () => onChange({ ...gallery, size: 'small' }) },
          { label: 'Medium cards', icon: gallery.size === 'medium' ? <CheckIcon /> : undefined, onClick: () => onChange({ ...gallery, size: 'medium' }) },
        ]}
      />
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
