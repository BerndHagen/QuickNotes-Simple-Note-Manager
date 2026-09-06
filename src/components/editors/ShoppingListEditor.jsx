import { useEffect, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Edit3,
  Plus,
  Settings2,
  Trash2,
  Undo2,
} from 'lucide-react'
import { Button, CheckboxMark, IconButton, Switch } from '../ui'
import {
  generateId,
  normalizeOptionalAmount,
  normalizePositiveQuantity,
  SHOPPING_CATEGORIES,
} from './noteTypes'
import StructuredWorkspaceShell, { WorkspaceSection } from './StructuredWorkspaceShell'
import { useLatestValue } from './useLatestValue'
import { useEditorDataSync } from './useEditorDataSync'

const UNITS = ['pcs', 'kg', 'g', 'lb', 'oz', 'L', 'ml', 'gal', 'pack', 'box', 'bag', 'bottle', 'can', 'bunch', 'dozen']
const CURRENCY_SYMBOLS = { USD: '$', EUR: '€', GBP: '£', JPY: '¥' }

export default function ShoppingListEditor({ data, onChange, noteTitle, onTitleChange, readOnly }) {
  const [shoppingData, setShoppingData] = useState({
    items: data?.items || [],
    categories: data?.categories || SHOPPING_CATEGORIES,
    budget: normalizeOptionalAmount(data?.budget),
    currency: data?.currency || 'USD',
    showPrices: data?.showPrices ?? true,
  })
  const [newItemName, setNewItemName] = useState('')
  const [newItemCategory, setNewItemCategory] = useState('other')
  const [newItemQuantity, setNewItemQuantity] = useState('1')
  const [newItemUnit, setNewItemUnit] = useState('pcs')
  const [newItemPrice, setNewItemPrice] = useState('')
  const [showNewItemDetails, setShowNewItemDetails] = useState(false)
  const [expandedItemId, setExpandedItemId] = useState(null)
  const [expandedCategories, setExpandedCategories] = useState(
    new Set((data?.categories || SHOPPING_CATEGORIES).map((category) => category.id))
  )
  const [showSettings, setShowSettings] = useState(false)
  const [lastRemoved, setLastRemoved] = useState([])
  const itemInputRef = useRef(null)
  const onChangeRef = useLatestValue(onChange)
  const skipChangeRef = useEditorDataSync(data, shoppingData, setShoppingData)
  const isInitialMount = useRef(true)

  useEffect(() => {
    if (isInitialMount.current) { isInitialMount.current = false; return }
    if (skipChangeRef.current) { skipChangeRef.current = false; return }
    onChangeRef.current?.(shoppingData)
  }, [onChangeRef, shoppingData, skipChangeRef])

  const update = (field, value) => {
    setShoppingData((current) => ({
      ...current,
      [field]: typeof value === 'function' ? value(current[field]) : value,
    }))
  }

  const updateItem = (id, updates) => {
    update('items', (items) => items.map((item) => item.id === id ? { ...item, ...updates } : item))
  }

  const addItem = () => {
    if (!newItemName.trim()) return
    update('items', (items) => [...items, {
      id: generateId(),
      name: newItemName.trim(),
      category: newItemCategory,
      quantity: normalizePositiveQuantity(newItemQuantity),
      unit: newItemUnit,
      price: normalizeOptionalAmount(newItemPrice),
      checked: false,
      note: '',
      createdAt: new Date().toISOString(),
    }])
    setNewItemName('')
    setNewItemQuantity('1')
    setNewItemPrice('')
    itemInputRef.current?.focus()
  }

  const deleteItem = (id) => {
    update('items', (items) => items.filter((item) => item.id !== id))
    setExpandedItemId((current) => current === id ? null : current)
  }

  const toggleChecked = (id) => {
    update('items', (items) => items.map((item) =>
      item.id === id ? { ...item, checked: !item.checked } : item
    ))
  }

  const moveItemInCategory = (id, direction) => {
    update('items', (items) => {
      const sourceIndex = items.findIndex((item) => item.id === id)
      if (sourceIndex < 0) return items
      const categoryIndexes = items
        .map((item, index) => item.category === items[sourceIndex].category ? index : -1)
        .filter((index) => index >= 0)
      const categoryPosition = categoryIndexes.indexOf(sourceIndex)
      const targetIndex = categoryIndexes[categoryPosition + direction]
      if (targetIndex == null) return items
      const next = [...items]
      ;[next[sourceIndex], next[targetIndex]] = [next[targetIndex], next[sourceIndex]]
      return next
    })
  }

  const removePurchased = () => {
    const purchased = shoppingData.items.filter((item) => item.checked)
    if (!purchased.length) return
    setLastRemoved(purchased)
    update('items', (items) => items.filter((item) => !item.checked))
    setExpandedItemId(null)
  }

  const restoreRemoved = () => {
    if (!lastRemoved.length) return
    update('items', (items) => [...items, ...lastRemoved])
    setLastRemoved([])
  }

  const markPurchasedAsNeeded = () => {
    update('items', (items) => items.map((item) => ({ ...item, checked: false })))
  }

  const toggleCategory = (categoryId) => {
    setExpandedCategories((current) => {
      const next = new Set(current)
      if (next.has(categoryId)) next.delete(categoryId)
      else next.add(categoryId)
      return next
    })
  }

  const total = shoppingData.items.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0)
  const purchasedTotal = shoppingData.items
    .filter((item) => item.checked)
    .reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0)
  const remainingTotal = total - purchasedTotal
  const checkedCount = shoppingData.items.filter((item) => item.checked).length
  const totalCount = shoppingData.items.length
  const currencySymbol = CURRENCY_SYMBOLS[shoppingData.currency] || shoppingData.currency
  const hasPriceData = shoppingData.budget != null || shoppingData.items.some((item) => item.price != null)

  return (
    <StructuredWorkspaceShell
      className="qn-type-editor qn-type-shopping"
      typeLabel="Shopping workspace"
      title={noteTitle}
      fallback="Shopping list"
      onTitleChange={onTitleChange}
      readOnly={readOnly}
      summary={(
        <>
          <span>{totalCount - checkedCount} needed</span>
          <span>{checkedCount} purchased</span>
          {shoppingData.showPrices && hasPriceData && <span>{currencySymbol}{remainingTotal.toFixed(2)} remaining</span>}
        </>
      )}
    >
      <WorkspaceSection title="Add items" description="Capture the item first; details are optional.">
        <form className="qn-shopping-add" onSubmit={(event) => { event.preventDefault(); addItem() }}>
          <div className="qn-shopping-add-primary">
            <label className="qn-sr-only" htmlFor="qn-shopping-new-item">Item name</label>
            <input
              id="qn-shopping-new-item"
              ref={itemInputRef}
              type="text"
              value={newItemName}
              onChange={(event) => setNewItemName(event.target.value)}
              placeholder="Item name"
              autoComplete="off"
            />
            <Button type="submit" variant="primary" icon={Plus} disabled={!newItemName.trim()}>Add item</Button>
            <Button
              variant="secondary"
              icon={Settings2}
              aria-expanded={showNewItemDetails}
              onClick={() => setShowNewItemDetails((open) => !open)}
            >
              Details
            </Button>
          </div>
          {showNewItemDetails && (
            <div className="qn-shopping-add-details">
              <LabeledControl label="Category">
                <select value={newItemCategory} onChange={(event) => setNewItemCategory(event.target.value)}>
                  {shoppingData.categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </LabeledControl>
              <LabeledControl label="Quantity">
                <input
                  type="number"
                  value={newItemQuantity}
                  onChange={(event) => setNewItemQuantity(event.target.value)}
                  min="0.1"
                  step="0.1"
                />
              </LabeledControl>
              <LabeledControl label="Unit">
                <select value={newItemUnit} onChange={(event) => setNewItemUnit(event.target.value)}>
                  {UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                </select>
              </LabeledControl>
              <LabeledControl label={`Estimated price (${currencySymbol})`}>
                <input
                  type="number"
                  value={newItemPrice}
                  onChange={(event) => setNewItemPrice(event.target.value)}
                  min="0"
                  step="0.01"
                  placeholder="Optional"
                />
              </LabeledControl>
            </div>
          )}
        </form>
      </WorkspaceSection>

      {showSettings && (
        <WorkspaceSection title="List settings" actions={<Button size="sm" variant="ghost" onClick={() => setShowSettings(false)}>Close</Button>}>
          <div className="qn-shopping-settings">
            <LabeledControl label="Currency">
              <select value={shoppingData.currency} onChange={(event) => update('currency', event.target.value)}>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="JPY">JPY (¥)</option>
              </select>
            </LabeledControl>
            <LabeledControl label="Budget">
              <input
                type="number"
                value={shoppingData.budget ?? ''}
                onChange={(event) => update('budget', normalizeOptionalAmount(event.target.value))}
                min="0"
                step="0.01"
                placeholder="Optional"
              />
            </LabeledControl>
            <div className="qn-shopping-setting-toggle">
              <div>
                <strong>Show prices in list</strong>
                <span>Keep estimates visible beside each item.</span>
              </div>
              <Switch
                checked={shoppingData.showPrices}
                onChange={(checked) => update('showPrices', checked)}
                label="Show prices in list"
              />
            </div>
          </div>
        </WorkspaceSection>
      )}

      <WorkspaceSection
        title="Items"
        description={totalCount ? `${checkedCount} of ${totalCount} purchased` : 'Your list is ready.'}
        actions={(
          <>
            <Button size="sm" variant="ghost" icon={Settings2} onClick={() => setShowSettings((open) => !open)}>Settings</Button>
            {checkedCount > 0 && (
              <>
                <Button size="sm" variant="secondary" onClick={markPurchasedAsNeeded}>Mark as needed</Button>
                <Button size="sm" variant="danger-ghost" icon={Trash2} onClick={removePurchased}>Remove purchased</Button>
              </>
            )}
            {lastRemoved.length > 0 && (
              <Button size="sm" variant="secondary" icon={Undo2} onClick={restoreRemoved}>Restore {lastRemoved.length}</Button>
            )}
          </>
        )}
      >
        {totalCount === 0 ? (
          <div className="qn-structured-empty">
            <strong>No items yet</strong>
            Add an item above to begin.
          </div>
        ) : (
          <div className="qn-shopping-list">
            {shoppingData.categories.map((category) => {
              const categoryItems = shoppingData.items.filter((item) => item.category === category.id)
              if (!categoryItems.length) return null
              const isExpanded = expandedCategories.has(category.id)
              const checkedInCategory = categoryItems.filter((item) => item.checked).length
              const categoryTotal = categoryItems.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0)
              return (
                <section key={category.id} className="qn-shopping-group">
                  <button
                    type="button"
                    className="qn-shopping-group-heading"
                    aria-expanded={isExpanded}
                    onClick={() => toggleCategory(category.id)}
                  >
                    {isExpanded
                      ? <ChevronDown className="h-4 w-4" aria-hidden="true" />
                      : <ChevronRight className="h-4 w-4" aria-hidden="true" />}
                    <span>{category.name}</span>
                    <small>{checkedInCategory}/{categoryItems.length}</small>
                    {shoppingData.showPrices && hasPriceData && <strong>{currencySymbol}{categoryTotal.toFixed(2)}</strong>}
                  </button>
                  {isExpanded && categoryItems.map((item, index) => (
                    <ShoppingItem
                      key={item.id}
                      item={item}
                      categories={shoppingData.categories}
                      currencySymbol={currencySymbol}
                      showPrice={shoppingData.showPrices}
                      expanded={expandedItemId === item.id}
                      firstInCategory={index === 0}
                      lastInCategory={index === categoryItems.length - 1}
                      onToggle={() => toggleChecked(item.id)}
                      onToggleDetails={() => setExpandedItemId((current) => current === item.id ? null : item.id)}
                      onUpdate={(updates) => updateItem(item.id, updates)}
                      onMove={(direction) => moveItemInCategory(item.id, direction)}
                      onDelete={() => deleteItem(item.id)}
                    />
                  ))}
                </section>
              )
            })}
          </div>
        )}
        {shoppingData.showPrices && hasPriceData && totalCount > 0 && (
          <footer className="qn-shopping-totals">
            {checkedCount > 0 && <span>Purchased <strong>{currencySymbol}{purchasedTotal.toFixed(2)}</strong></span>}
            <span>Remaining <strong>{currencySymbol}{remainingTotal.toFixed(2)}</strong></span>
            {shoppingData.budget != null && (
              <span className={total > shoppingData.budget ? 'text-danger-text' : ''}>
                Budget <strong>{currencySymbol}{total.toFixed(2)} / {currencySymbol}{shoppingData.budget.toFixed(2)}</strong>
              </span>
            )}
          </footer>
        )}
      </WorkspaceSection>
    </StructuredWorkspaceShell>
  )
}

