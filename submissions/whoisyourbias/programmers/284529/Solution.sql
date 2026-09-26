-- 코드를 작성해주세요

select
e.DEPT_ID,
dp.DEPT_NAME_EN,
round(avg(e.sal), 0) AVG_SAL
from hr_employees e
left join hr_department dp
on e.dept_id = dp.dept_id
group by e.dept_id
order by AVG_SAL desc