export const toggleStructuralCallout = (editor, tone = 'info') => {
  let chain = editor.chain().focus()
  if (editor.isActive('taskItem') && editor.can().liftListItem('taskItem')) {
    chain = chain.liftListItem('taskItem')
  } else if (editor.isActive('listItem') && editor.can().liftListItem('listItem')) {
    chain = chain.liftListItem('listItem')
  }
  return chain.toggleCallout({ tone }).run()
}
