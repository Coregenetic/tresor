import type { Member } from "../lib/types";

interface Props {
  member: Member;
  size?: number;
  ring?: boolean;
}

export function Avatar({ member, size = 22, ring }: Props) {
  return (
    <span
      className="avatar"
      data-ring={ring || undefined}
      title={member.name}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.45),
        background: `hsl(${member.hue} 70% 58%)`,
      }}
    >
      {member.name[0]?.toUpperCase()}
    </span>
  );
}

export function AvatarStack({ members, size = 20 }: { members: Member[]; size?: number }) {
  return (
    <span className="avatar-stack">
      {members.map((m) => (
        <Avatar key={m.id} member={m} size={size} ring />
      ))}
    </span>
  );
}
