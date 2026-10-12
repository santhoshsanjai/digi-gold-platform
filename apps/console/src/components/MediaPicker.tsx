import { useState } from 'react'
import { Button, Empty, Modal, Pagination, Spin, Upload } from 'antd'
import { ImagePlus } from 'lucide-react'
import { toast } from 'sonner'
import { errorMessage } from '@digigold/web-common/utils/errors.ts'
import { useMediaQuery, useUploadMediaMutation } from '../store/api/consoleApi.ts'

const PAGE_SIZE = 24
export const IMAGE_ACCEPT = 'image/png,image/jpeg,image/gif,image/webp,image/x-icon,.ico'

interface MediaPickerProps {
  tenantId: string
  open: boolean
  onClose: () => void
  onPick: (url: string) => void
}

/** The client's image library: pick one, or upload a new one and use it straight away. */
export function MediaPicker({ tenantId, open, onClose, onPick }: MediaPickerProps) {
  const [page, setPage] = useState(1)
  const { data, isFetching } = useMediaQuery(
    { tenantId, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE },
    { skip: !open },
  )
  const [upload, { isLoading: uploading }] = useUploadMediaMutation()

  const pick = (url: string) => {
    onPick(url)
    onClose()
  }

  const onUpload = async (file: File) => {
    try {
      const asset = await upload({ tenantId, file }).unwrap()
      pick(asset.url)
    } catch (e) {
      toast.error(errorMessage(e))
    }
    return false
  }

  return (
    <Modal title="Choose an image" open={open} onCancel={onClose} footer={null} width={760}>
      <div className="mb-4">
        <Upload accept={IMAGE_ACCEPT} showUploadList={false} beforeUpload={onUpload}>
          <Button icon={<ImagePlus size={16} />} loading={uploading}>
            Upload new image
          </Button>
        </Upload>
      </div>
      <Spin spinning={isFetching}>
        {data && data.items.length === 0 ? (
          <Empty description="No images yet" />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {data?.items.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => pick(m.url)}
                title={m.filename}
                className="group cursor-pointer rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-1 text-left hover:border-primary-500"
              >
                <img
                  src={m.url}
                  alt={m.filename}
                  loading="lazy"
                  className="h-24 w-full object-contain rounded"
                />
                <span className="block truncate text-xs mt-1 text-slate-500">{m.filename}</span>
              </button>
            ))}
          </div>
        )}
      </Spin>
      {(data?.total ?? 0) > PAGE_SIZE && (
        <Pagination
          className="mt-4"
          size="small"
          current={page}
          pageSize={PAGE_SIZE}
          total={data?.total}
          onChange={setPage}
        />
      )}
    </Modal>
  )
}
