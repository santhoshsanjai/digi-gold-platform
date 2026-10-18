"""Website content the platform owner edits in the Platform Console.

A page is a list of typed sections. The website renders each type with the client's
branding, so a new client needs content, not code. Rich text is sanitised on save.
"""

from typing import Annotated, Literal

import nh3
from pydantic import BaseModel, ConfigDict, Field, field_validator

_ALLOWED_TAGS = {
    "p", "br", "strong", "b", "em", "i", "u", "s", "a", "ul", "ol", "li",
    "h2", "h3", "h4", "blockquote", "span", "hr",
}  # fmt: skip
_ALLOWED_ATTRS = {"a": {"href", "title", "target"}}

Url = Annotated[str, Field(max_length=500)]
Short = Annotated[str, Field(max_length=200)]
Text = Annotated[str, Field(max_length=2000)]


def clean_html(value: str) -> str:
    """Keep formatting tags only; scripts, styles and event handlers are removed."""
    return nh3.clean(
        value,
        tags=_ALLOWED_TAGS,
        attributes=_ALLOWED_ATTRS,
        url_schemes={"http", "https", "mailto", "tel"},
        link_rel="noopener noreferrer",
    )


def _check_url(value: str) -> str:
    value = value.strip()
    if value and not value.startswith(("https://", "http://", "/", "#", "mailto:", "tel:")):
        raise ValueError("links must start with https://, /, #, mailto: or tel:")
    return value


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class _Section(_Strict):
    id: str = Field(min_length=1, max_length=40, description="Stable key set by the editor")
    eyebrow: Short = Field("", description="A short label above the heading")
    heading: Short = ""


class _Picture(_Strict):
    """Alt text, and whether the picture is a sample (stock or borrowed) rather than the
    client's own. The website marks samples so visitors never mistake them for real stock."""

    image_alt: Short = ""
    sample_image: bool = False


class _RichText:
    @field_validator("body_html", check_fields=False)
    @classmethod
    def _clean(cls, v: str) -> str:
        return clean_html(v)


class HeroSection(_Picture, _Section):
    type: Literal["hero"]
    size: Literal["full", "compact"] = "full"
    subheading: Text = ""
    image_url: Url = ""
    cta_label: Short = ""
    cta_url: Url = ""
    cta2_label: Short = ""
    cta2_url: Url = ""

    _urls = field_validator("cta_url", "cta2_url", "image_url")(_check_url)


class RichTextSection(_RichText, _Section):
    type: Literal["rich_text"]
    body_html: str = Field("", max_length=20000)


class ImageTextSection(_RichText, _Picture, _Section):
    type: Literal["image_text"]
    body_html: str = Field("", max_length=20000)
    image_url: Url = ""
    image_side: Literal["left", "right"] = "right"
    cta_label: Short = ""
    cta_url: Url = ""

    _urls = field_validator("image_url", "cta_url")(_check_url)


class Item(_Strict):
    title: Short = ""
    text: Text = ""
    icon: Annotated[str, Field(max_length=40)] = ""


class FeaturesSection(_Section):
    type: Literal["features"]
    items: list[Item] = Field(default_factory=list, max_length=12)


class StepsSection(_Section):
    type: Literal["steps"]
    items: list[Item] = Field(default_factory=list, max_length=8)


class Card(_Picture):
    """A picture with a title and a link: a category or a collection."""

    title: Short
    text: Text = ""
    image_url: Url = ""
    link_url: Url = ""
    link_label: Short = ""

    _urls = field_validator("image_url", "link_url")(_check_url)


class CategoriesSection(_Section):
    """Picture tiles in the order given, such as "Necklaces", "Bangles"."""

    type: Literal["categories"]
    intro: Text = ""
    items: list[Card] = Field(default_factory=list, max_length=24)


class CollectionsSection(_Section):
    """Larger editorial rows, picture beside text, for featured collections."""

    type: Literal["collections"]
    intro: Text = ""
    items: list[Card] = Field(default_factory=list, max_length=12)


class GoldRateSection(_Section):
    """Shows today's published rate, read live from the API."""

    type: Literal["gold_rate"]
    note: Text = ""


class Faq(_Strict):
    question: Short
    answer: Text


class FaqSection(_Section):
    type: Literal["faq"]
    items: list[Faq] = Field(default_factory=list, max_length=30)


class GalleryImage(_Strict):
    url: Url
    caption: Short = ""
    sample: bool = False

    _urls = field_validator("url")(_check_url)


class GallerySection(_Section):
    type: Literal["gallery"]
    images: list[GalleryImage] = Field(default_factory=list, max_length=24)


class CtaSection(_Section):
    type: Literal["cta"]
    text: Text = ""
    button_label: Short = ""
    button_url: Url = ""

    _urls = field_validator("button_url")(_check_url)


class ContactSection(_Section):
    """Shows the contact details from the site settings, with an optional map."""

    type: Literal["contact"]
    show_map: bool = True


Section = Annotated[
    HeroSection
    | RichTextSection
    | ImageTextSection
    | FeaturesSection
    | StepsSection
    | CategoriesSection
    | CollectionsSection
    | GoldRateSection
    | FaqSection
    | GallerySection
    | CtaSection
    | ContactSection,
    Field(discriminator="type"),
]

SECTION_TYPES = [
    "hero", "rich_text", "image_text", "features", "steps", "categories",
    "collections", "gold_rate", "faq", "gallery", "cta", "contact",
]  # fmt: skip


class PageContent(_Strict):
    sections: list[Section] = Field(default_factory=list, max_length=40)

    @field_validator("sections")
    @classmethod
    def _unique_ids(cls, v: list) -> list:
        ids = [s.id for s in v]
        if len(ids) != len(set(ids)):
            raise ValueError("section ids must be unique")
        return v


class Contact(_Strict):
    address: Text = ""
    phone: Annotated[str, Field(max_length=30)] = ""
    whatsapp: Annotated[str, Field(max_length=30)] = ""
    email: Annotated[str, Field(max_length=254)] = ""
    hours: Annotated[str, Field(max_length=500, description="One line per day range")] = ""
    map_url: Url = ""
    map_embed_url: Url = Field("", description="A Google Maps embed link, shown as a map")

    _urls = field_validator("map_url", "map_embed_url")(_check_url)

    @field_validator("map_embed_url")
    @classmethod
    def _embed(cls, v: str) -> str:
        if v and not v.startswith("https://www.google.com/maps"):
            raise ValueError("use a Google Maps embed link (https://www.google.com/maps/...)")
        return v


class Social(_Strict):
    facebook: Url = ""
    instagram: Url = ""
    youtube: Url = ""
    x: Url = ""

    _urls = field_validator("facebook", "instagram", "youtube", "x")(_check_url)


class AppLinks(_Strict):
    android: Url = ""
    ios: Url = ""

    _urls = field_validator("android", "ios")(_check_url)


class WebsiteSettings(_Strict):
    """Site-wide content: shown on every page, applied as soon as it is saved."""

    site_title: Short = ""
    tagline: Short = ""
    seo_description: Annotated[str, Field(max_length=300)] = ""
    share_image_url: Url = Field("", description="Shown when a page is shared on social media")
    footer_text: Text = ""
    announcement: Short = Field("", description="A one-line message above the menu")
    announcement_url: Url = ""
    local_business: Literal["", "JewelryStore", "Store"] = Field(
        "", description="Describe the business to search engines using the details above"
    )
    contact: Contact = Field(default_factory=Contact)
    social: Social = Field(default_factory=Social)
    app_links: AppLinks = Field(default_factory=AppLinks)

    _urls = field_validator("share_image_url", "announcement_url")(_check_url)
