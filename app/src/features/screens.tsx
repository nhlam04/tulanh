// Feature screens (Hùng): the screens read the shared rules, so a message shown here
// is the same message the server returns.
import { View, Text, Pressable } from 'react-native';
import { request } from '../api/client';
import { canEdit } from './permission';

export type ScreenProps = { token: string | null; offline: boolean; dispatch: (items: unknown[]) => void };

export async function loadFood(props: ScreenProps) {
  const response = await request('/foods', { token: props.token, offline: props.offline });
  props.dispatch((response.data as { foods: unknown[] })?.foods || []);
  return response;
}

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

export async function loadFridge(props: ScreenProps) {
  const response = await request('/fridge', { token: props.token, offline: props.offline });
  props.dispatch((response.data as { lots: unknown[] })?.lots || []);
  return response;
}

export function FridgeScreen({ items, message }: { items: Record<string, unknown>[]; message: string }) {
  return (
    <View>
      <Text>{message}</Text>
      {items.map((lot) => (
        <Text key={String(lot._id)}>{String(lot.quantity)} — {String(lot.use_until)}</Text>
      ))}
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

export async function loadMeals(props: ScreenProps) {
  const response = await request('/meal-plans/suggested', { token: props.token, offline: props.offline });
  props.dispatch((response.data as { suggested: unknown[] })?.suggested || []);
  return response;
}

export async function loadStats(props: ScreenProps) {
  const response = await request('/reports/purchases', { token: props.token, offline: props.offline });
  props.dispatch((response.data as { report: Record<string, unknown[]> })?.report.rau || []);
  return response;
}
