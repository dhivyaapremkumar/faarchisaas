from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import auth, projects, drawings, meetings, files, progress, vendors, tasks, me

app = FastAPI(title="ArchiSaaS API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten this to your actual frontend domain before going live
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(projects.router, prefix="/api")
app.include_router(drawings.router, prefix="/api")
app.include_router(meetings.router, prefix="/api")
app.include_router(files.router, prefix="/api")
app.include_router(progress.router, prefix="/api")
app.include_router(vendors.router, prefix="/api")
app.include_router(tasks.router, prefix="/api")
app.include_router(me.router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok"}