function LabeledControl({ label, children }) {
  return (
    <label className="qn-shopping-field">
      <span>{label}</span>
      {children}
    </label>
  )
}

function ShoppingItem({
  item,
  categories,
  currencySymbol,
  showPrice,
  expanded,
  firstInCategory,
  lastInCategory,
  onToggle,
  onToggleDetails,
  onUpdate,
  onMove,
  onDelete,
}) {
  const lineTotal = item.price == null ? null : item.price * item.quantity
  return (
    <article className={`qn-shopping-item qn-structured-row ${expanded ? 'qn-shopping-item--expanded' : ''}`}>
      <div className="qn-shopping-item-main">
        <button
          type="button"
          role="checkbox"
          aria-checked={item.checked}
          aria-label={item.checked ? `Mark ${item.name} as needed` : `Mark ${item.name} as purchased`}
          className="qn-shopping-check"
          onClick={onToggle}
        >
          <CheckboxMark checked={item.checked} />
        </button>
        <button type="button" className="qn-shopping-item-label" aria-expanded={expanded} onClick={onToggleDetails}>
          <strong className={item.checked ? 'line-through' : ''}>{item.name}</strong>
          <span>{item.quantity} {item.unit}{showPrice && lineTotal != null ? ` · ${currencySymbol}${lineTotal.toFixed(2)}` : ''}</span>
        </button>
        <IconButton icon={Edit3} size="sm" label={`${expanded ? 'Close details for' : 'Edit'} ${item.name}`} active={expanded} onClick={onToggleDetails} />
      </div>

      {expanded && (
        <div className="qn-shopping-item-editor">
          <LabeledControl label="Item name">
            <input value={item.name} maxLength={180} onChange={(event) => onUpdate({ name: event.target.value })} />
          </LabeledControl>
          <LabeledControl label="Category">
            <select value={item.category} onChange={(event) => onUpdate({ category: event.target.value })}>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </LabeledControl>
          <LabeledControl label="Quantity">
            <input
              type="number"
              value={item.quantity}
              min="0.1"
              step="0.1"
              onChange={(event) => onUpdate({ quantity: normalizePositiveQuantity(event.target.value) })}
            />
          </LabeledControl>
          <LabeledControl label="Unit">
            <select value={item.unit} onChange={(event) => onUpdate({ unit: event.target.value })}>
              {UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
            </select>
          </LabeledControl>
          <LabeledControl label={`Estimated price (${currencySymbol})`}>
            <input
              type="number"
              value={item.price ?? ''}
              min="0"
              step="0.01"
              placeholder="Optional"
              onChange={(event) => onUpdate({ price: normalizeOptionalAmount(event.target.value) })}
            />
          </LabeledControl>
          <LabeledControl label="Note">
            <input value={item.note || ''} maxLength={500} placeholder="Optional" onChange={(event) => onUpdate({ note: event.target.value })} />
          </LabeledControl>
          <div className="qn-shopping-item-actions">
            <IconButton icon={ArrowUp} label={`Move ${item.name} up`} disabled={firstInCategory} onClick={() => onMove(-1)} />
            <IconButton icon={ArrowDown} label={`Move ${item.name} down`} disabled={lastInCategory} onClick={() => onMove(1)} />
            <Button variant="danger-ghost" icon={Trash2} onClick={onDelete}>Delete item</Button>
          </div>
        </div>
      )}
    </article>
  )
}
