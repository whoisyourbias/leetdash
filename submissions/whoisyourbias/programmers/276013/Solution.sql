-- 코드를 작성해주세요



select
di.ID ID,
di.email EMAIL,
di.first_name FIRST_NAME,
di.last_name LAST_NAME
from
developer_infos di
where di.SKILL_1 = "Python"
or di.SKILL_2 ="Python"
or di.SKILL_3 = "Python"
order by ID asc;