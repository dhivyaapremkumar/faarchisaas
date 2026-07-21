from sqlalchemy.ext.asyncio import AsyncSession
from app.models.models import AuditLog


async def log_action(
    db: AsyncSession,
    org_id: str,
    actor_user_id: str,
    action: str,
    entity_type: str | None = None,
    entity_id: str | None = None,
    project_id: str | None = None,
    metadata: dict | None = None,
):
    """
    Fire-and-forget audit trail. Call this alongside any sensitive write
    (uploads, task assignment, role changes) - construction has contractual
    stakes, so "who did what, when" needs to be reconstructable later.
    """
    entry = AuditLog(
        org_id=org_id,
        project_id=project_id,
        actor_user_id=actor_user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        log_metadata=metadata or {},
    )
    db.add(entry)
