import { Avatar, AvatarImage, AvatarFallback } from "maneuver-2026";

// Inline data URI (no network dependency — external image hosts aren't
// reachable from every render environment this preview runs in).
const PLACEHOLDER_AVATAR =
  "data:image/svg+xml;base64," +
  btoa(
    '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128">' +
      '<rect width="128" height="128" fill="#64748b"/>' +
      '<circle cx="64" cy="50" r="24" fill="#cbd5e1"/>' +
      '<ellipse cx="64" cy="120" rx="40" ry="36" fill="#cbd5e1"/>' +
      "</svg>",
  );

export function WithImage() {
  return (
    <div className="p-4">
      <Avatar>
        <AvatarImage src={PLACEHOLDER_AVATAR} alt="Scout avatar" />
        <AvatarFallback>JD</AvatarFallback>
      </Avatar>
    </div>
  );
}

export function FallbackInitials() {
  return (
    <div className="p-4">
      <Avatar>
        <AvatarFallback>JD</AvatarFallback>
      </Avatar>
    </div>
  );
}

export function ScoutRoster() {
  const scouts = [
    { initials: "JD", name: "Jamie Diaz" },
    { initials: "MR", name: "Maya Rossi" },
    { initials: "TK", name: "Tyler Kim" },
  ];
  return (
    <div className="flex items-center gap-3 p-4">
      {scouts.map((s) => (
        <div key={s.initials} className="flex items-center gap-2">
          <Avatar>
            <AvatarFallback>{s.initials}</AvatarFallback>
          </Avatar>
          <span className="text-sm">{s.name}</span>
        </div>
      ))}
    </div>
  );
}
