-- 코드를 작성해주세요
select @python := code from SKILLCODES where NAME = "Python";
select @c := code from SKILLCODES where NAME = "C#";

select
ID, EMAIL, FIRST_NAME, LAST_NAME
from developers
where 
((SKILL_CODE & @python) = @python) or
((SKILL_CODE & @c) = @c)
order by ID asc;