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
  const heading = (
    <div className="grid gap-x-4 md:grid-cols-[200px_1fr]">
      <InputContainer
        type="input"
        name={f('eyebrow')}
        label="Label above"
        notes="Optional, e.g. “Our story”"
      />
      <InputContainer type="input" name={f('heading')} label="Heading" />
    </div>
  )
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
  const button = (label: string, url: string, title = 'Button') => (
    <div className="grid gap-x-4 md:grid-cols-2">
      <InputContainer type="input" name={f(label)} label={`${title} text`} />
      {link(url, `${title} link`)}
    </div>
  )
  const pictureInfo = (
    <div className="grid gap-x-4 md:grid-cols-[1fr_auto]">
      <InputContainer
        type="input"
        name={f('image_alt')}
        label="Picture description"
        notes="Read aloud to blind visitors and used by search engines."
      />
      <SampleSwitch name={f('sample_image')} />
    </div>
  )

  switch (type) {
    case 'hero':
      return (
        <>
          {heading}
          <InputContainer type="textarea" name={f('subheading')} label="Subheading" rows={2} />
          <InputContainer
            type="radio"
            name={f('size')}
            label="Size"
            options={[
              { label: 'Full screen (home page)', value: 'full' },
              { label: 'Compact (other pages)', value: 'compact' },
            ]}
          />
          {image('image_url')}
          {pictureInfo}
          {button('cta_label', 'cta_url')}
          {button('cta2_label', 'cta2_url', 'Second button')}
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
          {pictureInfo}
          {button('cta_label', 'cta_url')}
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
    case 'categories':
    case 'collections':
      return (
        <>
          {heading}
          <InputContainer type="textarea" name={f('intro')} label="Introduction" rows={2} />
          <ItemList
            index={index}
            field="items"
            addLabel={type === 'categories' ? 'Add category' : 'Add collection'}
            max={type === 'categories' ? 24 : 12}
            blank={{ title: '', text: '', image_url: '', image_alt: '', sample_image: false, link_url: '', link_label: '' }}
          >
            {(i) => (
              <>
                <InputContainer type="input" name={[i, 'title']} label="Title" required />
                <InputContainer type="textarea" name={[i, 'text']} label="Short description" rows={2} />
                <Form.Item name={[i, 'image_url']} label="Picture">
                  <ImageField tenantId={tenantId} />
                </Form.Item>
                <div className="grid gap-x-4 md:grid-cols-[1fr_auto]">
                  <InputContainer type="input" name={[i, 'image_alt']} label="Picture description" />
                  <SampleSwitch name={[i, 'sample_image']} />
                </div>
                <div className="grid gap-x-4 md:grid-cols-2">
                  {/* Same rule as the section links: the API refuses anything else. */}
                  <InputContainer type="input" name={[i, 'link_url']} label="Link" rules={[linkRule]} />
                  <InputContainer
                    type="input"
                    name={[i, 'link_label']}
                    label="Link text"
                    placeholder={type === 'categories' ? 'Explore' : 'Discover the collection'}
                  />
                </div>
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
                <div className="grid gap-x-4 md:grid-cols-[1fr_auto]">
                  <InputContainer type="input" name={[i, 'caption']} label="Caption" />
                  <SampleSwitch name={[i, 'sample']} />
                </div>
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
          {button('button_label', 'button_url')}
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

/** Stock or borrowed pictures are labelled "Sample image" on the site. */
function SampleSwitch({ name }: { name: (string | number)[] }) {
  return (
    <InputContainer
      type="switch"
      name={name}
      label="Sample picture"
      notes="Not the client's own piece"
    />
  )
}

interface ItemListProps {
  index: number
  field: string
  addLabel: string
  max: number
  blank: Record<string, string | boolean>
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
