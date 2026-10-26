const { z } = require('zod');

// One shared file read by both sides (D10), so a field rule cannot differ.
// Messages carry the response code so the shared rules do not name codes alone.
const codes = require('./codes.json');

function rule(schema, code) {
  return (value) => {
    const parsed = schema.safeParse(value);
    if (!parsed.success) return { code };
    return { code: null, data: parsed.data };
  };
}

const email = z.string().email();
const password = z.string().min(7).max(19);
const name = z.string().min(4).max(29);
const username = z.string().min(4).max(14);

const registerShape = (input) => {
  if (!input.email || !input.password || !input.name) return { code: '00025' };
  if (!email.safeParse(input.email).success) return { code: '00026' };
  if (!password.safeParse(input.password).success) return { code: '00027' };
  if (!name.safeParse(input.name).success) return { code: '00028' };
  return { code: null, data: input };
};

const loginShape = (input) => {
  if (!input.email || !input.password) return { code: '00038' };
  if (!email.safeParse(input.email).success) return { code: '00039' };
  if (!password.safeParse(input.password).success) return { code: '00040' };
  return { code: null, data: input };
};

// Quantity and date rules for the fridge and the shopping path.
const quantity = z.coerce.number().positive().finite();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const lotShape = (input) => {
  if (!input.foodId || !input.quantity || !input.useUntil) return { code: '00025' };
  if (!quantity.safeParse(input.quantity).success) return { code: '00304' };
  if (!isoDate.safeParse(input.useUntil).success) return { code: '00193' };
  return { code: null, data: input };
};

const taskShape = (input) => {
  if (!Array.isArray(input.tasks) || input.tasks.length === 0) return { code: '00278' };
  const rows = [];
  for (const task of input.tasks) {
    if (!task.foodId || !task.quantity || !task.buyerUsername) return { code: '00278' };
    if (!quantity.safeParse(task.quantity).success) return { code: '00304' };
    rows.push({ ...task, request_id: task.requestId || null });
  }
  return { code: null, data: { tasks: rows } };
};

// Search rule (D76): a whole stemmed word, so a keyword needs a full word.
// A keyword shorter than three characters cannot match a word, so it reads as too short.
const searchShape = (input) => {
  const keyword = String(input.keyword || '').trim();
  if (keyword.length < 3) return { code: '00399' };
  return { code: null, data: { keyword } };
};

module.exports = { registerShape, loginShape, lotShape, taskShape, searchShape, quantity, isoDate, codes };
