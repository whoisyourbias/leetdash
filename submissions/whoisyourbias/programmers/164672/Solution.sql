-- 코드를 입력하세요
SELECT 
B.BOARD_ID,
B.WRITER_ID,
B.TITLE,
B.PRICE,
case B.STATUS
    when 'SALE' then '판매중'
    when 'RESERVED' then '예약중'
    else '거래완료'
    end STATUS
FROM USED_GOODS_BOARD B
WHERE B.CREATED_DATE = "2022-10-05"
ORDER BY BOARD_ID desc