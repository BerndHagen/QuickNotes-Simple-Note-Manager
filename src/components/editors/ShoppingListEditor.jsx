import { useState, useEffect, useRef } from 'react'
import { buttonClasses } from '../ui'
import {
  ShoppingCart,
  Plus,
  Trash2,
  Check,
  ChevronDown,
  ChevronRight,
  Edit3,
  Settings2,
  Undo2,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
import {
  generateId,
  normalizeOptionalAmount,
  normalizePositiveQuantity,
  SHOPPING_CATEGORIES,
} from './noteTypes'
import { useLatestValue } from './useLatestValue'
import { useEditorDataSync } from './useEditorDataSync'
import FocusedNoteTitle from './FocusedNoteTitle'
import WorkspaceMetrics from './WorkspaceMetrics'
const UNITS = ['pcs', 'kg', 'g', 'lb', 'oz', 'L', 'ml', 'gal', 'pack', 'box', 'bag', 'bottle', 'can', 'bunch', 'dozen']

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
  const [editingItem, setEditingItem] = useState(null)
  const [showItemOptions, setShowItemOptions] = useState(false)
  const [lastCleared, setLastCleared] = useState([])
  const itemInputRef = useRef(null)
  const [expandedCategories, setExpandedCategories] = useState(
    new Set((data?.categories || SHOPPING_CATEGORIES).map(category => category.id))
  )
  const [showSettings, setShowSettings] = useState(false)
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
  const addItem = () => {
    if (!newItemName.trim()) return
    const item = {
      id: generateId(),
      name: newItemName.trim(),
      category: newItemCategory,
      quantity: normalizePositiveQuantity(newItemQuantity),
      unit: newItemUnit,
      price: normalizeOptionalAmount(newItemPrice),
      checked: false,
      note: '',
      createdAt: new Date().toISOString(),
    }
    update('items', (items) => [...items, item])
    setNewItemName('')
    setNewItemPrice('')
    setNewItemQuantity('1')
    itemInputRef.current?.focus()
  }
  const updateItem = (id, updates) => {
    update('items', (items) => items.map(item =>
      item.id === id ? { ...item, ...updates } : item
    ))
  }
  const deleteItem = (id) => {
    update('items', (items) => items.filter(item => item.id !== id))
  }
  const toggleChecked = (id) => {
    update('items', (items) => items.map(item =>
      item.id === id ? { ...item, checked: !item.checked } : item
    ))
  }
  const toggleCategory = (categoryId) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId)
    } else {
      newExpanded.add(categoryId)
    }
    setExpandedCategories(newExpanded)
  }
  const clearChecked = () => {
    const checked = shoppingData.items.filter(item => item.checked)
    if (checked.length === 0) return
    setLastCleared(checked)
    update('items', (items) => items.filter(item => !item.checked))
  }
  const restoreCleared = () => {
    if (lastCleared.length === 0) return
    update('items', (items) => [...items, ...lastCleared])
    setLastCleared([])
  }
  const moveItem = (id, direction) => {
    update('items', (items) => {
      const index = items.findIndex(item => item.id === id)
      const target = index + direction
      if (index < 0 || target < 0 || target >= items.length) return items
      const next = [...items]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }
  const uncheckAll = () => {
    update('items', (items) => items.map(item => ({ ...item, checked: false })))
  }
  const calculateTotals = () => {
    const items = shoppingData.items
    const total = items.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0)
    const checkedTotal = items
      .filter(item => item.checked)
      .reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0)
    const uncheckedTotal = total - checkedTotal
    return { total, checkedTotal, uncheckedTotal }
  }

  const { total, checkedTotal, uncheckedTotal } = calculateTotals()
  const checkedCount = shoppingData.items.filter(i => i.checked).length
  const totalCount = shoppingData.items.length
  const hasPriceData = shoppingData.budget != null || shoppingData.items.some(item => item.price != null)
  const currencySymbol = {
    USD: '$',
    EUR: '\u20AC',
    GBP: '£',
    JPY: '¥',
  }[shoppingData.currency] || shoppingData.currency

  return (
    <div className="qn-type-editor qn-type-shopping flex h-full flex-col">
      <header className="qn-type-hero qn-workspace-header flex-shrink-0 border-b border-subtle">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <FocusedNoteTitle
              icon={ShoppingCart}
              typeLabel="Shopping workspace"
              title={noteTitle}
              fallback="Shopping list"
              onChange={onTitleChange}
              readOnly={readOnly}
            />
            <p className="ml-12 mt-1 text-ui-md text-content-muted">
              {totalCount === 0 ? 'Ready for the first item' : `${totalCount - checkedCount} remaining • ${checkedCount} purchased`}
            </p>
          </div>
        </div>
        {totalCount > 0 && hasPriceData && (
          <WorkspaceMetrics
            items={[
              { label: 'Purchased', value: `${checkedCount}/${totalCount}` },
              ...(shoppingData.showPrices && hasPriceData ? [{
                label: shoppingData.budget != null ? 'Planned / budget' : 'Estimated total',
                value: shoppingData.budget != null
                  ? `${currencySymbol}${total.toFixed(2)} / ${currencySymbol}${shoppingData.budget.toFixed(2)}`
                  : `${currencySymbol}${total.toFixed(2)}`,
                tone: shoppingData.budget != null && total > shoppingData.budget ? 'danger' : 'neutral',
              }] : []),
            ]}
          />
        )}
      </header>
      <div className="qn-shopping-capture flex-shrink-0 border-b border-subtle bg-surface-raised px-4 py-3">
        <form
          className="qn-shopping-primary-entry flex gap-2"
          onSubmit={(event) => { event.preventDefault(); addItem() }}
        >
          <input
            ref={itemInputRef}
            type="text"
            aria-label="New shopping item"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder="Add an item…"
            className="min-w-0 flex-1 rounded-control border border-strong bg-surface-raised px-3 py-2 text-content outline-none focus:border-accent"
            autoFocus
          />
          <button
            type="submit"
            disabled={!newItemName.trim()}
            className={buttonClasses({ variant: 'primary' })}
          >
            <Plus className="w-5 h-5" />
            <span>Add</span>
          </button>
          <button
            type="button"
            onClick={() => setShowItemOptions(value => !value)}
            aria-label="Item details"
            aria-expanded={showItemOptions}
            className={buttonClasses({ variant: 'secondary' })}
          >
            <Settings2 className="h-4 w-4" />
            <span className="qn-shopping-details-label">Item details</span>
          </button>
        </form>
        {showItemOptions && (
          <div className="qn-shopping-entry-options mt-2 flex flex-wrap items-center gap-2 border-t border-subtle pt-2">
          <select
            aria-label="Category for new item"
            value={newItemCategory}
            onChange={(e) => setNewItemCategory(e.target.value)}
            className="rounded-control border border-subtle bg-surface-raised px-3 py-2 text-content outline-none"
          >
            {shoppingData.categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
            ))}
          </select>
          <div className="flex">
            <input
              type="number"
              aria-label="Quantity for new item"
              value={newItemQuantity}
              onChange={(e) => setNewItemQuantity(e.target.value)}
              min="0.1"
              step="0.1"
              placeholder="Qty"
              className="w-16 rounded-l-control border border-subtle bg-surface-raised px-2 py-2 text-center text-content outline-none"
            />
            <select
              aria-label="Unit for new item"
              value={newItemUnit}
              onChange={(e) => setNewItemUnit(e.target.value)}
              className="w-20 rounded-r-control border-y border-r border-subtle bg-surface-raised px-2 py-2 text-content outline-none"
            >
              {UNITS.map((unit) => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
          {shoppingData.showPrices && (
            <div className="flex items-center">
              <span className="px-2 py-2 bg-surface-sunken dark:bg-surface-active rounded-l-lg text-content-muted">
                {currencySymbol}
              </span>
              <input
                type="number"
                aria-label="Estimated price for new item"
                value={newItemPrice}
                onChange={(e) => setNewItemPrice(e.target.value)}
                placeholder="Price"
                min="0"
                step="0.01"
                className="w-20 rounded-r-control border border-subtle bg-surface-raised px-2 py-2 text-content outline-none"
              />
            </div>
          )}
          </div>
        )}
        <div className="qn-shopping-commands mt-2 flex items-center justify-between gap-3 text-sm">
          <div className="flex gap-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="text-sm text-content-muted hover:text-accent-text"
            >
              List settings
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={uncheckAll}
              disabled={checkedCount === 0}
              className="text-sm text-content-muted hover:text-accent-text"
            >
              Uncheck All
            </button>
            {lastCleared.length > 0 && (
              <button
                onClick={restoreCleared}
                className="flex items-center gap-1 text-accent-text hover:underline"
              >
                <Undo2 className="h-3.5 w-3.5" />
                Restore {lastCleared.length}
              </button>
            )}
            <button
              onClick={clearChecked}
              disabled={checkedCount === 0}
              className="text-sm text-red-500 hover:text-red-600"
            >
              Clear Checked
            </button>
          </div>
        </div>
        {showSettings && (
          <div className="mt-3 border-t border-subtle pt-3">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="text-sm text-content-muted mb-1 block">Currency</label>
                <select
                  aria-label="Shopping list currency"
                  value={shoppingData.currency}
                  onChange={(e) => update('currency', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-sunken dark:bg-surface-active border border-subtle outline-none text-content"
                >
                  <option value="USD">$ USD</option>
                  <option value="EUR">{"\u20AC"} EUR</option>
                  <option value="GBP">£ GBP</option>
                  <option value="JPY">¥ JPY</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-content-muted mb-1 block">Budget</label>
                <input
                  type="number"
                  aria-label="Shopping budget"
                  value={shoppingData.budget ?? ''}
                  onChange={(e) => update('budget', normalizeOptionalAmount(e.target.value))}
                  placeholder="Optional"
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 rounded-lg bg-surface-sunken dark:bg-surface-active border border-subtle outline-none text-content"
                />
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={shoppingData.showPrices}
                    onChange={(e) => update('showPrices', e.target.checked)}
                    className="w-4 h-4 rounded border-subtle text-emerald-500 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-content-muted">Show Prices</span>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="qn-workspace-canvas flex-1 overflow-y-auto bg-surface-raised">
        {shoppingData.items.length === 0 ? (
          <div className="qn-quiet-empty px-4 py-5 text-sm text-content-muted">
            The list is empty. Type the first item above and press Enter; optional details can wait.
          </div>
        ) : (
          <div className="qn-shopping-list">
            {shoppingData.categories.map((category) => {
              const categoryItems = shoppingData.items.filter(i => i.category === category.id)
              if (categoryItems.length === 0) return null

              const isExpanded = expandedCategories.has(category.id)
              const checkedInCategory = categoryItems.filter(i => i.checked).length
              const categoryTotal = categoryItems.reduce((sum, i) => sum + (i.price || 0) * i.quantity, 0)

              return (
                <section
                  key={category.id}
                  className="qn-shopping-group border-b border-subtle bg-surface-raised"
                >
                  <button
                    onClick={() => toggleCategory(category.id)}
                    aria-expanded={isExpanded}
                    className="qn-shopping-group-heading sticky top-0 z-[1] flex w-full items-center justify-between border-b border-subtle bg-surface-sunken px-4 py-2 transition-colors hover:bg-surface-hover"
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-content-muted" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-content-muted" />
                      )}
                      <span className="font-medium text-content">{category.name}</span>
                      <span className="text-sm text-content-muted">
                        ({checkedInCategory}/{categoryItems.length})
                      </span>
                    </div>
                    {shoppingData.showPrices && hasPriceData && (
                      <span className="text-sm font-medium text-content-muted">
                        {currencySymbol}{categoryTotal.toFixed(2)}
                      </span>
                    )}
                  </button>
                  {isExpanded && (
                    <div className="divide-y divide-[var(--qn-border-subtle)]">
                      {categoryItems.map((item) => (
                        <div
                          key={item.id}
                          className={`qn-shopping-item ${editingItem === item.id ? 'qn-shopping-item--editing' : ''} flex items-center gap-3 px-4 py-2.5 ${
 item.checked ? 'bg-success-soft' : 'bg-surface-raised'
 }`}
                        >
                          <button
                            onClick={() => toggleChecked(item.id)}
                            aria-label={item.checked ? `Mark ${item.name} as not purchased` : `Mark ${item.name} as purchased`}
                            className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-control border transition-colors ${
 item.checked
 ? 'bg-accent border-accent text-accent-on'
                                : 'border-strong bg-surface-raised hover:border-accent'
                            }`}
                          >
                            {item.checked && <Check className="w-4 h-4" />}
                          </button>
                          <div className="min-w-0 flex-1">
                            {editingItem === item.id ? (
                              <input
                                type="text"
                                aria-label={`Rename ${item.name}`}
                                value={item.name}
                                onChange={(e) => updateItem(item.id, { name: e.target.value })}
                                onBlur={() => setEditingItem(null)}
                                onKeyDown={(e) => e.key === 'Enter' && setEditingItem(null)}
                                className="w-full px-2 py-1 rounded bg-surface-sunken border border-subtle outline-none text-content"
                                autoFocus
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() => setEditingItem(item.id)}
                                className={`block truncate ${
 item.checked
 ? 'text-content-subtle line-through'
                                    : 'text-content'
                                }`}
                              >
                                {item.name}
                              </button>
                            )}
                            {editingItem !== item.id && (
                              <span className="block truncate text-xs text-content-muted">
                                {item.quantity} {item.unit}{shoppingData.showPrices && item.price != null ? ` • ${currencySymbol}${(item.price * item.quantity).toFixed(2)}` : ''}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => setEditingItem(editingItem === item.id ? null : item.id)}
                            aria-label={`${editingItem === item.id ? 'Close details for' : 'Edit'} ${item.name}`}
                            aria-expanded={editingItem === item.id}
                            className="qn-square-control flex h-8 w-8 items-center justify-center rounded-control text-content-muted hover:bg-surface-hover hover:text-content"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          {editingItem === item.id && (
                            <div className="qn-shopping-item-details flex w-full flex-wrap items-center gap-2 border-t border-subtle pt-2">
                          <div className="flex items-center gap-1 text-sm text-content-muted">
                            <input
                              type="number"
                              aria-label={`Quantity for ${item.name}`}
                              value={item.quantity}
                              onChange={(e) => updateItem(item.id, {
                                quantity: normalizePositiveQuantity(e.target.value),
                              })}
                              className="w-14 px-2 py-1 rounded bg-surface-sunken border border-subtle text-center outline-none text-content"
                              min="0.1"
                              step="0.1"
                            />
                            <select
                              aria-label={`Unit for ${item.name}`}
                              value={item.unit}
                              onChange={(e) => updateItem(item.id, { unit: e.target.value })}
                              className="px-2 py-1 rounded bg-surface-sunken border border-subtle outline-none text-content"
                            >
                              {UNITS.map((unit) => (
                                <option key={unit} value={unit}>{unit}</option>
                              ))}
                            </select>
                          </div>
                          <select
                            aria-label={`Category for ${item.name}`}
                            value={item.category}
                            onChange={(e) => updateItem(item.id, { category: e.target.value })}
                            className="max-w-32 px-2 py-1 rounded bg-surface-sunken border border-subtle outline-none text-sm text-content"
                          >
                            {shoppingData.categories.map((itemCategory) => (
                              <option key={itemCategory.id} value={itemCategory.id}>{itemCategory.icon} {itemCategory.name}</option>
                            ))}
                          </select>
                          {shoppingData.showPrices && (
                            <div className="flex items-center gap-1">
                              <span className="text-content-muted">{currencySymbol}</span>
                              <input
                                type="number"
                                aria-label={`Price for ${item.name}`}
                                value={item.price ?? ''}
                                onChange={(e) => updateItem(item.id, {
                                  price: normalizeOptionalAmount(e.target.value),
                                })}
                                placeholder="0.00"
                                min="0"
                                step="0.01"
                                className="w-20 px-2 py-1 rounded bg-surface-sunken border border-subtle outline-none text-content text-right"
                              />
                            </div>
                          )}
                          {shoppingData.showPrices && item.price && (
                            <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400 w-20 text-right">
                              {currencySymbol}{(item.price * item.quantity).toFixed(2)}
                            </span>
                          )}
                          <div className="ml-auto flex gap-1">
                            <button
                              onClick={() => moveItem(item.id, -1)}
                              aria-label={`Move ${item.name} up`}
                              className="p-1 rounded text-content-subtle hover:text-content-muted dark:hover:text-content-subtle"
                            >
                              <ArrowUp className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => moveItem(item.id, 1)}
                              aria-label={`Move ${item.name} down`}
                              className="p-1 rounded text-content-subtle hover:text-content-muted dark:hover:text-content-subtle"
                            >
                              <ArrowDown className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteItem(item.id)}
                              aria-label={`Delete ${item.name}`}
                              className="p-1 rounded text-content-subtle hover:text-red-500"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )
            })}
          </div>
        )}
      </div>
      {shoppingData.items.length > 0 && shoppingData.showPrices && hasPriceData && (
        <div className="qn-shopping-total flex flex-shrink-0 flex-wrap items-center justify-end gap-x-4 gap-y-1 border-t border-subtle bg-surface-raised px-4 py-2 text-sm">
          {checkedCount > 0 && <span className="text-content-muted">Purchased {currencySymbol}{checkedTotal.toFixed(2)}</span>}
          <span className="text-content">Remaining <strong>{currencySymbol}{uncheckedTotal.toFixed(2)}</strong></span>
          {shoppingData.budget != null && (
            <span className={total > shoppingData.budget ? 'text-danger-text' : 'text-content-muted'}>
              Budget {currencySymbol}{total.toFixed(2)} / {currencySymbol}{shoppingData.budget.toFixed(2)}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
