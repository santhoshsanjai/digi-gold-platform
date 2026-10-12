import { useMemo } from 'react'
import JoditEditor from 'jodit-react'
import { useTheme } from '../providers/themeContext.ts'
import type { RichTextEditorProps } from './RichTextEditor.tsx'

// Matches the tags the API keeps; see clean_html in apps/api/app/schemas/website.py.
const BUTTONS = [
  'paragraph',
  'bold',
  'italic',
  'underline',
  'strikethrough',
  '|',
  'ul',
  'ol',
  '|',
  'link',
  'hr',
  '|',
  'undo',
  'redo',
  'eraser',
]

export default function JoditField({ value = '', onChange }: RichTextEditorProps) {
  const { mode } = useTheme()
  const config = useMemo(
    () => ({
      theme: mode === 'dark' ? 'dark' : 'default',
      minHeight: 220,
      toolbarAdaptive: false,
      buttons: BUTTONS,
      statusbar: false,
      askBeforePasteHTML: false,
      askBeforePasteFromWord: false,
      defaultActionOnPaste: 'insert_clear_html' as const,
      controls: {
        paragraph: {
          list: { p: 'Normal', h2: 'Heading 2', h3: 'Heading 3', h4: 'Heading 4', blockquote: 'Quote' },
        },
      },
    }),
    [mode],
  )
  // Saving on blur, not on every key, keeps the cursor steady while typing.
  return <JoditEditor value={value} config={config} onBlur={(html) => onChange?.(html)} />
}
