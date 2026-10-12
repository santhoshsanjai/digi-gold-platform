import { App, Button, Empty, Pagination, Spin, Upload } from 'antd'
import { Copy, ImagePlus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Card } from '@digigold/web-common/components/ui/Card.tsx'
import { errorMessage } from '@digigold/web-common/utils/errors.ts'
import type { MediaAsset, Tenant } from '../../api/types.ts'
import { IMAGE_ACCEPT } from '../../components/MediaPicker.tsx'
import {
  useDeleteMediaMutation,
  useMediaQuery,
  useUploadMediaMutation,
} from '../../store/api/consoleApi.ts'

const PAGE_SIZE = 24
const kb = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`

export function ImagesTab({ tenant }: { tenant: Tenant }) {
  const [page, setPage] = useState(1)
  const { data, isFetching } = useMediaQuery({
    tenantId: tenant.id,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  })
  const [upload, { isLoading: uploading }] = useUploadMediaMutation()
  const [remove] = useDeleteMediaMutation()
  const { modal } = App.useApp()

  const onUpload = async (file: File) => {
    try {
      await upload({ tenantId: tenant.id, file }).unwrap()
      toast.success(`${file.name} uploaded`)
    } catch (e) {
      toast.error(`${file.name}: ${errorMessage(e)}`)
    }
    return false
  }

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Image address copied')
    } catch {
      toast.error('Could not copy. Select the address and copy it instead.')
    }
  }

  const confirmDelete = (m: MediaAsset) =>
    modal.confirm({
      title: `Delete ${m.filename}?`,
      content: 'Pages or branding that still use this image will show a broken image.',
      okText: 'Delete',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await remove({ tenantId: tenant.id, mediaId: m.id }).unwrap()
          toast.success('Image deleted')
        } catch (e) {
          toast.error(errorMessage(e))
        }
      },
    })

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <p className="m-0 text-sm text-slate-500 dark:text-slate-400">
          PNG, JPEG, GIF, WebP or ICO, up to 5 MB each.
        </p>
        <Upload accept={IMAGE_ACCEPT} multiple showUploadList={false} beforeUpload={onUpload}>
          <Button type="primary" icon={<ImagePlus size={16} />} loading={uploading}>
            Upload images
          </Button>
        </Upload>
      </div>
      <Spin spinning={isFetching}>
        {data && data.items.length === 0 ? (
          <Empty description="No images yet" />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {data?.items.map((m) => (
              <figure
                key={m.id}
                className="m-0 rounded-lg border border-slate-200 dark:border-slate-700 p-2"
              >
                <a href={m.url} target="_blank" rel="noreferrer">
                  <img
                    src={m.url}
                    alt={m.filename}
                    loading="lazy"
                    className="h-28 w-full object-contain rounded bg-slate-50 dark:bg-slate-800"
                  />
                </a>
                <figcaption className="mt-2 text-xs">
                  <span className="block truncate font-medium" title={m.filename}>
                    {m.filename}
                  </span>
                  <span className="text-slate-500">{kb(m.size_bytes)}</span>
                </figcaption>
                <div className="mt-2 flex gap-1">
                  <Button size="small" icon={<Copy size={12} />} onClick={() => copy(m.url)}>
                    Copy address
                  </Button>
                  <Button
                    size="small"
                    danger
                    aria-label={`Delete ${m.filename}`}
                    icon={<Trash2 size={12} />}
                    onClick={() => confirmDelete(m)}
                  />
                </div>
              </figure>
            ))}
          </div>
        )}
      </Spin>
      {(data?.total ?? 0) > PAGE_SIZE && (
        <Pagination
          className="mt-4"
          current={page}
          pageSize={PAGE_SIZE}
          total={data?.total}
          onChange={setPage}
        />
      )}
    </Card>
  )
}
