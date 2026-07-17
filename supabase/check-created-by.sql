-- Privacy scoping relies on requests.created_by_id being set. Older requests
-- created before this was enforced may have it NULL, which would hide them
-- from their own author too. Run this to see if any are affected:
select count(*) as requests_missing_owner
from requests
where created_by_id is null;

-- If the count above is greater than 0, you can map them back to their author
-- by matching the requestor/created_by name to the staff table:
--   update requests r
--   set created_by_id = s.id
--   from staff s
--   where r.created_by_id is null
--     and (r.created_by = s.name or r.requestor = s.name);
