-- ============================================
-- QuickNotes RLS Policies Setup
-- Run this in your Supabase SQL Editor
-- (Dashboard → SQL Editor → New Query)
-- ============================================

-- ==========================================
-- 1. NOTES TABLE
-- ==========================================

-- Enable RLS (if not already enabled)
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view own notes" ON notes;
DROP POLICY IF EXISTS "Users can insert own notes" ON notes;
DROP POLICY IF EXISTS "Users can update own notes" ON notes;
DROP POLICY IF EXISTS "Users can delete own notes" ON notes;
DROP POLICY IF EXISTS "Users can view shared notes" ON notes;
DROP POLICY IF EXISTS "Users can update shared notes" ON notes;

-- Users can SELECT their own notes
CREATE POLICY "Users can view own notes" ON notes
  FOR SELECT USING (auth.uid() = user_id);

-- Users can INSERT their own notes
CREATE POLICY "Users can insert own notes" ON notes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can UPDATE their own notes
CREATE POLICY "Users can update own notes" ON notes
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can DELETE their own notes
CREATE POLICY "Users can delete own notes" ON notes
  FOR DELETE USING (auth.uid() = user_id);

-- Users can SELECT notes shared with them (via accepted_shares)
CREATE POLICY "Users can view shared notes" ON notes
  FOR SELECT USING (
    id IN (
      SELECT note_id FROM accepted_shares WHERE user_id = auth.uid()
    )
  );

-- Users can UPDATE notes shared with them (edit permission)
CREATE POLICY "Users can update shared notes" ON notes
  FOR UPDATE USING (
    id IN (
      SELECT note_id FROM accepted_shares 
      WHERE user_id = auth.uid() AND permission = 'edit'
    )
  );

-- ==========================================
-- 2. FOLDERS TABLE
-- ==========================================

ALTER TABLE folders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own folders" ON folders;
DROP POLICY IF EXISTS "Users can insert own folders" ON folders;
DROP POLICY IF EXISTS "Users can update own folders" ON folders;
DROP POLICY IF EXISTS "Users can delete own folders" ON folders;

CREATE POLICY "Users can view own folders" ON folders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own folders" ON folders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own folders" ON folders
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own folders" ON folders
  FOR DELETE USING (auth.uid() = user_id);

-- ==========================================
-- 3. TAGS TABLE
-- ==========================================

ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own tags" ON tags;
DROP POLICY IF EXISTS "Users can insert own tags" ON tags;
DROP POLICY IF EXISTS "Users can update own tags" ON tags;
DROP POLICY IF EXISTS "Users can delete own tags" ON tags;

CREATE POLICY "Users can view own tags" ON tags
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tags" ON tags
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tags" ON tags
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tags" ON tags
  FOR DELETE USING (auth.uid() = user_id);

-- ==========================================
-- 4. NOTE_VERSIONS TABLE
-- ==========================================

ALTER TABLE note_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own note versions" ON note_versions;
DROP POLICY IF EXISTS "Users can insert own note versions" ON note_versions;

CREATE POLICY "Users can view own note versions" ON note_versions
  FOR SELECT USING (
    note_id IN (SELECT id FROM notes WHERE user_id = auth.uid())
    OR note_id IN (SELECT note_id FROM accepted_shares WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert own note versions" ON note_versions
  FOR INSERT WITH CHECK (
    note_id IN (SELECT id FROM notes WHERE user_id = auth.uid())
  );

-- ==========================================
-- 5. SHARED_NOTES TABLE
-- ==========================================

ALTER TABLE shared_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view shares they created" ON shared_notes;
DROP POLICY IF EXISTS "Users can view shares sent to them" ON shared_notes;
DROP POLICY IF EXISTS "Users can insert shares" ON shared_notes;
DROP POLICY IF EXISTS "Users can update own shares" ON shared_notes;
DROP POLICY IF EXISTS "Users can delete own shares" ON shared_notes;

-- Users can see shares they created
CREATE POLICY "Users can view shares they created" ON shared_notes
  FOR SELECT USING (auth.uid() = shared_by);

-- Users can see shares sent to them (by email match)
CREATE POLICY "Users can view shares sent to them" ON shared_notes
  FOR SELECT USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR shared_with = auth.uid()
  );

-- Users can create shares (for their own notes)
CREATE POLICY "Users can insert shares" ON shared_notes
  FOR INSERT WITH CHECK (
    auth.uid() = shared_by
    AND note_id IN (SELECT id FROM notes WHERE user_id = auth.uid())
  );

-- Users can update shares they created
CREATE POLICY "Users can update own shares" ON shared_notes
  FOR UPDATE USING (auth.uid() = shared_by);

-- Users can delete shares they created
CREATE POLICY "Users can delete own shares" ON shared_notes
  FOR DELETE USING (auth.uid() = shared_by);

-- ==========================================
-- 6. ACCEPTED_SHARES TABLE
-- ==========================================

ALTER TABLE accepted_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own accepted shares" ON accepted_shares;
DROP POLICY IF EXISTS "Users can insert accepted shares" ON accepted_shares;
DROP POLICY IF EXISTS "Users can delete own accepted shares" ON accepted_shares;

CREATE POLICY "Users can view own accepted shares" ON accepted_shares
  FOR SELECT USING (auth.uid() = user_id);

-- Allow inserts from stored procedures (service role handles this)
-- If using stored procedures with SECURITY DEFINER, this policy
-- won't be needed for the RPC calls, but is good for safety
CREATE POLICY "Users can insert accepted shares" ON accepted_shares
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own accepted shares" ON accepted_shares
  FOR DELETE USING (auth.uid() = user_id);

-- ==========================================
-- 7. COLLABORATION_CURSORS TABLE
-- ==========================================

ALTER TABLE collaboration_cursors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view cursors for accessible notes" ON collaboration_cursors;
DROP POLICY IF EXISTS "Users can manage own cursor" ON collaboration_cursors;

CREATE POLICY "Users can view cursors for accessible notes" ON collaboration_cursors
  FOR SELECT USING (
    note_id IN (SELECT id FROM notes WHERE user_id = auth.uid())
    OR note_id IN (SELECT note_id FROM accepted_shares WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can manage own cursor" ON collaboration_cursors
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- Done! All RLS policies are now configured.
-- ============================================
