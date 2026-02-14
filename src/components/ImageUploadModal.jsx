import React, { useState, useCallback } from 'react'
import { X, Upload, Link, Image as ImageIcon, FileImage, Loader2 } from 'lucide-react'
import { useUIStore } from '../store'
import toast from 'react-hot-toast'

export default function ImageUploadModal({ editor }) {
  const { imageUploadOpen, setImageUploadOpen } = useUIStore()
  const [activeTab, setActiveTab] = useState('url')
  const [imageUrl, setImageUrl] = useState('')
  const [altText, setAltText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [previewUrl, setPreviewUrl] = useState('')

  const handleDrag = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const processFile = async (file) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload only image files')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image too large (max. 5MB)')
      return
    }

    setIsLoading(true)

    try {
      const reader = new FileReader()
      reader.onload = (e) => {
        const base64 = e.target.result
        setPreviewUrl(base64)
        setImageUrl(base64)
        setAltText(file.name.replace(/\.[^/.]+$/, ''))
        setIsLoading(false)
      }
      reader.onerror = () => {
        toast.error('Error reading file')
        setIsLoading(false)
      }
      reader.readAsDataURL(file)
    } catch (error) {
      toast.error('Error processing image')
      setIsLoading(false)
    }
  }

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0])
    }
  }, [])

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0])
    }
  }

  const handleUrlChange = (e) => {
    const url = e.target.value
    setImageUrl(url)
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      setPreviewUrl(url)
    } else {
      setPreviewUrl('')
    }
  }

  const handleInsert = () => {
    if (!imageUrl) {
      toast.error('Please enter an image URL or upload a file')
      return
    }

    if (editor) {
      editor.chain().focus().setImage({ 
        src: imageUrl, 
        alt: altText || 'Image',
        title: altText || ''
      }).run()
      toast.success('Image inserted')
    }

    handleClose()
  }

  const handleClose = () => {
    setImageUploadOpen(false)
    setImageUrl('')
    setAltText('')
    setPreviewUrl('')
    setActiveTab('url')
  }

  if (!imageUploadOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm modal-backdrop-animate">
      <div className="modal-animate bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-[#cbd1db] dark:border-gray-700 w-full max-w-lg mx-4 overflow-hidden">
        <div className="flex items-center justify-between p-5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
          <div className="flex items-center gap-3">
            <ImageIcon className="w-6 h-6" />
            <div>
              <h2 className="text-lg font-bold">Insert Image</h2>
              <p className="text-sm text-white/70">Add an image to your note</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-full hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('url')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'url'
                ? 'text-primary-600 border-b-2 border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Link className="w-4 h-4" />
            URL
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'upload'
                ? 'text-primary-600 border-b-2 border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Upload className="w-4 h-4" />
            Upload
          </button>
        </div>
        <div className="p-6 space-y-4">
          {activeTab === 'url' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Image URL
                </label>
                <input
                  type="url"
                  value={imageUrl}
                  onChange={handleUrlChange}
                  placeholder="https://example.com/image.jpg"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>
          )}

          {activeTab === 'upload' && (
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              {isLoading ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Processing image...
                  </p>
                </div>
              ) : (
                <>
                  <FileImage className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Drag image here or
                  </p>
                  <label className="cursor-pointer">
                    <span className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm rounded-lg inline-block">
                      Choose file
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileInput}
                      className="hidden"
                    />
                  </label>
                  <p className="text-xs text-gray-400 mt-3">
                    Max. 5MB {"\u2022"} JPG, PNG, GIF, WebP
                  </p>
                </>
              )}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Alternative text (optional)
            </label>
            <input
              type="text"
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
              placeholder="Description of the image"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          {previewUrl && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Preview:</p>
              <img
                src={previewUrl}
                alt="Preview"
                className="max-h-48 mx-auto rounded object-contain"
                onError={() => {
                  setPreviewUrl('')
                  toast.error('Could not load image')
                }}
              />
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleInsert}
            disabled={!imageUrl || isLoading}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Insert
          </button>
        </div>
      </div>
    </div>
  )
}
