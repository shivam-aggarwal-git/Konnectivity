import { allowed } from "./permissions.mjs";

export function uploadAudience(room, sender, header) {
  if (header === undefined) return undefined;
  if (!allowed(room, sender, "privateMedia") || !sender.mediaIdentity) {
    throw new Error("Private media sharing is unavailable.");
  }
  let ids;
  try { ids = JSON.parse(header); } catch {}
  if (!Array.isArray(ids) || !ids.length || ids.length > 50) {
    throw new Error("Choose between 1 and 50 recipients.");
  }
  const recipients = ids.map(id => room.participants.get(id));
  if (recipients.some(member => !member?.mediaIdentity || member.status === "reconnecting" || member.id === sender.id)) {
    throw new Error("A selected recipient is no longer available. Choose recipients again.");
  }
  return { owner: sender.mediaIdentity, recipients: [...new Set(recipients.map(member => member.mediaIdentity))] };
}

export function canViewMedia(audience, participant) {
  return !audience || Boolean(participant?.mediaIdentity &&
    (audience.owner === participant.mediaIdentity || audience.recipients.includes(participant.mediaIdentity)));
}

export function visibleRoomEntries(entries, participant) {
  return entries.filter(entry => canViewMedia(entry.audience, participant)).map(publicRoomEntry);
}

export function publicRoomEntry({ audience, ...entry }) {
  return audience ? { ...entry, privateMedia: true } : entry;
}
