-- Migration 0045: reconcile the duplicate caste lookup category.
--
-- ckSync wrote CK's caste values into the category `cast_category`, while the
-- onboarding form and the Employee Master both read `caste_category`. The
-- result was a category nothing displayed, plus a stray duplicate row in the
-- Lookup Master. ckSync now writes `caste_category`; this cleans up what the
-- old code left behind.
--
-- Values are moved rather than deleted so a database that did receive rows
-- under the wrong code keeps them. Codes are unique per category, so a value
-- that already exists under the correct category is dropped instead of moved.

DELETE l FROM lookups l
JOIN lookup_categories wrong ON wrong.id = l.category_id AND wrong.code = 'cast_category'
JOIN lookup_categories right_cat ON right_cat.code = 'caste_category'
JOIN lookups keep ON keep.category_id = right_cat.id AND keep.code = l.code;

UPDATE lookups l
JOIN lookup_categories wrong ON wrong.id = l.category_id AND wrong.code = 'cast_category'
JOIN lookup_categories right_cat ON right_cat.code = 'caste_category'
SET l.category_id = right_cat.id;

DELETE FROM lookup_categories WHERE code = 'cast_category';
