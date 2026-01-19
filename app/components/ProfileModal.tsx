"use client"

import { useState, useEffect } from 'react'
import { getPlayerStats, type PlayerProfile } from '@/lib/player-profile'

interface ProfileModalProps {
  isOpen: boolean
  onClose: () => void
  walletAddress: string
}

export default function ProfileModal({ isOpen, onClose, walletAddress }: ProfileModalProps) {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<PlayerProfile | null>(null)

  useEffect(() => {
    if (isOpen && walletAddress) {
      loadProfile()
    }
  }, [isOpen, walletAddress])

  const loadProfile = async () => {
    console.log('👤 [Profile] Loading profile for:', walletAddress)
    setLoading(true)
    
    const data = await getPlayerStats(walletAddress)
    
    if (data) {
      console.log('👤 [Profile] Profile loaded:', data)
      setProfile(data)
    } else {
      console.error('👤 [Profile] Failed to load profile')
    }
    
    setLoading(false)
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
            👤 Player Profile
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
            <p className="text-gray-400">Loading profile...</p>
          </div>
        ) : profile ? (
          <div className="space-y-4">
            <div className="bg-gray-700/50 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-1">Wallet Address</p>
              <p className="font-mono text-sm text-cyan-200 break-all">
                {walletAddress.length > 20 
                  ? `${walletAddress.slice(0, 10)}...${walletAddress.slice(-10)}` 
                  : walletAddress
                }
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-xl p-4 border border-purple-500/30">
                <p className="text-xs text-gray-400 mb-1">Bot Rank</p>
                <p className="text-3xl font-bold text-white">{profile.bot_elo}</p>
              </div>

              <div className="bg-gradient-to-br from-blue-600/20 to-cyan-600/20 rounded-xl p-4 border border-blue-500/30">
                <p className="text-xs text-gray-400 mb-1">Total Games</p>
                <p className="text-3xl font-bold text-white">{profile.total_games}</p>
              </div>
            </div>

            <div className="bg-gray-700/50 rounded-xl p-4">
              <p className="text-sm text-gray-400 mb-3">Bot Game Record</p>
              <div className="flex items-center justify-around">
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-400">{profile.bot_wins}</p>
                  <p className="text-xs text-gray-400">Wins</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-400">{profile.bot_losses}</p>
                  <p className="text-xs text-gray-400">Losses</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-yellow-400">{profile.bot_draws}</p>
                  <p className="text-xs text-gray-400">Draws</p>
                </div>
              </div>
            </div>

            <div className="text-center text-xs text-gray-500">
              Record: {profile.bot_wins}W-{profile.bot_losses}L-{profile.bot_draws}D
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-red-400">Failed to load profile</p>
            <button
              onClick={loadProfile}
              className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-white text-sm"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
