from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.endpoints import router as api_router
from app.api.ai_endpoints import router as ai_router
from app.core.config import settings
import uvicorn

app = FastAPI(title="岁月留声 API", description="随记、相册、家谱功能后端")

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
app.include_router(ai_router)

@app.get("/")
async def root():
    return {"message": "Welcome to 岁月留声 API"}

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.API_PORT, reload=True)
