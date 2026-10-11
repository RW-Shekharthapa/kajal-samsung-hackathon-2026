const express = require('express');
const app = express();
app.get('/api/db', async (_q, r) => { const { Client } = require('pg'); const c = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 3000 }); try { await c.connect(); await c.query('select 1'); r.json({ db: 'ok' }); } catch (e) { r.status(503).json({ db: 'error', message: e.message }); } finally { c.end().catch(() => {}); } });
const port = process.env.PORT || 8080;
app.listen(port, '0.0.0.0', () => console.log('API on :' + port));
