select count(*) from (
select name, row_number() over (order by name desc) from animal_ins
where name is not null
group by name
    ) t