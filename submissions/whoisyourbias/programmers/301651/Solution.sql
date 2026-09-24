with recursive g as (
    select id, 1 as generation
    from ecoli_data
    where parent_id is null
    union all
    
    select ed.id, g.generation + 1
    from ecoli_data ed
    join g on g.id = ed.parent_id
)
select count(g.id) COUNT, generation as GENERATION
from g
where NOT EXISTS (
    select 1
    from ecoli_data child
    where child.parent_id = g.id
)
group by GENERATION
order by generation;