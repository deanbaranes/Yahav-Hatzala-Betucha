from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Request, Response, Cookie
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.models.user import User, UserStatus
from app.models.refresh_token import RefreshToken
from app.schemas import UserCreate, UserOut, Token
from app.auth import (
    get_password_hash,
    verify_password,
    create_access_token,
    create_refresh_token,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    REFRESH_TOKEN_EXPIRE_DAYS
)

# ── Rate limiting ──────────────────────────────────────────────────────────────
from slowapi import Limiter
from slowapi.util import get_remote_address
limiter = Limiter(key_func=get_remote_address)
# ──────────────────────────────────────────────────────────────────────────────

router = APIRouter(prefix="/auth", tags=["auth"])

REFRESH_COOKIE_NAME = "refresh_token"
REFRESH_COOKIE_MAX_AGE = REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600  # seconds


def _build_tokens_and_set_cookie(user: User, db: Session, response: Response) -> dict:
    """
    Creates both access + refresh tokens.
    Stores the refresh token in the DB and sets it as an HttpOnly cookie.
    Returns the access token payload for the caller.
    """
    # --- Access Token (30 min) ---
    access_token = create_access_token(data={
        "sub": str(user.id),
        "role": user.role,
        "status": user.status,
        "name": user.full_name
    })

    # --- Refresh Token (30 days, DB-backed) ---
    raw_token, expires_at = create_refresh_token()
    db_refresh = RefreshToken(
        token=raw_token,
        user_id=user.id,
        expires_at=expires_at
    )
    db.add(db_refresh)
    db.commit()

    # Set HttpOnly cookie (not accessible from JS)
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=raw_token,
        httponly=True,
        secure=False,     # set True in production behind HTTPS
        samesite="lax",   # 'strict' if same origin, 'lax' for cross-site navigation
        max_age=REFRESH_COOKIE_MAX_AGE,
        path="/auth/refresh"  # only sent to the refresh endpoint
    )

    return {"access_token": access_token, "token_type": "bearer"}


# ── Register ──────────────────────────────────────────────────────────────────
@router.post("/register", response_model=UserOut)
@limiter.limit("5/15minutes")
def register(request: Request, user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.phone == user.phone).first()
    if db_user:
        raise HTTPException(status_code=400, detail="מספר טלפון זה כבר קיים במערכת.")

    db_user_name = db.query(User).filter(User.full_name == user.full_name).first()
    if db_user_name:
        raise HTTPException(status_code=400, detail="שם עובד זה כבר קיים במערכת. אנא השתמש בשם אחר או הוסף שם משפחה מפורט יותר.")

    hashed_password = get_password_hash(user.password)
    new_user = User(
        full_name=user.full_name,
        phone=user.phone,
        password_hash=hashed_password,
        role=user.role,
        status=UserStatus.pending
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


# ── Login ─────────────────────────────────────────────────────────────────────
@router.post("/login", response_model=Token)
@limiter.limit("10/15minutes")
def login(
    request: Request,
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.phone == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect phone or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if user.status == UserStatus.inactive:
        raise HTTPException(status_code=403, detail="Account is inactive")

    return _build_tokens_and_set_cookie(user, db, response)


# ── Refresh ───────────────────────────────────────────────────────────────────
@router.post("/refresh", response_model=Token)
def refresh_token(
    response: Response,
    db: Session = Depends(get_db),
    refresh_token: Optional[str] = Cookie(default=None, alias=REFRESH_COOKIE_NAME)
):
    """
    Validates the refresh token from the HttpOnly cookie.
    Issues a new short-lived access token (and rotates the refresh token).
    """
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired refresh token. Please log in again."
    )

    if not refresh_token:
        raise credentials_exc

    # Look up in DB
    db_token = db.query(RefreshToken).filter(
        RefreshToken.token == refresh_token,
        RefreshToken.revoked == False
    ).first()

    if not db_token:
        raise credentials_exc

    if db_token.expires_at < datetime.utcnow():
        # Expired — revoke and reject
        db_token.revoked = True
        db.commit()
        raise credentials_exc

    user = db_token.user
    if not user or user.status == UserStatus.inactive:
        raise credentials_exc

    # Rotate: revoke old token, issue fresh pair
    db_token.revoked = True
    db.commit()

    return _build_tokens_and_set_cookie(user, db, response)


# ── Logout ────────────────────────────────────────────────────────────────────
@router.post("/logout")
def logout(
    response: Response,
    db: Session = Depends(get_db),
    refresh_token: Optional[str] = Cookie(default=None, alias=REFRESH_COOKIE_NAME)
):
    """Revoke the refresh token and clear the cookie."""
    if refresh_token:
        db_token = db.query(RefreshToken).filter(
            RefreshToken.token == refresh_token
        ).first()
        if db_token:
            db_token.revoked = True
            db.commit()

    response.delete_cookie(key=REFRESH_COOKIE_NAME, path="/auth/refresh")
    return {"message": "Logged out successfully"}
