import httpx
from app.core.config import settings


async def notify_task_assigned(task_id: str, assignee_user_id: str, task_title: str, due_date: str | None):
    """
    Posts to an n8n webhook, which owns the actual notification logic
    (email/SMS/WhatsApp, reminder scheduling, etc.) - see Step 9.
    Fails silently (logged, not raised) so a notification hiccup never
    blocks task creation itself.
    """
    if not settings.N8N_WEBHOOK_BASE_URL:
        return  # n8n not configured yet - safe no-op until Step 9 is wired up

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(
                f"{settings.N8N_WEBHOOK_BASE_URL}/task-assigned",
                json={
                    "task_id": task_id,
                    "assignee_user_id": assignee_user_id,
                    "task_title": task_title,
                    "due_date": due_date,
                },
            )
    except httpx.HTTPError as e:
        print(f"[notify] n8n webhook failed (non-blocking): {e}")
