// Feature scope test (Hùng): the client rule hides the control, it does not protect data,
// and a notice opens exactly one screen.
import { canEdit } from '../src/features/permission';
import { screenFor, watchTap } from '../src/features/push';
import { daysLeft } from '../src/features/days';

const mockListeners: ((response: unknown) => void)[] = [];

jest.mock('expo-notifications', () => ({
  addNotificationResponseReceivedListener: (handler: (response: unknown) => void) => {
    mockListeners.push(handler);
    return { remove: () => mockListeners.splice(mockListeners.indexOf(handler), 1) };
  },
}));

jest.mock('expo-constants', () => ({ expoConfig: { extra: { eas: { projectId: 'p' } } } }));

test('a member sees the control on the row they created (Rule C)', () => {
  expect(canEdit({ _id: 't1', created_by: 'u1' }, 'u1', 'user')).toBe(true);
  expect(canEdit({ _id: 't2', created_by: 'u2' }, 'u1', 'user')).toBe(false);
  expect(canEdit({ _id: 't2', created_by: 'u2' }, 'u1', 'group_leader')).toBe(true);
});

test('a notice names the fridge screen and nothing else (D36)', () => {
  expect(screenFor({ screen: 'fridge' })).toBe('/fridge');
  expect(screenFor({ screen: 'food' })).toBeNull();
  expect(screenFor(undefined)).toBeNull();
});

test('a tap runs the same rule as the payload', () => {
  const opened: string[] = [];
  const stop = watchTap((path) => opened.push(path));
  mockListeners[0]({ notification: { request: { content: { data: { screen: 'fridge' } } } } });
  mockListeners[0]({ notification: { request: { content: {} } } });
  stop();
  expect(opened).toEqual(['/fridge']);
  expect(mockListeners.length).toBe(0);
});

test('the days left are counted the way the notice counts them', () => {
  const today = new Date('2026-10-26T03:00:00Z');
  expect(daysLeft('2026-10-29', today)).toBe(3);
  expect(daysLeft('2026-10-26', today)).toBe(0);
  expect(daysLeft('not a date', today)).toBeNull();
});
