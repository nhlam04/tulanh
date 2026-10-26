// Rule C on the client side (Hùng): the edit control shows only for the row the caller
// owns, or for the group leader. The server checks the same rule, so the client rule is
// display only, not safety.
export function canEdit(row: Record<string, unknown>, userId: string, role: string) {
  return role === 'admin' || role === 'group_leader' || String(row.created_by) === userId;
}
