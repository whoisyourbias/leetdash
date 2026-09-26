-- 코드를 작성해주세요
with EMP_B_P as (
select emp_no,
    case
        when avg(score) >= 96 then 0.2
        when avg(score) >= 90 then 0.15
        when avg(score) >=80 then 0.1
        else
            0.0
    end as bonus_p,
    case
        when avg(score) >= 96 then 'S'
        when avg(score) >= 90 then 'A'
        when avg(score) >=80 then 'B'
        else
            'C'
    end as grade
from hr_grade
group by emp_no
)

select 
e.EMP_NO, 
e.EMP_NAME, 
b.grade GRADE, 
e.SAL * b.bonus_p BONUS
from hr_employees e
join  EMP_B_P b on e.emp_no = b.emp_no
order by e.EMP_NO asc;