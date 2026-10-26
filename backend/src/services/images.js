// Image rule (D13): a disk folder with a stored path, local only, so nothing is lost on
// redeploy. Base64 inside a document is out, because a document is capped at 16 MiB.
// Multipart needs a body parser in the route layer; this module holds the rule and the path.
const path = require('node:path');

const MAX_FILE_BYTES = 16 * 1024 * 1024;

function storedName(name) {
  return String(name).replace(/[^a-z0-9._-]/gi, '_').toLowerCase();
}

async function storeImage(deps, ctx) {
  if (!ctx.input.image) return { code: '00025' };
  const size = Number(ctx.input.size || 0);
  if (size > MAX_FILE_BYTES) return { code: '00158' };
  const folder = process.env.UPLOAD_DIR || 'uploads';
  return { code: '00098', data: { saved: path.join(folder, storedName(ctx.input.image)) } };
}

module.exports = { storeImage, storedName, MAX_FILE_BYTES };
