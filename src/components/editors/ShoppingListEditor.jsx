import React, { useState, useEffect, useRef } from 'react'
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
import { generateId } from './noteTypes'
const DEFAULT_CATEGORIES = [
  { id: 'produce', name: 'Produce', icon: '\u{1F96C}', color: '#22c55e' },
  { id: 'dairy', name: 'Dairy', icon: '\u{1F95B}', color: '#60a5fa' },
  { id: 'meat', name: 'Meat & Seafood', icon: '\u{1F969}', color: '#ef4444' },
  { id: 'bakery', name: 'Bakery', icon: '\u{1F956}', color: '#f59e0b' },
  { id: 'frozen', name: 'Frozen', icon: '\u{1F9CA}', color: '#06b6d4' },
  { id: 'beverages', name: 'Beverages', icon: '\u{1F964}', color: '#8b5cf6' },
  { id: 'snacks', name: 'Snacks', icon: '\u{1F37F}', color: '#ec4899' },
  { id: 'household', name: 'Household', icon: '\u{1F3E0}', color: '#6b7280' },
  { id: 'personal', name: 'Personal Care', icon: '\u{1F9F4}', color: '#10b981' },
  { id: 'other', name: 'Other', icon: '\u{1F4E6}', color: '#9ca3af' },
]
const UNITS = ['pcs', 'kg', 'g', 'lb', 'oz', 'L', 'ml', 'gal', 'pack', 'box', 'bag', 'bottle', 'can', 'bunch', 'dozen']

