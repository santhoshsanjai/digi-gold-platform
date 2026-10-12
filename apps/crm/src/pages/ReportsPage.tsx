import { Result } from 'antd'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/common/PageHeader.tsx'
import { useAuth } from '../providers/authContext.ts'

/** Placeholder until the reporting endpoints exist; links to what is available today. */
export default function ReportsPage() {
  const { can } = useAuth()
  return (
    <>
      <PageHeader title="Reports" />
      <Result
        status="info"
        title="Reports are on the way"
        subTitle="Collections by day, gold held per customer and redemptions by store will appear here."
        extra={
          <div className="flex flex-wrap justify-center gap-4">
            {can('dashboard:view') && <Link to="/">Today's figures</Link>}
            {can('payments:view') && <Link to="/payments">All payments</Link>}
            {can('redemptions:view') && <Link to="/redemptions">All redemptions</Link>}
          </div>
        }
      />
    </>
  )
}
