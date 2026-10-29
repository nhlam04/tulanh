// Feature screens (Hùng): the loaders read the shared paths, the lists read the kit, so
// one row looks the same on every screen and one situation reads the same everywhere.
import { request } from '../api/client';
import { canEdit } from './permission';
import { daysLeft } from './days';
import { Empty, List, ListRow } from './ui';

export { daysLeft };

export type ScreenProps = { token: string | null; offline: boolean; dispatch: (items: unknown[]) => void };
export type NameMap = Record<string, string>;

// Catalog rows arrive as {_id, name}; the screens show names, so every route reads the
// same id-to-name map from the answer it was given.
export function namesOf(out: { data: unknown | null }, key: string): NameMap {
  const rows = (out.data as Record<string, Record<string, unknown>[]> | null)?.[key] || [];
  return Object.fromEntries(rows.map((row) => [String(row._id), String(row.name)]));
}

// Member rows come back with `id`, `name` and `username`. A claimed row names the person
// with the name they chose for themselves; the username is an account key, so it is only a
// fallback for an account that has no name (rule 2 and rule 9).
export function peopleOf(out: { data: unknown | null }): NameMap {
  const rows = (out.data as { members?: Record<string, unknown>[] } | null)?.members || [];
  return Object.fromEntries(rows.map((row) => [String(row.id), String(row.name || row.username || '')]));
}

export async function loadMembers(props: ScreenProps) {
  const response = await request('/user/group/', { token: props.token, offline: props.offline });
  props.dispatch((response.data as { members?: unknown[] } | null)?.members || []);
  return response;
}

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

// The day's plans come back as one row per meal slot the group set (sáng, trưa, tối).
export async function loadPlans(props: ScreenProps, date: string) {
  const response = await request(`/meal/?date=${encodeURIComponent(date)}`, { token: props.token, offline: props.offline });
  props.dispatch((response.data as { plans?: unknown[] })?.plans || []);
  return response;
}

// The report comes back keyed by category, so the screen reads the keys, not a fixed name.
// The spec reads over a period, so both loaders pass optional `from`/`to` days.
export async function loadStats(props: ScreenProps, from = '', to = '') {
  const query = `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  const response = await request(`/reports/purchases/${query}`, { token: props.token, offline: props.offline });
  const report = (response.data as { report: Record<string, unknown[]> })?.report || {};
  props.dispatch(Object.keys(report).map((name) => ({ name, rows: report[name] })));
  return response;
}

export async function loadConsumption(props: ScreenProps, from = '', to = '') {
  const query = `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  const response = await request(`/reports/consumption/${query}`, { token: props.token, offline: props.offline });
  const report = (response.data as { report: Record<string, unknown[]> })?.report || {};
  props.dispatch(Object.keys(report).map((name) => ({ name, rows: report[name] })));
  return response;
}

// The food list reads as rows, not a run-on paragraph: the name, then the group and the
// unit it was filed under. Names come from the catalog the screen already loaded, because
// the server answers ids (D18).
export function FoodScreen({ items, categories, units }: { items: Record<string, unknown>[]; categories: NameMap; units: NameMap }) {
  if (!items.length) {
    return <Empty title="Chưa có thực phẩm nào" hint="Thêm thực phẩm để bắt đầu ghi danh sách mua và ghi tủ." />;
  }
  return (
    <List>
      {items.map((row) => (
        <ListRow
          key={String(row._id)}
          title={String(row.name)}
          sub={`${categories[String(row.category_id)] || 'chưa rõ nhóm'} · ${units[String(row.unit_id)] || 'chưa rõ đơn vị'}`}
        />
      ))}
    </List>
  );
}

// Days left lives in ./days so the rule is readable without the screens. The row offers the
// one write it owns: recording that the lot was used. A lot at or past its date is marked
// red, the colour meaning the course asks for (rule 2).
export function FridgeScreen({ items, names, units, onUse }: { items: Record<string, unknown>[]; names: NameMap; units: NameMap; onUse?: (lotId: string) => void }) {
  if (!items.length) {
    return <Empty title="Tủ đang trống" hint="Thêm thực phẩm đã mua vào tủ để được nhắc trước khi hết hạn." />;
  }
  return (
    <List>
      {items.map((lot) => {
        const left = daysLeft(String(lot.use_until || ''));
        const empty = Number(lot.quantity) <= 0;
        const due = left === null ? 'chưa rõ ngày dùng' : left <= 0 ? 'hết hạn hôm nay' : `còn ${left} ngày`;
        const place = lot.location ? ` · ${String(lot.location)}` : '';
        return (
          <ListRow
            key={String(lot._id)}
            title={names[String(lot.food_id)] || 'món trong tủ'}
            // An empty part states it is empty and offers nothing: the tap that would ask
            // the server for more of it is not there to make (rule 5).
            sub={empty ? 'đã dùng hết' : `${String(lot.quantity)} ${units[String(lot.unit_id)] || ''} · ${due}${place}`}
            warn={empty || (left !== null && left <= 0)}
            action={onUse && !empty ? 'Đã dùng' : undefined}
            onPress={onUse && !empty ? () => onUse(String(lot._id)) : undefined}
            disabled={!onUse || empty}
          />
        );
      })}
    </List>
  );
}

