import React, { useState, useEffect } from 'react'
import {
  FileText,
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  Cloud,
  Shield,
  Zap,
  FolderOpen,
  Star,
  RefreshCw,
  Sparkles,
  Layout,
  Share2,
  Search,
  History,
  Globe,
  Palette
} from 'lucide-react'
import { backend, isBackendConfigured, getRedirectUrl } from '../lib/backend'
import { useNotesStore, useUIStore } from '../store'
import HelpModal from './HelpModal'
import PrivacyModal from './PrivacyModal'
import TermsModal from './TermsModal'

export default function AuthScreen() {
  const [mode, setMode] = useState('login')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    agreeToTerms: false,
  })
  const [errors, setErrors] = useState({})

  const { setUser } = useNotesStore()

  useEffect(() => {
    setMounted(true)
  }, [])

  const features = [
    { icon: FileText, title: 'Rich Text Editor', description: 'Full WYSIWYG editor with formatting, tables, and media support' },
    { icon: FolderOpen, title: 'Smart Organization', description: 'Folders, tags, and powerful search to find anything instantly' },
    { icon: Cloud, title: 'Cloud Sync', description: 'Seamless synchronization across all your devices in real-time' },
    { icon: Zap, title: 'Offline-First', description: 'Works without internet — syncs automatically when online' },
    { icon: Layout, title: 'Specialized Notes', description: '7 note types including todos, projects, meetings, and more' },
    { icon: Share2, title: 'Collaboration', description: 'Share notes with others and work together in real-time' },
    { icon: History, title: 'Version History', description: 'Track every change with full revision history and rollback' },
    { icon: Globe, title: 'Multi-Language', description: 'Built-in translation support for over 30 languages' },
    { icon: Palette, title: 'Custom Themes', description: 'Personalize your workspace with light and dark themes' },
  ]

  const stats = [
    { value: '7+', label: 'Note Types' },
    { value: '100%', label: 'Free & Open Source' },
    { value: 'PWA', label: 'Works Offline' },
  ]

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }))
  }

  const validateForm = () => {
    const newErrors = {}
    if (!formData.email) newErrors.email = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Invalid email format'
    if (!formData.password) newErrors.password = 'Password is required'
    else if (mode === 'register' && formData.password.length < 8) newErrors.password = 'Password must be at least 8 characters'
    if (mode === 'register') {
      if (!formData.firstName) newErrors.firstName = 'First name is required'
      if (!formData.lastName) newErrors.lastName = 'Last name is required'
      if (!formData.confirmPassword) newErrors.confirmPassword = 'Please confirm your password'
      else if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'Passwords do not match'
      if (!formData.agreeToTerms) newErrors.agreeToTerms = 'You must agree to the terms'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validateForm()) return
    if (!isBackendConfigured()) {
      setErrors({ email: 'Backend is not configured. Please check .env file.' })
      return
    }
    setIsLoading(true)
    setErrors({})
    try {
      if (mode === 'register') {
        const { error } = await backend.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: { 
            data: { first_name: formData.firstName, last_name: formData.lastName },
            emailRedirectTo: getRedirectUrl()
          },
        })
        if (error) throw error
        setMode('confirmation')
      } else if (mode === 'login') {
        const { data, error } = await backend.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        })
        if (error) throw error
        if (data.user) setUser(data.user)
      } else if (mode === 'forgot') {
        const { error } = await backend.auth.resetPasswordForEmail(formData.email, {
          redirectTo: getRedirectUrl()
        })
        if (error) throw error
        setErrors({ email: 'Password reset email has been sent!' })
      }
    } catch (err) {
      const errorMessages = {
        'Invalid login credentials': 'Invalid email or password',
        'User already registered': 'Email is already registered',
      }
      setErrors({ email: errorMessages[err.message] || err.message })
    } finally {
      setIsLoading(false)
    }
  }

  const renderLoginForm = () => (
    <div className="auth-form-animate">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 mb-4 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 shadow-lg shadow-emerald-500/20">
          <Lock className="w-7 h-7 text-white" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">Welcome back</h2>
        <p className="mt-1.5 text-sm text-gray-500">Sign in to continue to your workspace</p>
      </div>
      
      {/* Form Card */}
      <div className="p-6 bg-white border border-[#cbd1db] rounded-2xl shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block mb-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Email Address</label>
            <div className="relative group">
              <Mail className="absolute w-4.5 h-4.5 text-gray-400 transition-colors -translate-y-1/2 left-3.5 top-1/2 group-focus-within:text-emerald-500" />
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className={`w-full pl-11 pr-4 py-3 bg-gray-50/80 border rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-gray-900 placeholder-gray-400 text-sm ${
                  errors.email ? 'border-red-300 bg-red-50/50' : 'border-[#cbd1db]'
                }`}
                placeholder="you@example.com"
              />
            </div>
            {errors.email && (
              <p className="flex items-center gap-1 mt-1.5 text-sm text-red-600">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                {errors.email}
              </p>
            )}
          </div>
          <div>
            <label className="block mb-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Password</label>
            <div className="relative group">
              <Lock className="absolute w-4.5 h-4.5 text-gray-400 transition-colors -translate-y-1/2 left-3.5 top-1/2 group-focus-within:text-emerald-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                className={`w-full pl-11 pr-12 py-3 bg-gray-50/80 border rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-gray-900 placeholder-gray-400 text-sm ${
                  errors.password ? 'border-red-300 bg-red-50/50' : 'border-[#cbd1db]'
                }`}
                placeholder="Enter your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute p-1.5 text-gray-400 -translate-y-1/2 rounded-lg right-3 top-1/2 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="flex items-center gap-1 mt-1.5 text-sm text-red-600">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                {errors.password}
              </p>
            )}
          </div>
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center cursor-pointer">
              <input type="checkbox" className="w-4 h-4 border-[#cbd1db] rounded text-emerald-600 focus:ring-emerald-500" />
              <span className="ml-2 text-sm text-gray-600">Remember me</span>
            </label>
            <button
              type="button"
              onClick={() => setMode('forgot')}
              className="text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
            >
              Forgot password?
            </button>
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="relative flex items-center justify-center w-full px-4 py-3 space-x-2 font-semibold text-white transition-all rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-60 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 hover:-translate-y-0.5 active:translate-y-0"
          >
            {isLoading ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <span>Sign in</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>
      </div>

      {/* Divider */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[#cbd1db]" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="px-3 text-gray-400 bg-white font-medium uppercase tracking-wider">New to QuickNotes?</span>
        </div>
      </div>

      <button
        onClick={() => setMode('register')}
        className="flex items-center justify-center w-full px-4 py-2.5 text-sm font-semibold text-emerald-700 transition-all bg-emerald-50 hover:bg-emerald-100 rounded-xl border border-[#cbd1db]"
      >
        Create a free account
      </button>
    </div>
  )

  const renderRegisterForm = () => (
    <div className="auth-form-animate">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-14 h-14 mb-4 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 shadow-lg shadow-emerald-500/20">
          <User className="w-7 h-7 text-white" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">Create your account</h2>
        <p className="mt-1.5 text-sm text-gray-500">Start organizing your thoughts today</p>
      </div>
      
      {/* Form Card */}
      <div className="p-6 bg-white border border-[#cbd1db] rounded-2xl shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block mb-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">First name</label>
              <div className="relative group">
                <User className="absolute w-4.5 h-4.5 text-gray-400 transition-colors -translate-y-1/2 left-3.5 top-1/2 group-focus-within:text-emerald-500" />
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange('firstName', e.target.value)}
                  className={`w-full pl-11 pr-4 py-3 bg-gray-50/80 border rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-gray-900 placeholder-gray-400 text-sm ${
                    errors.firstName ? 'border-red-300' : 'border-[#cbd1db]'
                  }`}
                  placeholder="John"
                />
              </div>
              {errors.firstName && <p className="mt-1 text-sm text-red-600">{errors.firstName}</p>}
            </div>
            <div>
              <label className="block mb-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Last name</label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => handleInputChange('lastName', e.target.value)}
                className={`w-full px-4 py-3 bg-gray-50/80 border rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-gray-900 placeholder-gray-400 text-sm ${
                  errors.lastName ? 'border-red-300' : 'border-[#cbd1db]'
                }`}
                placeholder="Doe"
              />
              {errors.lastName && <p className="mt-1 text-sm text-red-600">{errors.lastName}</p>}
            </div>
          </div>
          <div>
            <label className="block mb-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Email Address</label>
            <div className="relative group">
              <Mail className="absolute w-4.5 h-4.5 text-gray-400 transition-colors -translate-y-1/2 left-3.5 top-1/2 group-focus-within:text-emerald-500" />
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className={`w-full pl-11 pr-4 py-3 bg-gray-50/80 border rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-gray-900 placeholder-gray-400 text-sm ${
                  errors.email ? 'border-red-300' : 'border-[#cbd1db]'
                }`}
                placeholder="john.doe@example.com"
              />
            </div>
            {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
          </div>
          <div>
            <label className="block mb-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Password</label>
            <div className="relative group">
              <Lock className="absolute w-4.5 h-4.5 text-gray-400 transition-colors -translate-y-1/2 left-3.5 top-1/2 group-focus-within:text-emerald-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                className={`w-full pl-11 pr-12 py-3 bg-gray-50/80 border rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-gray-900 placeholder-gray-400 text-sm ${
                  errors.password ? 'border-red-300' : 'border-[#cbd1db]'
                }`}
                placeholder="At least 8 characters"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute p-1.5 text-gray-400 -translate-y-1/2 rounded-lg right-3 top-1/2 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {formData.password && (
              <div className="mt-2">
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map((level) => (
                    <div
                      key={level}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        formData.password.length >= level * 3
                          ? level <= 1
                            ? 'bg-red-400'
                            : level <= 2
                            ? 'bg-orange-400'
                            : level <= 3
                            ? 'bg-yellow-400'
                            : 'bg-emerald-500'
                          : 'bg-gray-200'
                      }`}
                    />
                  ))}
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  {formData.password.length < 4 ? 'Too short' : formData.password.length < 7 ? 'Weak' : formData.password.length < 10 ? 'Good' : 'Strong'}
                </p>
              </div>
            )}
            {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
          </div>
          <div>
            <label className="block mb-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Confirm Password</label>
            <div className="relative group">
              <Lock className="absolute w-4.5 h-4.5 text-gray-400 transition-colors -translate-y-1/2 left-3.5 top-1/2 group-focus-within:text-emerald-500" />
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                className={`w-full pl-11 pr-4 py-3 bg-gray-50/80 border rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-gray-900 placeholder-gray-400 text-sm ${
                  errors.confirmPassword ? 'border-red-300' : 'border-[#cbd1db]'
                }`}
                placeholder="Repeat password"
              />
            </div>
            {errors.confirmPassword && <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>}
          </div>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.agreeToTerms}
              onChange={(e) => handleInputChange('agreeToTerms', e.target.checked)}
              className={`mt-0.5 w-4 h-4 rounded border-[#cbd1db] text-emerald-600 focus:ring-emerald-500 ${
                errors.agreeToTerms ? 'border-red-300' : ''
              }`}
            />
            <span className="text-sm text-gray-500 leading-tight">
              I agree to the{' '}
              <button type="button" onClick={() => useUIStore.getState().setTermsModalOpen(true)} className="text-emerald-600 hover:text-emerald-700 font-medium">Terms of Service</button>{' '}
              and{' '}
              <button type="button" onClick={() => useUIStore.getState().setPrivacyModalOpen(true)} className="text-emerald-600 hover:text-emerald-700 font-medium">Privacy Policy</button>
            </span>
          </label>
          {errors.agreeToTerms && <p className="text-sm text-red-600">{errors.agreeToTerms}</p>}
          <button
            type="submit"
            disabled={isLoading}
            className="relative flex items-center justify-center w-full px-4 py-3 space-x-2 font-semibold text-white transition-all rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-60 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 hover:-translate-y-0.5 active:translate-y-0"
          >
            {isLoading ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <span>Create account</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>
      </div>
      
      <p className="text-sm text-center text-gray-500 mt-6">
        Already have an account?{' '}
        <button onClick={() => setMode('login')} className="font-medium text-emerald-600 hover:text-emerald-700 transition-colors">
          Sign in
        </button>
      </p>
    </div>
  )

  const renderConfirmation = () => (
    <div className="space-y-6 auth-form-animate">
      <div className="text-center">
        <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100">
          <Mail className="w-8 h-8 text-emerald-600" />
        </div>
        <h2 className="text-3xl font-bold tracking-tight text-gray-900">Check your email</h2>
        <p className="mt-2 text-gray-500">
          We've sent a confirmation link to<br />
          <span className="font-semibold text-gray-900">{formData.email}</span>
        </p>
      </div>
      <div className="p-4 border bg-emerald-50/80 border-emerald-200/50 rounded-xl">
        <div className="flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-emerald-800">
            <p className="font-semibold">Almost there!</p>
            <p className="mt-1 text-emerald-700">Click the link in your email to verify your account, then you can sign in.</p>
          </div>
        </div>
      </div>
      <div className="space-y-4 text-center">
        <p className="text-sm text-gray-400">Didn't receive the email? Check your spam folder.</p>
        <button
          onClick={() => {
            setMode('login')
            setFormData({ ...formData, password: '', confirmPassword: '' })
          }}
          className="flex items-center justify-center w-full px-4 py-3 space-x-2 font-semibold text-white transition-all rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-lg shadow-emerald-500/20 hover:-translate-y-0.5 active:translate-y-0"
        >
          <span>Back to sign in</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  )

  const renderForgotPassword = () => (
    <div className="auth-form-animate">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-14 h-14 mb-4 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 shadow-lg shadow-emerald-500/20">
          <Lock className="w-7 h-7 text-white" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">Reset password</h2>
        <p className="mt-1.5 text-sm text-gray-500">Enter your email and we'll send you a reset link</p>
      </div>
      
      {/* Form Card */}
      <div className="p-6 bg-white border border-[#cbd1db] rounded-2xl shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block mb-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Email Address</label>
            <div className="relative group">
              <Mail className="absolute w-4.5 h-4.5 text-gray-400 transition-colors -translate-y-1/2 left-3.5 top-1/2 group-focus-within:text-emerald-500" />
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className={`w-full pl-11 pr-4 py-3 bg-gray-50/80 border rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-gray-900 placeholder-gray-400 text-sm ${
                  errors.email ? 'border-red-300' : 'border-[#cbd1db]'
                }`}
                placeholder="you@example.com"
              />
            </div>
            {errors.email && (
              <p className={`mt-1.5 text-sm flex items-center gap-1 ${errors.email.includes('sent') ? 'text-emerald-600' : 'text-red-600'}`}>
                {errors.email.includes('sent') ? <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />}
                {errors.email}
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="relative flex items-center justify-center w-full px-4 py-3 space-x-2 font-semibold text-white transition-all rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-60 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 hover:-translate-y-0.5 active:translate-y-0"
          >
            {isLoading ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <span>Send reset link</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>
      </div>
      
      <p className="text-sm text-center text-gray-500 mt-6">
        <button onClick={() => setMode('login')} className="font-medium text-emerald-600 hover:text-emerald-700 transition-colors">
          {"\u2190"} Back to sign in
        </button>
      </p>
    </div>
  )

  return (
    <div className="flex min-h-screen">
      {/* Left Side - Hero/Brand Panel */}
      <div className="relative flex-col justify-between hidden overflow-hidden text-white lg:flex lg:w-[55%] bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute w-[500px] h-[500px] bg-emerald-400/20 rounded-full -top-20 -left-20 blur-3xl auth-float" />
          <div className="absolute w-[400px] h-[400px] bg-teal-400/15 rounded-full bottom-10 right-0 blur-3xl auth-float-delayed" />
          <div className="absolute w-[300px] h-[300px] bg-emerald-300/10 rounded-full top-1/2 left-1/3 blur-3xl auth-float-slow" />
          {/* Grid pattern overlay */}
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />
        </div>

        <div className="relative z-10 flex flex-col justify-between h-full px-12 py-10 xl:px-16">
          {/* Logo */}
          <div className={`transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-11 h-11 bg-white/15 rounded-xl backdrop-blur-sm border border-white/10">
                <FileText className="w-6 h-6" />
              </div>
              <span className="text-xl font-bold tracking-tight">QuickNotes</span>
            </div>
          </div>

          {/* Main Hero Content */}
          <div className="flex-1 flex flex-col justify-center py-8">
            <div className={`transition-all duration-700 delay-100 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-6 text-xs font-medium bg-white/10 rounded-full backdrop-blur-sm border border-white/10">
                <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                Free & Open Source
              </div>
              <h1 className="mb-4 text-4xl font-bold leading-tight tracking-tight xl:text-5xl">
                Your thoughts,<br />
                <span className="text-emerald-200">organized beautifully.</span>
              </h1>
              <p className="text-lg leading-relaxed text-emerald-100/80 max-w-md">
                A powerful note-taking workspace with rich text editing, cloud sync, and offline support.
              </p>
            </div>

            {/* Feature Grid */}
            <div className={`grid grid-cols-3 gap-3 mt-10 transition-all duration-700 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              {features.map((feature, index) => {
                const Icon = feature.icon
                return (
                  <div key={index} className="flex items-start gap-3 p-3 transition-colors rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.06]">
                    <div className="flex-shrink-0 p-2 rounded-lg bg-white/10">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold leading-tight">{feature.title}</h3>
                      <p className="mt-0.5 text-xs leading-snug text-emerald-200/60">{feature.description}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Bottom Stats */}
          <div className={`transition-all duration-700 delay-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <div className="flex items-center gap-8 pt-6 border-t border-white/10">
              {stats.map((stat, index) => (
                <div key={index}>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-emerald-200/60 mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Auth Forms */}
      <div className="flex flex-col flex-1 bg-white">
        {/* Mobile logo */}
        <div className="flex items-center justify-center py-6 lg:hidden">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 shadow-lg shadow-emerald-500/20">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">QuickNotes</span>
          </div>
        </div>

        {/* Form Container */}
        <div className="flex items-center justify-center flex-1 px-6 py-8 sm:px-8">
          <div className="w-full max-w-[420px]">
            {mode === 'login' && renderLoginForm()}
            {mode === 'register' && renderRegisterForm()}
            {mode === 'confirmation' && renderConfirmation()}
            {mode === 'forgot' && renderForgotPassword()}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-6">
          <div className="max-w-[420px] mx-auto">
            <div className="flex items-center justify-center gap-6 mb-3">
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <Shield className="w-3.5 h-3.5" />
                <span>Secure</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <Lock className="w-3.5 h-3.5" />
                <span>Self-Hosted</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Open Source</span>
              </div>
            </div>
            <div className="flex justify-center gap-6 text-xs text-gray-400">
              <button onClick={() => useUIStore.getState().setHelpModalOpen(true)} className="hover:text-gray-600 transition-colors">Help</button>
              <button onClick={() => useUIStore.getState().setPrivacyModalOpen(true)} className="hover:text-gray-600 transition-colors">Privacy</button>
              <button onClick={() => useUIStore.getState().setTermsModalOpen(true)} className="hover:text-gray-600 transition-colors">Terms</button>
            </div>
          </div>
        </div>
      </div>
      <HelpModal />
      <PrivacyModal />
      <TermsModal />
    </div>
  )
}
