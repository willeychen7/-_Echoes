import os
import replicate
from dotenv import load_dotenv

def diagnostic():
    load_dotenv()
    token = os.getenv("REPLICATE_API_TOKEN")
    
    print("--- AI 系统诊断报告 ---")
    print(f"1. 密钥检测: {'已找到' if token else '未找到'}")
    if token:
        print(f"   密钥前缀: {token[:10]}...")
    
    try:
        print("2. 尝试连接 Replicate...")
        # 尝试列出一个知名的模型来测试连接性
        model = replicate.models.get("tencentarc/gfpgan")
        print(f"   成功连接！找到模型: {model.name}")
        
        print("3. 测试简单修复任务 (Dry Run)...")
        # 使用一张测试图进行极简测试
        # 这一步会实际消耗极少量的额度，但能最真实地反馈问题
        test_img = "https://replicate.delivery/mgxm/59d9390c-b415-47e0-a907-f81b0d9920f1/187400315-87a90ac9-d231-45d6-b377-38702bd1838f.jpg"
        output = replicate.run(
            "tencentarc/gfpgan:0fbacf7afc6c144e5be9767cff80f25aff23e52b0708f17e20f9879b2f21516c",
            input={"img": test_img}
        )
        print(f"   修复任务启动成功！输出结果预览: {output}")
        print("--- 诊断结论: 后端链路一切正常 ---")
        
    except Exception as e:
        print(f"!!! 诊断失败 !!!")
        print(f"错误详情: {str(e)}")
        if "401" in str(e):
             print("建议: 密钥 (Token) 可能无效或已过期。")
        elif "404" in str(e):
             print("建议: 模型 ID 可能已更改或权限不足。")

if __name__ == "__main__":
    diagnostic()
