from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.security import decode_token
from app.core.database import get_db_with_rls

bearer_scheme = HTTPBearer()


class CurrentUser:
    def __init__(self, user_id: str, org_id: str, role: str):
        self.user_id = user_id
        self.org_id = org_id
        self.role = role


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> CurrentUser:
    payload = decode_token(credentials.credentials)
    if not payload or payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    return CurrentUser(user_id=payload["sub"], org_id=payload["org_id"], role=payload["role"])


async def get_scoped_db(current_user: CurrentUser = Depends(get_current_user)):
    """
    Combines auth + RLS: every protected route gets a DB session that Postgres
    will automatically filter by org_id, no matter what the query says.
    """
    async for session in get_db_with_rls(
        org_id=current_user.org_id, user_id=current_user.user_id, role=current_user.role
    ):
        yield session


def require_roles(*allowed_roles: str):
    """
    Usage: Depends(require_roles("architect_admin", "owner"))
    This is an APPLICATION-LEVEL check (fast, clear error messages).
    RLS is the DATABASE-LEVEL backstop underneath it - defense in depth.
    """
    async def checker(current_user: CurrentUser = Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{current_user.role}' is not permitted to perform this action",
            )
        return current_user
    return checker
