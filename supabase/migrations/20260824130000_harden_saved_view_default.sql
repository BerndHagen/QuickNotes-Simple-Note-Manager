-- Keep direct/API inserts valid even when a caller relies on the column
-- default. The original empty rules array conflicted with the table's own
-- one-to-twelve-rule constraint.
alter table public.saved_views
  alter column criteria set default jsonb_build_object(
    'match', 'all',
    'scope', 'active',
    'sort', 'updated-desc',
    'rules', jsonb_build_array(
      jsonb_build_object(
        'id', 'default',
        'field', 'text',
        'operator', 'contains',
        'value', ''
      )
    )
  );
