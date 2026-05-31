import { useCallback, useEffect, useRef, useState } from 'react'

function getSpeechRecognition() {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

/**
 * Browser speech-to-text (Chrome, Edge, Safari). Appends final transcripts via onAppend.
 */
export function useSpeechDictation({ onAppend, lang = 'en-GB' } = {}) {
  const [listening, setListening] = useState(false)
  const [supported, setSupported] = useState(false)
  const [speechError, setSpeechError] = useState('')
  const recognitionRef = useRef(null)

  useEffect(() => {
    setSupported(Boolean(getSpeechRecognition()))
  }, [])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setListening(false)
  }, [])

  const start = useCallback(() => {
    setSpeechError('')
    const SpeechRecognition = getSpeechRecognition()
    if (!SpeechRecognition) {
      setSpeechError('Dictation is not supported in this browser. Try Chrome or Edge.')
      return
    }

    stop()

    const recognition = new SpeechRecognition()
    recognition.lang = lang
    recognition.continuous = true
    recognition.interimResults = false
    recognition.onresult = (event) => {
      let chunk = ''
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        if (event.results[i].isFinal) {
          chunk += event.results[i][0].transcript
        }
      }
      const text = chunk.trim()
      if (text && onAppend) onAppend(text)
    }
    recognition.onerror = (event) => {
      if (event.error === 'aborted' || event.error === 'no-speech') return
      setSpeechError(
        event.error === 'not-allowed'
          ? 'Microphone permission denied. Allow mic access for this site in browser settings.'
          : `Dictation error: ${event.error}`,
      )
      setListening(false)
    }
    recognition.onend = () => {
      setListening(false)
      recognitionRef.current = null
    }

    recognitionRef.current = recognition
    recognition.start()
    setListening(true)
  }, [lang, onAppend, stop])

  const toggle = useCallback(() => {
    if (listening) stop()
    else start()
  }, [listening, start, stop])

  useEffect(() => () => stop(), [stop])

  return { listening, supported, speechError, toggle, stop }
}
