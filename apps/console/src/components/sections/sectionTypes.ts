import type { Section, SectionType } from '../../api/types.ts'

export const SECTION_LABELS: Record<SectionType, { label: string; hint: string }> = {
  hero: { label: 'Banner', hint: 'Big heading, picture and a button at the top of a page' },
  rich_text: { label: 'Text', hint: 'Formatted paragraphs, lists and links' },
  image_text: { label: 'Picture and text', hint: 'A picture beside formatted text' },
  features: { label: 'Highlights', hint: 'A grid of short points with icons' },
  steps: { label: 'Steps', hint: 'Numbered steps, such as how the scheme works' },
  categories: { label: 'Category tiles', hint: 'Picture tiles that link to a category, in the order you set' },
  collections: { label: 'Featured collections', hint: 'Large picture-and-text rows for featured collections' },
  gold_rate: { label: "Today's gold rate", hint: 'The rate staff publish in the CRM, always current' },
  faq: { label: 'Questions and answers', hint: 'Expandable FAQs' },
  gallery: { label: 'Gallery', hint: 'A grid of pictures with captions' },
  cta: { label: 'Call to action', hint: 'A short message with a button' },
  contact: { label: 'Contact', hint: 'Address, phone and map from the site settings' },
}

/** Icons the website can draw next to highlights and steps. */
export const ICONS = [
  'coins',
  'shield-check',
  'store',
  'smartphone',
  'gift',
  'clock',
  'badge-percent',
  'gem',
  'wallet',
  'sparkles',
].map((value) => ({ value, label: value }))

const newId = (type: string) => `${type.replace('_', '-')}-${Math.random().toString(36).slice(2, 8)}`

export function newSection(type: SectionType): Section {
  const base = { id: newId(type), eyebrow: '' }
  switch (type) {
    case 'hero':
      return {
        type,
        ...base,
        size: 'full',
        heading: '',
        subheading: '',
        image_url: '',
        image_alt: '',
        sample_image: false,
        cta_label: '',
        cta_url: '',
        cta2_label: '',
        cta2_url: '',
      }
    case 'rich_text':
      return { type, ...base, heading: '', body_html: '' }
    case 'image_text':
      return {
        type,
        ...base,
        heading: '',
        body_html: '',
        image_url: '',
        image_alt: '',
        sample_image: false,
        image_side: 'right',
        cta_label: '',
        cta_url: '',
      }
    case 'features':
    case 'steps':
      return { type, ...base, heading: '', items: [] }
    case 'categories':
    case 'collections':
      return { type, ...base, heading: '', intro: '', items: [] }
    case 'gold_rate':
      return { type, ...base, heading: "Today's gold rate", note: '' }
    case 'faq':
      return { type, ...base, heading: 'Frequently asked questions', items: [] }
    case 'gallery':
      return { type, ...base, heading: '', images: [] }
    case 'cta':
      return { type, ...base, heading: '', text: '', button_label: '', button_url: '' }
    case 'contact':
      return { type, ...base, heading: 'Visit us', show_map: true }
  }
}
