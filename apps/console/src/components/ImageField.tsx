import { useState } from 'react'
import { Button, Input } from 'antd'
import { Image as ImageIcon, X } from 'lucide-react'
import { MediaPicker } from './MediaPicker.tsx'

interface ImageFieldProps {
  tenantId: string
  value?: string
  onChange?: (value: string) => void
  id?: string
}

/** An image address with a thumbnail, filled from the image library or typed in. */
export function ImageField({ tenantId, value = '', onChange, id }: ImageFieldProps) {
  const [picking, setPicking] = useState(false)
  return (
    <div className="flex items-center gap-2">
      <div className="h-10 w-10 shrink-0 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
        {value ? (
          <img src={value} alt="" className="max-h-full max-w-full object-contain" />
        ) : (
          <ImageIcon size={16} className="text-slate-400" />
        )}
      </div>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder="https://…"
      />
      <Button onClick={() => setPicking(true)}>Choose</Button>
      {value && (
        <Button aria-label="Remove image" icon={<X size={14} />} onClick={() => onChange?.('')} />
      )}
      <MediaPicker
        tenantId={tenantId}
        open={picking}
        onClose={() => setPicking(false)}
        onPick={(url) => onChange?.(url)}
      />
    </div>
  )
}
