'use strict';

// `.in()` filters go in the URL, so long id lists are split up. Each chunk is
// also paged, because PostgREST returns at most 1000 rows per request (a
// chunk of 150 learners can have more email_log rows than that). `orderBy`
// must be unique per row so pages don't overlap or skip.
const PAGE_ROWS = 1000;
async function selectInChunks(supabaseAdmin, table, columns, idColumn, ids, orderBy = [idColumn], size = 150) {
  const out = [];
  for (let i = 0; i < ids.length; i += size) {
    const chunk = ids.slice(i, i + size);
    for (let from = 0; ; from += PAGE_ROWS) {
      let q = supabaseAdmin.from(table).select(columns).in(idColumn, chunk);
      for (const col of orderBy) q = q.order(col, { ascending: true });
      const { data, error } = await q.range(from, from + PAGE_ROWS - 1);
      if (error) throw error;
      out.push(...(data || []));
      if (!data || data.length < PAGE_ROWS) break;
    }
  }
  return out;
}

module.exports = { selectInChunks, PAGE_ROWS };
