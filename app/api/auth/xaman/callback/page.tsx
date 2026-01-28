'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function XamanCallback() {
  const router = useRouter()
  const [status, setStatus] = useState('Verifying login...')

  useEffect(() => {
    const verifyLogin = async () => {
      try {
        // Get UUID from sessionStorage
        const uuid = sessionStorage.getItem('xaman_signin_uuid')
        
        console.log('[CALLBACK] Starting verification for UUID:', uuid)
        
        if (!uuid) {
          throw new Error('No login session found')
        }

        setStatus('Checking signature...')

        // Poll the verify API (same as desktop)
        let attempts = 0
        const maxAttempts = 30
        
        while (attempts < maxAttempts) {
          attempts++
          console.log(`[CALLBACK] Attempt ${attempts}/${maxAttempts}`)
          
          const response = await fetch(`/api/auth/xaman/verify-signin/${uuid}`)
          const data = await response.json()
          
          console.log('[CALLBACK] Response:', data)
          
          if (data.signed && data.account) {
            console.log('[CALLBACK] ✅ Login successful!')
            
            // Save to localStorage
            localStorage.setItem('playerID', data.account)
            
            // Clear session storage
            sessionStorage.clear()
            
            setStatus('Login successful! Redirecting...')
            
            // Redirect to chess
            setTimeout(() => {
              router.push('/chess')
            }, 500)
            return
          } else if (data.signed === false) {
            throw new Error('Login was cancelled')
          }
          
          // Wait 1 second before next attempt
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
        
        throw new Error('Login verification timed out')
        
      } catch (error: any) {
        console.error('[CALLBACK] Error:', error)
        setStatus('Login failed')
        alert(error.message || 'Login failed')
        
        setTimeout(() => {
          router.push('/chess')
        }, 1500)
      }
    }

    verifyLogin()
  }, [router])

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl p-8 max-w-md w-full text-center border border-gray-700">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-white border-t-transparent mx-auto mb-4"></div>
        <h1 className="text-2xl font-bold text-white mb-2">Connecting Wallet</h1>
        <p className="text-gray-400">{status}</p>
      </div>
    </div>
  )
}