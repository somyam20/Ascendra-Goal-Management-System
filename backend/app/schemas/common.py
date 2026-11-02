from datetime import time
from typing import Annotated, Generic, TypeVar

from pydantic import BaseModel, ConfigDict, PlainSerializer

T = TypeVar("T")

HHMM = Annotated[time, PlainSerializer(lambda t: t.strftime("%H:%M") if t else None, return_type=str | None, when_used="json")]


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int


class Summary(BaseModel):
    total: int = 0
    completed: int = 0
    not_completed: int = 0
    unmarked: int = 0
    completion_rate: float | None = None
