"use client"

interface GameResultModalProps {
  isOpen: boolean
  result: 'win' | 'loss' | 'draw'
  oldRank: number
  newRank: number
  onReturnToLobby: () => void
}

export default function GameResultModal({ 
  isOpen, 
  result, 
  oldRank, 
  newRank, 
  onReturnToLobby 
}: GameResultModalProps) {
  if (!isOpen) return null

  const resultText = result === 'win' ? "You Won!" : result === 'loss' ? "You Lost!" : "Draw!"
  const resultColor = result === 'win' ? "from-green-600 to-emerald-600" : result === 'loss' ? "from-red-600 to-rose-600" : "from-yellow-600 to-amber-600"
  const resultEmoji = result === 'win' ? "🎉" : result === 'loss' ? "😔" : "🤝"

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl border border-purple-500/40 shadow-2xl max-w-md w-full p-8 text-center">
        <div className="text-6xl mb-4">{resultEmoji}</div>
        
        <h2 className={`text-4xl font-bold bg-gradient-to-r ${resultColor} bg-clip-text text-transparent mb-6`}>
          {resultText}
        </h2>

        <div className="bg-gray-700/50 rounded-xl p-4 mb-6">
          <p className="text-sm text-gray-400 mb-2">Rank Change</p>
          <div className="flex items-center justify-center gap-3 text-2xl font-bold">
            <span className="text-white">{oldRank}</span>
            <span className="text-gray-400">→</span>
            <span className={newRank > oldRank ? "text-green-400" : newRank < oldRank ? "text-red-400" : "text-yellow-400"}>
              {newRank}
            </span>
          </div>
          {newRank > oldRank && (
            <p className="text-green-400 text-sm mt-2">+{newRank - oldRank} ELO</p>
          )}
          {newRank < oldRank && (
            <p className="text-red-400 text-sm mt-2">{newRank - oldRank} ELO</p>
          )}
        </div>

        <button
          onClick={onReturnToLobby}
          className="w-full px-6 py-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-lg transition-all shadow-xl"
        >
          Return to Lobby
        </button>
      </div>
    </div>
  )
}
