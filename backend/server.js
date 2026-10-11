const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.get('/api/db', async (_q, r) => { const { Client } = require('pg'); const c = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 3000 }); try { await c.connect(); await c.query('select 1'); r.json({ db: 'ok' }); } catch (e) { r.status(503).json({ db: 'error', message: e.message }); } finally { c.end().catch(() => {}); } });

const init = pool.query(`
  create table if not exists folders (
    id serial primary key,
    name text not null,
    parent_id integer references folders(id) on delete cascade,
    created_at timestamptz not null default now()
  );
  create unique index if not exists folders_unique_name
    on folders (coalesce(parent_id, 0), lower(name));
`);

const wrap = (fn) => async (req, res) => {
  try { await init; await fn(req, res); }
  catch (e) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
};

const cleanName = (v) => (typeof v === 'string' ? v.trim() : '');
const invalidName = (n) => !n ? 'Name is required' : n.length > 100 ? 'Name must be 100 characters or fewer' : /[\/\\]/.test(n) ? 'Name cannot contain / or \\' : null;
const parseId = (v) => (/^\d+$/.test(String(v)) ? Number(v) : null);

// List children of a folder (parentId omitted = root) plus breadcrumb path.
app.get('/api/folders', wrap(async (req, res) => {
  const parentId = req.query.parentId === undefined ? null : parseId(req.query.parentId);
  if (req.query.parentId !== undefined && parentId === null) return res.status(400).json({ error: 'Invalid parentId' });
  let path = [];
  if (parentId !== null) {
    const p = await pool.query(`
      with recursive up as (
        select id, name, parent_id, 1 as depth from folders where id = $1
        union all
        select f.id, f.name, f.parent_id, up.depth + 1 from folders f join up on f.id = up.parent_id
      ) select id, name from up order by depth desc`, [parentId]);
    if (!p.rowCount) return res.status(404).json({ error: 'Folder not found' });
    path = p.rows;
  }
  const { rows } = await pool.query(`
    select f.id, f.name, f.parent_id as "parentId", f.created_at as "createdAt",
           (select count(*)::int from folders c where c.parent_id = f.id) as "childCount"
    from folders f where f.parent_id is not distinct from $1 order by lower(f.name)`, [parentId]);
  res.json({ path, folders: rows });
}));

app.post('/api/folders', wrap(async (req, res) => {
  const name = cleanName(req.body.name);
  const err = invalidName(name);
  if (err) return res.status(400).json({ error: err });
  const parentId = req.body.parentId == null ? null : parseId(req.body.parentId);
  if (req.body.parentId != null && parentId === null) return res.status(400).json({ error: 'Invalid parentId' });
  if (parentId !== null && !(await pool.query('select 1 from folders where id=$1', [parentId])).rowCount)
    return res.status(404).json({ error: 'Parent folder not found' });
  try {
    const { rows } = await pool.query('insert into folders (name, parent_id) values ($1,$2) returning id, name, parent_id as "parentId"', [name, parentId]);
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'A folder with that name already exists here' });
    throw e;
  }
}));

app.patch('/api/folders/:id', wrap(async (req, res) => {
  const id = parseId(req.params.id);
  const name = cleanName(req.body.name);
  const err = invalidName(name);
  if (id === null) return res.status(400).json({ error: 'Invalid id' });
  if (err) return res.status(400).json({ error: err });
  try {
    const { rows } = await pool.query('update folders set name=$1 where id=$2 returning id, name, parent_id as "parentId"', [name, id]);
    if (!rows.length) return res.status(404).json({ error: 'Folder not found' });
    res.json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'A folder with that name already exists here' });
    throw e;
  }
}));

// Deletes the folder and all its subfolders (ON DELETE CASCADE).
app.delete('/api/folders/:id', wrap(async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'Invalid id' });
  const r = await pool.query('delete from folders where id=$1', [id]);
  if (!r.rowCount) return res.status(404).json({ error: 'Folder not found' });
  res.status(204).end();
}));

const port = process.env.PORT || 8080;
app.listen(port, '0.0.0.0', () => console.log('API on :' + port));
