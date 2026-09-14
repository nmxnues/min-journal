-- Emotion/behaviour tags become user-editable (add/rename/delete) instead of
-- a fixed 4-option constant (docs/decisions.md § Phase 5). The presets live
-- per-user on `settings`, seeded with the original four so existing users see
-- no change until they edit the list themselves.
--
-- `trades.tags` already stores plain strings with no foreign-key relationship
-- to this list (docs/decisions.md § Phase 4a's tag toggle writes the display
-- label directly), so editing or deleting a preset here never touches tags
-- already saved on a trade — there is nothing to migrate on that side.

alter table public.settings
  add column tag_presets text[] not null
  default array['On plan', 'Impatient', 'Chased entry', 'Early exit'];
