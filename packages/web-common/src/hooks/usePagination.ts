import { useState } from 'react'
import type { TablePaginationConfig } from 'antd'

/** Page state for a server-paged antd Table: query params plus the Table's pagination prop. */
export function usePagination(pageSize = 20) {
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(pageSize)

  const params = { limit: size, offset: (page - 1) * size }

  const pagination = (total: number | undefined): TablePaginationConfig => ({
    current: page,
    pageSize: size,
    total: total ?? 0,
    showSizeChanger: true,
    pageSizeOptions: [10, 20, 50, 100],
    showTotal: (t) => `${t} total`,
    onChange: (p, s) => {
      setPage(s !== size ? 1 : p)
      setSize(s)
    },
  })

  return { params, pagination, reset: () => setPage(1) }
}
