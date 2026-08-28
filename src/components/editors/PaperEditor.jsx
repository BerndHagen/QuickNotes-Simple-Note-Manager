import SpatialEditor from '../spatial/SpatialEditor'

export default function PaperEditor({ note, noteTitle, onTitleChange, readOnly, navigationTarget, onNavigationComplete }) {
  return <SpatialEditor note={note} kind="paper" noteTitle={noteTitle} onTitleChange={onTitleChange} readOnly={readOnly} navigationTarget={navigationTarget} onNavigationComplete={onNavigationComplete} />
}
