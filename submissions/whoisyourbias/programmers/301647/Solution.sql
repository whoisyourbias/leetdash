-- 코드를 작성해주세요
select ed.id ID, ed.genotype GENOTYPE, parent.genotype PARENT_GENOTYPE
from ECOLI_DATA ed
left join ECOLI_DATA parent
on ed.parent_id = parent.id
where ed.genotype & parent.genotype = parent.genotype
and ed.parent_id is not null
order by ed.id asc;