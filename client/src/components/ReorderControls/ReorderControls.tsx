import styles from "./ReorderControls.module.scss";

type Props = {
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onRemove: () => void;
  removeLabel?: string;
  moveUpLabel?: string;
  moveDownLabel?: string;
};

export function ReorderControls({
  onMoveUp,
  onMoveDown,
  onRemove,
  removeLabel = "Quitar",
  moveUpLabel = "Mover arriba",
  moveDownLabel = "Mover abajo",
}: Props) {
  return (
    <div className={styles.controls}>
      <button
        type="button"
        className={styles.iconButton}
        onClick={onMoveUp}
        disabled={!onMoveUp}
        aria-label={moveUpLabel}
      >
        ↑
      </button>
      <button
        type="button"
        className={styles.iconButton}
        onClick={onMoveDown}
        disabled={!onMoveDown}
        aria-label={moveDownLabel}
      >
        ↓
      </button>
      <button
        type="button"
        className={`${styles.iconButton} ${styles.iconButtonDanger}`}
        onClick={onRemove}
        aria-label={removeLabel}
      >
        ×
      </button>
    </div>
  );
}
