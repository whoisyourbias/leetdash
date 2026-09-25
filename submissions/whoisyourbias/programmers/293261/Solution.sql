select fi.ID, fni.FISH_NAME, fi.LENGTH
from fish_info fi
left join fish_name_info fni
on fi.fish_type = fni.fish_type
where fi.length = (
    select max(fii.length) from fish_info fii
    where fii.fish_type = fi.fish_type
)
order by fi.id asc;