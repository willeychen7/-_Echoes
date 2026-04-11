from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.service.ai_service import ai_service

router = APIRouter(prefix="/api/ai", tags=["AI 魔法映像"])

class RestoreRequest(BaseModel):
    imageUrl: str

class AnimateRequest(BaseModel):
    imageUrl: str
    prompt: Optional[str] = "A cinematic memory, subtle movement"

@router.post("/restore")
async def restore_old_photo(request: RestoreRequest):
    """
    老照片修复接口 (GFPGAN)
    """
    result_url = await ai_service.restore_face(request.imageUrl)
    if not result_url:
        raise HTTPException(status_code=500, detail="照片修复失败，请检查 API 配置")
    return {"success": True, "restoredUrl": result_url}

@router.post("/animate/create")
async def create_animation_task(request: AnimateRequest):
    """
    第一步：创建异步生成任务，立得 taskId
    """
    task_id, error_detail = await ai_service.trigger_animation(request.imageUrl, request.prompt)
    if not task_id:
        raise HTTPException(status_code=500, detail=error_detail or "任务启动失败")
    
    return {"success": True, "taskId": task_id}

@router.get("/animate/status/{task_id}")
async def get_animation_status(task_id: str):
    """
    第二步：由前端/外部轮询状态
    """
    video_url, status, error = await ai_service.check_animation_status(task_id)
    return {
        "status": status, # PENDING, COMPLETE, FAILED
        "videoUrl": video_url,
        "error": error
    }
