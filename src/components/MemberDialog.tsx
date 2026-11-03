import { Check, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { Member } from "../lib/types";
import { Avatar } from "./Avatar";
import { HoldButton } from "./HoldButton";
import { Modal } from "./Modal";

export const MEMBER_HUES = [228, 340, 150, 32, 270, 190, 8, 95];

interface Props {
  /** undefined = neue Person */
  member?: Member;
  existingNames: string[];
  entryCount: number;
  suggestedHue: number;
  onSave: (member: Member) => void;
  onDelete?: () => void;
  onClose: () => void;
}

export function MemberDialog({ member, existingNames, entryCount, suggestedHue, onSave, onDelete, onClose }: Props) {
  const [name, setName] = useState(member?.name ?? "");
  const [hue, setHue] = useState(member?.hue ?? suggestedHue);

  const trimmed = name.trim();
  const duplicate = existingNames.some(
    (n) => n.toLowerCase() === trimmed.toLowerCase() && n.toLowerCase() !== member?.name.toLowerCase(),
  );
  const canSave = trimmed.length > 0 && !duplicate;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    onSave({ id: member?.id ?? crypto.randomUUID(), name: trimmed, hue });
  }

  return (
    <Modal title={member ? "Person bearbeiten" : "Person hinzufügen"} onClose={onClose}>
      <form className="modal-body" onSubmit={submit}>
        <div className="member-preview">
          <Avatar member={{ id: "preview", name: trimmed || "?", hue }} size={48} />
        </div>

        <label className="form-field">
          <span className="field-label">Name</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={30} />
        </label>
        <div className="meter-label" data-warn={duplicate || undefined}>
          {duplicate ? "Diesen Namen gibt es schon." : " "}
        </div>

        <span className="field-label">Farbe</span>
        <div className="swatches" role="radiogroup" aria-label="Farbe">
          {MEMBER_HUES.map((h) => (
            <button
              key={h}
              type="button"
              role="radio"
              aria-checked={hue === h}
              className="swatch"
              style={{ background: `hsl(${h} 70% 58%)` }}
              onClick={() => setHue(h)}
            >
              {hue === h && <Check size={13} strokeWidth={3} />}
            </button>
          ))}
        </div>

        <footer className="modal-foot">
          {member && onDelete ? (
            <HoldButton onConfirm={onDelete}>
              <Trash2 size={14} />
              Halten zum Entfernen
            </HoldButton>
          ) : (
            <span />
          )}
          <div className="editor-actions">
            <button type="button" className="ghost-btn" onClick={onClose}>
              Abbrechen
            </button>
            <button type="submit" className="primary-btn" disabled={!canSave}>
              {member ? "Speichern" : "Hinzufügen"}
            </button>
          </div>
        </footer>
        {member && onDelete && entryCount > 0 && (
          <p className="modal-hint">
            Beim Entfernen bleiben die {entryCount} Einträge erhalten – {member.name} wird nur aus ihnen ausgetragen.
          </p>
        )}
      </form>
    </Modal>
  );
}
