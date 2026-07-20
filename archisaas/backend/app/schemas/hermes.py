from pydantic import BaseModel, Field, field_validator


class DraftActionItem(BaseModel):
    """
    Raw action item as extracted by the LLM. Nothing here is trusted for
    writing to the DB directly - suggested_assignee_name is free text the
    LLM heard, NOT a validated user reference.
    """
    description: str = Field(..., min_length=3, max_length=500)
    suggested_assignee_name: str | None = None
    due_date: str | None = None  # ISO date string, or null if not mentioned

    @field_validator("description")
    @classmethod
    def not_empty(cls, v):
        if not v.strip():
            raise ValueError("Action item description cannot be empty")
        return v.strip()


class MOMDraft(BaseModel):
    """
    The full structured output GPT must return. We use OpenAI's JSON mode
    with this schema, then validate with Pydantic on the way in - if the
    model returns malformed output, validation fails and we retry rather
    than silently accepting garbage into a legal-weight document.
    """
    attendees: list[str] = Field(default_factory=list)
    discussion_points: list[str] = Field(default_factory=list)
    decisions: list[str] = Field(default_factory=list)
    action_items: list[DraftActionItem] = Field(default_factory=list)
    next_meeting_date: str | None = None

    @field_validator("action_items")
    @classmethod
    def cap_action_items(cls, v):
        # Sanity guardrail: a single site meeting producing 100+ action items
        # is almost certainly a transcription/extraction error, not reality.
        if len(v) > 50:
            raise ValueError("Implausible number of action items extracted - likely a parsing error")
        return v


class ActionItemReviewOut(BaseModel):
    id: str
    description: str
    suggested_assignee_name: str | None
    assignee_user_id: str | None
    assignee_name_resolved: str | None = None  # human-readable, filled in by API
    due_date: str | None
    confidence_score: float | None
    status: str

    class Config:
        from_attributes = True


class MeetingReviewOut(BaseModel):
    id: str
    meeting_date: str
    mom_status: str
    transcript: str | None
    mom_document: str | None
    action_items: list[ActionItemReviewOut]


class ActionItemUpdate(BaseModel):
    assignee_user_id: str | None = None
    due_date: str | None = None
    description: str | None = None
