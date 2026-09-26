-- 코드를 입력하세요

SELECT 
author.AUTHOR_ID,
author.AUTHOR_NAME,
book.CATEGORY,
sum(sales * book.price) TOTAL_SALES
from book_sales
    join book 
        on book.book_id = book_sales.book_id
    join author
        on book.author_id = author.author_id
where sales_date like "2022-01%"
group by book.author_id, book.category
order by author.author_id , book.category desc
;