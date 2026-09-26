-- grade a -> (frontend 중 1) and python
-- b -> c#
-- c -> frontend 중 1

with Python as (
    select code
    from skillcodes
    where name = 'Python'
),
FrontEndSum as (
    select sum(code) s
    from skillcodes
    where category = 'Front End'
),
Csharp as (
    select code
    from skillcodes
    where name = 'C#'
),
Grades as (
    select 
        case
            when d.skill_code & (select code from Python) = (select code from Python)
                and (
                    ((d.skill_code - (select code from Python)) & (select s from FrontEndSum)) 
                    > 0
                )
            then 'A'
            when d.skill_code & (select code from Csharp) = (select code from Csharp)
            then 'B'
            when (d.skill_code & (select s from FrontEndSum) > 0)
            then 'C'
        else
            NULL
        end as GRADE,
        d.ID,
        d.EMAIL
    from developers d
)

select GRADE, ID, EMAIL
from grades
where GRADE is not null
order by GRADe, ID