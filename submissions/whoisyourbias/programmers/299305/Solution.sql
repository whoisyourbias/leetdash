-- 코드를 작성해주세요
select 
ed.ID,
(select count(*) from ECOLI_DATA child where ed.id = child.parent_id) CHILD_COUNT
from ECOLI_DATA ed