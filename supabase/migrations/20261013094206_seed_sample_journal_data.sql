-- Sample AI Learning Journal data (non-sensitive, generic).
--
-- The 3 existing notes (Shopping list, Meeting notes, Ideas) are kept
-- untouched and stay uncollected. Rows added here make collections, tags,
-- AND filtering, search and empty states easy to demonstrate:
--   prompting + rag        -> "What is RAG?" only
--   prompting + evaluation -> "Few-shot vs zero-shot prompting" only
--   "AI Agents" has no notes (empty-collection state)
-- Do not store real personal notes while anonymous access is enabled.

insert into public.collections (name) values
  ('Prompt Engineering'),
  ('LLM Concepts'),
  ('AI Agents');

insert into public.tags (name) values
  ('prompting'),
  ('rag'),
  ('evaluation'),
  ('agents');

insert into public.notes (title, body, collection_id) values
  ('Prompt engineering basics',
   'Be specific, give examples, state the output format, and iterate.',
   (select id from public.collections where name = 'Prompt Engineering')),
  ('Few-shot vs zero-shot prompting',
   'Few-shot prompts include worked examples; zero-shot relies on instructions alone.',
   (select id from public.collections where name = 'Prompt Engineering')),
  ('What is RAG?',
   'Retrieval-augmented generation fetches relevant documents and adds them to the prompt to ground answers.',
   (select id from public.collections where name = 'LLM Concepts')),
  ('Evaluating LLM output',
   'Compare answers against a rubric or reference set and track failures over time.',
   (select id from public.collections where name = 'LLM Concepts')),
  ('Agents and tool use',
   'An agent loops: decide, call a tool, read the result, decide again.',
   null);

insert into public.note_tags (note_id, tag_id)
select n.id, t.id
from (values
  ('Prompt engineering basics', 'prompting'),
  ('Few-shot vs zero-shot prompting', 'prompting'),
  ('Few-shot vs zero-shot prompting', 'evaluation'),
  ('What is RAG?', 'rag'),
  ('What is RAG?', 'prompting'),
  ('Evaluating LLM output', 'evaluation'),
  ('Agents and tool use', 'agents')
) as v (note_title, tag_name)
join public.notes n on n.title = v.note_title
join public.tags t on lower(t.name) = v.tag_name;