export default function ShoppingListEditor({ data, onChange, noteTitle }) {
  const [shoppingData, setShoppingData] = useState({
    items: data?.items || [],
    categories: data?.categories || DEFAULT_CATEGORIES,
    budget: data?.budget || null,
    currency: data?.currency || 'USD',
    showPrices: data?.showPrices ?? true,
    sortByCategory: data?.sortByCategory ?? true,
  })

  const [newItemName, setNewItemName] = useState('')
  const [newItemCategory, setNewItemCategory] = useState('other')
  const [newItemQuantity, setNewItemQuantity] = useState('1')
  const [newItemUnit, setNewItemUnit] = useState('pcs')
  const [newItemPrice, setNewItemPrice] = useState('')
  const [editingItem, setEditingItem] = useState(null)
  const [expandedCategories, setExpandedCategories] = useState(new Set(DEFAULT_CATEGORIES.map(c => c.id)))
  const [showSettings, setShowSettings] = useState(false)
  const isInitialMount = useRef(true)
  useEffect(() => {
    if (isInitialMount.current) { isInitialMount.current = false; return }
    onChange?.(shoppingData)
  }, [shoppingData])

  const update = (field, value) => {
    setShoppingData(prev => ({ ...prev, [field]: value }))
  }
  const addItem = () => {
    if (!newItemName.trim()) return
    const item = {
      id: generateId(),
      name: newItemName.trim(),
      category: newItemCategory,
      quantity: parseFloat(newItemQuantity) || 1,
      unit: newItemUnit,
      price: parseFloat(newItemPrice) || null,
      checked: false,
      note: '',
      createdAt: new Date().toISOString(),
    }
    update('items', [...shoppingData.items, item])
    setNewItemName('')
    setNewItemPrice('')
    setNewItemQuantity('1')
  }
  const updateItem = (id, updates) => {
    update('items', shoppingData.items.map(item =>
      item.id === id ? { ...item, ...updates } : item
    ))
  }
  const deleteItem = (id) => {
    update('items', shoppingData.items.filter(item => item.id !== id))
  }
  const toggleChecked = (id) => {
    update('items', shoppingData.items.map(item =>
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
    update('items', shoppingData.items.filter(item => !item.checked))
  }
  const uncheckAll = () => {
    update('items', shoppingData.items.map(item => ({ ...item, checked: false })))
  }
  const getItemsByCategory = () => {
    const grouped = {}
    shoppingData.categories.forEach(cat => {
      grouped[cat.id] = shoppingData.items.filter(item => item.category === cat.id)
    })
    return grouped
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
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      <div className="flex-shrink-0 p-4 border-b border-[#cbd1db] dark:border-gray-700 bg-[#e5eaf0] dark:bg-gray-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <ShoppingCart className="w-7 h-7" />
              {noteTitle || 'Shopping List'}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              {checkedCount} of {totalCount} items checked
            </p>
          </div>
          <div className="text-right">
            {shoppingData.showPrices && (
              <div className="space-y-1">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {currencySymbol}{total.toFixed(2)}
                </div>
                {shoppingData.budget && (
                  <div className={`text-sm ${total > shoppingData.budget ? 'text-red-500 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    Budget: {currencySymbol}{shoppingData.budget.toFixed(2)}
                    {total > shoppingData.budget && ' (Over!)'}
                  </div>
                )}
                <div className="flex gap-4 text-sm text-gray-500 dark:text-gray-400">
                  <span>{"\u2713"} {currencySymbol}{checkedTotal.toFixed(2)}</span>
                  <span>{"\u25CB"} {currencySymbol}{uncheckedTotal.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="w-full h-2 rounded-full bg-gray-300 dark:bg-gray-600 overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all"
            style={{ width: `${totalCount > 0 ? (checkedCount / totalCount) * 100 : 0}%` }}
          />
        </div>
      </div>
      <div className="flex-shrink-0 p-4 border-b border-[#cbd1db] dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="flex gap-2 flex-wrap">
          <input
            type="text"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addItem()}
            placeholder="Add item..."
            className="flex-1 min-w-[200px] px-4 py-2 rounded-lg bg-white dark:bg-gray-700 border border-[#cbd1db] dark:border-gray-600 outline-none text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
          />
          <select
            value={newItemCategory}
            onChange={(e) => setNewItemCategory(e.target.value)}
            className="px-3 py-2 rounded-lg bg-white dark:bg-gray-700 border border-[#cbd1db] dark:border-gray-600 outline-none text-gray-900 dark:text-white"
          >
            {shoppingData.categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
            ))}
          </select>
          <div className="flex">
            <input
              type="number"
              value={newItemQuantity}
              onChange={(e) => setNewItemQuantity(e.target.value)}
              placeholder="Qty"
              className="w-16 px-2 py-2 rounded-l-lg bg-white dark:bg-gray-700 border border-[#cbd1db] dark:border-gray-600 outline-none text-gray-900 dark:text-white text-center"
            />
            <select
              value={newItemUnit}
              onChange={(e) => setNewItemUnit(e.target.value)}
              className="w-20 px-2 py-2 rounded-r-lg bg-white dark:bg-gray-700 border-y border-r border-[#cbd1db] dark:border-gray-600 outline-none text-gray-900 dark:text-white"
            >
              {UNITS.map((unit) => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
          {shoppingData.showPrices && (
            <div className="flex items-center">
              <span className="px-2 py-2 bg-gray-200 dark:bg-gray-600 rounded-l-lg text-gray-600 dark:text-gray-400">
                {currencySymbol}
              </span>
              <input
                type="number"
                value={newItemPrice}
                onChange={(e) => setNewItemPrice(e.target.value)}
                placeholder="Price"
                step="0.01"
                className="w-20 px-2 py-2 rounded-r-lg bg-white dark:bg-gray-700 border border-[#cbd1db] dark:border-gray-600 outline-none text-gray-900 dark:text-white"
              />
            </div>
          )}
          <button
            onClick={addItem}
            className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-medium flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add
          </button>
        </div>
        <div className="flex justify-between items-center mt-3">
          <div className="flex gap-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-emerald-500"
            >
              Settings
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={uncheckAll}
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-emerald-500"
            >
              Uncheck All
            </button>
            <button
              onClick={clearChecked}
              className="text-sm text-red-500 hover:text-red-600"
            >
              Clear Checked
            </button>
          </div>
        </div>
        {showSettings && (
          <div className="mt-3 p-4 rounded-lg bg-white dark:bg-gray-700 border border-[#cbd1db] dark:border-gray-600">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm text-gray-600 dark:text-gray-400 mb-1 block">Currency</label>
                <select
                  value={shoppingData.currency}
                  onChange={(e) => update('currency', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-600 border border-[#cbd1db] dark:border-gray-600 outline-none text-gray-900 dark:text-white"
                >
                  <option value="USD">$ USD</option>
                  <option value="EUR">{"\u20AC"} EUR</option>
                  <option value="GBP">£ GBP</option>
                  <option value="JPY">¥ JPY</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-600 dark:text-gray-400 mb-1 block">Budget</label>
                <input
                  type="number"
                  value={shoppingData.budget || ''}
                  onChange={(e) => update('budget', e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder="Optional"
                  className="w-full px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-600 border border-[#cbd1db] dark:border-gray-600 outline-none text-gray-900 dark:text-white"
                />
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={shoppingData.showPrices}
                    onChange={(e) => update('showPrices', e.target.checked)}
                    className="w-4 h-4 rounded border-[#cbd1db] text-emerald-500 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Show Prices</span>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {shoppingData.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <ShoppingBag className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-lg">Your shopping list is empty</p>
            <p className="text-sm mt-1">Add items using the form above</p>
          </div>
        ) : (
          <div className="p-4 space-y-2">
            {shoppingData.categories.map((category) => {
              const categoryItems = shoppingData.items.filter(i => i.category === category.id)
              if (categoryItems.length === 0) return null

              const isExpanded = expandedCategories.has(category.id)
              const checkedInCategory = categoryItems.filter(i => i.checked).length
              const categoryTotal = categoryItems.reduce((sum, i) => sum + (i.price || 0) * i.quantity, 0)

              return (
                <div
                  key={category.id}
                  className="rounded-xl overflow-hidden border border-[#cbd1db] dark:border-gray-700"
                >
                  <button
                    onClick={() => toggleCategory(category.id)}
                    className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-gray-500" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-500" />
                      )}
                      <span className="text-xl">{category.icon}</span>
                      <span className="font-medium text-gray-900 dark:text-white">{category.name}</span>
                      <span className="text-sm text-gray-500">
                        ({checkedInCategory}/{categoryItems.length})
                      </span>
                    </div>
                    {shoppingData.showPrices && (
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        {currencySymbol}{categoryTotal.toFixed(2)}
                      </span>
                    )}
                  </button>
                  {isExpanded && (
                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                      {categoryItems.map((item) => (
                        <div
                          key={item.id}
                          className={`flex items-center gap-3 p-3 ${
                            item.checked ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-white dark:bg-gray-900'
                          }`}
                        >
                          <button
                            onClick={() => toggleChecked(item.id)}
                            className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                              item.checked
                                ? 'bg-emerald-500 border-emerald-500 text-white'
                                : 'border-[#cbd1db] dark:border-gray-600 hover:border-emerald-500'
                            }`}
                          >
                            {item.checked && <Check className="w-4 h-4" />}
                          </button>
                          <div className="flex-1 min-w-0">
                            {editingItem === item.id ? (
                              <input
                                type="text"
                                value={item.name}
                                onChange={(e) => updateItem(item.id, { name: e.target.value })}
                                onBlur={() => setEditingItem(null)}
                                onKeyDown={(e) => e.key === 'Enter' && setEditingItem(null)}
                                className="w-full px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 border border-[#cbd1db] dark:border-gray-600 outline-none text-gray-900 dark:text-white"
                                autoFocus
                              />
                            ) : (
                              <span
                                className={`block truncate ${
                                  item.checked
                                    ? 'text-gray-400 line-through'
                                    : 'text-gray-900 dark:text-white'
                                }`}
                              >
                                {item.name}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateItem(item.id, { quantity: parseFloat(e.target.value) || 1 })}
                              className="w-14 px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 border border-[#cbd1db] dark:border-gray-600 text-center outline-none text-gray-900 dark:text-white"
                              min="0.1"
                              step="0.1"
                            />
                            <select
                              value={item.unit}
                              onChange={(e) => updateItem(item.id, { unit: e.target.value })}
                              className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 border border-[#cbd1db] dark:border-gray-600 outline-none text-gray-900 dark:text-white"
                            >
                              {UNITS.map((unit) => (
                                <option key={unit} value={unit}>{unit}</option>
                              ))}
                            </select>
                          </div>
                          {shoppingData.showPrices && (
                            <div className="flex items-center gap-1">
                              <span className="text-gray-500">{currencySymbol}</span>
                              <input
                                type="number"
                                value={item.price || ''}
                                onChange={(e) => updateItem(item.id, { price: e.target.value ? parseFloat(e.target.value) : null })}
                                placeholder="0.00"
                                step="0.01"
                                className="w-20 px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 border border-[#cbd1db] dark:border-gray-600 outline-none text-gray-900 dark:text-white text-right"
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
                              className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteItem(item.id)}
                              className="p-1 rounded text-gray-400 hover:text-red-500"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
      {shoppingData.items.length > 0 && shoppingData.showPrices && (
        <div className="flex-shrink-0 p-4 border-t border-[#cbd1db] dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="flex justify-between items-center">
            <div>
              <span className="text-gray-600 dark:text-gray-400">Total Items:</span>
              <span className="font-bold text-gray-900 dark:text-white ml-2">{totalCount}</span>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">
                {checkedCount > 0 && (
                  <span className="text-emerald-500">Purchased: {currencySymbol}{checkedTotal.toFixed(2)} | </span>
                )}
                Still to buy: {currencySymbol}{uncheckedTotal.toFixed(2)}
              </div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {currencySymbol}{total.toFixed(2)}
                {shoppingData.budget && (
                  <span className={`text-sm ml-2 ${total > shoppingData.budget ? 'text-red-500' : 'text-gray-500'}`}>
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
