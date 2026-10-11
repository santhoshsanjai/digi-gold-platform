from typing import Annotated

from fastapi import Query
from pydantic import BaseModel


class Page[T](BaseModel):
    items: list[T]
    total: int
    limit: int
    offset: int


Limit = Annotated[int, Query(ge=1, le=100)]
Offset = Annotated[int, Query(ge=0)]
