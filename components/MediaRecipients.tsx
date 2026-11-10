import type { Participant } from "@/lib/types";

export default function MediaRecipients({ members, value, onChange, disabled }: {
  members: Participant[];
  value: string[] | undefined;
  onChange: (value: string[] | undefined) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset disabled={disabled} className="space-y-2 rounded-xl border border-current/15 p-3 text-sm">
      <legend className="px-1 font-semibold">Share media with</legend>
      <label className="flex items-center gap-2">
        <input type="radio" checked={!value} onChange={() => onChange(undefined)} />
        Everyone in this room
      </label>
      <label className="flex items-center gap-2">
        <input type="radio" checked={Boolean(value)} onChange={() => onChange([])} />
        Selected members
      </label>
      {value && <div className="max-h-36 space-y-2 overflow-y-auto pl-4">
        {!members.length && <p className="text-muted">No other members are online.</p>}
        {members.map(member => (
          <label className="flex items-center gap-2" key={member.id}>
            <input type="checkbox" checked={value.includes(member.id)} onChange={event =>
              onChange(event.target.checked ? [...value, member.id] : value.filter(id => id !== member.id))} />
            <span>{member.nick}{member.isHost ? " (room admin)" : ""}</span>
          </label>
        ))}
      </div>}
    </fieldset>
  );
}
