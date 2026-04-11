import os
import httpx
import anyio
from typing import Optional, List, Dict, Any
from dotenv import load_dotenv
import json

load_dotenv()

class AIService:
    def __init__(self):
        self.replicate_api_token = os.getenv("REPLICATE_API_TOKEN")
        self.leonardo_api_key = os.getenv("LEONARDO_API_KEY")
        self.leonardo_base_url = "https://cloud.leonardo.ai/api/rest/v1"

    async def restore_face(self, image_url: str) -> Optional[str]:
        """
        修复模糊的老照片人脸
        """
        if not self.replicate_api_token:
            return None

        headers = {
            "Authorization": f"Token {self.replicate_api_token}",
            "Content-Type": "application/json"
        }

        # 使用 TencentARC/GFPGAN 进行人脸修复
        payload = {
            "version": "9283608cc6b7be6b65184e1a63f12f611174073606fd365029a997d81206f470",
            "input": {
                "img": image_url,
                "upscale": 2
            }
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                # 提交任务
                resp = await client.post(
                    "https://api.replicate.com/v1/predictions",
                    json=payload,
                    headers=headers
                )
                prediction = resp.json()
                predict_url = prediction.get("urls", {}).get("get")

                # 轮询直到完成
                for _ in range(30):
                    await anyio.sleep(2)
                    status_resp = await client.get(predict_url, headers=headers)
                    status_data = status_resp.json()
                    if status_data.get("status") == "succeeded":
                        return status_data.get("output")
                    if status_data.get("status") == "failed":
                        return None
                return None
            except Exception as e:
                print(f"GFPGAN Error: {str(e)}")
                return None

    async def trigger_animation(self, image_url: str, prompt: str = "") -> tuple[Optional[str], Optional[str]]:
        """
        触发异步生成任务 (只扣一次费)
        """
        headers = {
            "accept": "application/json",
            "content-type": "application/json",
            "authorization": f"Bearer {self.leonardo_api_key}"
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                # 1. Init Upload
                init_resp = await client.post(
                    f"{self.leonardo_base_url}/init-image",
                    json={"extension": "jpg"},
                    headers=headers
                )
                init_data = init_resp.json()
                if init_resp.status_code != 200:
                    return None, f"Leonardo Init Error: {init_data.get('error', init_resp.status_code)}"
                
                upload_data = init_data.get("uploadInitImage", {})
                image_id = upload_data.get("id")
                upload_url = upload_data.get("url")
                fields = upload_data.get("fields") 
                
                # 2. Upload to S3
                async with httpx.AsyncClient() as dl_client:
                    img_resp = await dl_client.get(image_url)
                    img_data = img_resp.content
                
                form_data = json.loads(fields) if isinstance(fields, str) else fields
                upload_post_resp = await client.post(upload_url, data=form_data, files={"file": img_data})
                if upload_post_resp.status_code not in [200, 201, 204]:
                    return None, f"S3 Upload Error: {upload_post_resp.status_code}"

                # 3. Start Motion
                motion_data = {
                    "prompt": prompt if prompt else "A cinematic memory, subtle movement",
                    "imageId": image_id,
                    "imageType": "UPLOADED",
                    "model": "KLING2_5",
                    "duration": 5
                }
                
                response = await client.post(
                    f"{self.leonardo_base_url}/generations-image-to-video",
                    json=motion_data,
                    headers=headers
                )
                
                resp_data = response.json()
                if response.status_code != 200:
                    return None, f"Generation Error: {resp_data.get('error', response.status_code)}"
                
                job_id = resp_data.get("motionVideoGenerationJob", {}).get("generationId")
                if not job_id:
                    job_id = resp_data.get("sdGenerationJob", {}).get("generationId")
                
                return job_id, None

            except Exception as e:
                return None, f"System Error: {str(e)}"

    async def check_animation_status(self, task_id: str) -> tuple[Optional[str], str, Optional[str]]:
        """
        只读状态查询 (不扣费)
        """
        if not self.leonardo_api_key:
            return None, "ERROR", "API Key Missing"

        headers = {
            "accept": "application/json",
            "authorization": f"Bearer {self.leonardo_api_key}"
        }

        async with httpx.AsyncClient(timeout=20.0) as client:
            try:
                status_resp = await client.get(
                    f"{self.leonardo_base_url}/generations/{task_id}",
                    headers=headers
                )
                status_data = status_resp.json()
                
                generation = status_data.get("generations_by_pk")
                if not generation:
                    gens = status_data.get("generations", [])
                    generation = gens[0] if gens else {}
                
                status = generation.get("status", "PENDING")
                if status == "COMPLETE":
                    imgs = generation.get("generated_images", [])
                    video_url = imgs[0].get("motionUrl") if imgs else None
                    if not video_url and imgs:
                        video_url = imgs[0].get("url") # 兜底
                    
                    if video_url:
                        return video_url, "COMPLETE", None
                    return None, "FAILED", "Video URL missing in response"
                elif status == "FAILED":
                    return None, "FAILED", "Leonardo task failed"
                
                return None, "PENDING", None
            except Exception as e:
                return None, "ERROR", str(e)

ai_service = AIService()
