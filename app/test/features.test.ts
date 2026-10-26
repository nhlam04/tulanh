// Feature scope test (Hùng): the client rule hides the control, it does not protect data.
import { canEdit } from '../src/features/permission';

test('a member sees the control on the row they created (Rule C)', () => {
  expect(canEdit({ _id: 't1', created_by: 'u1' }, 'u1', 'user')).toBe(true);
  expect(canEdit({ _id: 't2', created_by: 'u2' }, 'u1', 'user')).toBe(false);
  expect(canEdit({ _id: 't2', created_by: 'u2' }, 'u1', 'group_leader')).toBe(true);
});
