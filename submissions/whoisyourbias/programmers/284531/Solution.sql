-- 코드를 작성해주세요
select 
sd.ROUTE,
concat(ROUND(sum(sd.D_BETWEEN_DIST), 1),'km') TOTAL_DISTANCE,
concat(ROUND(avg(sd.D_BETWEEN_DIST), 2),'km') AVERAGE_DISTANCE
from SUBWAY_DISTANCE as sd
group by sd.ROUTE
order by sum(sd.D_BETWEEN_DIST) desc