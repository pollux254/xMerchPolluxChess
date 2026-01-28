'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function XamanCallbackPage() {
  const router = useRouter()
  const [status, setStatus] = useState('Starting...')
  const [debugInfo, setDebugInfo] = useState<string[]>([])
  
  const addDebug = (msg: string) => {
    console.log(msg)
    setDebugInfo((prev) => [...prev, msg])
  }

  useEffect(() => {
    const verifyLogin = async () => {
      try {
        addDebug('1. Callback page loaded')
        
        const uuid = sessionStorage.getItem('xaman_signin_uuid')
        
        addDebug(`2. UUID from storage: ${uuid ? uuid.substring(0, 20) + '...' : 'MISSING'}`)
        
        if (!uuid) {
          addDebug('3. ERROR: No UUID found!')
          setStatus('❌ No login session found')
          
          const keys = Object.keys(sessionStorage)
          addDebug(`SessionStorage keys: ${keys.join(', ') || 'EMPTY'}`)
          
          throw new Error('No login session found')
        }

        setStatus('Checking signature...')
        addDebug('4. Starting verification...')

        let attempts = 0
        const maxAttempts = 30
        
        while (attempts < maxAttempts) {
          attempts++
          addDebug(`5. Attempt ${attempts}/${maxAttempts}`)
          setStatus(`Checking... (${attempts}/30)`)
          
          const response = await fetch(`/api/auth/xaman/verify-signin/${uuid}`)
          const data = await response.json()
          
          addDebug(`6. Response: signed=${data.signed}, account=${data.account ? 'YES' : 'NO'}`)
          
          if (data.signed && data.account) {
            addDebug(`7. SUCCESS! Account: ${data.account}`)
            
            localStorage.setItem('playerID', data.account)
            addDebug('8. Saved to localStorage')
            
            sessionStorage.clear()
            addDebug('9. Cleared sessionStorage')
            
            setStatus('✅ Login successful! Redirecting...')
            
            setTimeout(() => {
              addDebug('10. Redirecting to /chess...')
              router.push('/chess')
            }, 1000)
            return
          } else if (data.signed === false) {
            addDebug('7. User cancelled signin')
            throw new Error('Login was cancelled')
          }
          
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }
        
        addDebug('7. TIMEOUT after 30 seconds')
        throw new Error('Login verification timed out')
        
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        addDebug(`ERROR: ${errorMessage}`)
        setStatus(`❌ ${errorMessage}`)
        
        setTimeout(() => {
          router.push('/chess')
        }, 5000)
      }
    }

    verifyLogin()
  }, [router])

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl p-6 max-w-2xl w-full border border-gray-700">
        <div className="text-center mb-6">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-white border-t-transparent mx-auto mb-4"></div>
          <h1 className="text-2xl font-bold text-white mb-2">Connecting Wallet</h1>
          <p className="text-gray-400 text-lg">{status}</p>
        </div>
        
        <div className="bg-black rounded-lg p-4 max-h-96 overflow-y-auto">
          <h3 className="text-green-400 font-mono text-sm mb-2">Debug Log:</h3>
          {debugInfo.map((msg, i) => (
            <div key={i} className="text-green-400 font-mono text-xs mb-1">
              {msg}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}