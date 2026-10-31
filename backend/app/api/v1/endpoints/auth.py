from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.permissions import current_user
from app.core.rate_limit import auth_limit
from app.api.common import public
from app.schemas.inputs import Register, Login, ForgotPassword, ResetPassword
from app.services import auth_service as service

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", status_code=201, dependencies=[Depends(auth_limit)])
def register(data: Register, db: Session = Depends(get_db, scope="function")):
    return public(service.register(db, data))


@router.post("/login", dependencies=[Depends(auth_limit)])
def login(data: Login, db: Session = Depends(get_db, scope="function")):
    return service.login(db, data.email, data.password)


@router.post("/token", dependencies=[Depends(auth_limit)])
def swagger_login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db, scope="function")):
    return service.login(db, form.username, form.password)


@router.get("/me")
def me(user=Depends(current_user)):
    return public(user)


@router.post("/forgot-password", dependencies=[Depends(auth_limit)])
def forgot(data: ForgotPassword, db: Session = Depends(get_db, scope="function")):
    return service.forgot_password(db, data.email)


@router.post("/reset-password", dependencies=[Depends(auth_limit)])
def reset(data: ResetPassword, db: Session = Depends(get_db, scope="function")):
    return service.reset_password(db, data)
