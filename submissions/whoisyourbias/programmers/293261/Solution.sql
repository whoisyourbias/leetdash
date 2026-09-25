select fi.ID, fni.FISH_NAME, m.max_length LENGTH
from fish_info fi
left join fish_name_info fni
on fi.fish_type = fni.fish_type
 join (
    select max(length) max_length, fish_type
    from fish_info
    group by fish_type
) m
on m.fish_type = fi.fish_type
and fi.length = m.max_length
order by fi.id asc;