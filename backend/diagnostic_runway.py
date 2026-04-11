import os
from dotenv import load_dotenv
from runwayml import RunwayML
import time

def diagnostic_runway():
    load_dotenv()
    api_key = os.getenv("RUNWAYML_API_KEY")
    
    print("--- Runway 系统诊断报告 ---")
    print(f"1. 密钥检测: {'已找到' if api_key else '未找到'}")
    
    if not api_key: return

    client = RunwayML(api_key=api_key)
    
    try:
        print("2. 尝试提交极简生成任务...")
        # 使用一张公网测试图
        test_img = "https://replicate.delivery/mgxm/59d9390c-b415-47e0-a907-f81b0d9920f1/187400315-87a90ac9-d231-45d6-b377-38702bd1838f.jpg"
        
        # 测试是否存在参数名问题
        try:
            task = client.image_to_video.create(
                model='gen3a_turbo',
                prompt_image=test_img,
                prompt_text="A cinematic memory, slow zoom"
            )
            print(f"   成功启动！任务 ID: {task.id}")
            
            print("3. 测试状态查询...")
            status = client.tasks.retrieve(task.id)
            print(f"   状态正常: {status.status}")
            
        except Exception as e:
            print(f"!!! 任务提交失败 !!!")
            print(f"具体错误: {str(e)}")
            print("这通常是由于参数名 (prompt_image vs image) 或模型权限引起。")

    except Exception as e:
        print(f"!!! 连接失败 !!!")
        print(f"错误详情: {str(e)}")

if __name__ == "__main__":
    diagnostic_runway()