// Rule C in the client: the edit control only appears on a row the caller may write.
// The row offers one action at a time — take the task, or mark it bought — never two side
// by side, so a tap cannot land on the wrong one.
export function ShoppingScreen({ items, names, people, userId, onClaim, onBought }: { items: Record<string, unknown>[]; names: NameMap; people: NameMap; userId: string; onClaim?: (taskId: string) => void; onBought?: (taskId: string) => void }) {
  if (!items.length) {
    return <Empty title="Chưa có món nào trong danh sách" hint="Thêm món vào danh sách hiện có, hoặc tạo danh sách mới." />;
  }
  return (
    <List>
      {items.map((task) => {
        const claimed = task.claimed_by ? String(task.claimed_by) : '';
        const bought = task.bought_at ? String(task.bought_at) : '';
        const mine = claimed === userId;
        const taken = Boolean(claimed) && !mine;
        const assignee = task.assign_to ? String(task.assign_to) : '';
        return (
          <ListRow
            key={String(task._id)}
            title={names[String(task.food_id)] || 'món trong danh sách'}
            sub={
              bought
                ? 'đã mua'
                : claimed
                  ? `đã nhận: ${people[claimed] || 'một người trong nhóm'}`
                  : `Số lượng ${String(task.quantity)}${assignee ? ` · phần của ${assignee}` : ' · chưa ai nhận'}`
            }
            // One action per row, and the same rule the server applies (rule 3 and 8): nobody
            // has taken the part, so any member can take it; I took it, so I mark it bought;
            // someone else took it, so this row waits for that person.
            action={bought || taken ? undefined : mine ? 'Đã mua' : 'Nhận phần này'}
            onPress={bought || taken ? undefined : mine ? (onBought ? () => onBought(String(task._id)) : undefined) : (onClaim ? () => onClaim(String(task._id)) : undefined)}
            disabled={Boolean(bought) || taken}
          />
        );
      })}
    </List>
  );
}

// The suggested meals name the recipe and the food already in the tủ, not the ids.
export function MealScreen({ items, names }: { items: Record<string, unknown>[]; names: NameMap }) {
  if (!items.length) {
    return <Empty title="Tủ chưa gợi ý được món nào" hint="Thêm thực phẩm vào tủ; món gợi ý đến từ những gì đang có." />;
  }
  return (
    <List>
      {items.map((meal) => (
        <ListRow
          key={String(meal.recipe_id)}
          title={String(meal.name)}
          sub={(meal.ingredients as string[])?.map((id) => names[id] || id).join(', ') || 'không rõ nguyên liệu'}
        />
      ))}
    </List>
  );
}

export type ReportGroup = { name: string; rows: unknown[] };

// Older rows still carry the reason word the app sent before the screen spoke Vietnamese,
// so the read side translates the known keys and passes a category name through untouched.
const REASON_LABELS: Record<string, string> = {
  cook: 'nấu ăn',
  spoil: 'hỏng',
  other: 'lý do khác',
};

export function ReportScreen({ groups, label }: { groups: ReportGroup[]; label: string }) {
  if (!groups.length) {
    return <Empty title={`${label}: chưa có số liệu`} hint="Số liệu đến từ các lượt mua và các lượt dùng đã ghi." />;
  }
  // Two stored keys can read as the same words, so the counts join before the row is drawn:
  // one name on screen is one line, never two lines that look alike.
  const counts = new Map<string, number>();
  groups.forEach((group) => {
    const name = REASON_LABELS[group.name] || group.name;
    counts.set(name, (counts.get(name) || 0) + group.rows.length);
  });
  return (
    <List>
      {[...counts.entries()].map(([name, count]) => (
        <ListRow key={name} title={name} sub={`${count} lượt`} />
      ))}
    </List>
  );
}
