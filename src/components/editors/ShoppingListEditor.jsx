import { useState, useEffect, useRef } from 'react'
import { EmptyState, buttonClasses } from '../ui'
import {
  ShoppingCart,
  Plus,
  Trash2,
  Check,
  ChevronDown,
  ChevronRight,
  Edit3,
  ShoppingBag
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
    update('items', (items) => items.filter(item => !item.checked))
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
            <p className="mt-1 text-content-muted">
              {checkedCount} of {totalCount} items checked
            </p>
          </div>
        </div>
        <WorkspaceMetrics
          items={[
            { label: 'Checked', value: `${checkedCount}/${totalCount}` },
            ...(shoppingData.showPrices ? [
              { label: 'Purchased', value: `${currencySymbol}${checkedTotal.toFixed(2)}` },
              { label: 'Still to buy', value: `${currencySymbol}${uncheckedTotal.toFixed(2)}` },
              {
                label: shoppingData.budget != null ? 'Budget status' : 'Total',
                value: shoppingData.budget != null
                  ? `${currencySymbol}${total.toFixed(2)} / ${currencySymbol}${shoppingData.budget.toFixed(2)}`
                  : `${currencySymbol}${total.toFixed(2)}`,
                tone: shoppingData.budget != null && total > shoppingData.budget ? 'danger' : 'neutral',
              },
            ] : []),
          ]}
        />
      </header>
      <div className="qn-type-tabs flex-shrink-0 p-4 border-b border-subtle bg-surface-sunken">
        <div className="flex gap-2 flex-wrap">
          <input
            type="text"
            aria-label="New shopping item"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addItem()}
            placeholder="Add item..."
            className="flex-1 min-w-[200px] px-4 py-2 rounded-lg bg-white dark:bg-surface-sunken border border-subtle outline-none text-content focus:ring-2 focus:ring-emerald-500"
          />
          <select
            aria-label="Category for new item"
            value={newItemCategory}
            onChange={(e) => setNewItemCategory(e.target.value)}
            className="px-3 py-2 rounded-lg bg-white dark:bg-surface-sunken border border-subtle outline-none text-content"
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
              className="w-16 px-2 py-2 rounded-l-lg bg-white dark:bg-surface-sunken border border-subtle outline-none text-content text-center"
            />
            <select
              aria-label="Unit for new item"
              value={newItemUnit}
              onChange={(e) => setNewItemUnit(e.target.value)}
              className="w-20 px-2 py-2 rounded-r-lg bg-white dark:bg-surface-sunken border-y border-r border-subtle outline-none text-content"
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
                className="w-20 px-2 py-2 rounded-r-lg bg-white dark:bg-surface-sunken border border-subtle outline-none text-content"
              />
            </div>
          )}
          <button
            onClick={addItem}
            disabled={!newItemName.trim()}
            className={buttonClasses({ variant: 'primary' })}
          >
            <Plus className="w-5 h-5" />
            Add
          </button>
        </div>
        <div className="flex justify-between items-center mt-3">
          <div className="flex gap-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="text-sm text-content-muted hover:text-accent-text"
            >
              Settings
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
          <div className="mt-3 p-4 rounded-lg bg-white dark:bg-surface-sunken border border-subtle ">
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
      <div className="qn-workspace-canvas flex-1 overflow-y-auto">
        {shoppingData.items.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title="Your shopping list is empty"
            description="Add the first item using the form above."
          />
        ) : (
          <div className="p-4 space-y-2">
            {shoppingData.categories.map((category) => {
              const categoryItems = shoppingData.items.filter(i => i.category === category.id)
              if (categoryItems.length === 0) return null

              const isExpanded = expandedCategories.has(category.id)
              const checkedInCategory = categoryItems.filter(i => i.checked).length
              const categoryTotal = categoryItems.reduce((sum, i) => sum + (i.price || 0) * i.quantity, 0)

              return (
                <section
                  key={category.id}
                  className="qn-section-card overflow-hidden rounded-card border border-subtle bg-surface-raised shadow-xs"
                >
                  <button
                    onClick={() => toggleCategory(category.id)}
                    aria-expanded={isExpanded}
                    className="w-full flex items-center justify-between p-3 bg-surface-sunken hover:bg-surface-hover transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-content-muted" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-content-muted" />
                      )}
                      <span className="text-xl">{category.icon}</span>
                      <span className="font-medium text-content">{category.name}</span>
                      <span className="text-sm text-content-muted">
                        ({checkedInCategory}/{categoryItems.length})
                      </span>
                    </div>
                    {shoppingData.showPrices && (
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
                          className={`flex flex-wrap items-center gap-3 p-3 ${
 item.checked ? 'bg-success-soft' : 'bg-surface-raised'
 }`}
                        >
                          <button
                            onClick={() => toggleChecked(item.id)}
                            aria-label={item.checked ? `Mark ${item.name} as not purchased` : `Mark ${item.name} as purchased`}
                            className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
 item.checked
 ? 'bg-accent border-accent text-accent-on'
                                : 'border-subtle  hover:border-emerald-500'
                            }`}
                          >
                            {item.checked && <Check className="w-4 h-4" />}
                          </button>
                          <div className="flex-1 min-w-0">
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
                              <span
                                className={`block truncate ${
 item.checked
 ? 'text-content-subtle line-through'
                                    : 'text-content'
                                }`}
                              >
                                {item.name}
                              </span>
                            )}
                          </div>
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
                          <div className="flex gap-1">
                            <button
                              onClick={() => setEditingItem(item.id)}
                              aria-label={`Rename ${item.name}`}
                              className="p-1 rounded text-content-subtle hover:text-content-muted dark:hover:text-content-subtle"
                            >
                              <Edit3 className="w-4 h-4" />
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
                      ))}
                    </div>
                  )}
                </section>
              )
            })}
          </div>
        )}
      </div>
      {shoppingData.items.length > 0 && shoppingData.showPrices && (
        <div className="flex-shrink-0 p-4 border-t border-subtle bg-surface-sunken">
          <div className="flex justify-between items-center">
            <div>
              <span className="text-content-muted">Total Items:</span>
              <span className="font-bold text-content ml-2">{totalCount}</span>
            </div>
            <div className="text-right">
              <div className="text-sm text-content-muted">
                {checkedCount > 0 && (
                  <span className="text-emerald-500">Purchased: {currencySymbol}{checkedTotal.toFixed(2)} | </span>
                )}
                Still to buy: {currencySymbol}{uncheckedTotal.toFixed(2)}
              </div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {currencySymbol}{total.toFixed(2)}
                {shoppingData.budget && (
                  <span className={`text-sm ml-2 ${total > shoppingData.budget ? 'text-red-500' : 'text-content-muted'}`}>
                    / {currencySymbol}{shoppingData.budget.toFixed(2)}
                  </span>
                )}
              </div>
              {shoppingData.budget && (
                <div className={`text-sm font-medium ${(shoppingData.budget - total) < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                  Remaining budget: {currencySymbol}{(shoppingData.budget - total).toFixed(2)}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
