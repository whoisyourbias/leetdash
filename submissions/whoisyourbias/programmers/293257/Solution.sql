-- 코드를 작성해주세요
select count(fish_info.fish_type) FISH_COUNT, FISH_NAME
from fish_info
left join fish_name_info
on fish_info.fish_type = fish_name_info.fish_type
group by fish_info.fish_type
order by FISH_COUNT desc;