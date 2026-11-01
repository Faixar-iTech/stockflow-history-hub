<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Stockroom (the inventory app) is single-tenant with no authentication, migrated as-is from the source ASP.NET/React archive. All tables (`products`, `stock_movements`) are fully public with permissive anon RLS policies; do not add auth gates or owner scoping unless the user asks for logins.
