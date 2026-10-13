-- Palette colours for collections and tags.
--
-- Colours are stored as one of eight palette keys (not hex values); the CHECK
-- constraint is the allow-list. The UI maps each key to Tailwind classes in
-- lib/palette.ts. No grants, policies or RLS settings are touched: the existing
-- (temporary) update policies and grants already cover these columns.

-- tags.color existed as a nullable hex column (all rows NULL). Replace its check.
alter table public.tags drop constraint tags_color_check;

alter table public.collections add column color text;

-- Give existing rows distinct, deterministic colours (by id, rotating).
update public.collections c
set color = (array['blue','green','amber','violet','teal','pink','red','slate'])[((r.n - 1) % 8) + 1]
from (select id, row_number() over (order by id) as n from public.collections) r
where c.id = r.id;

update public.tags t
set color = (array['violet','teal','pink','red','blue','green','amber','slate'])[((r.n - 1) % 8) + 1]
from (select id, row_number() over (order by id) as n from public.tags) r
where t.id = r.id;

alter table public.collections
  alter column color set default 'slate',
  alter column color set not null,
  add constraint collections_color_check
    check (color in ('slate','red','amber','green','teal','blue','violet','pink'));

alter table public.tags
  alter column color set default 'slate',
  alter column color set not null,
  add constraint tags_color_check
    check (color in ('slate','red','amber','green','teal','blue','violet','pink'));
