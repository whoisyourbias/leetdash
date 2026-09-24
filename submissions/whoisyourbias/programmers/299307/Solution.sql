select id,
CASE 
    WHEN SIZE_OF_COLONY <= 100 THEN "LOW"
    WHEN SIZE_OF_COLONY <= 1000 THEN "MEDIUM"
    ELSE "HIGH"
END as size
from ECOLI_DATA
order by id asc;