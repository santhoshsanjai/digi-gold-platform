import { Button, Form } from 'antd'
import { Plus, Trash2 } from 'lucide-react'
import InputContainer from '@digigold/web-common/shared-components/InputContainer.tsx'
import type { SectionType } from '../../api/types.ts'
import { ImageField } from '../ImageField.tsx'
import { RichTextEditor } from '../RichTextEditor.tsx'
import { linkRule } from '../../utils/rules.ts'
import { ICONS } from './sectionTypes.ts'

interface Props {
  tenantId: string
  type: SectionType
  /** Position of this section in the form's `sections` list. */
  index: number
}

/** The fields for one section, bound to `sections[index]` in the page editor's form. */
export function SectionFields({ tenantId, type, index }: Props) {
  const f = (...path: (string | number)[]) => [index, ...path]
  const heading = <InputContainer type="input" name={f('heading')} label="Heading" />
  const image = (name: string, label = 'Picture') => (
    <Form.Item name={f(name)} label={label}>
      <ImageField tenantId={tenantId} />
    </Form.Item>
  )
  const body = (
    <Form.Item name={f('body_html')} label="Text">
      <RichTextEditor />
    </Form.Item>
  )
  const link = (name: string, label: string) => (
    <InputContainer type="input" name={f(name)} label={label} rules={[linkRule]} />
  )

  switch (type) {
    case 'hero':
      return (
        <>
          {heading}
          <InputContainer type="textarea" name={f('subheading')} label="Subheading" rows={2} />
          {image('image_url')}
          <div className="grid gap-x-4 md:grid-cols-2">
            <InputContainer type="input" name={f('cta_label')} label="Button text" />
            {link('cta_url', 'Button link')}
          </div>
        </>
      )
    case 'rich_text':
      return (
        <>
          {heading}
          {body}
        </>
      )
    case 'image_text':
      return (
        <>
          {heading}
          {body}
          {image('image_url')}
          <InputContainer
            type="radio"
            name={f('image_side')}
            label="Picture on the"
            options={[
              { label: 'Left', value: 'left' },
              { label: 'Right', value: 'right' },
            ]}
          />
        </>
      )
    case 'features':
    case 'steps':
      return (
        <>
          {heading}
          <ItemList
            index={index}
            field="items"
            addLabel={type === 'steps' ? 'Add step' : 'Add highlight'}
            max={type === 'steps' ? 8 : 12}
            blank={{ title: '', text: '', icon: '' }}
          >
            {(i) => (
              <>
                <div className="grid gap-x-4 md:grid-cols-[1fr_180px]">
                  <InputContainer type="input" name={[i, 'title']} label="Title" />
                  <InputContainer
                    type="select"
                    name={[i, 'icon']}
                    label="Icon"
                    options={ICONS}
                    allowClear
                  />
                </div>
                <InputContainer type="textarea" name={[i, 'text']} label="Text" rows={2} />
              </>
            )}
          </ItemList>
        </>
      )
    case 'gold_rate':
      return (
        <>
          {heading}
          <InputContainer
            type="textarea"
            name={f('note')}
            label="Note under the rate"
            rows={2}
            notes="The rate itself comes from the CRM and is always current."
          />
        </>
      )
    case 'faq':
      return (
        <>
          {heading}
          <ItemList index={index} field="items" addLabel="Add question" max={30} blank={{ question: '', answer: '' }}>
            {(i) => (
              <>
                <InputContainer type="input" name={[i, 'question']} label="Question" required />
                <InputContainer type="textarea" name={[i, 'answer']} label="Answer" rows={3} required />
              </>
            )}
          </ItemList>
        </>
      )
    case 'gallery':
      return (
        <>
          {heading}
          <ItemList index={index} field="images" addLabel="Add picture" max={24} blank={{ url: '', caption: '' }}>
            {(i) => (
              <>
                <Form.Item
                  name={[i, 'url']}
                  label="Picture"
                  rules={[{ required: true, message: 'Choose a picture' }]}
                >
                  <ImageField tenantId={tenantId} />
                </Form.Item>
                <InputContainer type="input" name={[i, 'caption']} label="Caption" />
              </>
            )}
          </ItemList>
        </>
      )
    case 'cta':
      return (
        <>
          {heading}
          <InputContainer type="textarea" name={f('text')} label="Message" rows={2} />
          <div className="grid gap-x-4 md:grid-cols-2">
            <InputContainer type="input" name={f('button_label')} label="Button text" />
            {link('button_url', 'Button link')}
          </div>
        </>
      )
    case 'contact':
      return (
        <>
          {heading}
          <InputContainer
            type="switch"
            name={f('show_map')}
            label="Show the map"
            notes="Address, phone and map come from the site settings on the Website tab."
          />
        </>
      )
  }
}

interface ItemListProps {
  index: number
  field: string
  addLabel: string
  max: number
  blank: Record<string, string>
  children: (name: number) => React.ReactNode
}

/** A repeatable group inside a section, such as FAQ entries or gallery pictures. */
function ItemList({ index, field, addLabel, max, blank, children }: ItemListProps) {
  return (
    <Form.List name={[index, field]}>
      {(rows, { add, remove }) => (
        <div className="grid gap-3">
          {rows.map((row, n) => (
            <div
              key={row.key}
              className="rounded-lg border border-dashed border-slate-300 dark:border-slate-600 p-3 pb-0"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-medium text-slate-500">{n + 1}</span>
                <Button
                  size="small"
                  type="text"
                  danger
                  aria-label={`Remove ${n + 1}`}
                  icon={<Trash2 size={14} />}
                  onClick={() => remove(row.name)}
                />
              </div>
              {children(row.name)}
            </div>
          ))}
          {rows.length < max && (
            <Button icon={<Plus size={14} />} onClick={() => add({ ...blank })} className="self-start">
              {addLabel}
            </Button>
          )}
        </div>
      )}
    </Form.List>
  )
}
