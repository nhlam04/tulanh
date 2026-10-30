// Recipe screen (Hùng): the dishes the group keeps, and the ingredients that make each
// one. A recipe is named, then its ingredients are tapped from the catalog one at a time
// (rules 5 and 6), and the Bữa ăn suggestion reads the same rows back. Only the row's
// creator or the group leader may change it; when the app is wrong, the server says so in
// its own sentence (D28, rule 9).
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { failure, makeNote, request, type Note } from '../src/api/client';
import { useSession } from '../src/session';
import { namesOf } from '../src/features/screens';
import { Bar, Button, ChipGroup, Empty, Field, List, ListRow, Notice, Screen, styles } from '../src/features/ui';

export default function RecipeRoute() {
  const session = useSession();
  const [recipes, setRecipes] = useState<Record<string, unknown>[]>([]);
  const [foods, setFoods] = useState<Record<string, string>>({});
  const [ingredientNames, setIngredientNames] = useState<Record<string, string[]>>({});
  const [name, setName] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [ingredientId, setIngredientId] = useState('');
  const [note, setNote] = useState<Note>(makeNote('', false));

  async function reload() {
    const [recipesOut, foodsOut] = await Promise.all([
      request('/recipe/', { token: session.token }),
      request('/food/', { token: session.token }),
    ]);
    const rows = (recipesOut.data as { recipes?: Record<string, unknown>[] })?.recipes || [];
    setRecipes(rows);
    setFoods(namesOf(foodsOut, 'foods'));
    // One read per recipe (00400): the answer carries the ingredient names joined in, so a
    // row reads "cà chua · gạo" instead of ids (rule 2).
    const byRecipe: Record<string, string[]> = {};
    await Promise.all(
      rows.map(async (recipe) => {
        const out = await request(`/recipe/ingredients/?recipeId=${encodeURIComponent(String(recipe._id))}`, { token: session.token });
        byRecipe[String(recipe._id)] = ((out.data as { ingredients?: { name: string | null }[] })?.ingredients || [])
          .map((row) => row.name)
          .filter((rowName): rowName is string => Boolean(rowName));
      })
    );
    setIngredientNames(byRecipe);
    setNote(failure(recipesOut));
  }

  useEffect(() => {
    if (session.token) reload();
  }, [session.token, session.base]);

  async function create() {
    if (!name.trim()) {
      setNote(makeNote('Công thức cần một tên để gọi', true));
      return;
    }
    const out = await request('/recipe/', { method: 'post', body: { name: name.trim() }, token: session.token });
    setNote(failure(out));
    if (out.code === '00357') {
      const recipe = (out.data as { recipe: Record<string, unknown> })?.recipe;
      setSelectedId(String(recipe._id));
      setName('');
      await reload();
    }
  }

  async function addIngredient() {
    if (!selectedId) {
      setNote(makeNote('Chạm vào công thức cần thêm nguyên liệu', true));
      return;
    }
    if (!ingredientId) {
      setNote(makeNote('Chưa chọn nguyên liệu nào', true));
      return;
    }
    const out = await request('/recipe/ingredients/', {
      method: 'post',
      body: { recipeId: selectedId, ingredients: [{ foodName: foods[ingredientId] }] },
      token: session.token,
    });
    setNote(failure(out));
    if (out.code === '00394') {
      setIngredientId('');
      await reload();
    }
  }

  async function remove() {
    if (!selectedId) return;
    const out = await request('/recipe/', { method: 'delete', body: { recipeId: selectedId }, token: session.token });
    setNote(failure(out));
    if (out.code === '00376') {
      setSelectedId('');
      setIngredientId('');
      await reload();
    }
  }

  const selected = recipes.find((row) => String(row._id) === selectedId);
  const options = Object.entries(foods).map(([id, name]) => ({ id, name }));

  return (
    <View style={styles.shell}>
      <Bar title="Công thức" sub="món mà nhóm của bạn lưu" />
      <Screen>
        <Notice note={note} />
        {recipes.length ? (
          <List>
            {recipes.map((recipe) => {
              const ids = String(recipe._id);
              const names = ingredientNames[ids] || [];
              return (
                <ListRow
                  key={ids}
                  title={String(recipe.name)}
                  sub={ids === selectedId ? (names.length ? names.join(' · ') : 'chưa có nguyên liệu') : names.length ? names.join(' · ') : 'chưa chọn'}
                  action="Chọn"
                  onPress={() => {
                    setSelectedId(ids);
                    setIngredientId('');
                  }}
                />
              );
            })}
          </List>
        ) : (
          <Empty title="Nhóm chưa lưu công thức nào" hint="Gõ tên món ở phía dưới, rồi lưu." />
        )}
        {selected ? (
          <>
            <ChipGroup label="Nguyên liệu cho công thức đã chọn" options={options} value={ingredientId} onChange={setIngredientId} />
            <Button label="Thêm nguyên liệu" onPress={addIngredient} />
            <Button label="Xóa công thức này" onPress={remove} outline />
          </>
        ) : null}
        <Field label="Tên công thức mới" value={name} onChangeText={setName} placeholder="ví dụ: Cá basa kho tộ" />
        <Button label="Lưu công thức" onPress={create} />
        <Button label="Về bữa ăn" onPress={() => router.push('/meal')} outline />
      </Screen>
    </View>
  );
}
