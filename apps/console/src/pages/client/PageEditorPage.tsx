import { useEffect, useRef, useState } from 'react'
import { App, Button, Dropdown, Empty, Form, Result, Spin } from 'antd'
import type { MenuProps } from 'antd'
import { ArrowDown, ArrowLeft, ArrowUp, ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { Link, useBlocker, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { PageHeader } from '@digigold/web-common/components/PageHeader.tsx'
import { StatusBadge } from '@digigold/web-common/components/StatusBadge.tsx'
import { Card } from '@digigold/web-common/components/ui/Card.tsx'
import InputContainer from '@digigold/web-common/shared-components/InputContainer.tsx'
import { errorMessage } from '@digigold/web-common/utils/errors.ts'
import { formatDateTime } from '@digigold/web-common/utils/format.ts'
import type { Section, SectionType, SitePage } from '../../api/types.ts'
import { SectionFields } from '../../components/sections/SectionFields.tsx'
import { newSection, SECTION_LABELS } from '../../components/sections/sectionTypes.ts'
import {
  useDeleteSitePageMutation,
  usePublishSitePageMutation,
  useSitePageQuery,
  useUpdateSitePageMutation,
} from '../../store/api/consoleApi.ts'
import { pageSlugRule } from '../../utils/rules.ts'

interface EditorForm {
  title: string
  slug: string
  seo_title: string
  seo_description: string
  show_in_nav: boolean
  nav_order: number
  sections: Section[]
}

const toForm = (p: SitePage): EditorForm => ({
  title: p.title,
  slug: p.slug,
  seo_title: p.seo_title,
  seo_description: p.seo_description,
  show_in_nav: p.show_in_nav,
  nav_order: p.nav_order,
  sections: p.content.sections ?? [],
})

export default function PageEditorPage() {
  const { tenantId = '', pageId = '' } = useParams()
  const { data, isLoading, error } = useSitePageQuery({ tenantId, pageId })

  if (isLoading) return <Spin className="block! mx-auto! mt-16!" />
  if (!data) {
    return (
      <Result
        status="404"
        title="Page not found"
        subTitle={errorMessage(error)}
        extra={<Link to={`/clients/${tenantId}?tab=website`}>Back to the website</Link>}
      />
    )
  }
  // Keyed by page so switching pages starts a fresh form.
  return <Editor key={data.id} tenantId={tenantId} page={data} />
}

function Editor({ tenantId, page }: { tenantId: string; page: SitePage }) {
  const [form] = Form.useForm<EditorForm>()
  const [dirty, setDirty] = useState(false)
  const [open, setOpen] = useState<Set<string>>(() => new Set())
  const [update, { isLoading: saving }] = useUpdateSitePageMutation()
  const [publish, { isLoading: publishing }] = usePublishSitePageMutation()
  const [remove] = useDeleteSitePageMutation()
  const { modal } = App.useApp()
  const navigate = useNavigate()
  const backUrl = `/clients/${tenantId}?tab=website`
  const isHome = page.slug === 'home'

  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    dirty && currentLocation.pathname !== nextLocation.pathname,
  )
  const asking = useRef(false)
  useEffect(() => {
    // The blocker changes on every render, so ask once per blocked navigation.
    if (blocker.state !== 'blocked' || asking.current) return
    asking.current = true
    modal.confirm({
      title: 'Leave without saving?',
      content: 'Your changes to this page will be lost.',
      okText: 'Leave',
      okButtonProps: { danger: true },
      cancelText: 'Stay',
      onOk: () => blocker.proceed(),
      onCancel: () => blocker.reset(),
      afterClose: () => {
        asking.current = false
      },
    })
  }, [blocker, modal])
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  /** Validates and saves the draft. Returns false when something needs fixing. */
  const save = async (): Promise<boolean> => {
    try {
      await form.validateFields()
    } catch {
      toast.error('Some fields need attention')
      return false
    }
    // `true` includes values without a field, such as each section's id and type.
    const { sections, ...meta } = form.getFieldsValue(true) as EditorForm
    try {
      const saved = await update({
        tenantId,
        pageId: page.id,
        body: { ...meta, content: { sections } },
      }).unwrap()
      // The API cleans rich text, so show what was stored.
      form.setFieldsValue(toForm(saved))
      setDirty(false)
      return true
    } catch (e) {
      toast.error(errorMessage(e))
      return false
    }
  }

  const onSave = async () => {
    if (await save()) toast.success('Draft saved. Publish when you are ready for it to go live.')
  }

  const onPublish = async () => {
    if (dirty && !(await save())) return
    try {
      await publish({ tenantId, pageId: page.id, publish: true }).unwrap()
      toast.success('Published. The page is live on the website.')
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const onUnpublish = () =>
    modal.confirm({
      title: 'Take this page off the website?',
      content: 'Visitors will no longer see it. The draft is kept so you can publish it again.',
      okText: 'Unpublish',
      onOk: async () => {
        try {
          await publish({ tenantId, pageId: page.id, publish: false }).unwrap()
          toast.success('Page unpublished')
        } catch (e) {
          toast.error(errorMessage(e))
        }
      },
    })

  const onDelete = () =>
    modal.confirm({
      title: `Delete ${page.title}?`,
      content: 'The page and its draft are removed from the website for good.',
      okText: 'Delete',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await remove({ tenantId, pageId: page.id }).unwrap()
          setDirty(false)
          toast.success('Page deleted')
          // Let the cleared `dirty` reach the blocker before navigating.
          setTimeout(() => navigate(backUrl, { replace: true }))
        } catch (e) {
          toast.error(errorMessage(e))
        }
      },
    })

  const toggle = (id: string) =>
    setOpen((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const addMenu = (add: (s: Section) => void): MenuProps => ({
    items: (Object.keys(SECTION_LABELS) as SectionType[]).map((type) => ({
      key: type,
      label: (
        <div>
          <div className="font-medium">{SECTION_LABELS[type].label}</div>
          <div className="text-xs text-slate-500">{SECTION_LABELS[type].hint}</div>
        </div>
      ),
    })),
    onClick: ({ key }) => {
      const section = newSection(key as SectionType)
      add(section)
      setOpen((s) => new Set(s).add(section.id))
      setDirty(true)
    },
  })

  return (
    <>
      <Link to={backUrl} className="inline-flex items-center gap-1 text-sm mb-2">
        <ArrowLeft size={14} /> Website
      </Link>
      <PageHeader
        title={page.title}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <StatusBadge status={page.status} />
            {dirty && <span className="text-amber-600">Unsaved edits</span>}
            {page.published_at && <span>Published {formatDateTime(page.published_at)}</span>}
          </span>
        }
        actions={
          <>
            {!isHome && (
              <Button danger icon={<Trash2 size={14} />} onClick={onDelete}>
                Delete
              </Button>
            )}
            {page.published_content && (
              <Button onClick={onUnpublish} loading={publishing}>
                Unpublish
              </Button>
            )}
            <Button onClick={onSave} loading={saving} disabled={!dirty}>
              Save draft
            </Button>
            <Button
              type="primary"
              onClick={onPublish}
              loading={publishing || saving}
              disabled={!dirty && page.status === 'published'}
            >
              Publish
            </Button>
          </>
        }
      />
      <Form<EditorForm>
        form={form}
        layout="vertical"
        initialValues={toForm(page)}
        onValuesChange={() => setDirty(true)}
        requiredMark={false}
      >
        <div className="grid gap-4 xl:grid-cols-[1fr_320px] items-start">
          <div className="grid gap-3 min-w-0">
            <Form.List name="sections">
              {(rows, { add, remove: removeRow, move }) => (
                <>
                  {rows.length === 0 && (
                    <Card>
                      <Empty description="This page has no sections yet" />
                    </Card>
                  )}
                  {rows.map((row, i) => {
                    const section = form.getFieldValue(['sections', row.name]) as Section
                    const isOpen = open.has(section.id)
                    const change = (fn: () => void) => {
                      fn()
                      setDirty(true)
                    }
                    return (
                      <Card key={row.key} className="p-0!">
                        <div className="flex items-center gap-2 px-4 py-3">
                          <button
                            type="button"
                            onClick={() => toggle(section.id)}
                            aria-expanded={isOpen}
                            className="flex flex-1 min-w-0 items-center gap-2 bg-transparent border-0 p-0 cursor-pointer text-left text-inherit"
                          >
                            {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            <span className="font-medium">{SECTION_LABELS[section.type].label}</span>
                            <Form.Item noStyle shouldUpdate>
                              {() => (
                                <span className="truncate text-sm text-slate-500">
                                  {(form.getFieldValue(['sections', row.name]) as Section | undefined)?.heading}
                                </span>
                              )}
                            </Form.Item>
                          </button>
                          <Button
                            size="small"
                            type="text"
                            aria-label="Move up"
                            disabled={i === 0}
                            icon={<ArrowUp size={14} />}
                            onClick={() => change(() => move(i, i - 1))}
                          />
                          <Button
                            size="small"
                            type="text"
                            aria-label="Move down"
                            disabled={i === rows.length - 1}
                            icon={<ArrowDown size={14} />}
                            onClick={() => change(() => move(i, i + 1))}
                          />
                          <Button
                            size="small"
                            type="text"
                            danger
                            aria-label="Remove section"
                            icon={<Trash2 size={14} />}
                            onClick={() => change(() => removeRow(row.name))}
                          />
                        </div>
                        {/* Closed sections stay mounted so their fields still validate. */}
                        <div
                          className="border-t border-slate-200 dark:border-slate-700 px-4 pt-4"
                          hidden={!isOpen}
                        >
                          <SectionFields tenantId={tenantId} type={section.type} index={row.name} />
                        </div>
                      </Card>
                    )
                  })}
                  {rows.length < 40 && (
                    <Dropdown menu={addMenu(add)} trigger={['click']}>
                      <Button icon={<Plus size={14} />} className="self-start">
                        Add section
                      </Button>
                    </Dropdown>
                  )}
                </>
              )}
            </Form.List>
          </div>
          <Card className="xl:sticky xl:top-4">
            <h3 className="mt-0 text-base font-semibold">Page details</h3>
            <InputContainer type="input" name="title" label="Title" required />
            <InputContainer
              type="input"
              name="slug"
              label="Address"
              required
              disabled={isHome}
              rules={[pageSlugRule]}
              prefix="/"
              notes={isHome ? 'The home page is always at the site address.' : undefined}
            />
            <InputContainer type="switch" name="show_in_nav" label="Show in the menu" />
            <InputContainer
              type="number"
              name="nav_order"
              label="Menu position"
              min={0}
              max={1000}
              notes="Lower numbers come first."
            />
            <InputContainer
              type="input"
              name="seo_title"
              label="Search engine title"
              placeholder={page.title}
            />
            <InputContainer
              type="textarea"
              name="seo_description"
              label="Search engine description"
              rows={3}
            />
          </Card>
        </div>
      </Form>
    </>
  )
}
