"use client"

import { useState, useEffect } from 'react'
import { getPlayerSettings, updatePlayerSettings, type PlayerSettings } from '@/lib/player-profile'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  walletAddress: string
}

export default function SettingsModal({ isOpen, onClose, walletAddress }: SettingsModalProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<PlayerSettings | null>(null)
  
  // Local state for form
  const [confirmMoves, setConfirmMoves] = useState(false)
  const [highlightLegalMoves, setHighlightLegalMoves] = useState(true)
  const [autoQueenPromotion, setAutoQueenPromotion] = useState(true)

  useEffect(() => {
    if (isOpen && walletAddress) {
      loadSettings()
    }
  }, [isOpen, walletAddress])

  const loadSettings = async () => {
    setLoading(true)
    const data = await getPlayerSettings(walletAddress)
    
    if (data) {
      setSettings(data)
      setConfirmMoves(data.confirm_moves)
      setHighlightLegalMoves(data.highlight_legal_moves)
      setAutoQueenPromotion(data.auto_queen_promotion)
    }
    
    setLoading(false)
  }

  const handleSave = async () => {
    setSaving(true)
    
    const success = await updatePlayerSettings(walletAddress, {
      confirm_moves: confirmMoves,
      highlight_legal_moves: highlightLegalMoves,
      auto_queen_promotion: autoQueenPromotion
    })
    
    if (success) {
      alert('✅ Settings saved!')
      onClose()
    } else {
      alert('❌ Failed to save settings. Please try again.')
    }
    
    setSaving(false)
  }

  const handleCancel = () => {
    // Reset to original values
    if (settings) {
      setConfirmMoves(settings.confirm_moves)
      setHighlightLegalMoves(settings.highlight_legal_moves)
      setAutoQueenPromotion(settings.auto_queen_promotion)
    }
    onClose()
  }

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-gray-800 rounded-2xl border border-purple-500/40 shadow-2xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            ⚙️ Game Settings
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin h-8 w-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-3"></div>
            <p className="text-gray-400">Loading settings...</p>
          </div>
        ) : (
          <>
            <div className="space-y-4 mb-6">
              <label className="flex items-center gap-3 p-3 bg-gray-700/50 rounded-xl hover:bg-gray-700 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmMoves}
                  onChange={(e) => setConfirmMoves(e.target.checked)}
                  className="w-5 h-5 rounded border-gray-500 text-purple-500 focus:ring-purple-500"
                />
                <div>
                  <p className="text-white font-semibold">Confirm Moves</p>
                  <p className="text-xs text-gray-400">Require confirmation before making each move</p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 bg-gray-700/50 rounded-xl hover:bg-gray-700 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={highlightLegalMoves}
                  onChange={(e) => setHighlightLegalMoves(e.target.checked)}
                  className="w-5 h-5 rounded border-gray-500 text-purple-500 focus:ring-purple-500"
                />
                <div>
                  <p className="text-white font-semibold">Highlight Legal Moves</p>
                  <p className="text-xs text-gray-400">Show dots on valid squares when piece selected</p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 bg-gray-700/50 rounded-xl hover:bg-gray-700 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoQueenPromotion}
                  onChange={(e) => setAutoQueenPromotion(e.target.checked)}
                  className="w-5 h-5 rounded border-gray-500 text-purple-500 focus:ring-purple-500"
                />
                <div>
                  <p className="text-white font-semibold">Auto-Promote to Queen</p>
                  <p className="text-xs text-gray-400">Automatically promote pawns to queen (or show choice)</p>
                </div>
              </label>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCancel}
                className="flex-1 px-6 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-white font-bold transition-all"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold transition-all disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
