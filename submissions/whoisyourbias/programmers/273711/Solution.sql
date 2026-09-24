SELECT ii.ITEM_ID ITEM_ID, ii.ITEM_NAME ITEM_NAME, ii.RARITY RARITY
FROM ITEM_TREE it
left join ITEM_INFO ii
on it.ITEM_ID = ii.ITEM_ID
right join ITEM_INFO pi
on it.PARENT_ITEM_ID = pi.ITEM_ID
where it.PARENT_ITEM_ID is not null
and pi.RARITY = "RARE"
order by ITEM_ID desc;