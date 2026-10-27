// Feature screens (Hùng): the screens read the shared rules, so a message shown here
// is the same message the server returns. Paths are written as the route table writes them.
import { View, Text, Pressable } from 'react-native';
import { request } from '../api/client';
import { canEdit } from './permission';
import { daysLeft } from './days';

export { daysLeft };

export type ScreenProps = { token: string | null; offline: boolean; dispatch: (items: unknown[]) => void };

export async function loadFoods(props: ScreenProps) {
  const response = await request('/food/', { token: props.token, offline: props.offline });
  props.dispatch((response.data as { foods: unknown[] })?.foods || []);
  return response;
}

export async function searchFoods(props: ScreenProps, keyword: string) {
  const response = await request(`/food/search/?keyword=${encodeURIComponent(keyword)}`, { token: props.token, offline: props.offline });
  props.dispatch((response.data as { foods: unknown[] })?.foods || []);
  return response;
}

export async function loadFridge(props: ScreenProps) {
  const response = await request('/fridge/', { token: props.token, offline: props.offline });
  props.dispatch((response.data as { lots: unknown[] })?.lots || []);
  return response;
}

export async function loadLists(props: ScreenProps) {
  const response = await request('/shopping/', { token: props.token, offline: props.offline });
  props.dispatch((response.data as { lists: unknown[] })?.lists || []);
  return response;
}

export async function loadTasks(props: ScreenProps, listId: string) {
  const response = await request(`/shopping/task/?listId=${encodeURIComponent(listId)}`, { token: props.token, offline: props.offline });
  props.dispatch((response.data as { tasks: unknown[] })?.tasks || []);
  return response;
}

export async function loadMeals(props: ScreenProps) {
  const response = await request('/meal/suggested/', { token: props.token, offline: props.offline });
  props.dispatch((response.data as { suggested: unknown[] })?.suggested || []);
  return response;
}

// The report comes back keyed by category, so the screen reads the keys, not a fixed name.
export async function loadStats(props: ScreenProps) {
  const response = await request('/reports/purchases/', { token: props.token, offline: props.offline });
  const report = (response.data as { report: Record<string, unknown[]> })?.report || {};
  props.dispatch(Object.keys(report).map((name) => ({ name, rows: report[name] })));
  return response;
}

export async function loadConsumption(props: ScreenProps) {
  const response = await request('/reports/consumption/', { token: props.token, offline: props.offline });
  const report = (response.data as { report: Record<string, unknown[]> })?.report || {};
  props.dispatch(Object.keys(report).map((name) => ({ name, rows: report[name] })));
  return response;
}

// Days left lives in ./days so the rule is readable without the screens.

export function FoodScreen({ items, message }: { items: Record<string, unknown>[]; message: string }) {
  return (
    <View>
      <Text>{message}</Text>
      {items.map((row) => (
        <Text key={String(row._id)}>{String(row.name)}</Text>
      ))}
    </View>
  );
}

// The fridge screen names the food, not the lot id, and shows the days left like the notice.
// The row offers the one write the screen owns: recording that the lot was used.
export function FridgeScreen({ items, names, message, onUse }: { items: Record<string, unknown>[]; names: Record<string, string>; message: string; onUse?: (lotId: string) => void }) {
  return (
    <View>
      <Text>{message}</Text>
      {items.map((lot) => {
        const left = daysLeft(String(lot.use_until || ''));
        return (
          <Pressable key={String(lot._id)} onPress={() => onUse?.(String(lot._id))} disabled={!onUse}>
            <Text>
              {names[String(lot.food_id)] || 'món trong tủ'} — {String(lot.quantity)} — còn {left === null ? '?' : left} ngày
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Rule C in the client: hide the edit control for a row the caller does not own.

export function ShoppingScreen({ items, userId, role, message }: { items: Record<string, unknown>[]; userId: string; role: string; message: string }) {
  return (
    <View>
      <Text>{message}</Text>
      {items.map((task) => (
        <Pressable key={String(task._id)} disabled={!canEdit(task, userId, role)}>
          <Text>{String(task.quantity)} — {canEdit(task, userId, role) ? 'edit' : 'read'}</Text>
        </Pressable>
      ))}
    </View>
  );
}
