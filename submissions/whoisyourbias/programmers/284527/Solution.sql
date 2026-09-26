select 
sum(score) SCORE, hr_grade.EMP_NO, EMP_NAME, POSITION, EMAIL
from hr_grade
join hr_employees on hr_grade.emp_no = hr_employees.emp_no
group by emp_no
order by sum(score) desc
limit 1