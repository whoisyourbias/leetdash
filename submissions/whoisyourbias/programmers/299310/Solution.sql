select 
max_per_year.year YEAR, max_per_year.MAX_SIZE - ed.size_of_colony YEAR_DEV, ed.id ID
from ECOLI_DATA ed
join (
    select year(DIFFERENTIATION_DATE) year, max(size_of_colony) MAX_SIZE
    from ecoli_data
    group by year(DIFFERENTIATION_DATE)
) max_per_year
on year(ed.DIFFERENTIATION_DATE) = max_per_year.year
order by max_per_year.year asc,
YEAR_DEV asc;