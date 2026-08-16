-- USD is the only application currency for new operations in the MVP.
-- Financial history keeps its original currency and is intentionally untouched.
update public.profiles
set preferred_currency = 'USD'
where preferred_currency <> 'USD';
