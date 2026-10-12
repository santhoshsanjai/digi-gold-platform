import { Spin } from 'antd'

export const FullPageSpinner = () => (
  <div className="min-h-[60vh] grid place-items-center">
    <Spin size="large" />
  </div>
)
