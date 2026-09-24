-- 코드를 작성해주세요
select count(*) FISH_COUNT
from FISH_INFO fi
left join FISH_NAME_INFO fni
on fi.FISH_TYPE = fni.FISH_TYPE
where fni.FISH_NAME = "BASS" 
or fni.FISH_NAME = "SNAPPER";