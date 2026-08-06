from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Request, Response, Cookie
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.models.user import User, UserStatus
from app.models.refresh_token import RefreshToken
from app.models.password_reset_token import PasswordResetToken
from app.schemas import UserCreate, UserOut, Token, ForgotPasswordRequest, ResetPasswordRequest
from app.services.email_service import EmailService
from app.auth import (
    get_password_hash,
    verify_password,
    create_access_token,
    create_refresh_token,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    REFRESH_TOKEN_EXPIRE_DAYS
)
import secrets

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
    # IMPORTANT: path must match the browser-visible URL (/api/auth/refresh),
    # not the backend path (/auth/refresh) — Vite proxy rewrites /api → /
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=raw_token,
        httponly=True,
        secure=False,     # set True in production behind HTTPS
        samesite="lax",
        max_age=REFRESH_COOKIE_MAX_AGE,
        path="/api/auth/refresh"  # must match the frontend proxy path
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

    # Check email uniqueness if provided
    if user.email:
        existing_email = db.query(User).filter(User.email == user.email).first()
        if existing_email:
            raise HTTPException(status_code=400, detail="אימייל זה כבר קיים במערכת.")

    hashed_password = get_password_hash(user.password)
    new_user = User(
        full_name=user.full_name,
        phone=user.phone,
        email=user.email,
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

    response.delete_cookie(key=REFRESH_COOKIE_NAME, path="/api/auth/refresh")
    return {"message": "Logged out successfully"}


# ── Forgot Password ─────────────────────────────────────────────────────────────────────────────
@router.post("/forgot-password")
@limiter.limit("10/hour")
def forgot_password(request: Request, body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """
    Accepts an email address and sends a password reset link.
    Always returns 200 to avoid leaking which emails are registered.
    """
    user = db.query(User).filter(User.email == body.email).first()

    if user:
        # Invalidate any existing unused tokens for this user
        db.query(PasswordResetToken).filter(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used == False
        ).delete()
        db.commit()

        # Generate a secure random token (64 hex chars = 256 bits)
        raw_token = secrets.token_hex(32)
        expires_at = datetime.utcnow() + timedelta(minutes=15)

        reset_token = PasswordResetToken(
            token=raw_token,
            user_id=user.id,
            expires_at=expires_at
        )
        db.add(reset_token)
        db.commit()

        EmailService.send_password_reset(
            to_email=user.email,
            full_name=user.full_name,
            token=raw_token
        )

    # Always return 200 — don't reveal if email exists
    return {"message": "אם האימייל קיים במערכת, נשלח אליו קישור לאיפוס הסיסמא."}


# ── Reset Password ─────────────────────────────────────────────────────────────────────────────
@router.post("/reset-password")
def reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)):
    """
    Validates the reset token and updates the user's password.
    The token is single-use and expires after 15 minutes.
    """
    token_record = db.query(PasswordResetToken).filter(
        PasswordResetToken.token == body.token,
        PasswordResetToken.used == False
    ).first()

    if not token_record:
        raise HTTPException(status_code=400, detail="הקישור אינו תקין או כבר שומש.")

    if token_record.expires_at < datetime.utcnow():
        token_record.used = True
        db.commit()
        raise HTTPException(status_code=400, detail="הקישור פג תוקף. אנא בקש קישור חדש.")

    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="הסיסמא חייבת להכיל לפחות 6 תווים.")

    user = db.query(User).filter(User.id == token_record.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="משתמש לא נמצא.")

    user.password_hash = get_password_hash(body.new_password)
    token_record.used = True
    db.commit()

    return {"message": "הסיסמא עודכנה בהצלחה. אפשר להתחבר עכשיו."}
