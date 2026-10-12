import { Button, Result } from 'antd'
import { Link } from 'react-router-dom'

export const NotFoundPage = () => (
  <Result
    status="404"
    title="Page not found"
    subTitle="The page you opened does not exist."
    extra={
      <Link to="/">
        <Button type="primary">Back to home</Button>
      </Link>
    }
  />
)
