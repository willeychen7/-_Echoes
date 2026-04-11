import os
import requests
from datetime import datetime
from lunar_python import Lunar, Solar
from typing import List, Optional
from app.repository.supabase_repo import SupabaseRepository
from app.schema.models import AlmanacResponse

class AlmanacService:
    @staticmethod
    async def get_almanac(date_str: str, family_id: str = None) -> AlmanacResponse:
        """
        获取公历日期对应的黄历信息
        :param date_str: ISO 8601 格式日期 (YYYY-MM-DD)
        :param family_id: 家族 ID
        """
        try:
            dt = datetime.strptime(date_str, "%Y-%m-%d")
        except ValueError:
            dt = datetime.now()
        
        # 1. 优先尝试从聚合数据获取 (如果配置了 JUHE_KEY)
        juhe_key = os.getenv("JUHE_KEY")
        juhe_data = None
        if juhe_key:
            try:
                # 聚合数据 老黄历 API
                url = f"http://v.juhe.cn/laohuangli/d?date={date_str}&key={juhe_key}"
                response = requests.get(url, timeout=3)
                if response.status_code == 200:
                    res_json = response.json()
                    if res_json.get("error_code") == 0:
                        juhe_data = res_json.get("result", {})
            except Exception as e:
                print(f"[ALMANAC] Juhe API Error: {e}")

        # 2. 基础日历数据 (使用 lunar-python)
        solar = Solar.fromYmd(dt.year, dt.month, dt.day)
        lunar = Lunar.fromSolar(solar)

        # 宜/忌
        if juhe_data:
            yi = juhe_data.get("yi", "").split(". ") if juhe_data.get("yi") else []
            ji = juhe_data.get("ji", "").split(". ") if juhe_data.get("ji") else []
        else:
            yi = lunar.getDayYi()
            ji = lunar.getDayJi()

        # 3. 家族洞察与大事记匹配
        family_events = []
        family_insight = "岁月静好，记录家族点滴。"
        
        if family_id and family_id.strip():
            try:
                repo = SupabaseRepository()
                # 获取该家族的所有成员
                members = await repo.get_family_members(family_id)
                # 获取该家族的所有大事记
                events = await repo.get_events(family_id)
                
                # 匹配生日
                for m in members:
                    if m.birthday:
                        try:
                            bday = datetime.strptime(m.birthday, "%Y-%m-%d")
                            if bday.month == dt.month and bday.day == dt.day:
                                family_events.append(f"今天是 {m.name} 的生日")
                        except:
                            pass
                
                # 匹配大事记
                for e in events:
                    try:
                        edate = datetime.strptime(e.date, "%Y-%m-%d")
                        if edate.month == dt.month and edate.day == dt.day:
                            family_events.append(f"纪念日: {e.title}")
                    except:
                        pass
                
                # AI 解读 (基于宜忌和事件的规则引擎)
                family_insight = AlmanacService._generate_family_insight(yi, family_events)
                
            except Exception as e:
                print(f"[ALMANAC] Family Event matching error: {e}")

        return AlmanacResponse(
            solar_date=date_str,
            solar_year=dt.year,
            solar_month=dt.month,
            solar_day=dt.day,
            lunar_month_name=f"{lunar.getMonthInChinese()}月",
            lunar_day_name=lunar.getDayInChinese(),
            lunar_year_gz=f"{lunar.getYearInGanZhi()}({lunar.getYearShengXiao()})年",
            lunar_month_gz=f"{lunar.getMonthInGanZhi()}月",
            lunar_day_gz=f"{lunar.getDayInGanZhi()}日",
            is_lucky_day=lunar.getDayTianShenLuck() == "黄道",
            yi=yi if yi else ["扫舍", "祭祀", "沐浴"], # Fallback
            ji=ji if ji else ["开市", "入宅", "破土"], # Fallback
            week_day=f"星期{['日', '一', '二', '三', '四', '五', '六'][dt.weekday()+1 % 7]}",
            family_insight=family_insight,
            family_events=family_events
        )

    @staticmethod
    def _generate_family_insight(yi: List[str], family_events: List[str]) -> str:
        """
        深度融合宜忌与家族大事记生成寄语
        """
        # 基础寄语库 (增加随机性)
        base_insights = [
            "岁月虽然平凡，但记录下的每一刻都是对生活的致敬。",
            "翻开家族的记忆档案，每张笑颜都是时光最美的注脚。",
            "日子慢些走，让这份温情在家族的血脉里细水长流。"
        ]
        import random
        base = random.choice(base_insights)

        if family_events:
            event_desc = "、".join(family_events)
            # 融合案例 1：祭祀/祈福 + 大事记
            if "祭祀" in yi or "祈福" in yi:
                return f"今日宜祈福祭祖，恰逢家族大事：{event_desc}。在岁月的交叠中，这份传承更显厚重珍贵。"
            # 融合案例 2：出行 + 大事记
            if "出行" in yi:
                return f"今日宜出行，正值家中有事：{event_desc}。迈出门槛去见见亲人吧，在这个值得纪念的日子里。"
            # 通用融合
            return f"今日是家族的重要时刻：{event_desc}。{base}"

        # 仅基于宜忌的深度融合
        if "祭祀" in yi or "祈福" in yi:
            return "今日宜祈福祭祖。翻开家族旧影，在岁月的余温中感受那份一脉相承的力量。"
        if "移徙" in yi or "入宅" in yi:
            return "今日宜归家团聚，洒扫庭除。为家添一份新鲜感，让岁月在整洁中焕发新意。"
        if "嫁娶" in yi or "纳采" in yi:
            return "今日良缘相宜。岁月见证了家族一代代的爱与责任，愿这份幸福在今日长久停留。"
        if "沐浴" in yi or "扫舍" in yi:
            return "今日适合净心扫舍，修整身心。在平凡的劳作中，寻回那份最简单的家庭快乐。"
        if "出行" in yi:
            return "今日适合出门走动。去探望久违的亲朋，让这份牵挂在当面的问候中变得滚烫。"

        return f"今日宜守静致远。{base}"



