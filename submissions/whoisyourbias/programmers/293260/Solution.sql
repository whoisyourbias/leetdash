-- 코드를 작성해주세요
select count(id) FISH_COUNT, month(TIME) MONTH
from FISH_INFO
group by MONTH(TIME)
order by MONTH asc