
# 1세대
select g3.id ID from ecoli_data g3
join (
    select g2.id from ecoli_data g2
    join (
        select id from ecoli_data
        where parent_id is null
    ) g1 on g1.id = g2.parent_id
) g2 on g2.id = g3.parent_id
order by id asc
;