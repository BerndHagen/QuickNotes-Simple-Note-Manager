import SpatialEditor from '../spatial/SpatialEditor'

export default function CanvasEditor({ note, noteTitle, onTitleChange, readOnly, navigationTarget, onNavigationComplete }) {
  return <SpatialEditor note={note} kind="canvas" noteTitle={noteTitle} onTitleChange={onTitleChange} readOnly={readOnly} navigationTarget={navigationTarget} onNavigationComplete={onNavigationComplete} />
}
