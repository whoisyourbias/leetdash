select h2.car_id CAR_ID, 
case 
    when t.CAR_ID is null then "대여 가능"
    else
        "대여중"
end AVAILABILITY
from CAR_RENTAL_COMPANY_RENTAL_HISTORY h2
left join (
    SELECT
    h1.CAR_ID, h1.history_id
    from CAR_RENTAL_COMPANY_RENTAL_HISTORY h1
    where 
    h1.start_date <= "2022-10-16"
    and h1.end_date >= "2022-10-16"
) t on h2.car_id = t.CAR_ID
group by h2.car_id
order by h2.car_id desc;