/**
 * Keeps the focused field above the on-screen keyboard.
 *
 * Android apps now draw edge to edge, so the window no longer shrinks for the keyboard and
 * React Native's KeyboardAvoidingView cannot be relied on there. Instead the scroll view gets
 * bottom padding the height of the keyboard, and a field that would end up underneath it is
 * scrolled into view when it gains focus.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Keyboard,
  Platform,
  ScrollView,
  View,
  useWindowDimensions,
  type KeyboardEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
} from 'react-native'

const GAP = 24

/** The part of the screen the keyboard covers, 0 when it is closed. */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0)
  useEffect(() => {
    const show = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hide = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'
    const a = Keyboard.addListener(show, (e: KeyboardEvent) => setHeight(e.endCoordinates.height))
    const b = Keyboard.addListener(hide, () => setHeight(0))
    return () => {
      a.remove()
      b.remove()
    }
  }, [])
  return height
}

type Reveal = (target: View | null) => void
const RevealContext = createContext<Reveal>(() => {})

/** Fields call this on focus with their outer view. */
export const useRevealOnFocus = () => useContext(RevealContext)

/** A ScrollView that makes room for the keyboard and scrolls the focused field into view.
 * `keyboard` is the covered height (from useKeyboardHeight), so a caller can also lift a
 * footer that sits outside the scroll view. */
export function KeyboardScroll({
  keyboard,
  covered = 0,
  padForKeyboard = true,
  children,
  contentContainerStyle,
  ...rest
}: ScrollViewProps & {
  keyboard: number
  /** Extra height hidden at the bottom while typing, such as a footer lifted above the keyboard. */
  covered?: number
  /** Add room for the keyboard below the content (off when the whole page already shrinks). */
  padForKeyboard?: boolean
  children: ReactNode
}) {
  const scroll = useRef<ScrollView>(null)
  const offset = useRef(0)
  const pending = useRef<View | null>(null)
  const { height: windowHeight } = useWindowDimensions()

  const revealNow = useCallback(
    (target: View, hidden: number) => {
      target.measureInWindow((_x, y, _w, h) => {
        const visibleBottom = windowHeight - hidden - covered - GAP
        const visibleTop = GAP * 2
        if (y + h > visibleBottom) {
          scroll.current?.scrollTo({ y: offset.current + (y + h - visibleBottom), animated: true })
        } else if (y < visibleTop) {
          scroll.current?.scrollTo({ y: Math.max(0, offset.current - (visibleTop - y)), animated: true })
        }
      })
    },
    [windowHeight, covered],
  )

  // When the keyboard opens, bring the field that asked for it into view.
  useEffect(() => {
    if (keyboard > 0 && pending.current) {
      const target = pending.current
      // Wait a frame for the new bottom padding to lay out.
      const t = setTimeout(() => revealNow(target, keyboard), 60)
      return () => clearTimeout(t)
    }
  }, [keyboard, revealNow])

  const reveal = useCallback<Reveal>(
    (target) => {
      pending.current = target
      if (target && keyboard > 0) setTimeout(() => revealNow(target, keyboard), 60)
    },
    [keyboard, revealNow],
  )

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    offset.current = e.nativeEvent.contentOffset.y
    rest.onScroll?.(e)
  }

  const value = useMemo(() => reveal, [reveal])
  return (
    <RevealContext.Provider value={value}>
      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        scrollEventThrottle={32}
        {...rest}
        onScroll={onScroll}
        contentContainerStyle={[contentContainerStyle, padForKeyboard && keyboard > 0 ? { paddingBottom: keyboard + GAP } : null]}
      >
        {children}
      </ScrollView>
    </RevealContext.Provider>
  )
}
