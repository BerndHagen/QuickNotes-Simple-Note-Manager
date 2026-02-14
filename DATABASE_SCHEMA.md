# QuickNotes Database Schema

## 📊 Aktive Tabellen

### 1. **notes** - Haupttabelle für Notizen
```sql
- id (UUID)
- user_id (UUID) → Besitzer der Notiz
- folder_id (UUID) → Optional: Ordner-Zuordnung
- title (TEXT)
- content (TEXT)
- starred (BOOLEAN)
- pinned (BOOLEAN)
- deleted (BOOLEAN) → Soft-delete für Papierkorb
- archived (BOOLEAN)
- reminder (TIMESTAMPTZ)
- tags (TEXT[]) → Array von Tag-Namen
- note_type (TEXT) → Type of note: standard, todo, project, meeting, journal, brainstorm, shopping, weekly
- note_data (JSONB) → Structured data for specialized note types
- created_at, updated_at
```
**Status:** ✅ Aktiv, enthält alle deine Notizen

**Note Types:**
- `standard` - Regular rich text notes (default)
- `todo` - To-Do List with tasks, priorities, deadlines
- `project` - Project Planner with Kanban, milestones, team
- `meeting` - Meeting Notes with agenda, action items, timer
- `journal` - Daily Journal with mood, gratitude, streaks
- `brainstorm` - Brainstorming with idea cards, voting
- `shopping` - Shopping List with categories, budget
- `weekly` - Weekly Planner with goals, schedule, review

---

### 2. **folders** - Ordner/Notebooks
```sql
- id (UUID)
- user_id (UUID)
- name (TEXT)
- icon (TEXT) → z.B. "Briefcase", "Home"
- color (TEXT) → Hex-Farbe
- parent_id (UUID) → Für verschachtelte Ordner
- created_at, updated_at
```
**Status:** ✅ Aktiv, enthält deine Ordner

---

### 3. **tags** - Tag-Definitionen
```sql
- id (UUID)
- user_id (UUID)
- name (TEXT)
- color (TEXT) → Hex-Farbe
- created_at
```
**Status:** ✅ Aktiv, enthält Tag-Definitionen mit Farben

**Wichtig:** Die eigentliche Zuordnung von Tags zu Notizen erfolgt über das `tags` Array-Feld in der `notes` Tabelle, NICHT über eine Junction-Table!

---

### 4. **note_versions** - Versions-Historie
```sql
- id (UUID)
- note_id (UUID) → Referenz zur Notiz
- content (TEXT) → Alter Inhalt
- title (TEXT) → Alter Titel
- created_at
```
**Status:** ✅ Aktiv, wird automatisch bei Änderungen gefüllt (max. 50 Versionen pro Notiz)

---

### 5. **shared_notes** - Share-Einladungen
```sql
- id (UUID)
- note_id (UUID) → Geteilte Notiz
- shared_by (UUID) → Wer teilt
- shared_with (UUID) → Optional: User-ID des Empfängers (nach Accept)
- email (TEXT) → Email-Adresse des Empfängers
- permission ('view' | 'edit')
- status ('pending' | 'accepted' | 'declined')
- share_link (TEXT) → Eindeutiger Share-Token
- created_at, updated_at
```
**Status:** ✅ NEU (Share-Feature), wird beim Teilen gefüllt

**Constraint:** Entweder `shared_with` ODER `email` muss gesetzt sein (nicht beides)

---

### 6. **accepted_shares** - Akzeptierte Shares
```sql
- id (UUID)
- note_id (UUID) → Geteilte Notiz
- user_id (UUID) → Empfänger der Freigabe
- permission ('view' | 'edit')
- created_at
```
**Status:** ✅ NEU (Share-Feature), denormalisiert für Performance

**Zweck:** Schneller Zugriff auf akzeptierte Shares ohne JOIN über shared_notes

---

### 7. **collaboration_cursors** - Live-Collaboration
```sql
- id (UUID)
- note_id (UUID)
- user_id (UUID)
- cursor_position (JSONB) → Optional: Cursor-Position im Editor
- last_seen (TIMESTAMPTZ)
```
**Status:** ✅ NEU (Share-Feature), wird bei Live-Editing gefüllt

**Zweck:** Zeigt aktive Bearbeiter einer Notiz in Echtzeit (wer schaut gerade diese Notiz an)

---

## 🗑️ Gelöschte Tabellen

### ❌ note_tags (ENTFERNT)
**Grund:** Wurde nie verwendet! Tags werden als Array direkt in `notes.tags` gespeichert.

---

## 🔐 Row Level Security (RLS)

Alle Tabellen haben RLS aktiviert:

- **notes:** User sieht nur eigene Notizen + akzeptierte geteilte Notizen
- **folders:** User sieht nur eigene Ordner
- **tags:** User sieht nur eigene Tags
- **note_versions:** User sieht nur Versionen eigener Notizen
- **shared_notes:** User sieht nur Shares die er erstellt hat oder empfangen hat
- **accepted_shares:** User sieht nur eigene akzeptierte Shares
- **collaboration_cursors:** User sieht Cursors nur bei Notizen mit Zugriff

---

## 📋 Funktionen (Stored Procedures)

### accept_share_invitation(p_share_id UUID)
Akzeptiert eine Share-Einladung:
1. Setzt `shared_notes.status = 'accepted'`
2. Trägt `shared_with` User-ID ein
3. Erstellt Eintrag in `accepted_shares`

### decline_share_invitation(p_share_id UUID)
Lehnt eine Share-Einladung ab:
- Setzt `shared_notes.status = 'declined'`

### leave_shared_note(p_note_id UUID)
Verlässt eine geteilte Notiz:
1. Löscht aus `accepted_shares`
2. Setzt `shared_notes.status = 'declined'`

---

## 🔄 Trigger

### update_updated_at_column()
Automatisches Update von `updated_at` bei:
- notes
- folders
- shared_notes

### create_note_version()
Automatisches Erstellen einer Version bei Änderung von `notes.content`
- Speichert max. 50 Versionen pro Notiz

---

## 📊 Zusammenfassung

**Gesamtzahl aktiver Tabellen:** 7

**Datenmenge:**
- **notes:** Enthält deine Notizen ✅
- **folders:** Enthält deine Ordner ✅
- **tags:** Enthält deine Tag-Definitionen ✅
- **note_versions:** Enthält Historie ✅
- **shared_notes:** Neue Share-Einladungen 🆕
- **accepted_shares:** Akzeptierte Shares 🆕
- **collaboration_cursors:** Live-Collaboration (bei Nutzung gefüllt) 🆕

**Aufgeräumt:** ✅ `note_tags` wurde entfernt (war redundant)
