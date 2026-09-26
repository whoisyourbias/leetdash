with app as (
    select
        id,
        fish_type,
        time,
        case 
            when length <= 10 then 10
            when length is null then 10
        else length
    end as length
    from fish_info
)
select
count(id) as FISH_COUNT,
max(length) as MAX_LENGTH,
FISH_TYPE
from app
group by fish_type
having avg(length) >= 33
order by fish_type asc
;