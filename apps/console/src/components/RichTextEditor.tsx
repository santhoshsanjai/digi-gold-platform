import { lazy, Suspense } from 'react'
import { Skeleton } from 'antd'

export interface RichTextEditorProps {
  value?: string
  onChange?: (html: string) => void
}

// Jodit is large, so it loads only when a page with text sections is opened.
const Editor = lazy(() => import('./JoditField.tsx'))

/** Formatted text: headings, bold, lists, links and quotes. The API removes anything else. */
export function RichTextEditor(props: RichTextEditorProps) {
  return (
    <Suspense fallback={<Skeleton active paragraph={{ rows: 4 }} />}>
      <Editor {...props} />
    </Suspense>
  )
}
