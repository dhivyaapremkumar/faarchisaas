from difflib import SequenceMatcher
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.models import ProjectMembership, User

CONFIDENCE_THRESHOLD = 0.72  # below this, we leave the action item unassigned rather than guess


def _similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, a.lower().strip(), b.lower().strip()).ratio()


async def match_assignee(db: AsyncSession, project_id: str, suggested_name: str | None):
    """
    Takes whatever name the LLM heard in the transcript and tries to match it
    against real, active project members. This is the critical guardrail:
    the LLM's output is treated as a HINT, never as ground truth. If no
    confident match exists, we return None - the architect resolves it
    manually in the review step, which can also trigger an onboarding invite.
    """
    if not suggested_name:
        return None, 0.0

    result = await db.execute(
        select(ProjectMembership, User)
        .join(User, User.id == ProjectMembership.user_id)
        .where(ProjectMembership.project_id == project_id, ProjectMembership.status == "active")
    )
    members = result.all()

    best_match = None
    best_score = 0.0
    for membership, user in members:
        score = _similarity(suggested_name, user.full_name)
        if score > best_score:
            best_score = score
            best_match = user

    if best_match and best_score >= CONFIDENCE_THRESHOLD:
        return str(best_match.id), round(best_score, 2)
    return None, round(best_score, 2)
