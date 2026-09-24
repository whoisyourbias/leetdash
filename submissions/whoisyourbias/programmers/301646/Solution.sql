-- 코드를 작성해주세요
select count(*) as COUNT
from ECOLI_DATA ed
where ed.GENOTYPE & 2 != 2 
and (ed.GENOTYPE & 1 = 1 or ed.GENOTYPE & 4 = 4)