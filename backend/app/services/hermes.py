import json
from openai import OpenAI
from pydantic import ValidationError
from app.core.config import settings
from app.schemas.hermes import MOMDraft

client = OpenAI(api_key=settings.OPENAI_API_KEY)

MOM_SYSTEM_PROMPT = """You are an assistant that converts raw construction site-meeting \
transcripts into a structured Minutes of Meeting (MOM) document.

Rules:
- Only include information actually present in the transcript. Do not invent attendees, \
decisions, or action items that weren't discussed.
- For each action item, extract the person's name exactly as it was said, even if it's \
just a first name or nickname - do not guess a full name.
- If a due date is mentioned only vaguely ("by next week"), leave due_date null rather \
than guessing an exact date.
- Return ONLY valid JSON matching the exact schema provided. No prose, no markdown fences.
"""

MOM_JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "attendees": {"type": "array", "items": {"type": "string"}},
        "discussion_points": {"type": "array", "items": {"type": "string"}},
        "decisions": {"type": "array", "items": {"type": "string"}},
        "action_items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "description": {"type": "string"},
                    "suggested_assignee_name": {"type": ["string", "null"]},
                    "due_date": {"type": ["string", "null"]},
                },
                "required": ["description"],
            },
        },
        "next_meeting_date": {"type": ["string", "null"]},
    },
    "required": ["attendees", "discussion_points", "decisions", "action_items"],
}


def transcribe_audio(file_path: str) -> str:
    """
    Whisper transcription. file_path must be a local temp file path
    (OpenAI's SDK reads audio files directly).
    """
    with open(file_path, "rb") as audio_file:
        transcript = client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
        )
    return transcript.text


def draft_mom(transcript: str, max_retries: int = 2) -> MOMDraft:
    """
    Calls GPT with JSON mode + our schema, then validates with Pydantic.
    If the model returns something that doesn't match MOMDraft (malformed
    JSON, wrong types, our sanity checks like the 50-action-item cap),
    we retry with an explicit correction prompt rather than silently
    accepting bad data. After max_retries, we raise - a failed MOM should
    surface as an error to the architect, not publish garbage.
    """
    last_error = None
    messages = [
        {"role": "system", "content": MOM_SYSTEM_PROMPT},
        {"role": "user", "content": f"Transcript:\n\n{transcript}"},
    ]

    for attempt in range(max_retries + 1):
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            response_format={"type": "json_object"},
            temperature=0.2,
        )
        raw = response.choices[0].message.content

        try:
            data = json.loads(raw)
            return MOMDraft.model_validate(data)
        except (json.JSONDecodeError, ValidationError) as e:
            last_error = e
            messages.append({"role": "assistant", "content": raw})
            messages.append({
                "role": "user",
                "content": f"That response was invalid: {e}. Return corrected JSON matching the schema exactly, no other text.",
            })

    raise ValueError(f"Failed to get valid MOM structure after {max_retries + 1} attempts: {last_error}")
